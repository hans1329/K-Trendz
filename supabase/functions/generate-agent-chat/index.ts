// 에이전트 봇 대화 자동 생성 Edge Function (Cron 또는 수동 호출)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 요청 바디 파싱
    const body = await req.json().catch(() => ({}));
    const isManual = body?.manual === true;

    // 수동 호출: 유저의 에이전트로 1개 메시지만 생성
    if (isManual) {
      // JWT에서 유저 ID 추출
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) throw new Error("Authentication required");

      // 수동 생성 Star 비용 조회
      const { data: costSetting } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "agent_generate_cost")
        .maybeSingle();
      const starCost = (costSetting?.setting_value as any)?.cost ?? 3;

      // Star 포인트 차감 (deduct_points RPC 사용)
      if (starCost > 0) {
        // point_rules의 값도 동기화 (system_settings 기준)
        await supabase
          .from("point_rules")
          .update({ points: -starCost })
          .eq("action_type", "agent_generate");

        const { data: deducted, error: deductErr } = await supabase.rpc("deduct_points", {
          user_id_param: user.id,
          action_type_param: "agent_generate",
          reference_id_param: "00000000-0000-0000-0000-000000000000",
        });
        if (deductErr) throw new Error(`Failed to deduct stars: ${deductErr.message}`);
        if (deducted === false) throw new Error(`Not enough Stars. You need ${starCost} ⭐ to generate a message.`);
      }

      // 유저의 활성 에이전트 조회
      const { data: userAgent, error: agentError } = await supabase
        .from("user_agents")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (agentError || !userAgent) {
        throw new Error("No active agent found. Please create an agent first.");
      }

      // 최근 대화 컨텍스트 (중복 방지를 위해 30개 조회 — approved + pending 모두 포함)
      const { data: recentMsgs } = await supabase
        .from("agent_chat_messages")
        .select("*, agent_personas(name)")
        .in("status", ["approved", "pending"])
        .order("created_at", { ascending: false })
        .limit(30);

      const chatCtx = (recentMsgs || []).reverse()
        .map((m: any) => `${m.agent_personas?.name || "Agent"}: ${m.message}`)
        .join("\n");

      // 금지 문구 목록: 최근 메시지에서 핵심 문장 추출
      const forbiddenPhrases = (recentMsgs || [])
        .map((m: any) => `- "${m.message.slice(0, 80)}"`)
        .join("\n");

      // 랭킹/거래 데이터
      const { data: topEntries } = await supabase
        .from("wiki_entries")
        .select("title, trending_score, votes")
        .order("trending_score", { ascending: false })
        .limit(5);

      const rankCtx = (topEntries || [])
        .map((e: any, i: number) => `#${i + 1} ${e.title} (votes:${e.votes})`)
        .join(", ");

      // 좋아하는 아티스트의 응원봉 가격 데이터 (favorite_entry_id 기준)
      const favEntryId = userAgent.favorite_entry_id;
      let priceCtx = "";
      let favArtistName = "";
      let favHasToken = false;
      let favVotes = 0;

      // Stripe 수수료 계산 함수 (UI 훅과 동일: 2.9% + $0.30)
      const calcStripeTotal = (net: number) => (net + 0.30) / (1 - 0.029);

      if (favEntryId) {
        const { data: favEntry } = await supabase
          .from("wiki_entries")
          .select("title, votes, fanz_tokens(id, token_id, total_supply, is_active)")
          .eq("id", favEntryId)
          .maybeSingle();

        if (favEntry) {
          favArtistName = favEntry.title;
          favVotes = favEntry.votes || 0;
          const token = (favEntry as any).fanz_tokens?.[0];

          if (token && token.is_active) {
            favHasToken = true;

            // 온체인 가격 조회 (UI와 동일한 get-fanztoken-price Edge Function 호출)
            let price = 0;
            try {
              const priceResp = await fetch(`${supabaseUrl}/functions/v1/get-fanztoken-price`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({ tokenId: token.token_id, amount: 1 }),
              });
              const priceData = await priceResp.json();
              if (priceData?.success && priceData.data?.buyCostUsd) {
                // UI 훅과 동일: 온체인 buyCost에 Stripe 수수료 추가
                price = Math.max(calcStripeTotal(priceData.data.buyCostUsd), 0.50);
              }
            } catch (e) {
              console.warn("Failed to fetch onchain price for agent:", e);
            }

            const today0 = new Date();
            today0.setUTCHours(0, 0, 0, 0);
            const { data: todayTxs } = await supabase
              .from("fanz_transactions")
              .select("price_per_token, created_at")
              .eq("fanz_token_id", token.id)
              .eq("transaction_type", "buy")
              .gte("created_at", today0.toISOString())
              .order("created_at", { ascending: true })
              .limit(1);

            const firstP = todayTxs?.[0] ? Number(todayTxs[0].price_per_token) : null;
            const change24h = firstP && firstP > 0 ? (((price - firstP) / firstP) * 100).toFixed(1) + "%" : "N/A";

            priceCtx = price > 0
              ? `${favArtistName} LightStick: $${price.toFixed(2)} (24h change: ${change24h}, supply: ${token.total_supply})`
              : `${favArtistName} LightStick: price unavailable`;
          } else {
            priceCtx = `${favArtistName} LightStick: NOT YET ISSUED (current votes: ${favVotes}, need 1000+ votes to issue)`;
          }
        }
      }

      // 최근 뉴스 게시글 가져오기 (외부 근거 데이터)
      const { data: recentNews } = await supabase
        .from("posts")
        .select("title, content, source_url, created_at, wiki_entries(title)")
        .not("source_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(5);

      const newsCtx = (recentNews || [])
        .map((n: any) => `- "${n.title}" (${n.wiki_entries?.title || "General"}, source: ${n.source_url})`)
        .join("\n");

      const topics = ["news", "trading", "voting", "ranking", "strategy", "banter"];
      const topic = topics[Math.floor(Math.random() * topics.length)];

      const prompt = `You are ${userAgent.name} (${userAgent.avatar_emoji}), an AI fan agent on KTRENDZ (K-pop fan platform).
Personality: ${userAgent.personality}
Favorite Artist: ${favArtistName || "Not set"}

${favArtistName ? `YOUR FAVORITE ARTIST's LightStick status:
${priceCtx}` : ""}

Current rankings: ${rankCtx || "No data"}
Recent news articles:
${newsCtx || "(no recent news)"}
Recent chat:
${chatCtx || "(empty)"}

FORBIDDEN - These messages already exist. You MUST NOT write anything similar:
${forbiddenPhrases || "(none)"}

IMPORTANT RULES:
- You are a DEDICATED FAN of ${favArtistName || "K-pop"}. Focus your message ONLY on ${favArtistName || "your favorite artist"} and their LightStick.
${favHasToken ? `- Reference the actual LightStick price and 24h change data above. Example: "${favArtistName}'s LightStick is up 5.2% today at $3.45 🔥"
- You can discuss price movements, supply trends, news impact on price, and buying opportunities.` : `- The LightStick has NOT been issued yet. Current votes: ${favVotes}.
- If votes < 1000: Encourage fans to vote more to reach 1000 votes and unlock LightStick issuance. Example: "We need ${Math.max(1000 - favVotes, 0)} more votes to unlock ${favArtistName}'s LightStick! Let's go! 🗳️"
- If votes >= 1000: Express excitement that issuance is coming soon.`}
- Base your message on EXTERNAL FACTS (news, events, comebacks) when available, connecting them to ${favArtistName || "your artist"}'s LightStick.
- Do NOT make generic hype statements without factual basis.
- Do NOT invent prices or percentages. Only use the data provided above.
- Your message MUST be completely UNIQUE. Do NOT repeat, rephrase, or paraphrase ANY of the FORBIDDEN messages above. Use completely different words, structure, and topic angle.
- If all news articles have been covered in the forbidden messages, discuss a different topic like voting strategy, fan community, or upcoming events instead.
- Write exactly ONE short chat message (1-2 sentences, under 150 chars) about "${topic}".
- Be casual, fun, use emojis occasionally.
- When referencing a news article, include its source URL.

Return ONLY a JSON object: {"message": "your message here"}`;

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: "Generate one message. Return ONLY JSON." },
          ],
        }),
      });

      if (!aiResp.ok) throw new Error(`AI gateway error: ${aiResp.status}`);

      const aiData = await aiResp.json();
      let content = (aiData.choices?.[0]?.message?.content || "")
        .replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      let parsed: { message: string };
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error("Failed to parse AI response");
      }

      // user_agents의 ID를 agent_persona_id 대신 사용할 수 없으므로
      // agent_chat_messages에 user_id를 설정하고 sender_type을 user_agent로 구분
      const { error: insertErr } = await supabase
        .from("agent_chat_messages")
        .insert({
          sender_type: "agent",
          user_id: user.id,
          message: parsed.message,
          topic_type: topic,
          status: "pending",
          metadata: { user_agent_id: userAgent.id, user_agent_name: userAgent.name, user_agent_emoji: userAgent.avatar_emoji, user_agent_avatar_url: userAgent.avatar_url || null },
        });

      if (insertErr) throw insertErr;

      return new Response(
        JSON.stringify({ success: true, messages_generated: 1, topic, agent_name: userAgent.name }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === Cron 자동 호출 로직 ===
    const { data: settings } = await supabase
      .from("agent_chat_settings")
      .select("is_enabled")
      .limit(1)
      .maybeSingle();

    if (!settings?.is_enabled) {
      return new Response(
        JSON.stringify({ success: false, reason: "Agent chat generation is disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. 활성 에이전트 페르소나 가져오기
    const { data: personas, error: personaError } = await supabase
      .from("agent_personas")
      .select("*")
      .eq("is_active", true);

    if (personaError || !personas?.length) {
      throw new Error("No active agent personas found");
    }

    // 2. 최근 대화 컨텍스트 가져오기 (최근 30개 — 중복 방지 강화)
    const { data: recentMessages } = await supabase
      .from("agent_chat_messages")
      .select("*, agent_personas(name)")
      .order("created_at", { ascending: false })
      .limit(30);

    const chatHistory = (recentMessages || [])
      .reverse()
      .map((m: any) => {
        const name = m.sender_type === "agent" ? m.agent_personas?.name || "Agent" : "User";
        return `${name}: ${m.message}`;
      })
      .join("\n");

    // 금지 문구 목록: 최근 메시지에서 핵심 문장 추출 (중복 방지)
    const cronForbiddenPhrases = (recentMessages || [])
      .map((m: any) => `- "${m.message.slice(0, 100)}"`)
      .join("\n");

    // 3. 실시간 데이터 수집
    const { data: recentTrades } = await supabase
      .from("fanz_transactions")
      .select("amount, transaction_type, price_per_token, fanz_tokens(token_id)")
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: topEntriesCron } = await supabase
      .from("wiki_entries")
      .select("title, trending_score, votes, follower_count")
      .order("trending_score", { ascending: false })
      .limit(5);

    // 응원봉 가격 데이터 (Top 10) - 온체인 가격 조회
    const { data: priceEntriesCron } = await supabase
      .from("wiki_entries")
      .select("title, fanz_tokens!inner(id, token_id, total_supply)")
      .in("schema_type", ["artist", "member"])
      .order("trending_score", { ascending: false })
      .limit(10);

    const todayCron0 = new Date();
    todayCron0.setUTCHours(0, 0, 0, 0);
    const cronTokenDbIds = (priceEntriesCron || []).map((e: any) => e.fanz_tokens?.[0]?.id).filter(Boolean);
    let cronFirstPriceMap = new Map<string, number>();
    if (cronTokenDbIds.length > 0) {
      const { data: cronTodayTxs } = await supabase
        .from("fanz_transactions")
        .select("fanz_token_id, price_per_token, created_at")
        .in("fanz_token_id", cronTokenDbIds)
        .eq("transaction_type", "buy")
        .gte("created_at", todayCron0.toISOString())
        .order("created_at", { ascending: true });
      (cronTodayTxs || []).forEach((tx: any) => {
        if (!cronFirstPriceMap.has(tx.fanz_token_id)) {
          const p = Number(tx.price_per_token);
          if (Number.isFinite(p) && p > 0) cronFirstPriceMap.set(tx.fanz_token_id, p);
        }
      });
    }

    // 온체인 가격 조회 (UI와 동일한 get-fanztoken-price 사용)
    const calcStripeTotal = (net: number) => (net + 0.30) / (1 - 0.029);
    const cronPriceResults = await Promise.allSettled(
      (priceEntriesCron || []).map(async (e: any) => {
        const t = e.fanz_tokens?.[0];
        if (!t) return null;
        try {
          const resp = await fetch(`${supabaseUrl}/functions/v1/get-fanztoken-price`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({ tokenId: t.token_id, amount: 1 }),
          });
          const data = await resp.json();
          if (data?.success && data.data?.buyCostUsd) {
            const price = Math.max(calcStripeTotal(data.data.buyCostUsd), 0.50);
            const firstP = cronFirstPriceMap.get(t.id);
            const change24h = firstP && firstP > 0 ? (((price - firstP) / firstP) * 100).toFixed(1) + "%" : "N/A";
            return `${e.title}: $${price.toFixed(2)} (24h: ${change24h}, supply: ${t.total_supply})`;
          }
        } catch { /* skip */ }
        return null;
      })
    );
    const cronPriceCtx = cronPriceResults
      .map((r) => r.status === "fulfilled" ? r.value : null)
      .filter(Boolean)
      .join("\n");

    // 최근 뉴스 게시글 (외부 근거)
    const { data: newsPostsCron } = await supabase
      .from("posts")
      .select("title, content, source_url, wiki_entries(title)")
      .not("source_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(5);

    const tradeContext = (recentTrades || [])
      .map((t: any) => `${t.transaction_type} ${t.amount} ${t.fanz_tokens?.token_id || "unknown"} @ $${t.price_per_token}`)
      .join(", ");

    const rankingContext = (topEntriesCron || [])
      .map((e: any, i: number) => `#${i + 1} ${e.title} (score:${e.trending_score}, votes:${e.votes})`)
      .join(", ");

    const newsContext = (newsPostsCron || [])
      .map((n: any) => `- "${n.title}" (about: ${n.wiki_entries?.title || "General"}, source: ${n.source_url})`)
      .join("\n");

    // 4. 에이전트 2~3명 무작위 선택
    const shuffled = personas.sort(() => Math.random() - 0.5);
    const selectedAgents = shuffled.slice(0, Math.min(3, shuffled.length));

    const agentDescriptions = selectedAgents
      .map((a: any) => `- ${a.name} (${a.avatar_emoji}): ${a.personality}. Bio: ${a.bio}`)
      .join("\n");

    // 5. 토픽 결정
    const topics = ["news", "trading", "voting", "ranking", "strategy", "banter"];
    const topic = topics[Math.floor(Math.random() * topics.length)];

    // 6. AI로 대화 생성
    const systemPrompt = `You are simulating a group chat between AI fan agents on KTRENDZ, a K-pop fan platform. 
Each agent has a distinct personality and talks about fan activities like trading LightSticks (fan tokens), voting for artists, tracking rankings, and participating in challenges.

Active agents in this conversation:
${agentDescriptions}

Recent platform activity:
- Recent trades: ${tradeContext || "No recent trades"}
- Current rankings: ${rankingContext || "No ranking data"}
- Current LightStick prices:
${cronPriceCtx || "(no price data)"}
- Recent news:
${newsContext || "(no recent news)"}

Recent chat history:
${chatHistory || "(No previous messages)"}

FORBIDDEN - These messages already exist. You MUST NOT write anything similar in wording, structure, or meaning:
${cronForbiddenPhrases || "(none)"}

CRITICAL RULES:
- Your messages MUST be completely UNIQUE. Do NOT repeat, rephrase, or paraphrase ANY of the FORBIDDEN messages above. Use completely different words, sentence structure, and topic angle.
- If all news articles have been covered in the FORBIDDEN messages, discuss a completely different angle (fan community events, voting milestones, chart performance comparisons, historical trivia, etc.)
- Agents MUST base their opinions on EXTERNAL FACTS (news articles, comeback announcements, chart performance, concert schedules, awards).
- They MAY connect those facts to INTERNAL recommendations (buying/selling LightSticks, voting strategies, challenge tips), OR simply share/react to the news naturally.
- When the topic is "trading", agents SHOULD reference actual LightStick prices and 24h changes from the data above. Example: "BLACKPINK's LightStick up 5.2% at $3.45 🔥"
- Both styles are valid. Mix it up for variety.
- Do NOT make generic hype without factual basis.
- Do NOT invent prices or percentages. Only use the data provided above.
- Generate 2-4 short messages (1-2 sentences each, under 150 chars) as a natural conversation
- Each message should be from one of the selected agents
- Topic focus: ${topic}
- Use casual, fun language with occasional emojis
- Agents should sometimes disagree or have different opinions
- When referencing a news article, ALWAYS include its source URL at the end of the message so fans can read the full article.

Output format (JSON array):
[
  {"agent_name": "FanBot Alpha", "message": "BTS concert sold out in 2 min 😱 demand is insane right now"},
  {"agent_name": "StarGazer", "message": "IVE's LightStick at $2.85 (+3.1%) — might be worth grabbing before the comeback"}
]`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate a short ${topic} conversation between the agents. Return ONLY a JSON array.` },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let generatedMessages: Array<{ agent_name: string; message: string }>;
    try {
      generatedMessages = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI response as JSON");
    }

    // 7. 시스템 페르소나 메시지 DB에 삽입
    const personaMap = new Map(personas.map((p: any) => [p.name, p.id]));
    const insertMessages = generatedMessages
      .filter((m) => personaMap.has(m.agent_name))
      .map((m, idx) => ({
        sender_type: "agent",
        agent_persona_id: personaMap.get(m.agent_name),
        message: m.message,
        topic_type: topic,
        status: "pending",
        created_at: new Date(Date.now() + idx * (3000 + Math.random() * 7000)).toISOString(),
      }));

    if (insertMessages.length > 0) {
      const { error: insertError } = await supabase
        .from("agent_chat_messages")
        .insert(insertMessages);

      if (insertError) {
        console.error("Insert error:", insertError);
        throw insertError;
      }
    }

    // === 유저 에이전트 자동 메시지 생성 (하루 1개 approved) ===
    let userAgentMessagesGenerated = 0;
    try {
      const { data: activeUserAgents } = await supabase
        .from("user_agents")
        .select("id, user_id, name, avatar_emoji, avatar_url, personality, favorite_entry_id")
        .eq("is_active", true);

      if (activeUserAgents && activeUserAgents.length > 0) {
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);

        for (const ua of activeUserAgents) {
          // 밴 체크
          const { data: banned } = await supabase
            .from("user_bans")
            .select("id")
            .eq("user_id", ua.user_id)
            .eq("is_active", true)
            .maybeSingle();
          if (banned) continue;

          // 오늘 이미 생성된 메시지 수 체크 (하루 3개 한도)
          const { count: todayCount } = await supabase
            .from("agent_chat_messages")
            .select("id", { count: "exact", head: true })
            .eq("user_id", ua.user_id)
            .eq("sender_type", "agent")
            .gte("created_at", todayStart.toISOString());

          if ((todayCount ?? 0) >= 3) continue;

          // 오늘 자동 승인된 메시지가 있는지 확인
          const { count: approvedCount } = await supabase
            .from("agent_chat_messages")
            .select("id", { count: "exact", head: true })
            .eq("user_id", ua.user_id)
            .eq("sender_type", "agent")
            .eq("status", "approved")
            .gte("created_at", todayStart.toISOString());

          const msgStatus = (approvedCount ?? 0) === 0 ? "approved" : "pending";

          // 좋아하는 아티스트 정보 조회
          let favName = "";
          let uaPriceCtx = "";
          if (ua.favorite_entry_id) {
            const { data: favEntry } = await supabase
              .from("wiki_entries")
              .select("title, votes, fanz_tokens(id, token_id, total_supply, is_active)")
              .eq("id", ua.favorite_entry_id)
              .maybeSingle();
            if (favEntry) {
              favName = favEntry.title;
              const token = (favEntry as any).fanz_tokens?.[0];
              if (token?.is_active) {
                try {
                  const resp = await fetch(`${supabaseUrl}/functions/v1/get-fanztoken-price`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseServiceKey}` },
                    body: JSON.stringify({ tokenId: token.token_id, amount: 1 }),
                  });
                  const pd = await resp.json();
                  if (pd?.success && pd.data?.buyCostUsd) {
                    const price = Math.max(calcStripeTotal(pd.data.buyCostUsd), 0.50);
                    uaPriceCtx = `${favName} LightStick: $${price.toFixed(2)} (supply: ${token.total_supply})`;
                  }
                } catch { /* skip */ }
              } else {
                uaPriceCtx = `${favName} LightStick: NOT YET ISSUED (votes: ${favEntry.votes || 0})`;
              }
            }
          }

          // 최근 대화에서 이 유저 에이전트의 메시지 추출 (중복 방지)
          const { data: uaRecentMsgs } = await supabase
            .from("agent_chat_messages")
            .select("message")
            .eq("user_id", ua.user_id)
            .eq("sender_type", "agent")
            .order("created_at", { ascending: false })
            .limit(10);

          const uaForbidden = (uaRecentMsgs || [])
            .map((m: any) => `- "${m.message.slice(0, 80)}"`)
            .join("\n");

          const uaTopic = topics[Math.floor(Math.random() * topics.length)];
          const uaPrompt = `You are ${ua.name} (${ua.avatar_emoji}), an AI fan agent on KTRENDZ.
Personality: ${ua.personality}
Favorite Artist: ${favName || "Not set"}
${uaPriceCtx ? `LightStick status: ${uaPriceCtx}` : ""}
Current rankings: ${rankingContext || "No data"}
Recent news:
${newsContext || "(none)"}

FORBIDDEN (do NOT repeat):
${uaForbidden || "(none)"}

Write ONE short message (1-2 sentences, under 150 chars) about "${uaTopic}".
Be casual, fun, use emojis. Focus on ${favName || "K-pop"}.
Return ONLY JSON: {"message": "your message"}`;

          try {
            const uaResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: uaPrompt },
                  { role: "user", content: "Generate one message. Return ONLY JSON." },
                ],
              }),
            });

            if (!uaResp.ok) continue;
            const uaAiData = await uaResp.json();
            let uaContent = (uaAiData.choices?.[0]?.message?.content || "")
              .replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            const uaParsed = JSON.parse(uaContent);

            await supabase.from("agent_chat_messages").insert({
              sender_type: "agent",
              user_id: ua.user_id,
              message: uaParsed.message,
              topic_type: uaTopic,
              status: msgStatus,
              metadata: {
                user_agent_id: ua.id,
                user_agent_name: ua.name,
                user_agent_emoji: ua.avatar_emoji,
                user_agent_avatar_url: ua.avatar_url || null,
                auto_approved: msgStatus === "approved",
              },
            });
            userAgentMessagesGenerated++;
            console.log(`[generate-agent-chat] User agent message created for ${ua.name} (status: ${msgStatus})`);
          } catch (uaErr) {
            console.warn(`[generate-agent-chat] Failed for ${ua.name}:`, uaErr);
          }
        }
      }
    } catch (uaGlobalErr) {
      console.error("[generate-agent-chat] User agent batch error:", uaGlobalErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        messages_generated: insertMessages.length,
        user_agent_messages: userAgentMessagesGenerated,
        topic,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("generate-agent-chat error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
