import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 인증 확인 - 관리자만 실행 가능
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 관리자 권한 확인
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // wiki_entry_id가 있는 모든 fanz_tokens 조회
    const { data: fanzTokens, error: tokensError } = await supabase
      .from('fanz_tokens')
      .select('wiki_entry_id')
      .not('wiki_entry_id', 'is', null);

    if (tokensError) {
      throw new Error(`Failed to fetch fanz tokens: ${tokensError.message}`);
    }

    console.log(`Found ${fanzTokens?.length || 0} fanz tokens with wiki entries`);

    const results = {
      checked: 0,
      created: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // 각 wiki_entry_id에 대해 community_naming 제안이 있는지 확인
    for (const token of fanzTokens || []) {
      results.checked++;
      const wikiEntryId = token.wiki_entry_id;

      // 이미 community_naming 제안이 있는지 확인
      const { data: existingProposal } = await supabase
        .from('support_proposals')
        .select('id')
        .eq('wiki_entry_id', wikiEntryId)
        .eq('proposal_category', 'community_naming')
        .limit(1)
        .single();

      if (existingProposal) {
        console.log(`Skipping ${wikiEntryId} - already has naming proposal`);
        results.skipped++;
        continue;
      }

      // wiki entry 정보 조회
      const { data: wikiEntry, error: entryError } = await supabase
        .from('wiki_entries')
        .select('title, community_name')
        .eq('id', wikiEntryId)
        .single();

      if (entryError || !wikiEntry) {
        console.error(`Failed to fetch wiki entry ${wikiEntryId}: ${entryError?.message}`);
        results.errors.push(`Wiki entry ${wikiEntryId} not found`);
        continue;
      }

      // 이미 community_name이 설정되어 있으면 스킵
      if (wikiEntry.community_name) {
        console.log(`Skipping ${wikiEntryId} - already has community name: ${wikiEntry.community_name}`);
        results.skipped++;
        continue;
      }

      // 1달 후 종료되는 커뮤니티 네이밍 제안 생성
      const votingEndAt = new Date();
      votingEndAt.setMonth(votingEndAt.getMonth() + 1);

      const { error: proposalError } = await supabase
        .from('support_proposals')
        .insert({
          wiki_entry_id: wikiEntryId,
          proposer_id: user.id, // 실행한 관리자 ID (시스템 역할)
          title: `What should we call ${wikiEntry.title} fans?`,
          description: `Let's decide on the official fandom name for ${wikiEntry.title}! Share your creative ideas and vote for your favorite. The selected name will be displayed across the platform.`,
          proposal_type: 'discussion',
          proposal_format: 'discussion',
          proposal_category: 'community_naming',
          voting_end_at: votingEndAt.toISOString(),
          quorum_threshold: 1,
          pass_threshold: 50,
          status: 'voting',
          min_lightstick_required: 0,
        });

      if (proposalError) {
        console.error(`Failed to create proposal for ${wikiEntryId}: ${proposalError.message}`);
        results.errors.push(`Failed to create proposal for ${wikiEntryId}: ${proposalError.message}`);
        continue;
      }

      console.log(`Created naming proposal for ${wikiEntry.title} (${wikiEntryId})`);
      results.created++;
    }

    console.log('Backfill complete:', results);

    return new Response(JSON.stringify({
      success: true,
      message: `Checked ${results.checked} entries, created ${results.created} proposals, skipped ${results.skipped}`,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Backfill error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
