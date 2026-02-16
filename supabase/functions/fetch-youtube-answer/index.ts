import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// YouTube에서 video ID 추출
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// YouTube API로 비디오 정보 가져오기
async function fetchYoutubeStats(videoId: string, apiKey: string) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoId}&key=${apiKey}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.items || data.items.length === 0) {
    throw new Error('Video not found');
  }
  
  const video = data.items[0];
  return {
    videoId,
    title: video.snippet?.title || '',
    channelTitle: video.snippet?.channelTitle || '',
    viewCount: parseInt(video.statistics?.viewCount || '0', 10),
    likeCount: video.statistics?.likeCount ? parseInt(video.statistics.likeCount, 10) : null,
    commentCount: video.statistics?.commentCount ? parseInt(video.statistics.commentCount, 10) : null,
    fetchedAt: new Date().toISOString(),
  };
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
    if (!YOUTUBE_API_KEY) {
      throw new Error('YOUTUBE_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    console.log(`[fetch-youtube-answer] Running at ${now.toISOString()}`);

    // answer_fetch_time이 지났지만 correct_answer가 비어있는 YouTube 챌린지 찾기
    const { data: pendingChallenges, error: fetchError } = await supabase
      .from('challenges')
      .select('id, question, options, answer_fetch_time')
      .lte('answer_fetch_time', now.toISOString())
      .eq('correct_answer', '')
      .eq('status', 'active');

    if (fetchError) {
      throw fetchError;
    }

    if (!pendingChallenges || pendingChallenges.length === 0) {
      console.log('[fetch-youtube-answer] No pending YouTube challenges found');
      return new Response(
        JSON.stringify({ success: true, message: 'No pending challenges', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fetch-youtube-answer] Found ${pendingChallenges.length} pending challenge(s)`);

    let processed = 0;
    const results = [];

    for (const challenge of pendingChallenges) {
      try {
        const options = challenge.options as any;
        
        // YouTube 챌린지인지 확인
        if (options?.type !== 'youtube') {
          console.log(`[fetch-youtube-answer] Challenge ${challenge.id} is not YouTube type, skipping`);
          continue;
        }

        const videoId = options.youtube_video_id;
        const targetMetric = options.youtube_target_metric || 'viewCount';

        if (!videoId) {
          console.log(`[fetch-youtube-answer] Challenge ${challenge.id} has no video ID, skipping`);
          continue;
        }

        console.log(`[fetch-youtube-answer] Fetching ${targetMetric} for challenge ${challenge.id}, video ${videoId}`);

        // YouTube API로 현재 데이터 가져오기
        const stats = await fetchYoutubeStats(videoId, YOUTUBE_API_KEY);

        // 타겟 메트릭에 따라 정답 결정
        let correctAnswer: number;
        switch (targetMetric) {
          case 'likeCount':
            correctAnswer = stats.likeCount || 0;
            break;
          case 'commentCount':
            correctAnswer = stats.commentCount || 0;
            break;
          case 'viewCount':
          default:
            correctAnswer = stats.viewCount;
            break;
        }

        console.log(`[fetch-youtube-answer] Challenge ${challenge.id}: ${targetMetric} = ${correctAnswer}`);

        // 정답 업데이트
        const { error: updateError } = await supabase
          .from('challenges')
          .update({
            correct_answer: correctAnswer.toString(),
            options: {
              ...options,
              youtube_final_views: stats.viewCount,
              youtube_final_likes: stats.likeCount,
              youtube_final_comments: stats.commentCount,
              youtube_answer_fetched_at: stats.fetchedAt,
            },
          })
          .eq('id', challenge.id);

        if (updateError) {
          console.error(`[fetch-youtube-answer] Failed to update challenge ${challenge.id}:`, updateError);
          results.push({ id: challenge.id, success: false, error: updateError.message });
        } else {
          console.log(`[fetch-youtube-answer] Successfully updated challenge ${challenge.id} with answer: ${correctAnswer}`);
          
          // 정답 설정 후 자동으로 당첨자 선정 트리거
          try {
            console.log(`[fetch-youtube-answer] Triggering winner selection for challenge ${challenge.id}`);
            const selectResponse = await fetch(
              `${supabaseUrl}/functions/v1/select-challenge-winners`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({ challengeId: challenge.id, preview: false }),
              }
            );
            
            const selectResult = await selectResponse.json();
            if (selectResult.success) {
              console.log(`[fetch-youtube-answer] Winners selected for challenge ${challenge.id}: ${selectResult.winners?.length || 0} winners`);
            } else {
              console.log(`[fetch-youtube-answer] Winner selection result for challenge ${challenge.id}:`, selectResult.error || selectResult.message);
            }
          } catch (selectErr: any) {
            console.error(`[fetch-youtube-answer] Failed to trigger winner selection for challenge ${challenge.id}:`, selectErr.message);
          }
          
          results.push({ 
            id: challenge.id, 
            success: true, 
            metric: targetMetric,
            answer: correctAnswer,
            fetchedAt: stats.fetchedAt,
            winnersTriggered: true
          });
          processed++;
        }
      } catch (err: any) {
        console.error(`[fetch-youtube-answer] Error processing challenge ${challenge.id}:`, err);
        results.push({ id: challenge.id, success: false, error: err.message });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${processed} challenge(s)`,
        processed,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[fetch-youtube-answer] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
