import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ethers } from "npm:ethers@6.15.0";
import { BUILDER_CODE_SUFFIX } from "../_shared/builder-code.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const USDC_DECIMALS = 6;

// DAU 기록용 활동 타입
const ACTIVITY_FANZ_SELL = ethers.keccak256(ethers.toUtf8Bytes("fanz_sell"));

// ERC-4337 상수 (Base Mainnet)
const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

// Coinbase Smart Wallet Factory (Base Mainnet)
// - webhook-stripe-fanztoken 과 동일한 팩토리
const COINBASE_SMART_WALLET_FACTORY = "0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a";
const COINBASE_SMART_WALLET_IMPLEMENTATION = "0x000100abaad02f1cfC8Bbe32bD5a564817339E72";

// SimpleAccountFactory (ERC-4337, Base Mainnet)
// - 과거/대체 AA 지갑 주소(예: SimpleAccountFactory 기반)로 토큰이 발행된 케이스 복구용
const SIMPLE_ACCOUNT_FACTORY = "0x9406Cc6185a346906296840746125a0E44976454";

// Backend Smart Account (SimpleAccount) - 운영 주소 고정
// - Operator 권한으로 transferFor/sellFor 등을 수행해 레거시 지갑 복구에 사용
const BACKEND_SMART_ACCOUNT = "0x8B4197d938b8F4212B067e9925F7251B6C21B856";

// ERC1967Proxy creation code (OpenZeppelin) - webhook-stripe-fanztoken 과 동일
const PROXY_CREATION_CODE = "0x608060405260405161046c38038061046c83398101604081905261002291610249565b61002e82826000610035565b505061030e565b61003e83610061565b60008251118061004b5750805b1561005c5761005a83836100a1565b505b505050565b61006a816100cd565b6040516001600160a01b038216907fbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b90600090a250565b60606100c6838360405180606001604052806027815260200161044560279139610161565b9392505050565b6001600160a01b0381163b61013f5760405162461bcd60e51b815260206004820152602d60248201527f455243313936373a206e657720696d706c656d656e746174696f6e206973206e60448201526c1bdd08184818dbdb9d1c9858dd609a1b60648201526084015b60405180910390fd5b7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc80546001600160a01b0319166001600160a01b0392909216919091179055565b6060600080856001600160a01b03168560405161017e91906102bf565b600060405180830381855af49150503d80600081146101b9576040519150601f19603f3d011682016040523d82523d6000602084013e6101be565b606091505b5090925090506101d0868383876101da565b9695505050505050565b60608315610246578251610239576001600160a01b0385163b6102395760405162461bcd60e51b815260206004820152601d60248201527f416464726573733a2063616c6c20746f206e6f6e2d636f6e74726163740000006044820152606401610136565b5081610250565b6102508383610258565b949350505050565b8151156102685781518083602001fd5b8060405162461bcd60e51b81526004016101369190906102db565b634e487b7160e01b600052604160045260246000fd5b60005b838110156102b457818101518382015260200161029c565b50506000910152565b600082516102cf818460208701610299565b9190910192915050565b60208152600082518060208401526102f8816040850160208701610299565b601f01601f19169190910160400192915050565b610128806103206000396000f3fe6080604052366100135761001161001d565b005b61001b61001d565b005b610025610035565b61003561003061008c565b610095565b565b3660008037600080366000845af43d6000803e808015610056573d6000f35b3d6000fd5b60007f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc610087836100b9565b905090565b6000610087610121565b3660008037600080366000845af43d6000803e8080156100b4573d6000f35b3d6000fd5b6000806100c583610121565b9050806001600160a01b03163b6000036101175760405162461bcd60e51b815260206004820152600e60248201526d1393d517d355531317d05353d5d560921b604482015260640160405180910390fd5b919050565b60006100877f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc5490565b416464726573733a2064656c656761746563616c6c20746f206e6f6e2d636f6e7472616374000000";


// AES 복호화 헬퍼 함수
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

interface UserOperation {
  sender: string;
  nonce: bigint;
  initCode: string;
  callData: string;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: string;
  signature: string;
}

function getUserOpHash(userOp: UserOperation, chainId: bigint): string {
  const packed = ethers.AbiCoder.defaultAbiCoder().encode(
    ['address', 'uint256', 'bytes32', 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes32'],
    [
      userOp.sender,
      userOp.nonce,
      ethers.keccak256(userOp.initCode),
      ethers.keccak256(userOp.callData),
      userOp.callGasLimit,
      userOp.verificationGasLimit,
      userOp.preVerificationGas,
      userOp.maxFeePerGas,
      userOp.maxPriorityFeePerGas,
      ethers.keccak256(userOp.paymasterAndData),
    ]
  );
  
  const userOpHashInner = ethers.keccak256(packed);
  
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'address', 'uint256'],
      [userOpHashInner, ENTRY_POINT_ADDRESS, chainId]
    )
  );
}

const toRpcHex = (value: bigint | number) => {
  const v = typeof value === "bigint" ? value : BigInt(value);
  return "0x" + v.toString(16);
};

const logStep = (step: string, details?: any) => {
  console.log(`[SELL-FANZ-TOKEN-GASLESS] ${step}`, details || '');
};

// Smart Wallet 주소 예측 (Factory staticcall)
// - 로컬 CREATE2 재구성/브루트포스는 Worker CPU 제한(546) 및 버전 불일치 리스크가 있어 사용하지 않는다.
// - Factory의 getAddress(...)를 call로 실행하면 "배포 없이" 예측 주소를 얻을 수 있다.
//   (createAccount를 call로 때리면, 구현 변화/리버트 데이터 미노출로 디버깅이 어려워질 수 있음)
const COINBASE_FACTORY_GET_ADDRESS_IFACE = new ethers.Interface([
  "function getAddress(bytes[] calldata owners, uint256 nonce) external view returns (address)",
]);

// 레거시 Factory 인터페이스 (address[] 방식)
const COINBASE_FACTORY_LEGACY_IFACE = new ethers.Interface([
  "function getAddress(address[] calldata owners, uint256 nonce) external view returns (address)",
  "function createAccount(address[] calldata owners, uint256 nonce) external payable returns (address)",
]);

// SimpleAccountFactory 인터페이스 (owner + salt)
const SIMPLE_ACCOUNT_FACTORY_IFACE = new ethers.Interface([
  "function getAddress(address owner, uint256 salt) external view returns (address)",
  "function createAccount(address owner, uint256 salt) external returns (address)",
]);

// Smart Wallet 주소 예측 (Factory staticcall) - bytes[] 방식
async function predictCoinbaseSmartWalletAddress(
  provider: ethers.JsonRpcProvider,
  ownersBytes: string[],
  factoryNonce: bigint,
): Promise<string> {
  const data = COINBASE_FACTORY_GET_ADDRESS_IFACE.encodeFunctionData("getAddress", [
    ownersBytes,
    factoryNonce,
  ]);
  const result = await provider.call({ to: COINBASE_SMART_WALLET_FACTORY, data });
  const decoded = COINBASE_FACTORY_GET_ADDRESS_IFACE.decodeFunctionResult(
    "getAddress",
    result,
  ) as unknown as [string];
  return ethers.getAddress(decoded[0]);
}

// 레거시 Smart Wallet 주소 예측 (address[] 방식)
async function predictLegacySmartWalletAddress(
  provider: ethers.JsonRpcProvider,
  ownerAddresses: string[],
  factoryNonce: bigint,
): Promise<string | null> {
  try {
    const data = COINBASE_FACTORY_LEGACY_IFACE.encodeFunctionData("getAddress", [
      ownerAddresses,
      factoryNonce,
    ]);
    const result = await provider.call({ to: COINBASE_SMART_WALLET_FACTORY, data });
    const decoded = COINBASE_FACTORY_LEGACY_IFACE.decodeFunctionResult(
      "getAddress",
      result,
    ) as unknown as [string];
    return ethers.getAddress(decoded[0]);
  } catch (e) {
    logStep("Legacy getAddress call failed (may not be supported)", {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

// 레거시 방식(address[])으로 nonce 탐색
async function findLegacyFactoryNonceForStoredAddress(
  provider: ethers.JsonRpcProvider,
  ownerAddresses: string[],
  targetAddress: string,
  options?: { maxNonce?: number; chunkSize?: number; timeBudgetMs?: number },
): Promise<bigint | null> {
  const maxNonce = options?.maxNonce ?? 100;
  const chunkSize = options?.chunkSize ?? 10;
  const timeBudgetMs = options?.timeBudgetMs ?? 2000;

  const target = targetAddress.toLowerCase();
  const start = performance.now();

  for (let base = 0; base <= maxNonce; base += chunkSize) {
    if (performance.now() - start > timeBudgetMs) break;

    const tasks: Promise<{ nonce: bigint; addr: string } | null>[] = [];
    for (let i = 0; i < chunkSize && base + i <= maxNonce; i++) {
      const nonce = BigInt(base + i);
      tasks.push(
        predictLegacySmartWalletAddress(provider, ownerAddresses, nonce)
          .then((addr) => (addr ? { nonce, addr: addr.toLowerCase() } : null))
          .catch(() => null),
      );
    }

    const results = await Promise.all(tasks);
    for (const r of results) {
      if (r && r.addr === target) return r.nonce;
    }
  }

  return null;
}

// 레거시/구버전 데이터(지갑 주소) 복구용 nonce 탐색 (RPC 기반)
// - 과거에 잘못 저장된 wallet_address 가 사실은 같은 owner의 다른 nonce일 수 있어 제한된 범위만 스캔한다.
// - CPU 루프 대신 eth_call을 병렬로 호출해 WORKER_LIMIT(546) 리스크를 낮춘다.
async function findFactoryNonceForStoredAddressViaRpc(
  provider: ethers.JsonRpcProvider,
  ownersBytes: string[],
  targetAddress: string,
  options?: { maxNonce?: number; chunkSize?: number; timeBudgetMs?: number },
): Promise<bigint | null> {
  const maxNonce = options?.maxNonce ?? 250;
  const chunkSize = options?.chunkSize ?? 25;
  const timeBudgetMs = options?.timeBudgetMs ?? 2500;

  const target = targetAddress.toLowerCase();
  const start = performance.now();

  for (let base = 0; base <= maxNonce; base += chunkSize) {
    if (performance.now() - start > timeBudgetMs) break;

    const tasks: Promise<{ nonce: bigint; addr: string } | null>[] = [];
    for (let i = 0; i < chunkSize && base + i <= maxNonce; i++) {
      const nonce = BigInt(base + i);
      tasks.push(
        predictCoinbaseSmartWalletAddress(provider, ownersBytes, nonce)
          .then((addr) => ({ nonce, addr: addr.toLowerCase() }))
          .catch(() => null),
      );
    }

    const results = await Promise.all(tasks);
    for (const r of results) {
      if (r && r.addr === target) return r.nonce;
    }
  }

  return null;
}

// SimpleAccountFactory 기반 주소 예측/복구 (owner + salt)
async function predictSimpleAccountAddress(
  provider: ethers.JsonRpcProvider,
  owner: string,
  salt: bigint,
): Promise<string | null> {
  try {
    const data = SIMPLE_ACCOUNT_FACTORY_IFACE.encodeFunctionData("getAddress", [owner, salt]);
    const result = await provider.call({ to: SIMPLE_ACCOUNT_FACTORY, data });
    const decoded = SIMPLE_ACCOUNT_FACTORY_IFACE.decodeFunctionResult(
      "getAddress",
      result,
    ) as unknown as [string];
    return ethers.getAddress(decoded[0]);
  } catch {
    return null;
  }
}

// SimpleAccountFactory 기반 salt 탐색 (RPC 병렬)
// - Worker CPU 제한을 피하기 위해 eth_call을 병렬로 제한된 범위만 스캔한다.
async function findSimpleAccountSaltForStoredAddressViaRpc(
  provider: ethers.JsonRpcProvider,
  owner: string,
  targetAddress: string,
  options?: { maxSalt?: number; chunkSize?: number; timeBudgetMs?: number },
): Promise<bigint | null> {
  const maxSalt = options?.maxSalt ?? 250;
  const chunkSize = options?.chunkSize ?? 25;
  const timeBudgetMs = options?.timeBudgetMs ?? 2500;

  const target = targetAddress.toLowerCase();
  const start = performance.now();

  // Capability check (avoid log spam)
  const test = await predictSimpleAccountAddress(provider, owner, 0n);
  if (!test) {
    logStep("SimpleAccountFactory getAddress not available (skip)", {
      owner,
      factory: SIMPLE_ACCOUNT_FACTORY,
    });
    return null;
  }
  if (test.toLowerCase() === target) return 0n;

  for (let base = 1; base <= maxSalt; base += chunkSize) {
    if (performance.now() - start > timeBudgetMs) break;

    const tasks: Promise<{ salt: bigint; addr: string } | null>[] = [];
    for (let i = 0; i < chunkSize && base + i <= maxSalt; i++) {
      const salt = BigInt(base + i);
      tasks.push(
        predictSimpleAccountAddress(provider, owner, salt)
          .then((addr) => (addr ? { salt, addr: addr.toLowerCase() } : null))
          .catch(() => null),
      );
    }

    const results = await Promise.all(tasks);
    for (const r of results) {
      if (r && r.addr === target) return r.salt;
    }
  }

  return null;
}


// Smart Wallet 주소 계산 (Coinbase Smart Wallet Factory 규격 - webhook-stripe-fanztoken 과 동일)
// - factoryNonce 는 createAccount(owners, nonce) 에 전달하는 nonce 값과 동일해야 함
// - 성능 이슈(546 WORKER_LIMIT) 방지를 위해, 주소 계산 로직은 재사용 가능한 함수로 구성한다.

// 32바이트 워드(hex) 패딩 헬퍼
const pad32Hex = (value: bigint) => value.toString(16).padStart(64, "0");

function makeSmartAccountAddressFn(ownerAddress: string) {
  const owners = [ownerAddress];
  const abiCoder = new ethers.AbiCoder();

  // create-smart-wallet 과 동일한 initialize calldata
  const initializeInterface = new ethers.Interface([
    "function initialize(address[] owners)",
  ]);
  const initializeCalldata = initializeInterface.encodeFunctionData("initialize", [owners]);

  const constructorArgs = abiCoder.encode(
    ["address", "bytes"],
    [COINBASE_SMART_WALLET_IMPLEMENTATION, initializeCalldata],
  );

  const initCode = PROXY_CREATION_CODE + constructorArgs.slice(2);
  const initCodeHash = ethers.keccak256(initCode);

  return (factoryNonce: bigint) => {
    const encodedOwnersAndNonce = abiCoder.encode(
      ["address[]", "uint256"],
      [owners, factoryNonce],
    );
    const salt = ethers.keccak256(encodedOwnersAndNonce);

    // create-smart-wallet 과 동일하게 ethers.getCreate2Address 를 사용해 계산
    return ethers.getCreate2Address(
      COINBASE_SMART_WALLET_FACTORY,
      salt,
      initCodeHash,
    );
  };
}

// 빠른 Smart Wallet 주소 계산 (owners.length === 1 전제)
// - abiCoder.encode(address[] owners, uint256 nonce) 가 매우 비싸서, 동일한 ABI 인코딩을 수동으로 구성한다.
function makeSmartAccountAddressFnFast(ownerAddress: string) {
  const owners = [ownerAddress];
  const abiCoder = new ethers.AbiCoder();

  // initialize calldata 및 initCodeHash 는 nonce와 무관하므로 1회만 계산
  const initializeInterface = new ethers.Interface([
    "function initialize(address[] owners)",
  ]);
  const initializeCalldata = initializeInterface.encodeFunctionData("initialize", [owners]);

  const constructorArgs = abiCoder.encode(
    ["address", "bytes"],
    [COINBASE_SMART_WALLET_IMPLEMENTATION, initializeCalldata],
  );

  const initCode = PROXY_CREATION_CODE + constructorArgs.slice(2);
  const initCodeHash = ethers.keccak256(initCode);

  // abi.encode(address[] owners, uint256 nonce) for owners.length === 1
  // head: [offset_to_array=0x40][nonce]
  // tail: [array_len=1][owner_address]
  const offsetWord = pad32Hex(0x40n);
  const lenWord = pad32Hex(1n);
  const ownerWord = ownerAddress.toLowerCase().replace("0x", "").padStart(64, "0");
  const prefix = "0x" + offsetWord;
  const suffix = lenWord + ownerWord;

  return (factoryNonce: bigint) => {
    const nonceWord = factoryNonce.toString(16).padStart(64, "0");
    const encodedOwnersAndNonce = prefix + nonceWord + suffix;
    const salt = ethers.keccak256(encodedOwnersAndNonce);

    return ethers.getCreate2Address(
      COINBASE_SMART_WALLET_FACTORY,
      salt,
      initCodeHash,
    );
  };
}

function findFactoryNonceForTargetAddress(
  addressForNonce: (nonce: bigint) => string,
  targetAddress: string,
  options?: { maxNonce?: number; timeBudgetMs?: number },
): bigint | null {
  // NOTE: 레거시 지갑 복구를 위해 범위를 넉넉히 주되, Worker CPU 제한을 넘지 않도록 시간 예산으로 강제 중단한다.
  const maxNonce = options?.maxNonce ?? 1_000_000;
  const timeBudgetMs = options?.timeBudgetMs ?? 2500;

  const target = targetAddress.toLowerCase();
  const start = performance.now();

  for (let i = 0; i <= maxNonce; i++) {
    const candidate = addressForNonce(BigInt(i)).toLowerCase();
    if (candidate === target) return BigInt(i);

    // 일정 주기로 시간 체크하여 Worker 리소스 초과 방지
    if ((i & 4095) === 0 && performance.now() - start > timeBudgetMs) break;
  }

  return null;
}


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started (Gasless via Paymaster)");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // 환경변수 확인
    const paymasterUrl = Deno.env.get("COINBASE_PAYMASTER_URL");
    const encryptionKey = Deno.env.get("WALLET_ENCRYPTION_KEY");
    const contractAddress = Deno.env.get("FANZTOKEN_CONTRACT_ADDRESS");
    const baseRpcUrl = Deno.env.get("BASE_RPC_URL");
    const baseOperatorPrivateKey = Deno.env.get("BASE_OPERATOR_PRIVATE_KEY");

    if (!paymasterUrl) throw new Error("Missing COINBASE_PAYMASTER_URL");
    if (!encryptionKey) throw new Error("Missing WALLET_ENCRYPTION_KEY");
    if (!contractAddress) throw new Error("Missing FANZTOKEN_CONTRACT_ADDRESS");
    if (!baseRpcUrl) throw new Error("Missing BASE_RPC_URL");


    // 사용자 인증
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { tokenId, amount } = await req.json();
    if (!tokenId || !amount || amount !== 1) {
      throw new Error("Invalid request: only 1 token can be sold at a time (AMM constraint)");
    }
    logStep("Request data", { tokenId, amount });

    // Fanz Token 정보 조회
    const { data: fanzToken, error: tokenError } = await supabaseClient
      .from('fanz_tokens')
      .select('*')
      .eq('id', tokenId)
      .single();

    if (tokenError || !fanzToken) {
      throw new Error('Token not found');
    }
    logStep("Token found", { tokenId, currentSupply: fanzToken.total_supply, tokenIdOnChain: fanzToken.token_id });

    // tokenId를 uint256으로 변환
    const tokenIdUint = BigInt(fanzToken.token_id);
    logStep("Token ID converted", { tokenIdOnChain: fanzToken.token_id, tokenIdUint: tokenIdUint.toString() });

    // 사용자 암호화된 private key 조회
    const { data: keyData, error: keyError } = await supabaseClient
      .from('wallet_private_keys')
      .select('encrypted_private_key, wallet_address')
      .eq('user_id', user.id)
      .single();

    if (keyError || !keyData) {
      throw new Error('User wallet not found');
    }

    // Private key 복호화
    let privateKey: string;
    try {
      privateKey = await decryptPrivateKey(keyData.encrypted_private_key, encryptionKey);
    } catch {
      if (keyData.encrypted_private_key.startsWith('0x') && keyData.encrypted_private_key.length === 66) {
        privateKey = keyData.encrypted_private_key;
      } else {
        throw new Error('Decryption failed');
      }
    }
    
    const userWallet = new ethers.Wallet(privateKey);
    logStep("User wallet initialized", { address: userWallet.address });

    // 읽기용 프로바이더 (RPC)
    // - scanProvider: 주소 예측/다중 잔액 조회 등 "호출량이 많은" 작업 (429 회피 목적)
    // - pricingProvider: 가격/환불 계산 등 "정확한 eth_call"이 필요한 작업 (상용 RPC 사용)
    //   NOTE: 일부 public RPC는 복잡한 view call에서 revert data가 누락되는 케이스가 있어, pricingProvider는 baseRpcUrl을 그대로 사용한다.
    const scanRpcUrl = (baseRpcUrl.includes("alchemy.com") || baseRpcUrl.includes("alchemyapi.io"))
      ? "https://mainnet.base.org"
      : baseRpcUrl;

    const scanProvider = new ethers.JsonRpcProvider(scanRpcUrl, { name: "base", chainId: 8453 });
    const pricingProvider = new ethers.JsonRpcProvider(baseRpcUrl, { name: "base", chainId: 8453 });
    logStep("RPC providers configured", { scanRpcUrl, pricingRpcUrl: baseRpcUrl });

    const readProvider = scanProvider; // 기존 변수명 유지 (대부분 스캔/조회용)
    const chainId = 8453n; // Base Mainnet

    // Smart Wallet 주소 후보 (DB 저장값 vs Factory 예측값)
    const smartAccountAddressFromDb = ethers.getAddress(keyData.wallet_address);

    // CoinbaseSmartWalletFactory owners(bytes[])는 과거 구현/버그에 따라 "주소 바이트 표현"이 달랐을 수 있다.
    // - 32바이트(abi.encode(address))와 20바이트(raw address bytes) 두 가지를 모두 시도하여 레거시를 복구한다.
    const ownersBytes32 = [ethers.AbiCoder.defaultAbiCoder().encode(["address"], [userWallet.address])];
    const ownersBytes20 = [ethers.hexlify(ethers.getBytes(userWallet.address))];

    // 기본값: nonce = 0 (create-smart-wallet 표준)
    let ownersBytes = ownersBytes32;
    let factoryNonce = 0n;

    // bytes32 표현으로 예측
    let smartAccountAddressFromOwner = await predictCoinbaseSmartWalletAddress(
      readProvider,
      ownersBytes32,
      0n,
    );

    // bytes20 표현으로 예측(레거시)
    let smartAccountAddressFromOwnerAlt: string | null = null;
    try {
      smartAccountAddressFromOwnerAlt = await predictCoinbaseSmartWalletAddress(
        readProvider,
        ownersBytes20,
        0n,
      );
    } catch (e) {
      logStep("Alt owner-bytes prediction failed (non-blocking)", {
        message: e instanceof Error ? e.message : String(e),
      });
      smartAccountAddressFromOwnerAlt = null;
    }

    // 배포/주소검증에 사용할 Factory 모드
    // - 기본은 Coinbase Smart Wallet Factory(bytes[])
    // - 레거시 address[] 또는 SimpleAccountFactory 케이스를 복구하기 위해 런타임에 전환한다.
    let deploymentFactory: "coinbase" | "coinbase_legacy" | "simple_account" = "coinbase";

    // DB 저장 주소와 예측 주소가 일치하면 즉시 verified 처리
    let factoryNonceVerified =
      smartAccountAddressFromOwner.toLowerCase() === smartAccountAddressFromDb.toLowerCase();

    // alt 표현(20바이트)로 DB 주소가 맞으면 그 표현을 우선 사용(레거시 호환)
    if (!factoryNonceVerified && smartAccountAddressFromOwnerAlt) {
      const altMatchesDb =
        smartAccountAddressFromOwnerAlt.toLowerCase() === smartAccountAddressFromDb.toLowerCase();

      if (altMatchesDb) {
        ownersBytes = ownersBytes20;
        smartAccountAddressFromOwner = smartAccountAddressFromOwnerAlt;
        factoryNonceVerified = true;
      }
    }

    // 레거시/구버전에서 잘못 계산되어 저장된 주소인지 힌트를 얻기 위한 로컬 계산(진단용)
    // - 이 값이 DB 주소와 같더라도, Factory 기준으로 배포/서명이 가능한지는 별도 검증이 필요하다.
    let legacyPredictedNonce0: string | null = null;
    try {
      legacyPredictedNonce0 = ethers.getAddress(makeSmartAccountAddressFnFast(userWallet.address)(0n));
    } catch {
      legacyPredictedNonce0 = null;
    }

    logStep("Smart Wallet candidates", {
      rpcUrl: scanRpcUrl,
      smartAccountAddressFromDb,
      predictedNonce0_bytes32: smartAccountAddressFromOwner,
      predictedNonce0_bytes20: smartAccountAddressFromOwnerAlt,
      legacyPredictedNonce0,
      ownersBytesMode: ownersBytes === ownersBytes32 ? "abi32" : "raw20",
      factoryNonce: factoryNonce.toString(),
      factoryNonceVerified,
      owner: userWallet.address,
    });

    // 세 주소(DB/bytes32/bytes20) + TX 수신 주소에서 잔액 확인하여 토큰이 있는 주소 선택
    const balanceCheckAbi = [
      "function balanceOf(address account, uint256 id) external view returns (uint256)",
      "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
      "event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)",
    ];
    const balanceContract = new ethers.Contract(contractAddress, balanceCheckAbi, readProvider);

    const addressOwner32 = smartAccountAddressFromOwner;
    const addressOwner20 = smartAccountAddressFromOwnerAlt;

    // 1) 기본 주소들의 잔액 체크
    const [balanceDb, balanceOwner, balanceOwnerAlt] = await Promise.all([
      balanceContract.balanceOf(smartAccountAddressFromDb, tokenIdUint),
      smartAccountAddressFromDb.toLowerCase() !== addressOwner32.toLowerCase()
        ? balanceContract.balanceOf(addressOwner32, tokenIdUint)
        : Promise.resolve(0n),
      addressOwner20 &&
      addressOwner20.toLowerCase() !== smartAccountAddressFromDb.toLowerCase() &&
      addressOwner20.toLowerCase() !== addressOwner32.toLowerCase()
        ? balanceContract.balanceOf(addressOwner20, tokenIdUint)
        : Promise.resolve(0n),
    ]);

    logStep("Balance check on candidate addresses", {
      addressDb: smartAccountAddressFromDb,
      balanceDb: Number(balanceDb),
      addressOwner32: addressOwner32,
      balanceOwner32: Number(balanceOwner),
      addressOwner20: addressOwner20,
      balanceOwner20: Number(balanceOwnerAlt),
    });

    // 2) TX 수신 주소에서 토큰을 찾는 추가 로직
    let txRecipientAddress: string | null = null;
    let txRecipientBalance = 0n;

    // 2-1) Backend Smart Account에서 먼저 잔액 확인 (구매 후 transfer 실패 케이스)
    const backendBalance = await balanceContract.balanceOf(BACKEND_SMART_ACCOUNT, tokenIdUint);
    logStep("Backend Smart Account balance check", { 
      address: BACKEND_SMART_ACCOUNT, 
      balance: Number(backendBalance) 
    });

    if (Number(balanceDb) < amount && Number(balanceOwner) < amount && Number(balanceOwnerAlt) < amount) {
      // Backend에 토큰이 있으면 우선 사용
      if (Number(backendBalance) >= amount) {
        txRecipientAddress = BACKEND_SMART_ACCOUNT;
        txRecipientBalance = backendBalance;
        logStep("Token found in Backend Smart Account (transfer failure recovery)", {
          address: BACKEND_SMART_ACCOUNT,
          balance: Number(backendBalance),
        });
      } else {
        logStep("No balance in primary addresses or backend, checking TX recipients...");
      
      // fanz_transactions 테이블에서 해당 사용자의 모든 tx_hash 조회
      // - tokenId 필터 제거: 다른 토큰 구매 시 사용된 지갑에서도 현재 토큰을 보유할 수 있음
      const { data: txRows } = await supabaseClient
        .from("fanz_transactions")
        .select("tx_hash")
        .eq("user_id", user.id)
        .not("tx_hash", "is", null)
        .order("created_at", { ascending: false })
        .limit(20);

      if (txRows && txRows.length > 0) {
        const iface = new ethers.Interface(balanceCheckAbi);
        const checkedAddresses = new Set([
          smartAccountAddressFromDb.toLowerCase(),
          addressOwner32.toLowerCase(),
          addressOwner20?.toLowerCase(),
        ].filter(Boolean));

        for (const row of txRows) {
          const txHash = row.tx_hash;
          if (!txHash) continue;

          try {
            const receipt = await readProvider.getTransactionReceipt(txHash);
            if (!receipt) continue;

            for (const log of receipt.logs) {
              try {
                if (ethers.getAddress(log.address) !== ethers.getAddress(contractAddress)) continue;

                const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
                if (!parsed) continue;

                let toAddr: string | null = null;

                if (parsed.name === "TransferSingle") {
                  const value = parsed.args.value as bigint;

                  // 0-amount allowlist/no-op 트랜잭션 제외
                  if (value === 0n) continue;
                  // tokenId 필터 제거 - 지갑 주소 발견이 목적이므로 모든 transfer에서 recipient 수집

                  toAddr = ethers.getAddress(parsed.args.to as string);
                } else if (parsed.name === "TransferBatch") {
                  const values = parsed.args["values"] as unknown as bigint[];

                  // 최소 1개 이상의 토큰이 전송된 경우에만 지갑 주소로 인정
                  const hasAnyValue = values.some((v: bigint) => v > 0n);
                  if (!hasAnyValue) continue;

                  toAddr = ethers.getAddress(parsed.args.to as string);
                }

                if (!toAddr) continue;
                if (checkedAddresses.has(toAddr.toLowerCase())) continue;

                const bal = await balanceContract.balanceOf(toAddr, tokenIdUint);
                logStep("TX recipient found", { txHash, toAddr, balance: Number(bal) });

                if (Number(bal) >= amount) {
                  txRecipientAddress = toAddr;
                  txRecipientBalance = bal;
                  break;
                }
                checkedAddresses.add(toAddr.toLowerCase());
              } catch {
                // ignore parse errors
              }
            }
          } catch (e) {
            logStep("TX receipt fetch failed", { txHash, error: e instanceof Error ? e.message : String(e) });
          }

          if (txRecipientAddress) break;
        }
      }
      } // close else block for backend check
    }

    // 잔액이 있는 주소를 선택
    // - 서명키로 제어 가능한 주소(bytes32/bytes20) 중 토큰이 있는 쪽을 우선 사용
    // - DB 주소에만 잔액이 있고, 그 주소가 서명키로부터 도출/배포 불가능하면 복구가 불가능하다.
    let smartAccountAddress: string;
    let userOnchainBalance: number;

    if (Number(balanceOwner) >= amount) {
      smartAccountAddress = addressOwner32;
      userOnchainBalance = Number(balanceOwner);

      // bytes32 모드 확정
      ownersBytes = ownersBytes32;
      smartAccountAddressFromOwner = addressOwner32;
      factoryNonce = 0n;
      factoryNonceVerified = true;
    } else if (addressOwner20 && Number(balanceOwnerAlt) >= amount) {
      smartAccountAddress = addressOwner20;
      userOnchainBalance = Number(balanceOwnerAlt);

      // raw20 모드 확정
      ownersBytes = ownersBytes20;
      smartAccountAddressFromOwner = addressOwner20;
      factoryNonce = 0n;
      factoryNonceVerified = true;
    } else if (Number(balanceDb) >= amount) {
      smartAccountAddress = smartAccountAddressFromDb;
      userOnchainBalance = Number(balanceDb);
    } else if (txRecipientAddress && Number(txRecipientBalance) >= amount) {
      // TX 수신 주소에서 토큰 발견 - 레거시 지갑 복구 필요
      smartAccountAddress = txRecipientAddress;
      userOnchainBalance = Number(txRecipientBalance);
      logStep("Using TX recipient address for legacy recovery", { txRecipientAddress });
    } else {
      throw new Error(
        `Insufficient token balance. DB address balance: ${Number(balanceDb)}, Owner(bytes32) balance: ${Number(balanceOwner)}, Owner(bytes20) balance: ${Number(balanceOwnerAlt)}, TX recipient balance: ${Number(txRecipientBalance)}, requested: ${amount}`
      );
    }

    // DB 주소가 선택됐는데 아직 검증이 안된 경우(레거시 nonce/표현 차이), 제한적으로 nonce 탐색을 시도한다.
    // - 탐색에 실패하면 배포(initCode) 자체가 불가능하므로 의미있는 에러로 종료한다.
    if (smartAccountAddress.toLowerCase() === smartAccountAddressFromDb.toLowerCase() && !factoryNonceVerified) {
      logStep("Attempting nonce discovery for stored Smart Wallet", {
        smartAccountAddressFromDb,
        owner: userWallet.address,
      });

      const discoveredNonce32 = await findFactoryNonceForStoredAddressViaRpc(
        readProvider,
        ownersBytes32,
        smartAccountAddressFromDb,
        { maxNonce: 250, chunkSize: 25, timeBudgetMs: 2500 },
      );

      if (discoveredNonce32 !== null) {
        ownersBytes = ownersBytes32;
        factoryNonce = discoveredNonce32;
        smartAccountAddressFromOwner = await predictCoinbaseSmartWalletAddress(
          readProvider,
          ownersBytes,
          factoryNonce,
        );
        factoryNonceVerified = true;
      } else {
        const discoveredNonce20 = await findFactoryNonceForStoredAddressViaRpc(
          readProvider,
          ownersBytes20,
          smartAccountAddressFromDb,
          { maxNonce: 250, chunkSize: 25, timeBudgetMs: 2500 },
        );

        if (discoveredNonce20 !== null) {
          ownersBytes = ownersBytes20;
          factoryNonce = discoveredNonce20;
          smartAccountAddressFromOwner = await predictCoinbaseSmartWalletAddress(
            readProvider,
            ownersBytes,
            factoryNonce,
          );
          factoryNonceVerified = true;
        }
      }

      // 레거시 address[] 방식으로도 시도 (bytes[] 방식이 모두 실패한 경우)
      if (!factoryNonceVerified) {
        logStep("Attempting legacy address[] factory method", {
          owner: userWallet.address,
          target: smartAccountAddressFromDb,
        });

        const legacyNonce = await findLegacyFactoryNonceForStoredAddress(
          readProvider,
          [userWallet.address],
          smartAccountAddressFromDb,
          { maxNonce: 100, chunkSize: 10, timeBudgetMs: 2000 },
        );

        if (legacyNonce !== null) {
          logStep("Legacy nonce found!", {
            legacyNonce: legacyNonce.toString(),
            owner: userWallet.address,
          });
          factoryNonce = legacyNonce;
          factoryNonceVerified = true;
          deploymentFactory = "coinbase_legacy";
          smartAccountAddressFromOwner = smartAccountAddressFromDb; // Factory가 검증함
        }
      }

      // SimpleAccountFactory(owner+salt) 방식으로도 시도 (Coinbase 방식이 모두 실패한 경우)
      if (!factoryNonceVerified) {
        logStep("Attempting SimpleAccountFactory method", {
          owner: userWallet.address,
          target: smartAccountAddressFromDb,
          factory: SIMPLE_ACCOUNT_FACTORY,
        });

        const discoveredSalt = await findSimpleAccountSaltForStoredAddressViaRpc(
          readProvider,
          userWallet.address,
          smartAccountAddressFromDb,
          { maxSalt: 250, chunkSize: 25, timeBudgetMs: 2500 },
        );

        if (discoveredSalt !== null) {
          logStep("SimpleAccountFactory salt found!", {
            salt: discoveredSalt.toString(),
            owner: userWallet.address,
          });
          factoryNonce = discoveredSalt;
          factoryNonceVerified = true;
          deploymentFactory = "simple_account";
          smartAccountAddressFromOwner = smartAccountAddressFromDb; // Factory가 검증함
        }
      }

      logStep("Nonce discovery result", {
        factoryNonceVerified,
        factoryNonce: factoryNonce.toString(),
        derived: smartAccountAddressFromOwner,
        target: smartAccountAddressFromDb,
        ownersBytesMode: ownersBytes === ownersBytes32 ? "abi32" : "raw20",
        deploymentFactory,
      });
    }

    const selectedIsOwnerDerived =
      smartAccountAddress.toLowerCase() === smartAccountAddressFromOwner.toLowerCase();


    if (selectedIsOwnerDerived) {
      // 선택된 지갑이 owner 기반(=서명키로 배포/서명 가능한 주소)인 경우에는 배포가 가능하도록 verified 처리만 한다.
      // NOTE: factoryNonce 는 레거시 복구(discoveredNonce) 결과를 유지해야 하므로 0으로 덮어쓰면 안된다.
      factoryNonceVerified = true;

      // DB에 저장된 값이 구버전(EOA/오래된 주소)인 케이스를 자동 정리
      if (smartAccountAddressFromDb.toLowerCase() !== smartAccountAddressFromOwner.toLowerCase()) {
        logStep("Syncing stored wallet address to derived smart wallet address", {
          fromDb: smartAccountAddressFromDb,
          to: smartAccountAddressFromOwner,
        });

        const [pkUpdate, addrUpdate] = await Promise.all([
          supabaseClient
            .from("wallet_private_keys")
            .update({ wallet_address: smartAccountAddressFromOwner, updated_at: new Date().toISOString() })
            .eq("user_id", user.id),
          supabaseClient
            .from("wallet_addresses")
            .update({ wallet_address: smartAccountAddressFromOwner, updated_at: new Date().toISOString() })
            .eq("user_id", user.id),
        ]);

        if (pkUpdate.error || addrUpdate.error) {
          logStep("Wallet address sync failed (non-blocking)", {
            walletPrivateKeysError: pkUpdate.error,
            walletAddressesError: addrUpdate.error,
          });
        }
      }
    }

    const tokenHoldingAddress = smartAccountAddress; // 실제 토큰이 있는 주소(레거시 주소일 수 있음)

    let accountCode = await readProvider.getCode(smartAccountAddress);
    logStep("Smart Wallet selected by balance", {
      smartAccountAddress,
      userOnchainBalance,
      isDeployed: accountCode !== '0x',
      factoryNonceVerified,
      factoryNonce: factoryNonce.toString(),
    });

    // 레거시/불일치 케이스: 토큰이 '현재 signer로 제어 불가능한 주소'에 있는 경우
    // - 여기서 바로 중단하지 않고, Backend Smart Account(Operator)가 transferFor로 토큰을
    //   signer 기반 Smart Wallet로 옮긴 뒤 판매를 계속 진행한다.
    let needsBackendRecovery = false;
    let backendRecoveryFromAddress: string | null = null;

    if (accountCode === '0x' && !factoryNonceVerified) {
      needsBackendRecovery = true;
      backendRecoveryFromAddress = tokenHoldingAddress;

      // 판매는 signer 기반 주소에서 수행하도록 전환 (이 주소는 initCode 배포 가능)
      smartAccountAddress = smartAccountAddressFromOwner;
      userOnchainBalance = amount; // transferFor 이후 이 주소에 amount만큼 존재한다고 가정
      accountCode = await readProvider.getCode(smartAccountAddress);

      // owner-derived 주소 기준으로는 배포/서명이 가능하므로 verified 처리
      factoryNonceVerified = true;
      deploymentFactory = "coinbase";
      ownersBytes = ownersBytes32;
      factoryNonce = 0n;

      logStep("Wallet deployment blocked - switching to owner-derived wallet and enabling backend recovery", {
        tokenHoldingAddress,
        ownerDerivedAddress: smartAccountAddress,
        owner: userWallet.address,
      });
    }

    logStep("Smart Account (token holding address)", { smartAccountAddress });

    // =====================
    // V5: 백엔드 Smart Account가 sellFor()를 대행
    // - 사용자 지갑 배포 불필요 (initCode 없음)
    // - DAU는 sellFor의 actualSeller 파라미터로 추적
    // =====================

    // 환불액 조회
    const refundAbi = [
      "function calculateSellRefund(uint256 tokenId, uint256 amount) external view returns (uint256 grossRefund, uint256 platformFee, uint256 netRefund)",
    ];
    const refundContract = new ethers.Contract(contractAddress, refundAbi, pricingProvider);

    const [grossRefundAmount, sellFee, netRefundAmount] = await refundContract.calculateSellRefund(
      tokenIdUint,
      BigInt(amount),
    );

    const netRefundUsd = Number(netRefundAmount) / (10 ** USDC_DECIMALS);
    const sellFeeUsd = Number(sellFee) / (10 ** USDC_DECIMALS);
    const grossRefundUsd = Number(grossRefundAmount) / (10 ** USDC_DECIMALS);

    logStep("Expected refund calculated", { grossRefundUsd, netRefundUsd, sellFeeUsd });

    // 슬리피지 보호 (5% 여유)
    const minRefund = netRefundAmount * BigInt(95) / BigInt(100);

    // Backend Smart Account 준비
    if (!baseOperatorPrivateKey) {
      throw new Error("Missing BASE_OPERATOR_PRIVATE_KEY for V5 sellFor delegation");
    }

    const backendCode = await readProvider.getCode(BACKEND_SMART_ACCOUNT);
    if (backendCode === '0x') {
      throw new Error("Backend Smart Account is not deployed. Please deploy it first.");
    }

    const backendOwnerWallet = new ethers.Wallet(baseOperatorPrivateKey);

    // V5 sellFor: function sellFor(uint256 tokenId, address actualSeller, uint256 amount, uint256 minRefund)
    const sellForInterface = new ethers.Interface([
      "function sellFor(uint256 tokenId, address actualSeller, uint256 amount, uint256 minRefund) external"
    ]);
    const sellForCallData = sellForInterface.encodeFunctionData('sellFor', [
      tokenIdUint,
      smartAccountAddress, // actualSeller = 토큰 보유 주소 (DAU 추적용)
      BigInt(amount),
      minRefund
    ]);

    // Backend Smart Account의 execute 함수로 래핑
    const executeCallData = new ethers.Interface([
      "function execute(address dest, uint256 value, bytes calldata func) external"
    ]).encodeFunctionData('execute', [
      contractAddress,
      0n,
      sellForCallData
    ]);

    // EntryPoint에서 Backend Smart Account의 Nonce 조회
    const entryPointInterface = new ethers.Interface([
      "function getNonce(address sender, uint192 key) view returns (uint256)"
    ]);
    const entryPoint = new ethers.Contract(ENTRY_POINT_ADDRESS, entryPointInterface, pricingProvider);

    let nonce = 0n;
    try {
      nonce = await entryPoint.getNonce(BACKEND_SMART_ACCOUNT, 0n);
      logStep("Backend Smart Account nonce retrieved", { nonce: nonce.toString() });
    } catch (nonceError) {
      logStep("EntryPoint getNonce failed for backend, retrying with readProvider", { error: String(nonceError) });
      try {
        const entryPointFallback = new ethers.Contract(ENTRY_POINT_ADDRESS, entryPointInterface, readProvider);
        nonce = await entryPointFallback.getNonce(BACKEND_SMART_ACCOUNT, 0n);
        logStep("Backend nonce retrieved via fallback", { nonce: nonce.toString() });
      } catch {
        throw new Error("Failed to get nonce for Backend Smart Account");
      }
    }



    // 동적 가스비 계산 (투표 성공 패턴과 동일하게 20% 버퍼 적용)
    // - Paymaster per-UserOp USD cap을 자주 초과하므로, 과도한 maxFeePerGas를 제한한다.
    const feeData = await readProvider.getFeeData();
    const suggestedMaxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('1', 'gwei');
    const suggestedMaxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('0.1', 'gwei');

    const rawMaxFeePerGas = (suggestedMaxFeePerGas * 120n) / 100n; // 20% 버퍼
    const rawMaxPriorityFeePerGas = (suggestedMaxPriorityFeePerGas * 120n) / 100n;

    // Base에서 극단적으로 높은 추천값이 나올 때 Paymaster cap을 터뜨리는 케이스 방지
    const maxFeeCap = ethers.parseUnits('3', 'gwei');
    const maxPriorityFeeCap = ethers.parseUnits('1', 'gwei');

    const maxFeePerGas = rawMaxFeePerGas > maxFeeCap ? maxFeeCap : rawMaxFeePerGas;
    const maxPriorityFeePerGas = rawMaxPriorityFeePerGas > maxPriorityFeeCap ? maxPriorityFeeCap : rawMaxPriorityFeePerGas;

    logStep("Dynamic gas fees calculated", {
      suggestedMaxFeePerGas: suggestedMaxFeePerGas.toString(),
      suggestedMaxPriorityFeePerGas: suggestedMaxPriorityFeePerGas.toString(),
      maxFeePerGas: maxFeePerGas.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
    });

    // 공통 RPC 호출 유틸 (Paymaster/Bundler endpoint 공용)
    const rpcCall = async (method: string, params: any[]) => {
      const res = await fetch(paymasterUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      const json = await res.json();
      return json;
    };

    const sponsorSignSendAndWait = async (
      label: string,
      op: UserOperation,
      signerWallet: ethers.Wallet,
      signatureMode: "coinbase" | "simple_account",
    ) => {
      // Paymaster는 내부 시뮬레이션에서 validateUserOp를 호출하므로,
      // Coinbase Smart Wallet은 "리버트하지 않는" 스텁 시그니처가 필요하다. (viem 구현 기준)
      const COINBASE_STUB_INNER_SIG =
        '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c';

      const wrapCoinbaseSignature = (innerSig: string, ownerIndex = 0) =>
        ethers.AbiCoder.defaultAbiCoder().encode(['uint8', 'bytes'], [ownerIndex, innerSig]);

      const dummyInnerSig = '0x' + '00'.repeat(65);
      op.signature =
        signatureMode === 'coinbase'
          ? wrapCoinbaseSignature(COINBASE_STUB_INNER_SIG)
          : dummyInnerSig;

      logStep(`[${label}] Requesting Paymaster sponsorship (pm_getPaymasterData)...`, {
        sender: op.sender,
        hasInitCode: op.initCode !== '0x',
        callGasLimit: op.callGasLimit.toString(),
        verificationGasLimit: op.verificationGasLimit.toString(),
        preVerificationGas: op.preVerificationGas.toString(),
        signatureMode,
      });

      const paymasterJson = await rpcCall('pm_getPaymasterData', [
        {
          sender: op.sender,
          nonce: toRpcHex(op.nonce),
          initCode: op.initCode,
          callData: op.callData,
          callGasLimit: toRpcHex(op.callGasLimit),
          verificationGasLimit: toRpcHex(op.verificationGasLimit),
          preVerificationGas: toRpcHex(op.preVerificationGas),
          maxFeePerGas: toRpcHex(op.maxFeePerGas),
          maxPriorityFeePerGas: toRpcHex(op.maxPriorityFeePerGas),
          paymasterAndData: op.paymasterAndData,
          signature: op.signature,
        },
        ENTRY_POINT_ADDRESS,
        toRpcHex(chainId),
      ]);

      logStep(`[${label}] Paymaster response`, { result: JSON.stringify(paymasterJson) });

      if (paymasterJson.error) {
        throw new Error(`Paymaster error: ${paymasterJson.error.message || JSON.stringify(paymasterJson.error)}`);
      }

      const paymasterResult = paymasterJson.result;

      // Paymaster 응답 적용 (가스/PaymasterAndData는 응답 값이 최종값)
      if (paymasterResult?.paymasterAndData) op.paymasterAndData = paymasterResult.paymasterAndData;
      if (paymasterResult?.callGasLimit) op.callGasLimit = BigInt(paymasterResult.callGasLimit);
      if (paymasterResult?.verificationGasLimit) op.verificationGasLimit = BigInt(paymasterResult.verificationGasLimit);
      if (paymasterResult?.preVerificationGas) op.preVerificationGas = BigInt(paymasterResult.preVerificationGas);

      // paymasterAndData 반영 후 최종 서명
      const userOpHash = getUserOpHash(op, chainId);

      if (signatureMode === 'coinbase') {
        // Coinbase Smart Wallet: raw ERC-4337 userOpHash에 대해 "prefix 없이" 서명하고,
        // signature = abi.encode(uint8 ownerIndex, bytes signatureData) 로 래핑한다. (viem 구현 기준)
        const signingKey = new ethers.SigningKey(signerWallet.privateKey);
        const innerSig = signingKey.sign(userOpHash).serialized; // r||s||v (65 bytes)
        op.signature = wrapCoinbaseSignature(innerSig);
      } else {
        // SimpleAccount는 ERC-191(toEthSignedMessageHash) 기반
        op.signature = await signerWallet.signMessage(ethers.getBytes(userOpHash));
      }

      logStep(`[${label}] Submitting UserOperation to Bundler...`);

      const bundlerJson = await rpcCall('eth_sendUserOperation', [
        {
          sender: op.sender,
          nonce: toRpcHex(op.nonce),
          initCode: op.initCode,
          callData: op.callData,
          callGasLimit: toRpcHex(op.callGasLimit),
          verificationGasLimit: toRpcHex(op.verificationGasLimit),
          preVerificationGas: toRpcHex(op.preVerificationGas),
          maxFeePerGas: toRpcHex(op.maxFeePerGas),
          maxPriorityFeePerGas: toRpcHex(op.maxPriorityFeePerGas),
          paymasterAndData: op.paymasterAndData,
          signature: op.signature,
        },
        ENTRY_POINT_ADDRESS,
      ]);

      logStep(`[${label}] Bundler response`, { result: JSON.stringify(bundlerJson) });

      if (bundlerJson.error) {
        throw new Error(`Bundler error: ${bundlerJson.error.message || JSON.stringify(bundlerJson.error)}`);
      }

      const userOpHashResult: string = bundlerJson.result;

      // 트랜잭션 영수증 대기 (최대 45초)
      let txHash: string | null = null;
      for (let i = 0; i < 45; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const receiptJson = await rpcCall('eth_getUserOperationReceipt', [userOpHashResult]);
        if (receiptJson?.result) {
          txHash = receiptJson?.result?.receipt?.transactionHash || null;
          break;
        }
      }

      logStep(`[${label}] UserOp confirmed`, { userOpHashResult, txHash });

      return { userOpHashResult, txHash };
    };

    // =====================
    // Backend operator recovery
    // - 토큰이 현재 signer로 제어 불가능한 주소(레거시 주소)에 있을 때,
    //   Backend Smart Account(Operator)가 transferFor로 토큰을 signer 기반 Smart Wallet로 이동.
    // =====================
    if (needsBackendRecovery && backendRecoveryFromAddress) {
      if (!baseOperatorPrivateKey) {
        throw new Error("Missing BASE_OPERATOR_PRIVATE_KEY (operator recovery is not available)");
      }

      // Backend Smart Account가 배포되어 있어야 함
      const backendCode = await readProvider.getCode(BACKEND_SMART_ACCOUNT);
      if (backendCode === '0x') {
        throw new Error(
          "Backend Smart Account is not deployed. Please deploy it (deploy-backend-smart-account) and retry."
        );
      }

      const backendOwnerWallet = new ethers.Wallet(baseOperatorPrivateKey);

      const transferIface = new ethers.Interface([
        "function transferFor(uint256 tokenId, address from, address to, uint256 amount) external",
      ]);

      const transferCallData = transferIface.encodeFunctionData("transferFor", [
        tokenIdUint,
        backendRecoveryFromAddress,
        smartAccountAddress,
        BigInt(amount),
      ]);

      const backendExecuteCallData = new ethers.Interface([
        "function execute(address dest, uint256 value, bytes calldata func) external",
      ]).encodeFunctionData("execute", [contractAddress, 0n, transferCallData]);

      let backendNonce = 0n;
      try {
        backendNonce = await entryPoint.getNonce(BACKEND_SMART_ACCOUNT, 0n);
      } catch {
        logStep("EntryPoint getNonce failed for backend smart account, fallback nonce = 0");
      }

      const recoveryOp: UserOperation = {
        sender: BACKEND_SMART_ACCOUNT,
        nonce: backendNonce,
        initCode: '0x',
        callData: backendExecuteCallData,
        callGasLimit: 300000n,
        verificationGasLimit: 220000n,
        preVerificationGas: 65000n,
        maxFeePerGas,
        maxPriorityFeePerGas,
        paymasterAndData: '0x',
        signature: '0x',
      };

      logStep("Attempting backend operator transferFor recovery", {
        from: backendRecoveryFromAddress,
        to: smartAccountAddress,
        tokenId: tokenIdUint.toString(),
        amount,
      });

      const recoveryResult = await sponsorSignSendAndWait(
        'RECOVER_TRANSFER',
        recoveryOp,
        backendOwnerWallet,
        "simple_account",
      );

      logStep("Backend recovery transfer confirmed", { txHash: recoveryResult.txHash });

      // DB에 저장된 지갑 주소를 signer 기반 Smart Wallet로 동기화
      const [pkUpdate, addrUpdate] = await Promise.all([
        supabaseClient
          .from("wallet_private_keys")
          .update({ wallet_address: smartAccountAddress, updated_at: new Date().toISOString() })
          .eq("user_id", user.id),
        supabaseClient
          .from("wallet_addresses")
          .update({ wallet_address: smartAccountAddress, updated_at: new Date().toISOString() })
          .eq("user_id", user.id),
      ]);

      if (pkUpdate.error || addrUpdate.error) {
        logStep("Wallet address sync after recovery failed (non-blocking)", {
          walletPrivateKeysError: pkUpdate.error,
          walletAddressesError: addrUpdate.error,
        });
      }
    }

    // =====================
    // V5: 백엔드 Smart Account가 sellFor()를 대행
    // - 사용자 지갑 배포 불필요
    // - DAU는 sellFor의 actualSeller 파라미터로 추적
    // =====================

    let userOpHashResult: string | null = null;
    let txHash: string | null = null;

    logStep("Executing V5 sellFor via Backend Smart Account", {
      backendAccount: BACKEND_SMART_ACCOUNT,
      actualSeller: smartAccountAddress,
      tokenId: tokenIdUint.toString(),
      amount,
    });

    const sellOp: UserOperation = {
      sender: BACKEND_SMART_ACCOUNT,
      nonce,
      initCode: '0x', // 백엔드 계정은 이미 배포됨
      callData: executeCallData + BUILDER_CODE_SUFFIX,
      callGasLimit: 300000n,
      verificationGasLimit: 200000n,
      preVerificationGas: 60000n,
      maxFeePerGas,
      maxPriorityFeePerGas,
      paymasterAndData: '0x',
      signature: '0x',
    };

    const sellResult = await sponsorSignSendAndWait('SELL', sellOp, backendOwnerWallet, "simple_account");
    userOpHashResult = sellResult.userOpHashResult;
    txHash = sellResult.txHash;

    logStep('Transaction confirmed', { txHash });

    // 데이터베이스 업데이트
    const { error: dbError } = await supabaseClient
      .from('fanz_transactions')
      .insert({
        fanz_token_id: tokenId,
        user_id: user.id,
        transaction_type: 'sell',
        amount: amount,
        // NOTE: net 기준 가격/총액, fee는 별도 컬럼
        price_per_token: netRefundUsd / amount,
        total_value: netRefundUsd,
        creator_fee: 0,
        platform_fee: sellFeeUsd,
        payment_token: 'USDC',
        // payment_value는 gross(= user net + platform fee)로 저장
        payment_value: grossRefundUsd,
        tx_hash: txHash,
      });

    if (dbError) {
      logStep("Database insert error", { error: dbError });
    }

    // DB 잔액 업데이트
    const newBalance = userOnchainBalance - amount;
    if (newBalance > 0) {
      await supabaseClient
        .from('fanz_balances')
        .upsert({ 
          user_id: user.id,
          fanz_token_id: tokenId,
          balance: newBalance,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,fanz_token_id'
        });
    } else {
      await supabaseClient
        .from('fanz_balances')
        .delete()
        .eq('user_id', user.id)
        .eq('fanz_token_id', tokenId);
    }

    // 토큰 total_supply 업데이트
    await supabaseClient
      .from('fanz_tokens')
      .update({ 
        total_supply: fanzToken.total_supply - amount,
        updated_at: new Date().toISOString()
      })
      .eq('id', tokenId);

    logStep("Sale completed successfully (Gasless)", { txHash, refundUsd: netRefundUsd });

    // DAU 기록 (백그라운드 - 결과 대기 없이 처리)
    try {
      const dauContractAddress = Deno.env.get("DAU_CONTRACT_ADDRESS");
      if (dauContractAddress && txHash) {
        const dauInterface = new ethers.Interface([
          "function recordActivity(address user, bytes32 activityType, bytes32 referenceHash) external",
        ]);
        const referenceHash = ethers.keccak256(ethers.solidityPacked(['string'], [tokenId]));
        const dauCalldata = dauInterface.encodeFunctionData("recordActivity", [
          smartAccountAddress,
          ACTIVITY_FANZ_SELL,
          referenceHash,
        ]);

        const dauAccountInterface = new ethers.Interface([
          "function execute(address dest, uint256 value, bytes calldata func) external",
        ]);
        const dauExecuteCalldata = dauAccountInterface.encodeFunctionData("execute", [
          dauContractAddress,
          0n,
          dauCalldata,
        ]);

        // nonce 조회 (새로운 key 사용해서 충돌 방지)
        const dauNonceKey = BigInt(Date.now()) % (2n ** 64n);
        const entryPointInterface = new ethers.Interface([
          "function getNonce(address sender, uint192 key) view returns (uint256)",
        ]);
        const dauNonceData = await readProvider.call({
          to: ENTRY_POINT_ADDRESS,
          data: entryPointInterface.encodeFunctionData("getNonce", [BACKEND_SMART_ACCOUNT, dauNonceKey]),
        });
        const dauNonce = BigInt(dauNonceData);

        const dauUserOp = {
          sender: BACKEND_SMART_ACCOUNT,
          nonce: "0x" + dauNonce.toString(16),
          initCode: "0x",
          callData: dauExecuteCalldata,
          callGasLimit: "0x15f90",
          verificationGasLimit: "0x15f90",
          preVerificationGas: "0x5208",
          maxFeePerGas: "0x" + maxFeePerGas.toString(16),
          maxPriorityFeePerGas: "0x" + maxPriorityFeePerGas.toString(16),
          paymasterAndData: "0x",
          signature: "0x",
        };

        // Paymaster 요청
        const pmResponse = await fetch(paymasterUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: 1, jsonrpc: "2.0", method: "pm_getPaymasterData",
            params: [dauUserOp, ENTRY_POINT_ADDRESS, "0x2105", {}],
          }),
        });
        const pmResult = await pmResponse.json();
        if (!pmResult.error && pmResult.result?.paymasterAndData) {
          dauUserOp.paymasterAndData = pmResult.result.paymasterAndData;

          // UserOp 서명
          const packed = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "uint256", "bytes32", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
            [dauUserOp.sender, BigInt(dauUserOp.nonce), ethers.keccak256(dauUserOp.initCode), ethers.keccak256(dauUserOp.callData),
             BigInt(dauUserOp.callGasLimit), BigInt(dauUserOp.verificationGasLimit), BigInt(dauUserOp.preVerificationGas),
             BigInt(dauUserOp.maxFeePerGas), BigInt(dauUserOp.maxPriorityFeePerGas), ethers.keccak256(dauUserOp.paymasterAndData)]
          );
          const dauUserOpHash = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "address", "uint256"], [ethers.keccak256(packed), ENTRY_POINT_ADDRESS, 8453n])
          );
          dauUserOp.signature = await backendOwnerWallet.signMessage(ethers.getBytes(dauUserOpHash));

          // Bundler 제출 (백그라운드)
          fetch(paymasterUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: 2, jsonrpc: "2.0", method: "eth_sendUserOperation", params: [dauUserOp, ENTRY_POINT_ADDRESS] }),
          }).catch(e => logStep("DAU bundler error", { error: e instanceof Error ? e.message : String(e) }));

          logStep("DAU activity recorded for sell");
        }
      }
    } catch (dauError) {
      logStep("DAU recording error (non-fatal)", { error: dauError instanceof Error ? dauError.message : String(dauError) });
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Fanz Token sold successfully (Gasless)",
        tokenId,
        amount,
        refundUsd: netRefundUsd,
        txHash,
        userOpHash: userOpHashResult,
        smartAccountAddress
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });

    // 사용자 입력/상태 문제는 4xx로 내려서 "서버 장애(500)"와 구분한다.
    const status = errorMessage.includes("Insufficient token balance") ? 400 : 500;

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      }
    );
  }
});
