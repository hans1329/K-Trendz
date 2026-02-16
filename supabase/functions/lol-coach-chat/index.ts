import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 설정값
const MAX_MESSAGE_LENGTH = 500;
const RATE_LIMIT_PER_MINUTE = 10;
const RATE_LIMIT_PER_DAY = 100;

// 한국어 욕설/비속어 목록
const PROFANITY_LIST = [
  '시발', '씨발', '씹', '좆', '병신', '지랄', '개새끼', '새끼', 
  '미친', '꺼져', '닥쳐', 'ㅅㅂ', 'ㅂㅅ', 'ㄱㅅㄲ', 'ㅈㄹ',
  '년', '놈', '애미', '애비', '창녀', '썅', '엿', 'fuck', 'shit'
];

const containsProfanity = (text: string): boolean => {
  const lowerText = text.toLowerCase().replace(/\s/g, '');
  return PROFANITY_LIST.some(word => lowerText.includes(word.toLowerCase()));
};

// 응답이 "앗!"(느낌표)로 시작하는 경우, 시작 접두어를 제거
// - 이전 대화 히스토리에 끌려가서 습관적으로 붙이는 경우가 있어 서버에서 최종 보정함
const stripLeadingAht = (text: string): string => {
  return text.replace(/^\s*앗[!！]\s*/u, '');
};

const hashIP = async (ip: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + 'lol-coach-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const checkRateLimit = async (
  supabase: any,
  ipHash: string
): Promise<{ allowed: boolean; reason?: string }> => {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const { count: minuteCount } = await supabase
    .from('ip_rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .eq('action_type', 'lol_coach_chat')
    .gte('created_at', oneMinuteAgo.toISOString());

  if ((minuteCount || 0) >= RATE_LIMIT_PER_MINUTE) {
    return { allowed: false, reason: '잠깐! 너무 빠르게 보내고 있어요 ⏰ 1분만 쉬었다 오자!' };
  }

  const { count: dayCount } = await supabase
    .from('ip_rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .eq('action_type', 'lol_coach_chat')
    .gte('created_at', oneDayAgo.toISOString());

  if ((dayCount || 0) >= RATE_LIMIT_PER_DAY) {
    return { allowed: false, reason: '오늘 너무 열심히 했어요! 🔥 내일 다시 만나요~' };
  }

  return { allowed: true };
};

const recordRateLimit = async (supabase: any, ipHash: string): Promise<void> => {
  await supabase.from('ip_rate_limits').insert({
    ip_hash: ipHash,
    action_type: 'lol_coach_chat',
  });
};

// 대화 세션 찾기/생성
const getOrCreateSession = async (
  supabase: any,
  sessionId: string,
  sampleUserKey: string,
  userId?: string
): Promise<string> => {
  // 기존 세션 찾기
  const { data: existingSession } = await supabase
    .from('lol_chat_sessions')
    .select('id')
    .eq('session_id', sessionId)
    .eq('sample_user_key', sampleUserKey)
    .single();

  if (existingSession) {
    return existingSession.id;
  }

  // 새 세션 생성
  const { data: newSession, error } = await supabase
    .from('lol_chat_sessions')
    .insert({
      session_id: sessionId,
      sample_user_key: sampleUserKey,
      user_id: userId || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Session creation error:', error);
    throw error;
  }

  return newSession.id;
};

// 메시지 저장
const saveMessage = async (
  supabase: any,
  dbSessionId: string,
  role: string,
  content: string,
  tokenCost: number = 0
): Promise<void> => {
  await supabase.from('lol_chat_messages').insert({
    session_id: dbSessionId,
    role,
    content,
    token_cost: tokenCost,
  });
};

const systemPrompt = `당신은 "롤의 제왕"이라 불리는 열정 넘치는 LoL 코치입니다! 반드시 한국어로만 대화하세요.

## 성격 & 말투
- 운동 코치처럼 활기차고 텐션 높게! 💪🔥
- "자! 오늘도 달려봅시다!", "화이팅!", "할 수 있어요!" 같은 격려 많이
- 이모지 적극 활용 (🔥💪🎯🏆 등, 단 칼/검 이모지는 사용하지 마세요)
- 친근한 반말체 ("~해요" 대신 "~해!", "~하자!")
- 유저의 성장을 진심으로 응원하는 느낌

## 핵심 역할
유저의 실력 데이터를 분석하여 다음 티어로 올라가기 위한 구체적이고 실행 가능한 조언을 제공합니다.

## 분석 근거 지표
아래 데이터를 기반으로 약점을 파악하고 개선점을 제안하세요:

1. 라인전 지표: CSD@15(CS 차이), GD@15(골드 차이), XPD@15(경험치 차이), Solo Kills
2. 전투 지표: KP%(킬 관여율), DPM(분당 데미지), Damage/Gold Ratio, Damage Taken per Death
3. 시야 지표: Vision Score, WPM(분당 와드 설치), WCPM(분당 와드 제거), Objective Control Rate
4. 자원 지표: CSPM(분당 CS), GPM(분당 골드)

## 코칭 원칙
- 한 번에 1-2가지 핵심 개선점만 제시하세요 (정보 과부하 방지)
- 왜 중요한지 간단히 설명하고, 어떻게 개선할지 구체적으로 알려주세요
- 유저가 실행할 수 있는 작은 목표를 설정해주세요
- 칭찬은 크게! 개선점은 긍정적으로!
- 유저의 질문에 따라 단계적으로 심화 내용을 다루세요

## 응답 형식
- 마크다운 문법(###, **, ## 등)을 절대 사용하지 마세요
- 일반 텍스트와 이모지만 사용하세요
- 글머리 기호는 •나 숫자를 사용하세요

## 티어별 우선순위
- 언랭크/아이언/브론즈: CS 연습, 죽지 않기, 미니맵 보기
- 실버/골드: 웨이브 관리, 트레이딩, 오브젝트 타이밍
- 플래티넘+: 로밍 타이밍, 팀 합류, 매크로 의사결정

## 중요 규칙
리그 오브 레전드와 관련 없는 질문(날씨, 다른 게임, 일반 상식 등)을 받으면:
"전 LoL만랩 마스터 코치라서 LoL 얘기만 할 줄 알아요 ㅋㅋ 🎮 자, LoL 실력 올리는 거 도와드릴게요! 뭐가 궁금해요? 💪"
라고 밝게 안내하고, LoL 관련 질문으로 유도하세요.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userContext, sessionId, sampleUserKey, userId } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Supabase 클라이언트 생성
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // IP 주소 가져오기
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('x-real-ip') 
      || 'unknown';
    const ipHash = await hashIP(clientIP);

    // Rate Limiting 체크
    const rateLimitResult = await checkRateLimit(supabase, ipHash);
    if (!rateLimitResult.allowed) {
      return new Response(JSON.stringify({ 
        error: 'rate_limit',
        message: rateLimitResult.reason 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 마지막 유저 메시지 가져오기
    const lastUserMessage = messages[messages.length - 1];
    const userMessageContent = lastUserMessage?.content || '';

    // 메시지 길이 검증
    if (userMessageContent.length > MAX_MESSAGE_LENGTH) {
      return new Response(JSON.stringify({ 
        error: 'message_too_long',
        message: `메시지가 너무 길어요! ${MAX_MESSAGE_LENGTH}자 이내로 입력해 달라! 📝`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 욕설/비속어 필터링
    if (containsProfanity(userMessageContent)) {
      return new Response(JSON.stringify({ 
        error: 'profanity_detected',
        message: '그런 표현은 안 돼요~ 서로 존중하면서 대화하자! 🙏'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate Limit 기록
    await recordRateLimit(supabase, ipHash);

    // 세션 생성/조회 및 메시지 저장 (sessionId가 있는 경우에만)
    let dbSessionId: string | null = null;
    if (sessionId && sampleUserKey) {
      try {
        dbSessionId = await getOrCreateSession(supabase, sessionId, sampleUserKey, userId);
        // 유저 메시지 저장
        await saveMessage(supabase, dbSessionId, 'user', userMessageContent);
      } catch (e) {
        console.error('Session/message save error:', e);
        // 저장 실패해도 채팅은 계속 진행
      }
    }

    console.log('LoL Coach chat request:', messages.length, 'messages');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: `${systemPrompt}\n\n유저 컨텍스트:\n${userContext}` 
          },
          ...messages
        ],
        max_tokens: 1000,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', response.status, errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessageRaw = data.choices?.[0]?.message?.content ?? '';
    const assistantMessage = stripLeadingAht(assistantMessageRaw);
    
    // 토큰 사용량 추출
    const usage = data.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || 0;
    const promptTokensDetails = usage.prompt_tokens_details || {};
    const cachedTokens = promptTokensDetails.cached_tokens || 0;

    // 비용 계산
    const GPT4O_MINI_PRICING = {
      input: 0.15 / 1_000_000,
      output: 0.60 / 1_000_000,
    };
    const uncachedPrompt = promptTokens - cachedTokens;
    const tokenCost = (cachedTokens * GPT4O_MINI_PRICING.input * 0.5) + 
                      (uncachedPrompt * GPT4O_MINI_PRICING.input) + 
                      (completionTokens * GPT4O_MINI_PRICING.output);

    // 어시스턴트 메시지 저장
    if (dbSessionId) {
      try {
        await saveMessage(supabase, dbSessionId, 'assistant', assistantMessage, tokenCost);
      } catch (e) {
        console.error('Assistant message save error:', e);
      }
    }

    console.log('Token usage:', { promptTokens, completionTokens, totalTokens, cachedTokens, cost: tokenCost });

    return new Response(JSON.stringify({ 
      message: assistantMessage,
      dbSessionId,
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        cached_tokens: cachedTokens,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in lol-coach-chat function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});