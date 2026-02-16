import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EvaluationCriteria {
  minVotes: number;
  minViewCount: number;
  minContentLength: number;
}

// 콘텐츠 품질 평가 기준
const QUALITY_CRITERIA = {
  post: {
    minVotes: 10,      // 최소 10 업보트
    minViewCount: 50,  // 최소 50 조회수
    minContentLength: 100, // 최소 100자
  },
  wiki: {
    minVotes: 5,       // 최소 5 업보트
    minViewCount: 100, // 최소 100 조회수
    minContentLength: 200, // 최소 200자
  }
};

// 품질 점수 계산
function calculateQualityScore(content: any, type: 'post' | 'wiki'): number {
  const criteria = QUALITY_CRITERIA[type];
  let score = 0;
  
  // 투표 점수 (0-40점)
  const voteScore = Math.min((content.votes / criteria.minVotes) * 40, 40);
  score += voteScore;
  
  // 조회수 점수 (0-30점)
  const viewScore = Math.min((content.view_count / criteria.minViewCount) * 30, 30);
  score += viewScore;
  
  // 콘텐츠 길이 점수 (0-30점)
  const contentLength = content.content?.length || 0;
  const lengthScore = Math.min((contentLength / criteria.minContentLength) * 30, 30);
  score += lengthScore;
  
  return Math.round(score);
}

// 포스트 평가 및 등록
async function evaluatePosts(supabase: any) {
  console.log('Evaluating posts for AI training data...');
  
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .gte('votes', QUALITY_CRITERIA.post.minVotes)
    .gte('view_count', QUALITY_CRITERIA.post.minViewCount)
    .eq('is_approved', true);
  
  if (error) {
    console.error('Error fetching posts:', error);
    return { processed: 0, errors: 1 };
  }
  
  let processed = 0;
  let errors = 0;
  
  for (const post of posts || []) {
    // 이미 등록되어 있는지 확인
    const { data: existing } = await supabase
      .from('ai_data_contributions')
      .select('id')
      .eq('content_id', post.id)
      .eq('content_type', 'post')
      .single();
    
    if (existing) {
      continue; // 이미 등록됨
    }
    
    // 콘텐츠 길이 체크
    if ((post.content?.length || 0) < QUALITY_CRITERIA.post.minContentLength) {
      continue;
    }
    
    const qualityScore = calculateQualityScore(post, 'post');
    
    // 품질 점수가 60점 이상만 등록
    if (qualityScore >= 60) {
      const { error: insertError } = await supabase
        .from('ai_data_contributions')
        .insert({
          user_id: post.user_id,
          content_type: 'post',
          content_id: post.id,
          contribution_quality_score: qualityScore,
          used_in_training: false,
        });
      
      if (insertError) {
        console.error('Error inserting post contribution:', insertError);
        errors++;
      } else {
        // 포인트 지급
        await supabase.rpc('award_points', {
          user_id_param: post.user_id,
          action_type_param: 'ai_data_accepted',
          reference_id_param: post.id,
        });
        
        // 고품질 보너스 (80점 이상)
        if (qualityScore >= 80) {
          await supabase.rpc('award_points', {
            user_id_param: post.user_id,
            action_type_param: 'ai_data_high_quality',
            reference_id_param: post.id,
          });
        }
        
        processed++;
        console.log(`Registered post ${post.id} with quality score ${qualityScore}`);
      }
    }
  }
  
  return { processed, errors };
}

// 위키 엔트리 평가 및 등록
async function evaluateWikiEntries(supabase: any) {
  console.log('Evaluating wiki entries for AI training data...');
  
  const { data: entries, error } = await supabase
    .from('wiki_entries')
    .select('*')
    .gte('votes', QUALITY_CRITERIA.wiki.minVotes)
    .gte('view_count', QUALITY_CRITERIA.wiki.minViewCount)
    .eq('is_verified', true);
  
  if (error) {
    console.error('Error fetching wiki entries:', error);
    return { processed: 0, errors: 1 };
  }
  
  let processed = 0;
  let errors = 0;
  
  for (const entry of entries || []) {
    // 이미 등록되어 있는지 확인
    const { data: existing } = await supabase
      .from('ai_data_contributions')
      .select('id')
      .eq('content_id', entry.id)
      .eq('content_type', 'wiki_entry')
      .single();
    
    if (existing) {
      continue; // 이미 등록됨
    }
    
    // 콘텐츠 길이 체크
    if ((entry.content?.length || 0) < QUALITY_CRITERIA.wiki.minContentLength) {
      continue;
    }
    
    const qualityScore = calculateQualityScore(entry, 'wiki');
    
    // 품질 점수가 60점 이상만 등록
    if (qualityScore >= 60) {
      const { error: insertError } = await supabase
        .from('ai_data_contributions')
        .insert({
          user_id: entry.creator_id,
          content_type: 'wiki_entry',
          content_id: entry.id,
          contribution_quality_score: qualityScore,
          used_in_training: false,
        });
      
      if (insertError) {
        console.error('Error inserting wiki contribution:', insertError);
        errors++;
      } else {
        // 포인트 지급
        await supabase.rpc('award_points', {
          user_id_param: entry.creator_id,
          action_type_param: 'ai_data_accepted',
          reference_id_param: entry.id,
        });
        
        // 고품질 보너스 (80점 이상)
        if (qualityScore >= 80) {
          await supabase.rpc('award_points', {
            user_id_param: entry.creator_id,
            action_type_param: 'ai_data_high_quality',
            reference_id_param: entry.id,
          });
        }
        
        processed++;
        console.log(`Registered wiki entry ${entry.id} with quality score ${qualityScore}`);
      }
    }
  }
  
  return { processed, errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting AI contribution evaluation...');

    // 포스트 평가
    const postResults = await evaluatePosts(supabase);
    console.log(`Posts: ${postResults.processed} processed, ${postResults.errors} errors`);

    // 위키 엔트리 평가
    const wikiResults = await evaluateWikiEntries(supabase);
    console.log(`Wiki entries: ${wikiResults.processed} processed, ${wikiResults.errors} errors`);

    const totalProcessed = postResults.processed + wikiResults.processed;
    const totalErrors = postResults.errors + wikiResults.errors;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Evaluated and registered ${totalProcessed} high-quality contributions`,
        details: {
          posts: postResults,
          wiki_entries: wikiResults,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in evaluate-ai-contributions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
