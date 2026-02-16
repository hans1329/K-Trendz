import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { ethers } from "https://esm.sh/ethers@6.15.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 컨트랙트 주소들
const CONTRACTS = {
  challenge:
    Deno.env.get("CHALLENGE_CONTRACT_ADDRESS") ??
    "0xdE5eDb6A6A10F1ae91C4ed33bd640D0667a650Da",
  // V5 FanzToken 컨트랙트 (Active)
  fanzToken:
    Deno.env.get("FANZTOKEN_CONTRACT_ADDRESS") ??
    "0x2003eF9610A34Dc5771CbB9ac1Db2B2c056C66C7",
  ktnzToken:
    Deno.env.get("KTNZ_TOKEN_CONTRACT_ADDRESS") ??
    "0x45dB0DA161Ede30990f827b09881938CDFfE1df6",
  // V1 Vote 컨트랙트 (Historical)
  vote:
    Deno.env.get("VOTE_V1_CONTRACT_ADDRESS") ??
    "0x341176e85D9D76eB9C04dDbCA9305d2aD7CAa086",
  // V2 Vote 컨트랙트 (Historical)
  voteV2:
    Deno.env.get("VOTE_V2_CONTRACT_ADDRESS") ??
    "0x9c08BB23352173800a725F208a438FfE32d59D05",
  // V3 Vote 컨트랙트 (Active - DAU 추적 가능)
  voteV3:
    Deno.env.get("VOTE_CONTRACT_ADDRESS") ??
    "0x70E4B129B624Fc99775D23382568209Bf9c2d923",
};

// 이벤트 토픽 정의
const EVENT_TOPICS: Record<string, Record<string, string>> = {
  challenge: {
    ChallengeCreated: ethers.id("ChallengeCreated(uint256,bytes32,uint256,uint256,uint256)"),
    Participated: ethers.id("Participated(uint256,address,bytes32,bool,uint256)"),
    AnswerRevealed: ethers.id("AnswerRevealed(uint256,string,bytes32)"),
    WinnersSelected: ethers.id("WinnersSelected(uint256,address[],uint256,bytes32)"),
    PrizeClaimed: ethers.id("PrizeClaimed(uint256,address,uint256)"),
  },
  fanzToken: {
    TokenCreated: ethers.id("TokenCreated(uint256,address,uint256,uint256)"),
    Bought: ethers.id("Bought(uint256,address,uint256,uint256,uint256,uint256)"),
    Sold: ethers.id("Sold(uint256,address,uint256,uint256,uint256)"),
  },
  ktnzToken: {
    Transfer: ethers.id("Transfer(address,address,uint256)"),
  },
  // V1 Vote 이벤트 (string 파라미터)
  vote: {
    Vote: ethers.id("Vote(address,string,string,uint256,uint256)"),
  },
  // V2 Vote 이벤트 (bytes32 해시, voter indexed)
  voteV2: {
    Vote: ethers.id("Vote(address,bytes32,bytes32,uint256,uint256)"),
  },
  // V3 Vote 이벤트 (operator indexed, actualVoter indexed, artistHash indexed)
  voteV3: {
    Vote: ethers.id("Vote(address,address,bytes32,bytes32,uint256,uint256)"),
  },
};

// 토픽에서 이벤트 이름 찾기
function getEventNameFromTopic(topic0: string): string {
  for (const [, events] of Object.entries(EVENT_TOPICS)) {
    for (const [eventName, topic] of Object.entries(events)) {
      if (topic === topic0) return eventName;
    }
  }
  return "Unknown";
}

// 컨트랙트 주소에서 이름 찾기
function getContractName(address: string): string {
  const normalized = address.toLowerCase();
  for (const [name, addr] of Object.entries(CONTRACTS)) {
    if (addr.toLowerCase() === normalized) return name;
  }
  return "unknown";
}

// Alchemy RPC 우선 사용 (eth_getLogs)
const getBaseRpcUrl = () => {
  const alchemyKey = Deno.env.get('ALCHEMY_API_KEY');
  if (alchemyKey) return `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`;
  return Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";
};
const BASE_RPC_URL = getBaseRpcUrl();

interface RpcLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  blockHash: string;
  transactionHash: string;
  transactionIndex: string;
  logIndex: string;
  removed: boolean;
}

async function rpcGetLogs(params: {
  address: string;
  topic0: string;
  fromBlock: number;
  toBlock: string | number;
}): Promise<{ logs: RpcLog[]; latestBlock: number }> {
  const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  
  // 현재 블록 가져오기
  const latestBlock = await provider.getBlockNumber();
  
  // fromBlock이 0이면 최근 100,000 블록만 조회 (너무 오래된 데이터 방지)
  const effectiveFromBlock = params.fromBlock === 0 
    ? Math.max(latestBlock - 100000, 0) 
    : params.fromBlock;
  
  const filter = {
    address: params.address,
    topics: [params.topic0],
    fromBlock: effectiveFromBlock,
    toBlock: params.toBlock === "latest" ? latestBlock : Number(params.toBlock),
  };
  
  try {
    const logs = await provider.getLogs(filter);
    
    // ethers.js Log를 RpcLog 형식으로 변환
    const rpcLogs: RpcLog[] = await Promise.all(logs.map(async (log) => {
      // 블록 타임스탬프 가져오기
      const block = await provider.getBlock(log.blockNumber);
      return {
        address: log.address,
        topics: [...log.topics],
        data: log.data,
        blockNumber: "0x" + log.blockNumber.toString(16),
        blockHash: log.blockHash,
        transactionHash: log.transactionHash,
        transactionIndex: "0x" + log.transactionIndex.toString(16),
        logIndex: "0x" + log.index.toString(16),
        removed: log.removed,
        timestamp: block?.timestamp || Math.floor(Date.now() / 1000),
      } as RpcLog & { timestamp: number };
    }));
    
    return { logs: rpcLogs, latestBlock };
  } catch (error) {
    console.error("RPC getLogs error:", error);
    return { logs: [], latestBlock };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting RPC fetch with:", BASE_RPC_URL);

    // 각 컨트랙트별로 스캔
    for (const [contractKey, contractAddress] of Object.entries(CONTRACTS)) {
      const events = EVENT_TOPICS[contractKey];
      if (!events) continue;

      // 스캔 상태 조회
      const { data: scanState } = await supabase
        .from("onchain_scan_state")
        .select("last_scanned_block")
        .eq("contract_address", contractAddress.toLowerCase())
        .maybeSingle();

      // 시작 블록: 저장된 블록 + 1, 없으면 0
      const fromBlock = scanState?.last_scanned_block 
        ? Number(scanState.last_scanned_block) + 1 
        : 0;

      console.log(`${contractKey}: Fetching from block ${fromBlock}`);

      let maxBlockNumber = fromBlock - 1;
      let totalLogsFound = 0;

      // 각 이벤트 타입별로 조회
      for (const [eventName, topic0] of Object.entries(events)) {
        try {
          const { logs, latestBlock } = await rpcGetLogs({
            address: contractAddress,
            topic0,
            fromBlock,
            toBlock: "latest",
          });

          console.log(`${contractKey}.${eventName}: Found ${logs.length} logs`);
          totalLogsFound += logs.length;

          // latestBlock으로 maxBlockNumber 업데이트 (로그가 없어도)
          if (latestBlock > maxBlockNumber) {
            maxBlockNumber = latestBlock;
          }

          // 로그를 DB에 저장
          for (const log of logs) {
            const blockNumber = parseInt(log.blockNumber, 16);
            const timestamp = (log as RpcLog & { timestamp: number }).timestamp;
            const logIndex = parseInt(log.logIndex, 16);

            const { error: insertError } = await supabase
              .from("onchain_tx_cache")
              .upsert({
                tx_hash: log.transactionHash,
                block_number: blockNumber,
                log_index: logIndex,
                contract_address: log.address.toLowerCase(),
                event_type: eventName,
                event_data: {
                  topics: log.topics,
                  data: log.data,
                },
                block_timestamp: new Date(timestamp * 1000).toISOString(),
              }, {
                onConflict: "tx_hash,log_index",
                ignoreDuplicates: true,
              });

            if (insertError) {
              console.error(`Error inserting log:`, insertError);
            }
          }
          
        } catch (eventError) {
          console.error(`Error fetching ${contractKey}.${eventName}:`, eventError);
        }
      }

      // 스캔 상태 업데이트 (새 로그가 있었거나, 블록이 진행된 경우)
      if (maxBlockNumber >= fromBlock) {
        const { error: stateError } = await supabase
          .from("onchain_scan_state")
          .upsert({
            contract_address: contractAddress.toLowerCase(),
            last_scanned_block: maxBlockNumber,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "contract_address",
          });

        if (stateError) {
          console.error(`Error updating scan state:`, stateError);
        }
        console.log(`${contractKey}: Updated last_scanned_block to ${maxBlockNumber}, found ${totalLogsFound} total logs`);
      }
    }

    // DB에서 통계 조회
    const { data: txCounts, error: countError } = await supabase
      .from("onchain_tx_cache")
      .select("contract_address, event_type");

    if (countError) {
      throw countError;
    }

    // challenge_participations에서 온체인 기록된 참여 수 조회 (tx_hash가 있는 것만)
    const { count: participationCount } = await supabase
      .from("challenge_participations")
      .select("*", { count: "exact", head: true })
      .not("tx_hash", "is", null);

    const onchainParticipations = participationCount || 0;
    console.log(`On-chain participations from challenge_participations: ${onchainParticipations}`);

    // special_votes에서 온체인 기록된 투표 수 조회 (tx_hash가 있는 것만)
    const { count: specialVoteCount } = await supabase
      .from("special_votes")
      .select("*", { count: "exact", head: true })
      .not("tx_hash", "is", null);

    const onchainSpecialVotes = specialVoteCount || 0;
    console.log(`On-chain votes from special_votes: ${onchainSpecialVotes}`);

    // wiki_entry_votes에서 온체인 기록된 투표 수 조회 (tx_hash가 있는 것만)
    const { count: wikiEntryVoteCount } = await supabase
      .from("wiki_entry_votes")
      .select("*", { count: "exact", head: true })
      .not("tx_hash", "is", null);

    const onchainWikiEntryVotes = wikiEntryVoteCount || 0;
    console.log(`On-chain votes from wiki_entry_votes: ${onchainWikiEntryVotes}`);

    // post_votes에서 온체인 기록된 투표 수 조회 (tx_hash가 있는 것만)
    const { count: postVoteCount } = await supabase
      .from("post_votes")
      .select("*", { count: "exact", head: true })
      .not("tx_hash", "is", null);

    const onchainPostVotes = postVoteCount || 0;
    console.log(`On-chain votes from post_votes: ${onchainPostVotes}`);

    // support_proposal_votes에서 온체인 기록된 프로포절 투표 수 조회
    const { count: proposalVoteCount } = await supabase
      .from("support_proposal_votes")
      .select("*", { count: "exact", head: true })
      .not("tx_hash", "is", null);

    const onchainProposalVotes = proposalVoteCount || 0;
    console.log(`On-chain votes from support_proposal_votes: ${onchainProposalVotes}`);

    // support_proposal_opinion_votes에서 온체인 기록된 의견 투표 수 조회
    const { count: opinionVoteCount } = await supabase
      .from("support_proposal_opinion_votes")
      .select("*", { count: "exact", head: true })
      .not("tx_hash", "is", null);

    const onchainOpinionVotes = opinionVoteCount || 0;
    console.log(`On-chain votes from support_proposal_opinion_votes: ${onchainOpinionVotes}`);

    // support_proposal_opinions에서 온체인 기록된 의견 제안 수 조회
    const { count: opinionSubmissionCount } = await supabase
      .from("support_proposal_opinions")
      .select("*", { count: "exact", head: true })
      .not("tx_hash", "is", null);

    const onchainOpinionSubmissions = opinionSubmissionCount || 0;
    console.log(`On-chain opinion submissions from support_proposal_opinions: ${onchainOpinionSubmissions}`);

    // point_transactions에서 KTNZ mint/burn 트랜잭션 수 조회 (reference_id가 tx_hash인 것만)
    const { count: ktnzMintCount } = await supabase
      .from("point_transactions")
      .select("*", { count: "exact", head: true })
      .eq("action_type", "daily_token_mint")
      .not("reference_id", "is", null);

    const onchainKtnzMints = ktnzMintCount || 0;
    console.log(`On-chain KTNZ mints from point_transactions: ${onchainKtnzMints}`);

    const { count: ktnzBurnCount } = await supabase
      .from("point_transactions")
      .select("*", { count: "exact", head: true })
      .eq("action_type", "exchange_ktnz_to_points")
      .not("reference_id", "is", null);

    const onchainKtnzBurns = ktnzBurnCount || 0;
    console.log(`On-chain KTNZ burns from point_transactions: ${onchainKtnzBurns}`);

    const totalKtnzTransactions = onchainKtnzMints + onchainKtnzBurns;
    const totalOnchainVotes = onchainSpecialVotes + onchainWikiEntryVotes + onchainPostVotes + onchainProposalVotes + onchainOpinionVotes + onchainOpinionSubmissions;

    // 통계 계산
    const stats = {
      total: (txCounts?.length || 0) + onchainParticipations + totalOnchainVotes + totalKtnzTransactions,
      identity: onchainParticipations, // 참여는 Identity tx
      activity: totalOnchainVotes, // 모든 투표는 Activity tx
      economic: totalKtnzTransactions, // KTNZ mint/burn은 Economic tx
      byContract: {
        challenge: onchainParticipations,
        fanzToken: 0,
        ktnzToken: totalKtnzTransactions,
        vote: 0,
        voteV2: 0,
        voteV3: totalOnchainVotes,
      },
      detailed: {
        challenge: { Participated: onchainParticipations } as Record<string, number>,
        fanzToken: {} as Record<string, number>,
        ktnzTransfers: totalKtnzTransactions,
        ktnzMints: onchainKtnzMints,
        ktnzBurns: onchainKtnzBurns,
        vote: 0,
        voteV2: 0,
        voteV3: totalOnchainVotes,
      },
      source: "Alchemy RPC + DB Cache + Participations + SpecialVotes + WikiEntryVotes + PostVotes + ProposalVotes + OpinionVotes + OpinionSubmissions + KTNZ Mint/Burn",
    };

    // 이벤트 타입별로 분류
    for (const tx of txCounts || []) {
      const contractName = getContractName(tx.contract_address);
      const eventType = tx.event_type;

      // byContract 카운트
      if (contractName in stats.byContract) {
        stats.byContract[contractName as keyof typeof stats.byContract]++;
      }

      // detailed 카운트
      if (contractName === "challenge") {
        stats.detailed.challenge[eventType] = (stats.detailed.challenge[eventType] || 0) + 1;
      } else if (contractName === "fanzToken") {
        stats.detailed.fanzToken[eventType] = (stats.detailed.fanzToken[eventType] || 0) + 1;
      } else if (contractName === "ktnzToken") {
        stats.detailed.ktnzTransfers++;
      } else if (contractName === "vote") {
        stats.detailed.vote++;
      } else if (contractName === "voteV2") {
        stats.detailed.voteV2++;
      } else if (contractName === "voteV3") {
        stats.detailed.voteV3++;
      }

      // 카테고리별 분류
      if (eventType === "Participated") {
        stats.identity++;
      } else if (["ChallengeCreated", "AnswerRevealed", "WinnersSelected", "Vote"].includes(eventType)) {
        stats.activity++;
      } else {
        stats.economic++;
      }
    }

    // 최근 트랜잭션 50개 조회
    const { data: recentTxs } = await supabase
      .from("onchain_tx_cache")
      .select("*")
      .order("block_timestamp", { ascending: false })
      .limit(50);

    const transactions = (recentTxs || []).map(tx => {
      let description = getEventDescription(tx.event_type);
      
      // Vote 이벤트의 경우 artist 정보 파싱
      if (tx.event_type === "Vote" && tx.event_data?.data) {
        const contractName = getContractName(tx.contract_address);
        try {
          const abiCoder = ethers.AbiCoder.defaultAbiCoder();
          
          if (contractName === "vote") {
            // V1: Vote(address indexed voter, string artist, string inviteCode, uint256 voteCount, uint256 timestamp)
            const decoded = abiCoder.decode(
              ["string", "string", "uint256", "uint256"],
              tx.event_data.data
            );
            const artist = decoded[0];
            const voteCount = Number(decoded[2]);
            description = `Voted ${voteCount}x for "${artist}"`;
          } else if (contractName === "voteV2") {
            // V2: Vote(address indexed voter, bytes32 indexed artistHash, bytes32 inviteCodeHash, uint256 voteCount, uint256 timestamp)
            // artistHash는 indexed이므로 topics[2]에, data에는 inviteCodeHash, voteCount, timestamp만 있음
            const decoded = abiCoder.decode(
              ["bytes32", "uint256", "uint256"],
              tx.event_data.data
            );
            const voteCount = Number(decoded[1]);
            description = `Voted ${voteCount}x (V2)`;
          } else if (contractName === "voteV3") {
            // V3: Vote(address indexed operator, address indexed actualVoter, bytes32 indexed artistHash, bytes32 inviteCodeHash, uint256 voteCount, uint256 timestamp)
            // data에는 inviteCodeHash, voteCount, timestamp만 있음
            // actualVoter는 topics[2]에서 추출 가능
            const decoded = abiCoder.decode(
              ["bytes32", "uint256", "uint256"],
              tx.event_data.data
            );
            const voteCount = Number(decoded[1]);
            // actualVoter를 topics에서 추출 (topic index 2)
            const actualVoter = tx.event_data?.topics?.[2] 
              ? "0x" + tx.event_data.topics[2].slice(26) 
              : "unknown";
            description = `Voted ${voteCount}x (V3: ${actualVoter.slice(0, 8)}...)`;
          }
        } catch (e) {
          // 디코딩 실패해도 기본 description 유지
          console.warn("Failed to decode Vote event, using default description");
        }
      }
      
      return {
        txHash: tx.tx_hash,
        blockNumber: tx.block_number,
        timestamp: new Date(tx.block_timestamp).getTime() / 1000,
        contract: tx.contract_address,
        contractName: getContractName(tx.contract_address),
        eventName: tx.event_type,
        category: tx.event_type === "Participated" ? "identity" 
          : ["ChallengeCreated", "AnswerRevealed", "WinnersSelected", "Vote"].includes(tx.event_type) ? "activity" 
          : "economic",
        description,
        args: tx.event_data,
      };
    });

    console.log(`Total cached transactions: ${stats.total}`);

    return new Response(JSON.stringify({ transactions, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getEventDescription(eventType: string): string {
  const descriptions: Record<string, string> = {
    ChallengeCreated: "New challenge created",
    Participated: "User participated in a challenge",
    AnswerRevealed: "Challenge answer revealed",
    WinnersSelected: "Challenge winners selected",
    PrizeClaimed: "Prize claimed by winner",
    TokenCreated: "New lightstick token created",
    Bought: "Lightstick tokens bought",
    Sold: "Lightstick tokens sold",
    Transfer: "KTNZ token transfer",
    Vote: "Vote recorded on-chain",
  };
  return descriptions[eventType] || eventType;
}
