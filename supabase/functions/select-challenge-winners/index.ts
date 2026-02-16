import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.15.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 응원봉 보유자:미보유자 비율 (7:3)
const LIGHTSTICK_RATIO = 0.7;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const baseRpcUrl = Deno.env.get('BASE_RPC_URL') || 'https://mainnet.base.org';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const provider = new ethers.JsonRpcProvider(baseRpcUrl);

    const { challengeId, preview = false, selectedUserIds, selectedExternalIds, previewTargetValue, confirmWinners } = await req.json();

    if (!challengeId) {
      throw new Error('Challenge ID is required');
    }
    
    // 관리자가 선별한 user ID 목록 (없으면 전체 선정) - 레거시 호환
    const adminSelectedIds: string[] | null = selectedUserIds && selectedUserIds.length > 0 ? selectedUserIds : null;
    const adminSelectedExternalIds: string[] | null = selectedExternalIds && selectedExternalIds.length > 0 ? selectedExternalIds : null;
    if (adminSelectedIds) {
      console.log(`Admin selected ${adminSelectedIds.length} internal user(s) for winning (legacy mode)`);
    }
    if (adminSelectedExternalIds) {
      console.log(`Admin selected ${adminSelectedExternalIds.length} external user(s) for winning (legacy mode)`);
    }

    // 1. 챌린지 정보 가져오기
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .maybeSingle();

    if (challengeError || !challenge) {
      throw new Error('Challenge not found');
    }

    // 이미 선정 완료된 경우
    // - admin_approved_at이 없으면 재선정 허용 (사용자에게 아직 공개 안 됨)
    // - 과거 버그/오류로 selected_at만 찍히고(is_winner가 0명) 저장된 당첨자가 없는 케이스도 재실행 허용
    if (challenge.selected_at && !preview) {
      // admin_approved_at이 있으면 이미 사용자에게 공개된 상태 → 재선정 불가
      if (challenge.admin_approved_at) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Winners already approved and published to users',
            selection: {
              block_number: challenge.selection_block_number,
              block_hash: challenge.selection_block_hash,
              seed: challenge.selection_seed,
              selected_at: challenge.selected_at
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // admin_approved_at 없음 → 재선정 허용, 기존 당첨자 리셋
      console.log(`Challenge ${challengeId} has selected_at but not approved yet; resetting existing winners for re-selection`);
      
      // 기존 internal 당첨자 리셋
      const { error: resetInternalError } = await supabase
        .from('challenge_participations')
        .update({ is_winner: false, prize_amount: null })
        .eq('challenge_id', challengeId)
        .eq('is_winner', true);
      
      if (resetInternalError) {
        console.error('Failed to reset internal winners:', resetInternalError);
      }

      // 기존 external 당첨자 리셋
      const { error: resetExternalError } = await supabase
        .from('external_challenge_participations')
        .update({ is_winner: false, prize_amount: null })
        .eq('challenge_id', challengeId)
        .eq('is_winner', true);
      
      if (resetExternalError) {
        console.error('Failed to reset external winners:', resetExternalError);
      }
    }

    // ==========================================
    // confirmWinners 모드: 관리자가 확정한 당첨자 정보를 직접 저장 (새 랜덤 선정 없음)
    // ==========================================
    if (confirmWinners && !preview) {
      console.log('Confirm mode: Saving admin-selected winners directly without new random selection');
      
      const internalWinners = confirmWinners.internal || [];
      const externalWinners = confirmWinners.external || [];
      
      console.log(`Confirming ${internalWinners.length} internal + ${externalWinners.length} external winners`);

      // Internal 당첨자 저장
      for (const winner of internalWinners) {
        const { error: updateError } = await supabase
          .from('challenge_participations')
          .update({
            is_winner: true,
            prize_amount: winner.prize_amount
          })
          .eq('challenge_id', challengeId)
          .eq('user_id', winner.user_id);
        
        if (updateError) {
          console.error(`Failed to update internal winner ${winner.user_id}:`, updateError);
        }
      }

      // External 당첨자 저장
      for (const winner of externalWinners) {
        const { error: updateError } = await supabase
          .from('external_challenge_participations')
          .update({
            is_winner: true,
            prize_amount: winner.prize_amount
          })
          .eq('challenge_id', challengeId)
          .eq('external_wallet_id', winner.external_wallet_id);
        
        if (updateError) {
          console.error(`Failed to update external winner ${winner.external_wallet_id}:`, updateError);
        }
      }

      // 챌린지 상태 업데이트 (selected_at 갱신)
      const { error: challengeUpdateError } = await supabase
        .from('challenges')
        .update({
          selected_at: new Date().toISOString(),
        })
        .eq('id', challengeId);

      if (challengeUpdateError) {
        console.error('Failed to update challenge selected_at:', challengeUpdateError);
      }

      console.log(`Confirm complete: ${internalWinners.length} internal + ${externalWinners.length} external winners saved`);

      // 전체 참여자 온체인 일괄 기록 (fire-and-forget - 타임아웃 방지)
      // record-challenge-onchain은 독립 Edge Function으로 자체 타임아웃 내 실행됨
      try {
        fetch(`${supabaseUrl}/functions/v1/record-challenge-onchain`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ challengeId }),
        }).then(async (res) => {
          try {
            const result = await res.json();
            if (result.success) {
              console.log(`Async onchain recording (confirm): ${result.data?.totalRecorded || 0} participations recorded`);
            } else {
              console.warn('Async onchain recording failed (confirm):', result.error);
            }
          } catch (e) {
            console.warn('Async onchain recording response parse error:', e);
          }
        }).catch((err) => {
          console.error('Async onchain recording trigger error (confirm):', err);
        });
        console.log('Triggered async batch onchain recording (confirm) for challenge:', challengeId);
      } catch (onchainErr) {
        console.error('Failed to trigger onchain recording (confirm, non-blocking):', onchainErr);
      }

      return new Response(
        JSON.stringify({
          success: true,
          winners: internalWinners,
          externalWinners: externalWinners,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 챌린지가 아직 끝나지 않은 경우 (preview 모드는 예외)
    if (!preview && new Date(challenge.end_time) > new Date()) {
      throw new Error('Challenge has not ended yet');
    }

    const options = challenge.options as any;
    // options.type === 'youtube' 또는 options.challenge_type === 'youtube' 둘 다 지원
    const challengeType = options?.type || options?.challenge_type || 'multiple_choice';
    const isYoutubeChallenge = challengeType === 'youtube';

    // 2. 밴된 유저 목록 가져오기
    const { data: bannedUsers, error: bannedError } = await supabase
      .from('user_bans')
      .select('user_id');

    if (bannedError) {
      console.error('Failed to fetch banned users:', bannedError);
    }
    
    const bannedUserIds = new Set((bannedUsers || []).map(b => b.user_id));
    console.log(`Found ${bannedUserIds.size} banned users to exclude from winner selection`);

    // 3. 참여자 목록 가져오기 (K-Trendz 사용자)
    const { data: allParticipationsRaw, error: participationsError } = await supabase
      .from('challenge_participations')
      .select('*')
      .eq('challenge_id', challengeId)
      .order('created_at', { ascending: true });

    if (participationsError) {
      throw new Error('Failed to fetch participations');
    }
    
    // 밴된 유저 제외
    const filteredParticipationsRaw = (allParticipationsRaw || []).filter(
      p => !bannedUserIds.has(p.user_id)
    );
    
    const bannedCount = (allParticipationsRaw?.length || 0) - filteredParticipationsRaw.length;
    if (bannedCount > 0) {
      console.log(`Excluded ${bannedCount} participation(s) from banned users`);
    }

    // 2-1. External wallet 참여자 가져오기 (Frame 사용자)
    const { data: externalParticipationsRaw, error: externalError } = await supabase
      .from('external_challenge_participations')
      .select('*, external_wallet_users(wallet_address, username, display_name, avatar_url), has_lightstick')
      .eq('challenge_id', challengeId)
      .order('created_at', { ascending: true });

    if (externalError) {
      console.error('Failed to fetch external participations:', externalError);
      // External 참여자 없어도 진행
    }

    console.log(`Found ${filteredParticipationsRaw.length} K-Trendz participants (after excluding banned), ${externalParticipationsRaw?.length || 0} external participants`);

    // YouTube 챌린지가 아닌 경우 정답자만 필터링 (대소문자 무시)
    // Preview 모드에서 correct_answer가 비어있으면 정답 필터링 건너뛰기 (전체 참여자 표시)
    let allParticipations = filteredParticipationsRaw;
    let externalParticipations = externalParticipationsRaw || [];
    
    const correctAnswerLower = challenge.correct_answer?.toLowerCase().trim() || '';
    const shouldFilterByAnswer = !isYoutubeChallenge && correctAnswerLower !== '';
    
    // 정답 매칭을 위한 유효한 정답 목록 생성
    // correct_answer가 옵션 ID(숫자)인 경우 해당 옵션의 텍스트도 정답으로 인정
    const validAnswers = new Set<string>([correctAnswerLower]);
    
    if (shouldFilterByAnswer && options?.items && Array.isArray(options.items)) {
      // correct_answer가 숫자인 경우 해당 ID의 옵션 텍스트 추가
      const correctAnswerNum = parseInt(correctAnswerLower, 10);
      if (!isNaN(correctAnswerNum)) {
        const matchingOption = options.items.find((item: any) => 
          item.id === correctAnswerNum || String(item.id) === correctAnswerLower
        );
        if (matchingOption?.text) {
          validAnswers.add(matchingOption.text.toLowerCase().trim());
          console.log(`Added option text "${matchingOption.text}" as valid answer for ID ${correctAnswerLower}`);
        }
      }
      // correct_answer가 텍스트인 경우 해당 텍스트의 옵션 ID도 정답으로 인정
      const matchingOptionByText = options.items.find((item: any) => 
        item.text?.toLowerCase().trim() === correctAnswerLower
      );
      if (matchingOptionByText) {
        validAnswers.add(String(matchingOptionByText.id));
        console.log(`Added option ID "${matchingOptionByText.id}" as valid answer for text ${correctAnswerLower}`);
      }
    }
    
    console.log(`Valid answers for matching: ${Array.from(validAnswers).join(', ')}`);
    
    if (shouldFilterByAnswer) {
      allParticipations = allParticipations.filter(
        p => validAnswers.has(p.answer?.toLowerCase().trim() || '')
      );
      externalParticipations = externalParticipations.filter(
        p => validAnswers.has(p.answer?.toLowerCase().trim() || '')
      );
      console.log(`Filtered by correct answer (case-insensitive): ${allParticipations.length} K-Trendz, ${externalParticipations.length} external matches`);
    } else if (!isYoutubeChallenge && preview) {
      console.log(`Preview mode: correct_answer not set, showing all ${allParticipations.length} K-Trendz + ${externalParticipations.length} external participants`);
    }

    // 통합 참여자 목록 생성 (source 필드로 구분)
    interface UnifiedParticipation {
      id: string;
      user_id?: string;
      external_wallet_id?: string;
      answer: string;
      has_lightstick: boolean;
      created_at: string;
      source: 'internal' | 'external';
      wallet_address?: string;
      _difference?: number;
    }

    let eligibleParticipations: UnifiedParticipation[] = [
      ...allParticipations.map(p => ({
        ...p,
        source: 'internal' as const,
        has_lightstick: p.has_lightstick || false,
      })),
      ...externalParticipations.map(p => ({
        id: p.id,
        external_wallet_id: p.external_wallet_id,
        answer: p.answer,
        has_lightstick: p.has_lightstick || false, // DB에서 가져온 응원봉 보유 여부 사용
        created_at: p.created_at,
        source: 'external' as const,
        wallet_address: p.external_wallet_users?.wallet_address,
      })),
    ];

    // YouTube 챌린지의 경우 근접도 순으로 정렬
    if (isYoutubeChallenge && eligibleParticipations.length > 0) {
      // 답변에서 숫자만 추출하는 헬퍼 함수
      const parseAnswerNumber = (answer: string): number => {
        if (!answer) return NaN;
        // 콤마, 공백 제거하고 숫자만 추출
        let cleaned = answer.replace(/,/g, '').replace(/\s/g, '');
        // 'k' 또는 'K'를 1000으로 변환
        if (/(\d+(?:\.\d+)?)\s*[kK]$/i.test(cleaned)) {
          const match = cleaned.match(/(\d+(?:\.\d+)?)\s*[kK]$/i);
          if (match) return Math.round(parseFloat(match[1]) * 1000);
        }
        // 'million' 또는 'm'을 1000000으로 변환
        if (/(\d+(?:\.\d+)?)\s*(million|m)$/i.test(cleaned)) {
          const match = cleaned.match(/(\d+(?:\.\d+)?)\s*(million|m)$/i);
          if (match) return Math.round(parseFloat(match[1]) * 1000000);
        }
        // 숫자만 추출 (소수점 포함)
        const numMatch = cleaned.match(/^[\d.]+/);
        if (numMatch) {
          return Math.round(parseFloat(numMatch[0]));
        }
        return NaN;
      };

      // 프리뷰 모드에서 previewTargetValue가 있으면 그 값을 사용, 없으면 DB의 correct_answer 사용
      let targetValue: number;
      if (preview && previewTargetValue) {
        targetValue = parseAnswerNumber(previewTargetValue);
        console.log(`YouTube challenge preview: using provided target value ${targetValue}`);
      } else {
        targetValue = parseAnswerNumber(challenge.correct_answer);
        console.log(`YouTube challenge: using DB correct_answer ${targetValue}`);
      }

      // 타겟 값은 반드시 유효한 숫자여야 함
      if (!Number.isFinite(targetValue)) {
        throw new Error('Invalid YouTube target value for winner preview/selection');
      }
      // 근접도 계산 및 정렬 (NaN은 맨 뒤로)
      eligibleParticipations = eligibleParticipations.map(p => {
        const parsedAnswer = parseAnswerNumber(p.answer);
        return {
          ...p,
          _difference: isNaN(parsedAnswer) ? Infinity : Math.abs(parsedAnswer - targetValue)
        };
      }).sort((a, b) => (a._difference || Infinity) - (b._difference || Infinity));
      
      console.log(`YouTube challenge: sorted ${eligibleParticipations.length} participations by proximity to ${targetValue}`);
    }

    // ========================================
    // 중복 제거: 한 사람당 best answer 하나만 유지
    // (internal: user_id, external: external_wallet_id)
    // ========================================
    const seenUserIds = new Set<string>();
    const seenExternalIds = new Set<string>();
    const deduplicatedParticipations: typeof eligibleParticipations = [];
    
    for (const p of eligibleParticipations) {
      if (p.source === 'internal' && p.user_id) {
        if (!seenUserIds.has(p.user_id)) {
          seenUserIds.add(p.user_id);
          deduplicatedParticipations.push(p);
        }
      } else if (p.source === 'external' && p.external_wallet_id) {
        if (!seenExternalIds.has(p.external_wallet_id)) {
          seenExternalIds.add(p.external_wallet_id);
          deduplicatedParticipations.push(p);
        }
      }
    }
    
    const duplicatesRemoved = eligibleParticipations.length - deduplicatedParticipations.length;
    if (duplicatesRemoved > 0) {
      console.log(`Removed ${duplicatesRemoved} duplicate entries (keeping best answer per user)`);
    }
    
    eligibleParticipations = deduplicatedParticipations;

    console.log(`Found ${eligibleParticipations.length} eligible participants (${eligibleParticipations.filter(p => p.source === 'internal').length} K-Trendz, ${eligibleParticipations.filter(p => p.source === 'external').length} external)`);

    if (eligibleParticipations.length === 0) {
      // Preview 모드에서는 DB 업데이트 없이 결과만 반환
      if (preview) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'No eligible participants found',
            winners: [],
            externalWinners: [],
            preview: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // 정답자/참여자 없음 - 상태만 업데이트
      await supabase
        .from('challenges')
        .update({ 
          status: 'ended',
          selected_at: new Date().toISOString()
        })
        .eq('id', challengeId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No eligible participants found',
          winners: [],
          externalWinners: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. 응원봉 보유자/미보유자 분리 (external은 항상 미보유자)
    const withLightstick = eligibleParticipations.filter(p => p.has_lightstick);
    const withoutLightstick = eligibleParticipations.filter(p => !p.has_lightstick);

    console.log(`Lightstick holders: ${withLightstick.length}, Non-holders: ${withoutLightstick.length}`);

    // 4. 현재 블록 정보 가져오기 (랜덤 시드용)
    const blockNumber = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNumber);
    
    if (!block || !block.hash) {
      throw new Error('Failed to fetch block information');
    }

    console.log(`Using block ${blockNumber} with hash ${block.hash}`);

    // 5. 참여자 목록 해시 생성
    const participantIds = eligibleParticipations.map(p => p.user_id).sort();
    const participantListHash = ethers.keccak256(
      ethers.toUtf8Bytes(participantIds.join(','))
    );

    // 6. 최종 랜덤 시드 생성 (블록 해시 + 참여자 목록 해시)
    const selectionSeed = ethers.keccak256(
      ethers.concat([
        ethers.getBytes(block.hash),
        ethers.getBytes(participantListHash)
      ])
    );

    console.log(`Selection seed: ${selectionSeed}`);

    // 7. 순위별 상금 정보 및 당첨자 수 계산
    const prizeTiers = options?.prize_tiers || [];
    
    let targetWinnerCount = 0;
    if (prizeTiers.length > 0) {
      targetWinnerCount = prizeTiers.reduce((sum: number, tier: any) => sum + (tier.count || 1), 0);
    } else {
      targetWinnerCount = challenge.winner_count;
    }

    console.log(`Prize tiers: ${JSON.stringify(prizeTiers)}, Target winner count: ${targetWinnerCount}`);

    // 8. 7:3 비율로 응원봉/미보유자 당첨자 선정
    const winners: any[] = [];
    
    // 순위별 당첨자 선정 함수
    const selectWinnersForTier = (
      tierCount: number,
      lightstickPool: any[],
      nonLightstickPool: any[],
      roundBase: number
    ) => {
      const tierWinners: any[] = [];
      
      // 7:3 비율 계산 (반올림하여 응원봉 보유자에게 유리하게)
      const lightstickCount = Math.min(
        Math.ceil(tierCount * LIGHTSTICK_RATIO),
        lightstickPool.length
      );
      const nonLightstickCount = Math.min(
        tierCount - lightstickCount,
        nonLightstickPool.length
      );
      
      // 부족한 경우 다른 그룹에서 보충
      let finalLightstickCount = lightstickCount;
      let finalNonLightstickCount = nonLightstickCount;
      
      const totalAvailable = lightstickPool.length + nonLightstickPool.length;
      const totalNeeded = Math.min(tierCount, totalAvailable);
      
      if (finalLightstickCount + finalNonLightstickCount < totalNeeded) {
        // 응원봉 보유자가 부족하면 미보유자에서 추가
        if (finalLightstickCount < Math.ceil(tierCount * LIGHTSTICK_RATIO)) {
          finalNonLightstickCount = Math.min(totalNeeded - finalLightstickCount, nonLightstickPool.length);
        }
        // 미보유자가 부족하면 응원봉 보유자에서 추가
        if (finalNonLightstickCount < Math.floor(tierCount * (1 - LIGHTSTICK_RATIO))) {
          finalLightstickCount = Math.min(totalNeeded - finalNonLightstickCount, lightstickPool.length);
        }
      }

      console.log(`Tier allocation: ${finalLightstickCount} lightstick, ${finalNonLightstickCount} non-lightstick`);

      // YouTube 챌린지: 근접도 순으로 선정 (이미 정렬되어 있음)
      if (isYoutubeChallenge) {
        // 응원봉 보유자에서 상위 N명
        for (let i = 0; i < finalLightstickCount && lightstickPool.length > 0; i++) {
          tierWinners.push(lightstickPool.shift());
        }
        // 미보유자에서 상위 N명
        for (let i = 0; i < finalNonLightstickCount && nonLightstickPool.length > 0; i++) {
          tierWinners.push(nonLightstickPool.shift());
        }
      } else {
        // 그 외: 랜덤 추첨
        // 응원봉 보유자 추첨
        for (let i = 0; i < finalLightstickCount && lightstickPool.length > 0; i++) {
          const roundSeed = ethers.keccak256(
            ethers.concat([
              ethers.getBytes(selectionSeed),
              ethers.toBeArray(BigInt(roundBase + i))
            ])
          );
          const seedBigInt = BigInt(roundSeed);
          const index = Number(seedBigInt % BigInt(lightstickPool.length));
          tierWinners.push(lightstickPool.splice(index, 1)[0]);
        }
        
        // 미보유자 추첨
        for (let i = 0; i < finalNonLightstickCount && nonLightstickPool.length > 0; i++) {
          const roundSeed = ethers.keccak256(
            ethers.concat([
              ethers.getBytes(selectionSeed),
              ethers.toBeArray(BigInt(roundBase + finalLightstickCount + i + 1000)) // offset으로 구분
            ])
          );
          const seedBigInt = BigInt(roundSeed);
          const index = Number(seedBigInt % BigInt(nonLightstickPool.length));
          tierWinners.push(nonLightstickPool.splice(index, 1)[0]);
        }
      }
      
      return tierWinners;
    };

    // 각 풀의 복사본 생성
    const lightstickPoolCopy = [...withLightstick];
    const nonLightstickPoolCopy = [...withoutLightstick];
    
    // 순위별 당첨자 선정
    let roundBase = 0;
    const winnersByTier: { tier: any; winners: any[] }[] = [];
    
    if (prizeTiers.length > 0) {
      for (const tier of prizeTiers) {
        const tierCount = tier.count || 1;
        const tierWinners = selectWinnersForTier(
          tierCount,
          lightstickPoolCopy,
          nonLightstickPoolCopy,
          roundBase
        );
        winnersByTier.push({ tier, winners: tierWinners });
        winners.push(...tierWinners);
        roundBase += tierCount;
      }
    } else {
      // 레거시: prize_tiers 없는 경우
      const selectedWinners = selectWinnersForTier(
        targetWinnerCount,
        lightstickPoolCopy,
        nonLightstickPoolCopy,
        0
      );
      winners.push(...selectedWinners);
    }

    // 당첨자 순서를 시드 기반으로 셔플 (응원봉/미보유자 순서가 고정되지 않도록)
    const shuffleWithSeed = (arr: any[], seed: string) => {
      const shuffled = [...arr];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const roundSeed = ethers.keccak256(
          ethers.concat([
            ethers.getBytes(seed),
            ethers.toBeArray(BigInt(i + 10000)) // shuffle offset
          ])
        );
        const seedBigInt = BigInt(roundSeed);
        const j = Number(seedBigInt % BigInt(i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };
    
    const shuffledWinners = shuffleWithSeed(winners, selectionSeed);
    
    // Internal/External 당첨자 분리
    const internalWinners = shuffledWinners.filter(w => w.source === 'internal');
    const externalWinners = shuffledWinners.filter(w => w.source === 'external');
    
    console.log(`Selected ${shuffledWinners.length} winners (preview: ${preview})`);
    console.log(`Winners breakdown - Internal: ${internalWinners.length}, External: ${externalWinners.length}`);
    console.log(`Winners breakdown - Lightstick: ${shuffledWinners.filter(w => w.has_lightstick).length}, Non-lightstick: ${shuffledWinners.filter(w => !w.has_lightstick).length}`);

    // 프로필 정보 조회 (internal 사용자만)
    const winnerUserIds = internalWinners.map(w => w.user_id).filter(Boolean);
    const { data: winnerProfiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', winnerUserIds);

    const profileMap = new Map(winnerProfiles?.map(p => [p.id, p]) || []);

    // External 사용자 정보 조회
    const externalWalletIds = externalWinners.map(w => w.external_wallet_id).filter(Boolean);
    const { data: externalWalletData } = await supabase
      .from('external_wallet_users')
      .select('id, wallet_address, username, display_name, avatar_url')
      .in('id', externalWalletIds);

    const externalWalletMap = new Map(externalWalletData?.map(e => [e.id, e]) || []);

    // 미리보기 모드
    if (preview) {
      const previewWinnerDetails: any[] = [];
      let previewIndex = 0;
      
      if (prizeTiers.length > 0) {
        for (const { tier, winners: tierWinners } of winnersByTier) {
          for (const winner of tierWinners) {
            // prize_tiers에서 응원봉 보유 여부에 따라 상금 결정
            const prizeAmount = winner.has_lightstick 
              ? (tier.amountWithLightstick ?? tier.amount ?? 0)
              : (tier.amountWithoutLightstick ?? tier.amount ?? 0);

            if (winner.source === 'internal') {
              const profile = profileMap.get(winner.user_id);
              previewWinnerDetails.push({
                user_id: winner.user_id,
                username: profile?.username || 'Unknown',
                display_name: profile?.display_name,
                avatar_url: profile?.avatar_url,
                rank: tier.rank,
                has_lightstick: winner.has_lightstick,
                prize_amount: prizeAmount,
                answer: winner.answer,
                created_at: winner.created_at,
                source: 'internal',
                ...(isYoutubeChallenge && { difference: winner._difference })
              });
            } else {
              const externalUser = externalWalletMap.get(winner.external_wallet_id);
              previewWinnerDetails.push({
                external_wallet_id: winner.external_wallet_id,
                wallet_address: externalUser?.wallet_address || winner.wallet_address,
                username: externalUser?.username || 'Frame User',
                display_name: externalUser?.display_name,
                avatar_url: externalUser?.avatar_url,
                rank: tier.rank,
                has_lightstick: false,
                prize_amount: prizeAmount,
                answer: winner.answer,
                created_at: winner.created_at,
                source: 'external',
                ...(isYoutubeChallenge && { difference: winner._difference })
              });
            }
            previewIndex++;
          }
        }
      } else {
        for (let i = 0; i < winners.length; i++) {
          const winner = winners[i];
          const prizeAmount = winner.has_lightstick 
            ? challenge.prize_with_lightstick 
            : challenge.prize_without_lightstick;

          if (winner.source === 'internal') {
            const profile = profileMap.get(winner.user_id);
            previewWinnerDetails.push({
              user_id: winner.user_id,
              username: profile?.username || 'Unknown',
              display_name: profile?.display_name,
              avatar_url: profile?.avatar_url,
              rank: i + 1,
              has_lightstick: winner.has_lightstick,
              prize_amount: prizeAmount,
              answer: winner.answer,
              created_at: winner.created_at,
              source: 'internal',
              ...(isYoutubeChallenge && { difference: winner._difference })
            });
          } else {
            const externalUser = externalWalletMap.get(winner.external_wallet_id);
            previewWinnerDetails.push({
              external_wallet_id: winner.external_wallet_id,
              wallet_address: externalUser?.wallet_address || winner.wallet_address,
              username: externalUser?.username || 'Frame User',
              display_name: externalUser?.display_name,
              avatar_url: externalUser?.avatar_url,
              rank: i + 1,
              has_lightstick: false,
              prize_amount: prizeAmount,
              answer: winner.answer,
              created_at: winner.created_at,
              source: 'external',
              ...(isYoutubeChallenge && { difference: winner._difference })
            });
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          preview: true,
          message: `Preview: ${winners.length} winner(s) would be selected (${internalWinners.length} K-Trendz, ${externalWinners.length} external)`,
          selection: {
            block_number: blockNumber,
            block_hash: block.hash,
            participant_list_hash: participantListHash,
            selection_seed: selectionSeed
          },
          winners: previewWinnerDetails.filter(w => w.source === 'internal'),
          externalWinners: previewWinnerDetails.filter(w => w.source === 'external'),
          verification: {
            description: 'Winners selected using 7:3 ratio (lightstick:non-lightstick) with verifiable on-chain randomness',
            formula: 'keccak256(block_hash + keccak256(sorted_participant_ids))',
            total_eligible: eligibleParticipations.length,
            internal_eligible: eligibleParticipations.filter(p => p.source === 'internal').length,
            external_eligible: eligibleParticipations.filter(p => p.source === 'external').length,
            lightstick_holders: withLightstick.length,
            non_lightstick_holders: withoutLightstick.length,
            winner_count: winners.length,
            internal_winners: internalWinners.length,
            external_winners: externalWinners.length,
            winners_with_lightstick: winners.filter(w => w.has_lightstick).length,
            winners_without_lightstick: winners.filter(w => !w.has_lightstick).length,
            challenge_type: challengeType
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 9. 당첨자 정보 업데이트 (알림은 관리자 승인 후 전송)
    // Internal과 External을 각각의 테이블에 업데이트
    const internalWinnerDetails: any[] = [];
    const externalWinnerDetails: any[] = [];
    
    if (prizeTiers.length > 0) {
      for (const { tier, winners: tierWinners } of winnersByTier) {
        for (const winner of tierWinners) {
          // prize_tiers에서 응원봉 보유 여부에 따라 상금 결정
          const prizeAmount = winner.has_lightstick 
            ? (tier.amountWithLightstick ?? tier.amount ?? 0)
            : (tier.amountWithoutLightstick ?? tier.amount ?? 0);

          if (winner.source === 'internal') {
            // 관리자가 선별한 목록이 있으면 해당 유저만 처리
            if (adminSelectedIds && !adminSelectedIds.includes(winner.user_id)) {
              console.log(`Skipping user ${winner.user_id} - not in admin selection`);
              continue;
            }
            
            await supabase
              .from('challenge_participations')
              .update({
                is_winner: true,
                prize_amount: prizeAmount
              })
              .eq('id', winner.id);
            
            internalWinnerDetails.push({
              user_id: winner.user_id,
              rank: tier.rank,
              has_lightstick: winner.has_lightstick,
              prize_amount: prizeAmount,
              source: 'internal'
            });
          } else {
            // External winner
            await supabase
              .from('external_challenge_participations')
              .update({
                is_winner: true,
                prize_amount: prizeAmount
              })
              .eq('id', winner.id);
            
            const externalUser = externalWalletMap.get(winner.external_wallet_id);
            externalWinnerDetails.push({
              external_wallet_id: winner.external_wallet_id,
              wallet_address: externalUser?.wallet_address || winner.wallet_address,
              rank: tier.rank,
              has_lightstick: winner.has_lightstick || false,
              prize_amount: prizeAmount,
              source: 'external'
            });
          }
        }
      }
    } else {
      // 레거시 호환
      let rankIndex = 1;
      for (const winner of winners) {
        const prizeAmount = winner.has_lightstick 
          ? challenge.prize_with_lightstick 
          : challenge.prize_without_lightstick;

        if (winner.source === 'internal') {
          // 관리자가 선별한 목록이 있으면 해당 유저만 처리
          if (adminSelectedIds && !adminSelectedIds.includes(winner.user_id)) {
            console.log(`Skipping user ${winner.user_id} - not in admin selection`);
            continue;
          }
          
          await supabase
            .from('challenge_participations')
            .update({
              is_winner: true,
              prize_amount: prizeAmount
            })
            .eq('id', winner.id);
          
          internalWinnerDetails.push({
            user_id: winner.user_id,
            rank: rankIndex,
            has_lightstick: winner.has_lightstick,
            prize_amount: prizeAmount,
            source: 'internal'
          });
        } else {
          // External winner
          // 관리자가 선별한 external 목록이 있으면 해당 유저만 처리
          if (adminSelectedExternalIds && !adminSelectedExternalIds.includes(winner.external_wallet_id)) {
            console.log(`Skipping external user ${winner.external_wallet_id} - not in admin selection`);
            continue;
          }
          
          await supabase
            .from('external_challenge_participations')
            .update({
              is_winner: true,
              prize_amount: prizeAmount
            })
            .eq('id', winner.id);
          
          const externalUser = externalWalletMap.get(winner.external_wallet_id);
          externalWinnerDetails.push({
            external_wallet_id: winner.external_wallet_id,
            wallet_address: externalUser?.wallet_address || winner.wallet_address,
            rank: rankIndex,
            has_lightstick: false,
            prize_amount: prizeAmount,
            source: 'external'
          });
        }
        rankIndex++;
      }
    }

    // 10. 챌린지 상태 업데이트
    await supabase
      .from('challenges')
      .update({
        status: 'ended',
        selection_block_number: blockNumber,
        selection_block_hash: block.hash,
        selection_seed: selectionSeed,
        selected_at: new Date().toISOString()
      })
      .eq('id', challengeId);

    // 11. 전체 참여자 온체인 일괄 기록 (fire-and-forget)
    // 대규모 챌린지(100명+)에서 배치 처리가 120초+ 소요될 수 있어
    // select-challenge-winners의 150초 타임아웃을 방지하기 위해 비동기 호출
    // record-challenge-onchain은 독립 Edge Function으로 자체 150초 타임아웃 내 실행됨
    // batchParticipate로 참여 정보만 기록 (isWinner는 DB에서만 관리, 온체인 selectWinners 미사용)
    try {
      // 응답을 기다리지 않고 호출만 트리거 (Edge Function은 독립 실행됨)
      fetch(`${supabaseUrl}/functions/v1/record-challenge-onchain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ challengeId }),
      }).then(async (res) => {
        try {
          const result = await res.json();
          if (result.success) {
            console.log(`Async onchain recording: ${result.data?.totalRecorded || 0} participations recorded`);
          } else {
            console.warn('Async onchain recording failed:', result.error);
          }
        } catch (e) {
          console.warn('Async onchain recording response parse error:', e);
        }
      }).catch((err) => {
        console.error('Async onchain recording trigger error:', err);
      });
      console.log('Triggered async batch onchain recording for challenge:', challengeId);
    } catch (onchainErr) {
      console.error('Failed to trigger onchain recording (non-blocking):', onchainErr);
    }

    const totalWinnerCount = internalWinnerDetails.length + externalWinnerDetails.length;
    console.log(`Final winner count: ${totalWinnerCount} (internal: ${internalWinnerDetails.length}, external: ${externalWinnerDetails.length})`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully selected ${totalWinnerCount} winner(s) (${internalWinnerDetails.length} K-Trendz, ${externalWinnerDetails.length} external)`,
        selection: {
          block_number: blockNumber,
          block_hash: block.hash,
          participant_list_hash: participantListHash,
          selection_seed: selectionSeed,
          selected_at: new Date().toISOString(),
          admin_filtered: !!adminSelectedIds
        },
        winners: internalWinnerDetails,
        externalWinners: externalWinnerDetails,
        verification: {
          description: adminSelectedIds 
            ? 'Winners manually selected by admin from algorithm candidates'
            : 'Winners selected using 7:3 ratio (lightstick:non-lightstick) with verifiable on-chain randomness',
          formula: 'keccak256(block_hash + keccak256(sorted_participant_ids))',
          total_eligible: eligibleParticipations.length,
          internal_eligible: eligibleParticipations.filter(p => p.source === 'internal').length,
          external_eligible: eligibleParticipations.filter(p => p.source === 'external').length,
          lightstick_holders: withLightstick.length,
          non_lightstick_holders: withoutLightstick.length,
          winner_count: totalWinnerCount,
          internal_winners: internalWinnerDetails.length,
          external_winners: externalWinnerDetails.length,
          winners_with_lightstick: internalWinnerDetails.filter(w => w.has_lightstick).length,
          winners_without_lightstick: totalWinnerCount - internalWinnerDetails.filter(w => w.has_lightstick).length,
          challenge_type: challengeType,
          admin_excluded: adminSelectedIds ? internalWinners.length - internalWinnerDetails.length : 0
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error selecting winners:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to select winners';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
