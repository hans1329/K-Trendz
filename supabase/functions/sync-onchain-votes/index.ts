// 온체인 투표 데이터를 DB 캐시로 동기화하는 Edge Function
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.15.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// KTrendzVote 컨트랙트 ABI
const VOTE_CONTRACT_ABI = [
  "function totalVotes() view returns (uint256)"
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== sync-onchain-votes 시작 ===');

    // 환경변수
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const baseRpcUrl = Deno.env.get('BASE_RPC_URL');
    const voteContractAddress = Deno.env.get('VOTE_CONTRACT_ADDRESS');

    if (!baseRpcUrl) {
      throw new Error('Missing BASE_RPC_URL');
    }

    if (!voteContractAddress) {
      throw new Error('Missing VOTE_CONTRACT_ADDRESS');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 요청에서 특정 event_id를 받을 수 있음 (없으면 활성 이벤트 전체 동기화)
    let eventId: string | null = null;
    try {
      const body = await req.json();
      eventId = body?.eventId || null;
    } catch {
      // body가 없어도 OK
    }

    // 활성 이벤트 조회
    let query = supabase
      .from('special_vote_events')
      .select('id, title')
      .eq('is_active', true);

    if (eventId) {
      query = query.eq('id', eventId);
    }

    const { data: events, error: eventsError } = await query;

    if (eventsError) {
      throw new Error(`Failed to fetch events: ${eventsError.message}`);
    }

    if (!events || events.length === 0) {
      console.log('No active events to sync');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active events',
        synced: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 온체인에서 totalVotes 조회
    const provider = new ethers.JsonRpcProvider(baseRpcUrl);
    const contract = new ethers.Contract(voteContractAddress, VOTE_CONTRACT_ABI, provider);

    const totalVotes = await contract.totalVotes();
    console.log('On-chain totalVotes:', totalVotes.toString());

    // 각 이벤트에 대해 캐시 업데이트
    // 현재는 컨트랙트가 전체 투표수만 추적하므로, 모든 이벤트에 같은 값 저장
    // 향후 이벤트별 분리가 필요하면 컨트랙트 수정 필요
    const results = [];

    for (const event of events) {
      const { error: upsertError } = await supabase
        .from('onchain_vote_cache')
        .upsert({
          event_id: event.id,
          total_votes: Number(totalVotes),
          last_synced_at: new Date().toISOString()
        }, {
          onConflict: 'event_id'
        });

      if (upsertError) {
        console.error(`Failed to upsert cache for event ${event.id}:`, upsertError);
        results.push({ eventId: event.id, success: false, error: upsertError.message });
      } else {
        console.log(`Synced event ${event.id}: ${totalVotes} votes`);
        results.push({ eventId: event.id, success: true, totalVotes: Number(totalVotes) });
      }
    }

    const response = {
      success: true,
      synced: results.filter(r => r.success).length,
      totalVotes: Number(totalVotes),
      results
    };

    console.log('=== sync-onchain-votes 완료 ===', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in sync-onchain-votes:', errorMessage);

    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
