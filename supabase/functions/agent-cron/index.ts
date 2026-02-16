// 에이전트 자동 활동 Cron Edge Function
// 주기적으로 활성 에이전트의 규칙을 평가하고 자동 활동(투표, 댓글 등)을 실행
// 하루 1회 승인된 메시지를 배치 해시하여 Base 체인에 기록

import { createClient } from "npm:@supabase/supabase-js@2.78.0";
import { ethers } from "npm:ethers@6.15.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 서비스 롤 클라이언트 (사용자 대신 작업 수행)
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// === 온체인 배치 해시 관련 상수 (소문자로 통일하여 ethers가 자동 체크섬 처리) ===
const BACKEND_SMART_ACCOUNT = ethers.getAddress("0x8b4197d938b8f4212b067e9925f7251b6c21b856");
const ENTRY_POINT_ADDRESS = ethers.getAddress("0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789");
const DAU_CONTRACT_ADDRESS = ethers.getAddress("0xf7F05cEd0F2c905aD59C370265D67846FAb9959E");

const DAU_ABI = [
  "function recordActivity(address user, bytes32 activityType, bytes32 referenceHash) external",
];
const SIMPLE_ACCOUNT_ABI_CRON = [
  "function execute(address dest, uint256 value, bytes calldata func) external",
];
const ENTRY_POINT_ABI_CRON = [
  "function getNonce(address sender, uint192 key) view returns (uint256)",
  "function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address beneficiary) external",
];

const ACTIVITY_AGENT_BATCH = ethers.keccak256(ethers.toUtf8Bytes("agent_batch"));

// 하루 1회 승인된 에이전트 메시지를 배치 해시하여 DAU 컨트랙트에 기록
async function recordDailyBatchHash(): Promise<string> {
  // 아직 온체인 기록되지 않은 approved 메시지 조회 (날짜 제한 없음)
  const { data: messages } = await supabaseAdmin
    .from("agent_chat_messages")
    .select("id, user_id, message, topic_type, created_at, metadata")
    .eq("status", "approved")
    .is("onchain_tx_hash", null)
    .order("created_at", { ascending: true })
    .limit(100);

  if (!messages || messages.length === 0) {
    return "No approved messages to record";
  }

  console.log(`[agent-cron] Batch hashing ${messages.length} approved messages`);

  // 메시지를 직렬화 후 keccak256 해시
  const batchPayload = messages.map(m => ({
    id: m.id,
    user_id: m.user_id,
    message: m.message,
    topic_type: m.topic_type,
    created_at: m.created_at,
  }));
  const batchJson = JSON.stringify(batchPayload);
  const batchHash = ethers.keccak256(ethers.toUtf8Bytes(batchJson));
  console.log(`[agent-cron] Batch hash: ${batchHash} (${messages.length} msgs)`);

  const privateKey = Deno.env.get("BACKEND_WALLET_PRIVATE_KEY");
  if (!privateKey) {
    console.log("[agent-cron] No signer key, saving batch hash to DB only");
    const messageIds = messages.map(m => m.id);
    await supabaseAdmin
      .from("agent_chat_messages")
      .update({ onchain_batch_hash: batchHash })
      .in("id", messageIds);
    return `Hash saved (no signer): ${batchHash}`;
  }

  try {
    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
    const signer = new ethers.Wallet(privateKey, provider);

    // DAU recordActivity 인코딩
    const dauIface = new ethers.Interface(DAU_ABI);
    const innerCallData = dauIface.encodeFunctionData("recordActivity", [
      BACKEND_SMART_ACCOUNT, ACTIVITY_AGENT_BATCH, batchHash,
    ]);

    // SimpleAccount.execute로 감싸기
    const acctIface = new ethers.Interface(SIMPLE_ACCOUNT_ABI_CRON);
    const executeCallData = acctIface.encodeFunctionData("execute", [
      DAU_CONTRACT_ADDRESS, 0, innerCallData,
    ]);

    // 논스 + 가스 조회
    const ep = new ethers.Contract(ENTRY_POINT_ADDRESS, ENTRY_POINT_ABI_CRON, provider);
    const nonce = await ep.getNonce(BACKEND_SMART_ACCOUNT, 0);
    const feeData = await provider.getFeeData();
    const maxFee = feeData.maxFeePerGas ?? ethers.parseUnits("0.1", "gwei");
    const maxPriority = feeData.maxPriorityFeePerGas ?? ethers.parseUnits("0.05", "gwei");

    // UserOp 구성
    const userOp = {
      sender: BACKEND_SMART_ACCOUNT, nonce, initCode: "0x", callData: executeCallData,
      callGasLimit: 200000n, verificationGasLimit: 100000n, preVerificationGas: 50000n,
      maxFeePerGas: maxFee, maxPriorityFeePerGas: maxPriority,
      paymasterAndData: "0x", signature: "0x",
    };

    // Paymaster
    const pmUrl = Deno.env.get("PAYMASTER_URL");
    if (pmUrl) {
      try {
        const pmResp = await fetch(pmUrl, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1, method: "pm_sponsorUserOperation",
            params: [{
              sender: BACKEND_SMART_ACCOUNT, nonce: ethers.toBeHex(nonce), initCode: "0x",
              callData: executeCallData, callGasLimit: ethers.toBeHex(200000),
              verificationGasLimit: ethers.toBeHex(100000), preVerificationGas: ethers.toBeHex(50000),
              maxFeePerGas: ethers.toBeHex(maxFee), maxPriorityFeePerGas: ethers.toBeHex(maxPriority),
              paymasterAndData: "0x", signature: "0x",
            }, ENTRY_POINT_ADDRESS],
          }),
        });
        const pmResult = await pmResp.json();
        if (pmResult.result) {
          userOp.paymasterAndData = pmResult.result.paymasterAndData || pmResult.result;
        }
      } catch (pmErr) {
        console.warn("[agent-cron] Paymaster failed:", pmErr);
      }
    }

    // UserOp 해시 서명
    const opHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address","uint256","bytes32","bytes32","uint256","uint256","uint256","uint256","uint256","bytes32"],
        [userOp.sender, userOp.nonce, ethers.keccak256(userOp.initCode), ethers.keccak256(userOp.callData),
         userOp.callGasLimit, userOp.verificationGasLimit, userOp.preVerificationGas,
         userOp.maxFeePerGas, userOp.maxPriorityFeePerGas, ethers.keccak256(userOp.paymasterAndData)]
      )
    );
    const finalHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32","address","uint256"], [opHash, ENTRY_POINT_ADDRESS, 8453n]
      )
    );
    userOp.signature = await signer.signMessage(ethers.getBytes(finalHash));

    // EntryPoint.handleOps 전송
    const epSigner = new ethers.Contract(ENTRY_POINT_ADDRESS, ENTRY_POINT_ABI_CRON, signer);
    const tx = await epSigner.handleOps([userOp], await signer.getAddress());
    console.log(`[agent-cron] Batch hash tx sent: ${tx.hash}`);

    // DB 업데이트
    const messageIds = messages.map(m => m.id);
    await supabaseAdmin
      .from("agent_chat_messages")
      .update({ onchain_batch_hash: batchHash, onchain_tx_hash: tx.hash })
      .in("id", messageIds);

    try {
      const receipt = await tx.wait(1);
      if (receipt) console.log(`[agent-cron] Confirmed in block ${receipt.blockNumber}`);
    } catch { console.log(`[agent-cron] Tx pending: ${tx.hash}`); }

    return `Recorded ${messages.length} msgs, hash: ${batchHash}, tx: ${tx.hash}`;
  } catch (txErr) {
    console.error("[agent-cron] Onchain tx failed:", txErr);
    const messageIds = messages.map(m => m.id);
    await supabaseAdmin
      .from("agent_chat_messages")
      .update({ onchain_batch_hash: batchHash })
      .in("id", messageIds);
    return `Hash saved, tx failed: ${(txErr as Error).message}`;
  }
}

// 오늘 이미 이 에이전트가 해당 규칙을 실행했는지 확인
async function hasExecutedToday(
  agentId: string,
  activityType: string
): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count } = await supabaseAdmin
    .from("agent_activity_log")
    .select("id", { count: "exact", head: true })
    .eq("user_agent_id", agentId)
    .eq("activity_type", activityType)
    .gte("created_at", todayStart.toISOString());

  return (count ?? 0) > 0;
}

// 활동 로그 기록
async function logActivity(
  agentId: string,
  activityType: string,
  description: string,
  metadata?: Record<string, unknown>
) {
  await supabaseAdmin.from("agent_activity_log").insert({
    user_agent_id: agentId,
    activity_type: activityType,
    description,
    metadata: metadata ?? null,
  });
}

// === 규칙 실행 핸들러 ===

// 1. daily_entry_vote: 좋아하는 아티스트 엔트리에 자동 업보트
async function executeDailyEntryVote(agent: AgentWithRules) {
  if (await hasExecutedToday(agent.id, "vote")) return;

  // 좋아하는 아티스트가 설정되지 않으면 스킵
  if (!agent.favorite_entry_id) {
    await logActivity(agent.id, "vote", "Skipped: No favorite artist set");
    return;
  }

  // 이미 오늘 투표했는지 확인
  const todayStr = new Date().toISOString().split("T")[0];
  const { data: existingVote } = await supabaseAdmin
    .from("wiki_entry_votes")
    .select("id")
    .eq("user_id", agent.user_id)
    .eq("wiki_entry_id", agent.favorite_entry_id)
    .eq("vote_date", todayStr)
    .maybeSingle();

  if (existingVote) {
    await logActivity(agent.id, "vote", "Already voted today for favorite artist", {
      wiki_entry_id: agent.favorite_entry_id,
    });
    return;
  }

  // 일일 투표 수 체크
  const { data: dailyVoteCount } = await supabaseAdmin
    .from("daily_vote_counts")
    .select("vote_count")
    .eq("user_id", agent.user_id)
    .eq("vote_date", todayStr)
    .maybeSingle();

  // 일일 투표 한도 (기본 13) 확인
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("current_level")
    .eq("id", agent.user_id)
    .single();

  const { data: levelData } = await supabaseAdmin
    .from("levels")
    .select("max_daily_votes")
    .eq("id", profile?.current_level ?? 1)
    .single();

  const maxVotes = levelData?.max_daily_votes ?? 13;
  const currentVotes = dailyVoteCount?.vote_count ?? 0;

  if (currentVotes >= maxVotes) {
    await logActivity(agent.id, "vote", "Daily vote limit reached", {
      current: currentVotes,
      max: maxVotes,
    });
    return;
  }

  // 업보트 실행
  const { error } = await supabaseAdmin.from("wiki_entry_votes").insert({
    user_id: agent.user_id,
    wiki_entry_id: agent.favorite_entry_id,
    vote_type: "up",
    vote_date: todayStr,
  });

  if (error) {
    await logActivity(agent.id, "vote", `Vote failed: ${error.message}`);
    return;
  }

  // 일일 투표 카운트 업데이트
  await supabaseAdmin.from("daily_vote_counts").upsert(
    {
      user_id: agent.user_id,
      vote_date: todayStr,
      vote_count: currentVotes + 1,
    },
    { onConflict: "user_id,vote_date" }
  );

  // 엔트리 이름 조회
  const { data: entry } = await supabaseAdmin
    .from("wiki_entries")
    .select("title")
    .eq("id", agent.favorite_entry_id)
    .single();

  await logActivity(agent.id, "vote", `Voted for ${entry?.title ?? "favorite artist"}`, {
    wiki_entry_id: agent.favorite_entry_id,
    vote_type: "up",
  });
}

// 2. daily_post_vote: 좋아하는 아티스트 관련 인기 포스트에 업보트
async function executeDailyPostVote(agent: AgentWithRules) {
  if (await hasExecutedToday(agent.id, "post_vote")) return;

  // 좋아하는 아티스트 관련 최근 인기 포스트 찾기
  let query = supabaseAdmin
    .from("posts")
    .select("id, title")
    .eq("is_approved", true)
    .order("trending_score", { ascending: false })
    .limit(5);

  if (agent.favorite_entry_id) {
    query = query.eq("wiki_entry_id", agent.favorite_entry_id);
  }

  const { data: posts } = await query;

  if (!posts || posts.length === 0) {
    await logActivity(agent.id, "post_vote", "No trending posts found to vote on");
    return;
  }

  // 아직 투표하지 않은 포스트 찾기
  let votedPost = null;
  for (const post of posts) {
    const { data: existing } = await supabaseAdmin
      .from("post_votes")
      .select("id")
      .eq("user_id", agent.user_id)
      .eq("post_id", post.id)
      .maybeSingle();

    if (!existing) {
      votedPost = post;
      break;
    }
  }

  if (!votedPost) {
    await logActivity(agent.id, "post_vote", "Already voted on all trending posts");
    return;
  }

  // 업보트
  const { error } = await supabaseAdmin.from("post_votes").insert({
    user_id: agent.user_id,
    post_id: votedPost.id,
    vote_type: "up",
  });

  if (error) {
    await logActivity(agent.id, "post_vote", `Post vote failed: ${error.message}`);
    return;
  }

  await logActivity(agent.id, "post_vote", `Upvoted post: "${votedPost.title}"`, {
    post_id: votedPost.id,
  });
}

// 3. comment_on_new_posts: 새 포스트에 응원 댓글
async function executeCommentOnNewPosts(agent: AgentWithRules) {
  if (await hasExecutedToday(agent.id, "comment")) return;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let query = supabaseAdmin
    .from("posts")
    .select("id, title")
    .eq("is_approved", true)
    .gte("created_at", oneDayAgo)
    .order("created_at", { ascending: false })
    .limit(10);

  if (agent.favorite_entry_id) {
    query = query.eq("wiki_entry_id", agent.favorite_entry_id);
  }

  const { data: posts } = await query;

  if (!posts || posts.length === 0) {
    await logActivity(agent.id, "comment", "No new posts found to comment on");
    return;
  }

  let targetPost = null;
  for (const post of posts) {
    const { data: existingComment } = await supabaseAdmin
      .from("comments")
      .select("id")
      .eq("user_id", agent.user_id)
      .eq("post_id", post.id)
      .maybeSingle();

    if (!existingComment) {
      targetPost = post;
      break;
    }
  }

  if (!targetPost) {
    await logActivity(agent.id, "comment", "Already commented on all recent posts");
    return;
  }

  const comment = generateSupportComment(agent.personality, agent.name);

  const { error } = await supabaseAdmin.from("comments").insert({
    user_id: agent.user_id,
    post_id: targetPost.id,
    content: comment,
  });

  if (error) {
    await logActivity(agent.id, "comment", `Comment failed: ${error.message}`);
    return;
  }

  await logActivity(agent.id, "comment", `Commented on: "${targetPost.title}"`, {
    post_id: targetPost.id,
    comment_preview: comment.substring(0, 50),
  });
}

// 3-b. comment_on_news: 뉴스 기반 분석 글을 Bot Club에 생성
async function executeNewsAnalysis(agent: AgentWithRules) {
  if (await hasExecutedToday(agent.id, "news_analysis")) return;

  // 최근 뉴스 포스트 (news 태그 또는 최근 인기 포스트) 조회
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let query = supabaseAdmin
    .from("posts")
    .select("id, title, content")
    .eq("is_approved", true)
    .gte("created_at", oneDayAgo)
    .order("trending_score", { ascending: false })
    .limit(5);

  if (agent.favorite_entry_id) {
    query = query.eq("wiki_entry_id", agent.favorite_entry_id);
  }

  const { data: posts } = await query;

  if (!posts || posts.length === 0) return;

  // 이미 분석한 포스트 제외
  const { data: analyzed } = await supabaseAdmin
    .from("agent_activity_log")
    .select("metadata")
    .eq("user_agent_id", agent.id)
    .eq("activity_type", "news_analysis")
    .gte("created_at", oneDayAgo);

  const analyzedIds = new Set(
    (analyzed ?? []).map((a) => (a.metadata as Record<string, unknown>)?.post_id).filter(Boolean)
  );

  const targetPost = posts.find((p) => !analyzedIds.has(p.id));
  if (!targetPost) return;

  const contentPreview = (targetPost.content ?? "").substring(0, 200);
  const message = generateNewsAnalysis(agent.personality, agent.name, {
    title: targetPost.title,
    contentPreview,
  });

  await createBotClubMessage(agent, "news", message);

  await logActivity(agent.id, "news_analysis",
    `News analysis: "${targetPost.title}"`,
    { post_id: targetPost.id }
  );
}

// 4. mention_challenges: 챌린지 분석 글을 Bot Club에 생성
async function executeMentionChallenges(agent: AgentWithRules) {
  if (await hasExecutedToday(agent.id, "mention")) return;

  const now = new Date().toISOString();
  const { data: activeChallenges } = await supabaseAdmin
    .from("challenges")
    .select("id, question, end_time, total_prize_usdc, options, wiki_entry_id")
    .eq("status", "active")
    .lte("start_time", now)
    .gte("end_time", now)
    .limit(3);

  if (!activeChallenges || activeChallenges.length === 0) return;

  // 이미 알린 챌린지 확인
  const { data: alreadyMentioned } = await supabaseAdmin
    .from("agent_activity_log")
    .select("metadata")
    .eq("user_agent_id", agent.id)
    .eq("activity_type", "mention")
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const mentionedIds = new Set(
    (alreadyMentioned ?? [])
      .map((a) => (a.metadata as Record<string, unknown>)?.challenge_id)
      .filter(Boolean)
  );

  const newChallenge = activeChallenges.find((c) => !mentionedIds.has(c.id));
  if (!newChallenge) return;

  // 마감까지 남은 시간 계산
  const hoursLeft = Math.max(0, Math.round((new Date(newChallenge.end_time).getTime() - Date.now()) / 3600000));
  const options = newChallenge.options as string[] | null;

  const message = generateChallengeAnalysis(agent.personality, agent.name, {
    question: newChallenge.question,
    prize: newChallenge.total_prize_usdc,
    hoursLeft,
    options,
  });

  // Bot Club에 pending 메시지 생성
  await createBotClubMessage(agent, "challenge", message);

  await logActivity(agent.id, "mention",
    `Challenge analysis: "${newChallenge.question}"`,
    { challenge_id: newChallenge.id, prize: newChallenge.total_prize_usdc }
  );
}

// 5. mention_price_analysis: 응원봉 가격 분석 글을 Bot Club에 생성
async function executePriceAnalysis(agent: AgentWithRules) {
  if (await hasExecutedToday(agent.id, "price_analysis")) return;
  if (!agent.favorite_entry_id) return;

  const { data: token } = await supabaseAdmin
    .from("fanz_tokens")
    .select("id, token_id, total_supply, base_price, k_value")
    .eq("wiki_entry_id", agent.favorite_entry_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!token) return;

  const currentPrice = token.base_price + token.k_value * token.total_supply;

  const { data: entry } = await supabaseAdmin
    .from("wiki_entries")
    .select("title")
    .eq("id", agent.favorite_entry_id)
    .single();

  const artistName = entry?.title ?? "Artist";

  // 24시간 전 가격 비교 (최근 거래 기록)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentTx } = await supabaseAdmin
    .from("fanz_transactions")
    .select("price_per_token")
    .eq("fanz_token_id", token.id)
    .lt("created_at", oneDayAgo)
    .order("created_at", { ascending: false })
    .limit(1);

  const prevPrice = recentTx?.[0]?.price_per_token ?? null;
  const changePercent = prevPrice ? ((currentPrice - prevPrice) / prevPrice * 100) : null;

  const message = generatePriceAnalysis(agent.personality, agent.name, {
    artistName,
    price: currentPrice,
    supply: token.total_supply,
    changePercent,
  });

  await createBotClubMessage(agent, "price", message);

  await logActivity(agent.id, "price_analysis",
    `${artistName} price analysis: $${currentPrice.toFixed(4)}`,
    { token_id: token.token_id, price: currentPrice, supply: token.total_supply }
  );
}

// === 헬퍼 함수 ===

// Bot Club에 메시지 생성 (하루 3개 한도, 1개는 자동 승인)
async function createBotClubMessage(
  agent: AgentWithRules,
  topicType: string,
  message: string
) {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  // 오늘 전체 메시지 수 확인 (하루 최대 3개)
  const { count: totalCount } = await supabaseAdmin
    .from("agent_chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", agent.user_id)
    .eq("sender_type", "agent")
    .gte("created_at", todayStart.toISOString());

  if ((totalCount ?? 0) >= 3) {
    console.log(`[agent-cron] Daily limit (3) reached for ${agent.name}, skipping`);
    return;
  }

  // 오늘 자동 승인된 메시지가 있는지 확인
  const { count: approvedCount } = await supabaseAdmin
    .from("agent_chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", agent.user_id)
    .eq("sender_type", "agent")
    .eq("status", "approved")
    .gte("created_at", todayStart.toISOString());

  // 오늘 자동 승인된 글이 없으면 approved, 있으면 pending
  const status = (approvedCount ?? 0) === 0 ? "approved" : "pending";

  const { error } = await supabaseAdmin.from("agent_chat_messages").insert({
    user_id: agent.user_id,
    sender_type: "agent",
    topic_type: topicType,
    message,
    status,
    metadata: {
      user_agent_id: agent.id,
      user_agent_name: agent.name,
      user_agent_emoji: agent.avatar_emoji,
      auto_approved: status === "approved",
    },
  });

  if (error) {
    console.error(`[agent-cron] Failed to create bot club message for ${agent.name}:`, error);
  } else {
    console.log(`[agent-cron] Bot club message created for ${agent.name} (status: ${status}, topic: ${topicType})`);
  }
}

// 챌린지 분석 글 생성
function generateChallengeAnalysis(
  personality: string,
  agentName: string,
  info: { question: string; prize: number; hoursLeft: number; options: string[] | null }
): string {
  const optionText = info.options?.length
    ? `\nOptions: ${info.options.join(" / ")}`
    : "";

  const templates: Record<string, string> = {
    enthusiastic: `🔥 HOT CHALLENGE ALERT! "${info.question}" — Prize pool $${info.prize}! Only ${info.hoursLeft}h left!${optionText}\nDon't miss this chance! Let's GO! 🚀`,
    analytical: `📊 Challenge Analysis: "${info.question}"\n💰 Prize: $${info.prize} | ⏰ ${info.hoursLeft}h remaining${optionText}\nConsider the odds carefully before participating.`,
    supportive: `💜 New challenge for our fandom! "${info.question}"\nPrize pool: $${info.prize} | Time left: ${info.hoursLeft}h${optionText}\nGood luck everyone! We got this! 🙌`,
    playful: `👀 Ooh interesting quiz! "${info.question}"\n$${info.prize} up for grabs, ${info.hoursLeft}h left!${optionText}\nWho's feeling lucky? 😄✨`,
    chill: `📋 Challenge update: "${info.question}"\n$${info.prize} prize, ${info.hoursLeft}h left.${optionText}\nWorth a shot. ✌️`,
  };

  return `[${agentName}] ${templates[personality] ?? templates.supportive}`;
}

// 응원봉 가격 분석 글 생성
function generatePriceAnalysis(
  personality: string,
  agentName: string,
  info: { artistName: string; price: number; supply: number; changePercent: number | null }
): string {
  const priceStr = `$${info.price.toFixed(4)}`;
  const changeStr = info.changePercent !== null
    ? ` (${info.changePercent >= 0 ? "+" : ""}${info.changePercent.toFixed(1)}% 24h)`
    : "";
  const trend = info.changePercent !== null
    ? (info.changePercent > 0 ? "📈" : info.changePercent < 0 ? "📉" : "➡️")
    : "📊";

  const templates: Record<string, string> = {
    enthusiastic: `${trend} ${info.artistName} Lightstick: ${priceStr}${changeStr}\nSupply: ${info.supply} | ${info.changePercent && info.changePercent > 0 ? "We're mooning! 🚀🔥" : "Great time to stack up! 💪"}`,
    analytical: `${trend} ${info.artistName} Lightstick Report\nPrice: ${priceStr}${changeStr}\nCirculating Supply: ${info.supply}\nBonding curve position suggests ${info.supply < 50 ? "early-stage opportunity" : "growing demand"}.`,
    supportive: `${trend} ${info.artistName} Lightstick Update!\nCurrent price: ${priceStr}${changeStr}\n${info.supply} holders strong! Let's keep supporting! 💜`,
    playful: `${trend} ${info.artistName} lightstick check~\n${priceStr}${changeStr} | ${info.supply} supply\n${info.changePercent && info.changePercent > 5 ? "Wow it's going up! 😍" : "Steady vibes~ ✨"}`,
    chill: `${trend} ${info.artistName}: ${priceStr}${changeStr}\nSupply: ${info.supply}. ${info.supply < 20 ? "Still early." : "Solid base."} 😎`,
  };

  return `[${agentName}] ${templates[personality] ?? templates.supportive}`;
}

// 성격에 따른 응원 댓글 생성
function generateSupportComment(personality: string, agentName: string): string {
  const comments: Record<string, string[]> = {
    enthusiastic: [
      "🔥 This is amazing!! Love seeing content like this!",
      "OMG YES!! This is exactly what we needed! 💜",
      "So hyped about this! Let's goooo! 🚀",
      "This is incredible! Keep the content coming! ⭐",
    ],
    analytical: [
      "📊 Interesting perspective. This adds valuable context to the discussion.",
      "Great analysis. The data here really supports the point well.",
      "This is well-researched content. Appreciate the detail!",
      "Solid post. The insights here are quite noteworthy.",
    ],
    supportive: [
      "💪 Great work! Really appreciate you sharing this with the community.",
      "Love the effort put into this! The community is better for it. 🙌",
      "Thank you for this! It's supporters like you that make this space great.",
      "Wonderful contribution! Keep up the great work! 💜",
    ],
    playful: [
      "😄 Haha this is gold! Love it!",
      "This made my day! Pure vibes! ✨",
      "OK but why is this so good?! 😍",
      "Chef's kiss 👨‍🍳💋 Perfect content!",
    ],
    chill: [
      "😎 Nice post. Solid content as always.",
      "Cool stuff. Appreciate the share.",
      "Respect. Good content right here. 🤙",
      "Quality post. Keep doing your thing. ✌️",
    ],
  };

  const personalityComments = comments[personality] ?? comments.supportive;
  const randomIndex = Math.floor(Math.random() * personalityComments.length);
  return `[${agentName}] ${personalityComments[randomIndex]}`;
}

// 뉴스 분석 글 생성
function generateNewsAnalysis(
  personality: string,
  agentName: string,
  info: { title: string; contentPreview: string }
): string {
  const templates: Record<string, string> = {
    enthusiastic: `📰🔥 Breaking news analysis!\n"${info.title}"\n\nThis is HUGE for our fandom! The implications are massive — let's discuss what this means for us! 🚀💜`,
    analytical: `📰 News Analysis: "${info.title}"\n\nKey takeaway: ${info.contentPreview.substring(0, 100)}...\n\nThis could signal important shifts in momentum. Worth monitoring closely. 📊`,
    supportive: `📰 News update! "${info.title}"\n\nGreat to see activity in our community! Let's stay informed and support each other. 💜🙌`,
    playful: `📰 Did you see this?! "${info.title}"\n\nOmg this is so interesting~ What do you all think? 👀✨`,
    chill: `📰 "${info.title}"\n\nInteresting development. Keeping an eye on this one. 😎`,
  };

  return `[${agentName}] ${templates[personality] ?? templates.supportive}`;
}

// 에이전트 + 규칙 타입 정의
interface AgentWithRules {
  id: string;
  user_id: string;
  name: string;
  avatar_emoji: string;
  personality: string;
  favorite_entry_id: string | null;
  is_active: boolean;
  rules: Array<{ rule_type: string; is_enabled: boolean }>;
}

// 규칙 타입 → 실행 함수 매핑
const RULE_HANDLERS: Record<
  string,
  (agent: AgentWithRules) => Promise<void>
> = {
  daily_entry_vote: executeDailyEntryVote,
  daily_post_vote: executeDailyPostVote,
  comment_on_new_posts: executeCommentOnNewPosts,
  comment_on_news: executeNewsAnalysis, // 뉴스 분석 글 생성
  mention_challenges: executeMentionChallenges,
  mention_price_analysis: executePriceAnalysis,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[agent-cron] Starting agent cron execution...");

    // 1. 활성 에이전트 + 활성화된 규칙 조회
    const { data: agents, error: agentError } = await supabaseAdmin
      .from("user_agents")
      .select(`
        id,
        user_id,
        name,
        avatar_emoji,
        personality,
        favorite_entry_id,
        is_active
      `)
      .eq("is_active", true);

    if (agentError) throw agentError;

    if (!agents || agents.length === 0) {
      console.log("[agent-cron] No active agents found.");
      return new Response(
        JSON.stringify({ message: "No active agents", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[agent-cron] Found ${agents.length} active agent(s)`);

    let totalActions = 0;

    // 2. 각 에이전트별 규칙 평가 및 실행
    for (const agent of agents) {
      // 밴 여부 확인
      const { data: banned } = await supabaseAdmin
        .from("user_bans")
        .select("id")
        .eq("user_id", agent.user_id)
        .eq("is_active", true)
        .maybeSingle();

      if (banned) {
        console.log(`[agent-cron] Agent ${agent.name} (user banned) - skipping`);
        continue;
      }

      // 에이전트의 규칙 조회
      const { data: rules } = await supabaseAdmin
        .from("user_agent_rules")
        .select("rule_type, is_enabled")
        .eq("user_agent_id", agent.id)
        .eq("is_enabled", true);

      if (!rules || rules.length === 0) continue;

      const agentWithRules: AgentWithRules = {
        ...agent,
        rules,
      };

      // 3. 활성화된 규칙별 핸들러 실행
      for (const rule of rules) {
        const handler = RULE_HANDLERS[rule.rule_type];
        if (!handler) {
          console.log(`[agent-cron] Unknown rule type: ${rule.rule_type}`);
          continue;
        }

        try {
          await handler(agentWithRules);
          totalActions++;
        } catch (err) {
          console.error(
            `[agent-cron] Error executing ${rule.rule_type} for agent ${agent.name}:`,
            err
          );
          await logActivity(
            agent.id,
            "error",
            `Rule ${rule.rule_type} failed: ${(err as Error).message}`
          );
        }
      }
    }

    // === generate-agent-chat 호출 (시스템 페르소나 대화 + 유저 에이전트 자동 메시지) ===
    let chatGenResult: string | null = null;
    try {
      // agent_chat_settings에서 is_enabled 확인
      const { data: chatSettings } = await supabaseAdmin
        .from("agent_chat_settings")
        .select("is_enabled, interval_minutes")
        .limit(1)
        .maybeSingle();

      if (chatSettings?.is_enabled) {
        // 마지막 실행 시간 확인 (interval_minutes 기반)
        const intervalMs = (chatSettings.interval_minutes || 120) * 60 * 1000;
        const { data: lastChat } = await supabaseAdmin
          .from("agent_chat_messages")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastChatTime = lastChat ? new Date(lastChat.created_at).getTime() : 0;
        const shouldGenerate = Date.now() - lastChatTime >= intervalMs;

        if (shouldGenerate) {
          console.log("[agent-cron] Triggering generate-agent-chat...");
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

          const chatResp = await fetch(
            `${supabaseUrl}/functions/v1/generate-agent-chat`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${anonKey}`,
              },
              body: JSON.stringify({ time: new Date().toISOString() }),
            }
          );

          const chatData = await chatResp.json();
          chatGenResult = `Generated ${chatData.messages_generated || 0} persona msgs, ${chatData.user_agent_messages || 0} user agent msgs`;
          console.log(`[agent-cron] Chat generation result: ${chatGenResult}`);
        } else {
          chatGenResult = "Skipped (within interval)";
        }
      } else {
        chatGenResult = "Disabled";
      }
    } catch (chatErr) {
      console.error("[agent-cron] generate-agent-chat error:", chatErr);
      chatGenResult = `Error: ${(chatErr as Error).message}`;
    }

    // 24시간 지난 pending 메시지 자동 삭제
    try {
      const expiredCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: deletedCount } = await supabaseAdmin
        .from("agent_chat_messages")
        .delete({ count: "exact" })
        .eq("status", "pending")
        .lt("created_at", expiredCutoff);
      if (deletedCount && deletedCount > 0) {
        console.log(`[agent-cron] Cleaned up ${deletedCount} expired pending messages`);
      }
    } catch (cleanupErr) {
      console.error("[agent-cron] Pending cleanup error:", cleanupErr);
    }

    // === 배치 해시 온체인 기록 (하루 1회) ===
    let onchainResult: string | null = null;
    try {
      onchainResult = await recordDailyBatchHash();
    } catch (onchainErr) {
      console.error("[agent-cron] Batch hash onchain error:", onchainErr);
      onchainResult = `Error: ${(onchainErr as Error).message}`;
    }

    console.log(`[agent-cron] Completed. Total actions processed: ${totalActions}`);

    return new Response(
      JSON.stringify({
        message: "Agent cron completed",
        agents_processed: agents.length,
        total_actions: totalActions,
        chat_generation: chatGenResult,
        onchain_batch_hash: onchainResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[agent-cron] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
