import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ethers } from "npm:ethers@6.15.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const USDC_DECIMALS = 6;
const BACKEND_WALLET_ADDRESS = "0xf1d20DF30aaD9ee0701C6ee33Fc1bb59466CaB36";

// Coinbase Smart Wallet Factory (Base Mainnet)
const COINBASE_SMART_WALLET_FACTORY = "0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a";

// SimpleAccountFactory (ERC-4337, Base Mainnet)
// - 과거/대체 AA 지갑 주소(SimpleAccountFactory 기반)로 토큰이 발행된 케이스 보완
const SIMPLE_ACCOUNT_FACTORY = "0x9406Cc6185a346906296840746125a0E44976454";

// Factory 인터페이스 (sell-fanz-token과 동일 계열)
const COINBASE_FACTORY_GET_ADDRESS_IFACE = new ethers.Interface([
  "function getAddress(bytes[] calldata owners, uint256 nonce) external view returns (address)",
]);

const COINBASE_FACTORY_LEGACY_IFACE = new ethers.Interface([
  "function getAddress(address[] calldata owners, uint256 nonce) external view returns (address)",
]);

const SIMPLE_ACCOUNT_FACTORY_IFACE = new ethers.Interface([
  "function getAddress(address owner, uint256 salt) external view returns (address)",
]);

// FanzTokenUSDC_v4 컨트랙트 ABI
const fanzTokenAbi = [
  "function balanceOf(address account, uint256 id) external view returns (uint256)",
  "function tokens(uint256 tokenId) view returns (uint256 totalSupply, uint256 basePrice, uint256 kValue, address creator, bool exists)",
  "function calculateBuyCost(uint256 tokenId, uint256 amount) view returns (uint256 reserveCost, uint256 artistFundFee, uint256 platformFee, uint256 totalCost)",
  // ERC-1155
  "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
  "event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)",
];

interface TokenRequest {
  tokenId: string;
}

interface BalanceRequest {
  walletAddress: string;
  tokens?: TokenRequest[];
  userId?: string; // 선택적: 사용자 ID로 EOA 조회
  includeMeta?: boolean; // 선택적: supply/price 등 부가정보 포함 여부(기본 true)
}

// AES 복호화 헬퍼 함수 (sell-fanz-token과 동일)
async function decryptPrivateKey(encryptedData: string, encryptionKey: string): Promise<string> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));

  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encryptedBytes = combined.slice(28);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(encryptionKey),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encryptedBytes,
  );

  return decoder.decode(decrypted);
}

// Coinbase Smart Wallet Factory를 통해 주소 예측 (bytes[] owners)
async function predictCoinbaseSmartWalletAddress(
  provider: ethers.JsonRpcProvider,
  ownersBytes: string[],
  nonce: bigint
): Promise<string> {
  const callData = COINBASE_FACTORY_GET_ADDRESS_IFACE.encodeFunctionData("getAddress", [ownersBytes, nonce]);
  const callResult = await provider.call({ to: COINBASE_SMART_WALLET_FACTORY, data: callData });
  const decoded = COINBASE_FACTORY_GET_ADDRESS_IFACE.decodeFunctionResult("getAddress", callResult) as unknown as [string];
  return ethers.getAddress(decoded[0]);
}

// 레거시 Coinbase Factory 방식 주소 예측 (address[] owners)
async function predictLegacyCoinbaseSmartWalletAddress(
  provider: ethers.JsonRpcProvider,
  ownerAddresses: string[],
  nonce: bigint
): Promise<string | null> {
  try {
    const callData = COINBASE_FACTORY_LEGACY_IFACE.encodeFunctionData("getAddress", [ownerAddresses, nonce]);
    const callResult = await provider.call({ to: COINBASE_SMART_WALLET_FACTORY, data: callData });
    const decoded = COINBASE_FACTORY_LEGACY_IFACE.decodeFunctionResult("getAddress", callResult) as unknown as [string];
    return ethers.getAddress(decoded[0]);
  } catch {
    return null;
  }
}

// SimpleAccountFactory 기반 주소 예측 (owner + salt)
async function predictSimpleAccountAddress(
  provider: ethers.JsonRpcProvider,
  owner: string,
  salt: bigint
): Promise<string | null> {
  try {
    const callData = SIMPLE_ACCOUNT_FACTORY_IFACE.encodeFunctionData("getAddress", [owner, salt]);
    const callResult = await provider.call({ to: SIMPLE_ACCOUNT_FACTORY, data: callData });
    const decoded = SIMPLE_ACCOUNT_FACTORY_IFACE.decodeFunctionResult("getAddress", callResult) as unknown as [string];
    return ethers.getAddress(decoded[0]);
  } catch {
    return null;
  }
}

// 사용자의 모든 가능한 지갑(EOA + Smart Wallet) 주소 수집
// - nonce(0~5) 범위는 성능과 정확성의 균형을 위해 제한한다.
async function collectCandidateAddresses(
  provider: ethers.JsonRpcProvider,
  primaryAddress: string,
  eoaAddress?: string,
  extraAddresses: string[] = []
): Promise<string[]> {
  const candidates = new Set<string>();

  const addCandidate = (addr?: string | null) => {
    if (!addr) return;
    try {
      candidates.add(ethers.getAddress(addr));
    } catch {
      // ignore invalid
    }
  };

  addCandidate(primaryAddress);
  extraAddresses.forEach(addCandidate);

  if (eoaAddress) {
    const eoa = ethers.getAddress(eoaAddress);
    addCandidate(eoa);

    // bytes[] owners 표현은 과거 버전 차이로 2가지 케이스가 존재한다.
    // - 32바이트(ABI encode address)
    // - 20바이트(raw address bytes)
    const ownersBytes32 = [ethers.AbiCoder.defaultAbiCoder().encode(["address"], [eoa])];
    const ownersBytes20 = [ethers.hexlify(ethers.getBytes(eoa))];

    const ownerAddresses = [eoa];

    const tasks: Promise<void>[] = [];

    for (let nonce = 0n; nonce <= 5n; nonce++) {
      tasks.push(
        predictCoinbaseSmartWalletAddress(provider, ownersBytes32, nonce)
          .then(addCandidate)
          .catch(() => {})
          .then(() => undefined)
      );
      tasks.push(
        predictCoinbaseSmartWalletAddress(provider, ownersBytes20, nonce)
          .then(addCandidate)
          .catch(() => {})
          .then(() => undefined)
      );
      tasks.push(
        predictLegacyCoinbaseSmartWalletAddress(provider, ownerAddresses, nonce)
          .then(addCandidate)
          .catch(() => {})
          .then(() => undefined)
      );
    }

    for (let salt = 0n; salt <= 5n; salt++) {
      tasks.push(
        predictSimpleAccountAddress(provider, eoa, salt)
          .then(addCandidate)
          .catch(() => {})
          .then(() => undefined)
      );
    }

    await Promise.all(tasks);
  }

  return Array.from(candidates);
}

// tx_hash(구매/민팅 트랜잭션) 영수증에서 실제 수령(to) 주소 후보를 수집
async function collectTxRecipientAddresses(
  provider: ethers.JsonRpcProvider,
  contractAddress: string,
  userId: string,
  tokenIds: string[]
): Promise<string[]> {
  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    if (!serviceRoleKey || !supabaseUrl) return [];
    if (!tokenIds || tokenIds.length === 0) return [];

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 1) token_id -> fanz_tokens.id 매핑
    const { data: tokenRows, error: tokenErr } = await supabaseAdmin
      .from("fanz_tokens")
      .select("id, token_id")
      .in("token_id", tokenIds);

    if (tokenErr || !tokenRows || tokenRows.length === 0) return [];

    const tokenIdByDbId = new Map<string, string>();
    const tokenDbIds: string[] = [];
    for (const r of tokenRows as any[]) {
      tokenDbIds.push(r.id);
      tokenIdByDbId.set(r.id, r.token_id);
    }

    // 2) 해당 토큰의 tx_hash 수집 (최신 1개씩)
    const { data: txRows, error: txErr } = await supabaseAdmin
      .from("fanz_transactions")
      .select("tx_hash, fanz_token_id, created_at")
      .eq("user_id", userId)
      .in("fanz_token_id", tokenDbIds)
      .not("tx_hash", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (txErr || !txRows || txRows.length === 0) return [];

    const txHashByTokenId = new Map<string, string>();
    for (const row of txRows as any[]) {
      const tokenId = tokenIdByDbId.get(row.fanz_token_id);
      const txHash = row.tx_hash as string | null;
      if (!tokenId || !txHash) continue;
      if (!txHashByTokenId.has(tokenId)) {
        txHashByTokenId.set(tokenId, txHash);
      }
    }

    const uniqueTxHashes = Array.from(new Set(Array.from(txHashByTokenId.values())));
    if (uniqueTxHashes.length === 0) return [];

    const wantedTokenIds = new Set(tokenIds.map(String));
    const recipients = new Set<string>();
    const iface = new ethers.Interface(fanzTokenAbi);

    for (const txHash of uniqueTxHashes) {
      const receipt = await provider.getTransactionReceipt(txHash).catch(() => null);
      if (!receipt) continue;

        for (const log of receipt.logs as any[]) {
          try {
            if (ethers.getAddress(log.address) !== ethers.getAddress(contractAddress)) continue;

            const parsed = iface.parseLog(log);
            if (!parsed) continue;

            if (parsed.name === "TransferSingle") {
              const idStr = (parsed.args.id as bigint).toString();
              const value = parsed.args.value as bigint;

              // 0-amount allowlist/no-op 트랜잭션은 실제 보유 지갑 추적에 도움이 안 되므로 제외
              if (value === 0n) continue;
              if (!wantedTokenIds.has(idStr)) continue;

              const to = ethers.getAddress(parsed.args.to as string);
              recipients.add(to);
            } else if (parsed.name === "TransferBatch") {
              const ids = parsed.args["ids"] as unknown as bigint[];
              const values = parsed.args["values"] as unknown as bigint[];

              let hasWanted = false;
              for (let i = 0; i < ids.length; i++) {
                if ((values[i] ?? 0n) > 0n && wantedTokenIds.has(ids[i].toString())) {
                  hasWanted = true;
                  break;
                }
              }
              if (!hasWanted) continue;

              const to = ethers.getAddress(parsed.args.to as string);
              recipients.add(to);
            }
          } catch {
            // ignore parse errors
          }
        }
    }

    return Array.from(recipients);
  } catch (e) {
    console.error("collectTxRecipientAddresses error:", e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Partial<BalanceRequest>;
    let walletAddress = body.walletAddress;
    const userId = body.userId;
    const includeMeta = body.includeMeta;
    const shouldIncludeMeta = includeMeta !== false;
    let tokens = Array.isArray(body.tokens) ? body.tokens : [];

    const contractAddress = Deno.env.get("FANZTOKEN_CONTRACT_ADDRESS");
    if (!contractAddress) {
      throw new Error("FANZTOKEN_CONTRACT_ADDRESS environment variable is not set");
    }

    const alchemyApiKey = Deno.env.get("ALCHEMY_API_KEY");
    if (!alchemyApiKey) {
      throw new Error("ALCHEMY_API_KEY environment variable is not set");
    }

    const encryptionKey = Deno.env.get("WALLET_ENCRYPTION_KEY");

    // Supabase Admin (활성 토큰 조회 + 지갑 후보 확장/EOA 복호화에 사용)
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAdminAny = serviceRoleKey && supabaseUrl ? createClient(supabaseUrl, serviceRoleKey) : null;
    const supabaseAdmin = userId ? supabaseAdminAny : null;

    // userId만 있고 walletAddress가 없는 경우, DB에서 지갑 주소 조회
    // - profiles 테이블에는 지갑 컬럼이 없으므로(walletAddress 관련 컬럼 없음)
    //   wallet_addresses 테이블에서 smart_wallet 우선으로 1개를 선택한다.
    if (!walletAddress && userId && supabaseAdminAny) {
      try {
        const { data: walletRows, error: walletErr } = await supabaseAdminAny
          .from("wallet_addresses")
          .select("wallet_address, wallet_type, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10);

        if (walletErr) {
          console.error("Failed to resolve walletAddress from wallet_addresses:", walletErr);
        } else if (walletRows && walletRows.length > 0) {
          const preferred =
            (walletRows as any[]).find((w) => w.wallet_type === "smart_wallet") ??
            (walletRows as any[])[0];

          if (preferred?.wallet_address) {
            walletAddress = preferred.wallet_address;
            console.log(`Resolved walletAddress from userId via wallet_addresses: ${walletAddress}`);
          }
        }
      } catch (e) {
        console.error("Failed to resolve walletAddress from wallet_addresses (exception):", e);
      }
    }

    // walletAddress가 여전히 없으면 빈 결과 반환 (에러 대신)
    if (!walletAddress) {
      console.log("No walletAddress provided or resolved, returning empty balances");
      return new Response(
        JSON.stringify({ balances: [], totalValue: 0, totalChange: 0, holdings: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // tokens가 없으면 서버에서 토큰 목록을 조회 (클라이언트 RLS 영향 제거)
    if (!tokens || tokens.length === 0) {
      if (!supabaseAdminAny) {
        return new Response(
          JSON.stringify({ balances: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // 1) 기본: 활성/발행된 토큰을 넓게 가져온다.
      // - contract_address 체크섬/대소문자 차이로 eq 필터가 0건이 되는 케이스가 있어 contract filter는 사용하지 않는다.
      // - 너무 많이 가져오지 않도록 200개로 제한한다.
      const { data: activeTokenRows, error: activeTokenErr } = await supabaseAdminAny
        .from("fanz_tokens")
        .select("token_id")
        .or("is_active.eq.true,total_supply.gt.0")
        .limit(200);

      if (activeTokenErr) {
        console.error("Failed to fetch active tokens:", activeTokenErr);
        return new Response(
          JSON.stringify({ balances: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      tokens = (activeTokenRows ?? []).map((r: any) => ({ tokenId: String(r.token_id) }));

      // 2) 추가 폴백: fanz_tokens가 비어있거나 필터링 이슈가 있더라도,
      // DB에 기록된 사용자 보유분(fanz_balances)에서 최소 토큰 목록을 구성한다.
      // (온체인 보유만 있고 DB가 늦게 동기화되는 경우엔 0개일 수 있음)
      if (tokens.length === 0 && userId) {
        const { data: balanceTokenRows, error: balanceTokenErr } = await supabaseAdminAny
          .from('fanz_balances')
          .select('fanz_tokens(token_id)')
          .eq('user_id', userId)
          .gt('balance', 0)
          .limit(50);

        if (!balanceTokenErr && balanceTokenRows) {
          const ids = (balanceTokenRows as any[])
            .map((r) => r?.fanz_tokens?.token_id)
            .filter(Boolean)
            .map((id) => ({ tokenId: String(id) }));

          if (ids.length > 0) tokens = ids;
        }
      }
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ balances: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(
      `Fetching balances for ${walletAddress}, tokens: ${tokens.length}, userId: ${userId || 'N/A'}, includeMeta: ${shouldIncludeMeta}`
    );

    // RPC: Alchemy 우선, rate limit(429) 발생 시 public RPC로 fallback
    const rpcUrl = `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;
    const provider = new ethers.JsonRpcProvider(rpcUrl, {
      chainId: 8453,
      name: 'base'
    });

    const fallbackProvider = new ethers.JsonRpcProvider('https://mainnet.base.org', {
      chainId: 8453,
      name: 'base'
    });

    const contract = new ethers.Contract(contractAddress, fanzTokenAbi, provider);
    const contractFallback = new ethers.Contract(contractAddress, fanzTokenAbi, fallbackProvider);

    const isRateLimited = (err: any) => {
      const code = err?.info?.error?.code;
      const msg = String(err?.info?.error?.message || err?.message || '');
      return code === 429 || msg.includes('compute units') || msg.includes('capacity') || msg.includes('429');
    };

    const callWithFallback = async (primary: () => Promise<any>, fallback: () => Promise<any>) => {
      try {
        return await primary();
      } catch (e) {
        if (isRateLimited(e)) {
          return await fallback();
        }
        throw e;
      }
    };

    console.log(`Contract address: ${contractAddress}`);

    // EOA 주소 + 지갑 히스토리 주소 조회
    let eoaAddress: string | undefined;
    let walletHistoryAddresses: string[] = [];

    if (supabaseAdmin && userId) {
      try {
        const [walletKeyRes, walletAddrRes] = await Promise.all([
          encryptionKey
            ? supabaseAdmin
                .from("wallet_private_keys")
                .select("encrypted_private_key")
                .eq("user_id", userId)
                .maybeSingle()
            : Promise.resolve({ data: null } as any),
          supabaseAdmin
            .from("wallet_addresses")
            .select("wallet_address")
            .eq("user_id", userId)
            .limit(50),
        ]);

        walletHistoryAddresses = (walletAddrRes?.data ?? [])
          .map((r: any) => r.wallet_address)
          .filter(Boolean);

        if (encryptionKey && walletKeyRes?.data?.encrypted_private_key) {
          const privateKey = await decryptPrivateKey(walletKeyRes.data.encrypted_private_key, encryptionKey);
          const userWallet = new ethers.Wallet(privateKey);
          eoaAddress = userWallet.address;
          console.log(`EOA address resolved: ${eoaAddress}`);
        }
      } catch (e) {
        console.error("Error fetching wallet data:", e);
      }
    }

    console.log(
      `Wallet history addresses (${walletHistoryAddresses.length}): ${walletHistoryAddresses.join(", ") || "none"}`
    );

    // 후보 주소 수집 (현재 주소 + EOA 기반 다양한 파생 주소 + 히스토리)
    let candidateAddresses = await collectCandidateAddresses(
      provider,
      walletAddress,
      eoaAddress,
      walletHistoryAddresses
    );

    // DB에 남아있는 tx_hash(구매/민팅)로 실제 수령 주소를 추가 후보로 포함
    if (userId) {
      const txRecipients = await collectTxRecipientAddresses(
        provider,
        contractAddress,
        userId,
        tokens.map(t => t.tokenId)
      );

      console.log(
        `Tx recipient addresses (${txRecipients.length}): ${txRecipients.length ? txRecipients.join(", ") : "none"}`
      );

      if (txRecipients.length > 0) {
        candidateAddresses = Array.from(new Set([...candidateAddresses, ...txRecipients]));
      }
    }

    console.log(`Candidate addresses (${candidateAddresses.length}): ${candidateAddresses.join(', ')}`);

    // 병렬로 모든 토큰의 잔액 조회 (모든 후보 주소에서)
    const results = await Promise.all(
      tokens.map(async ({ tokenId }) => {
        try {
          const tokenIdUint = BigInt(tokenId);

          // 모든 후보 주소에서 잔액 조회
          const balancePromises = candidateAddresses.map(addr =>
            callWithFallback(
              () => contract.balanceOf(addr, tokenIdUint),
              () => contractFallback.balanceOf(addr, tokenIdUint)
            )
              .then((bal: bigint) => ({ address: addr, balance: Number(bal) }))
              .catch(() => ({ address: addr, balance: 0 }))
          );

          const balanceResults = await Promise.all(balancePromises);

          // 잔액 합산
          const totalUserBalance = balanceResults.reduce((sum, r) => sum + r.balance, 0);
          const holdingAddress = balanceResults.find(r => r.balance > 0)?.address;

          // Transfer 화면처럼 "보유량"만 필요한 경우 RPC 호출을 크게 줄이기 위해 meta를 생략한다.
          if (!shouldIncludeMeta) {
            return {
              tokenId,
              balance: totalUserBalance,
              totalSupply: 0,
              userHeldSupply: 0,
              priceUsd: 0,
              holdingAddress,
            };
          }

          const [tokenInfo, backendBalance, buyCostResult] = await Promise.all([
            callWithFallback(
              () => contract.tokens(tokenIdUint),
              () => contractFallback.tokens(tokenIdUint)
            ),
            callWithFallback(
              () => contract.balanceOf(BACKEND_WALLET_ADDRESS, tokenIdUint),
              () => contractFallback.balanceOf(BACKEND_WALLET_ADDRESS, tokenIdUint)
            ),
            callWithFallback(
              () => contract.calculateBuyCost(tokenIdUint, 1),
              () => contractFallback.calculateBuyCost(tokenIdUint, 1)
            ).catch(() => [BigInt(0), BigInt(0), BigInt(0), BigInt(0)])
          ]);

          const totalSupply = Number(tokenInfo[0]);
          const userHeldSupply = Math.max(0, totalSupply - Number(backendBalance));

          const totalCost = buyCostResult[3] ?? buyCostResult[0] ?? BigInt(0);
          const priceUsd = Number(totalCost) / (10 ** USDC_DECIMALS);

          console.log(`Token ${tokenId}: balance=${totalUserBalance}, supply=${totalSupply}, price=${priceUsd}, holdingAddr=${holdingAddress || 'none'}`);

          return {
            tokenId,
            balance: totalUserBalance,
            totalSupply,
            userHeldSupply,
            priceUsd,
            holdingAddress, // 토큰이 있는 실제 주소 (복구용)
          };
        } catch (error) {
          console.error(`Error fetching token ${tokenId}:`, error);
          return {
            tokenId,
            balance: 0,
            totalSupply: 0,
            userHeldSupply: 0,
            priceUsd: 0,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })
    );

    console.log(`Fetched ${results.length} token balances`);

    return new Response(
      JSON.stringify({ balances: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
