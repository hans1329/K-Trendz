# KTREND Token Deployment Guide

## 📋 배포 전 체크리스트

### 1. 필요한 것들
- **MetaMask 지갑**: Base Mainnet 연결
- **Base ETH**: 가스비용 (약 0.01-0.02 ETH 필요)
- **Remix IDE**: https://remix.ethereum.org

### 2. 토큰 사양 확인
- ✅ **토큰 이름**: K-Trendz
- ✅ **심볼**: KTNZ
- ✅ **총 공급량**: 5,000,000,000 (50억)
- ✅ **초기 발행**: 1,500,000,000 (15억, 30%)
- ✅ **Decimals**: 18
- ✅ **초기 환율**: 10 포인트 = 1 KTNZ ($0.10/token)
- ✅ **네트워크**: Base Mainnet

---

## 🚀 Remix를 통한 배포 단계별 가이드

### Step 1: OpenZeppelin 라이브러리 설치

1. **Remix IDE 접속**: https://remix.ethereum.org
2. **좌측 사이드바에서 "File Explorer" 선택**
3. **contracts 폴더 생성** (없으면)
4. **KTREND.sol 파일 생성 및 컨트랙트 코드 붙여넣기**

### Step 2: 컴파일러 설정

1. **좌측 사이드바에서 "Solidity Compiler" 클릭**
2. **Compiler 버전 선택**: `0.8.20` 이상
3. **Advanced Configurations 클릭**:
   - EVM Version: `default`
   - Enable optimization: ✅ (200 runs)
4. **"Compile KTREND.sol" 버튼 클릭**
5. ✅ 컴파일 성공 확인 (초록색 체크마크)

### Step 3: Base Mainnet 연결

1. **MetaMask에 Base Mainnet 추가** (없으면):
   ```
   Network Name: Base Mainnet
   RPC URL: https://mainnet.base.org
   Chain ID: 8453
   Currency Symbol: ETH
   Block Explorer: https://basescan.org
   ```

2. **MetaMask에서 Base Mainnet 선택**
3. **지갑에 Base ETH가 있는지 확인** (최소 0.01 ETH)
   - 없으면 Coinbase나 다른 거래소에서 Base로 브릿지

### Step 4: 컨트랙트 배포

1. **좌측 사이드바에서 "Deploy & Run Transactions" 클릭**
2. **Environment 선택**: `Injected Provider - MetaMask`
3. **MetaMask 연결 승인**
4. **Account 확인**: 배포할 지갑 주소 확인
5. **Contract 선택**: `KTREND - contracts/KTREND.sol`
6. **Gas Limit**: `자동` (약 2,500,000)
7. **🚀 "Deploy" 버튼 클릭**
8. **MetaMask에서 트랜잭션 승인**
9. **배포 완료 대기** (약 2-5초)
10. **✅ 배포 완료 확인**: 하단 콘솔에 컨트랙트 주소 표시

### Step 5: 컨트랙트 주소 저장

배포 완료 후 표시되는 **컨트랙트 주소를 반드시 저장**하세요!
```
예시: 0x1234567890abcdef1234567890abcdef12345678
```

---

## 🔑 Step 6: MINTER_ROLE 설정 (서버 지갑 권한 부여)

배포 후, Edge Function에서 토큰을 민팅할 수 있도록 서버 지갑에 MINTER_ROLE을 부여해야 합니다.

### 6-1. 서버 지갑 주소 얻기

#### 방법 A: Supabase Secrets 사용
```typescript
// Edge Function에서 private key로부터 주소 얻기
import { Wallet } from "ethers";

const privateKey = Deno.env.get("MINTER_PRIVATE_KEY");
const wallet = new Wallet(privateKey);
const serverAddress = wallet.address;
console.log("Server wallet address:", serverAddress);
```

#### 방법 B: AWS KMS 사용
```typescript
// KMS로 서명할 지갑 주소를 먼저 생성하고 기록
// KMS Key ID와 연결된 퍼블릭 키에서 주소 도출
```

### 6-2. Remix에서 MINTER_ROLE 부여

1. **Deployed Contracts 섹션에서 배포된 KTREND 확장**
2. **`grantRole` 함수 찾기**
3. **입력값 설정**:
   ```
   role (bytes32): 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6
   account (address): [서버 지갑 주소] 예: 0xYourServerWalletAddress
   ```
   
   ℹ️ **MINTER_ROLE 해시값**: 
   ```
   0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6
   ```
   이것은 `keccak256("MINTER_ROLE")`의 결과값입니다.

4. **"transact" 버튼 클릭**
5. **MetaMask에서 트랜잭션 승인**
6. **✅ 권한 부여 완료 확인**

### 6-3. 권한 확인

```
hasRole 함수 호출:
- role: 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6
- account: [서버 지갑 주소]
- 결과: true 반환되면 성공 ✅
```

---

## 🔧 Step 7: 환율 관리자 설정 (선택사항)

환율을 변경할 수 있는 별도의 관리자 계정이 필요한 경우:

### RATE_MANAGER_ROLE 부여

```
grantRole 함수 호출:
- role: 0x00ccaa74e0fe7c58e4c9ba4e2d0c6aa0b6dbb8d45f5d0fa7e4c44e0ef0d8d5f0
- account: [환율 관리자 지갑 주소]
```

ℹ️ **RATE_MANAGER_ROLE 해시값**: 
```
0x00ccaa74e0fe7c58e4c9ba4e2d0c6aa0b6dbb8d45f5d0fa7e4c44e0ef0d8d5f0
```

---

## 📊 Step 8: BaseScan에서 컨트랙트 검증 (Verify)

컨트랙트를 공개적으로 검증하면 사용자들이 코드를 볼 수 있어 신뢰도가 높아집니다.

### 8-1. BaseScan 접속
https://basescan.org/verifyContract

### 8-2. 검증 정보 입력

```
Contract Address: [배포된 컨트랙트 주소]
Compiler Type: Solidity (Single file)
Compiler Version: v0.8.20+commit.a1b79de6
Open Source License Type: MIT
```

### 8-3. 컨트랙트 코드 입력

- **Solidity Contract Code**: KTREND.sol 전체 코드 붙여넣기
- **Optimization**: Yes
- **Runs**: 200
- **Constructor Arguments**: (없음 - 빈 칸으로 둠)

### 8-4. "Verify and Publish" 클릭

✅ 검증 완료되면 BaseScan에서 "Contract" 탭에 소스코드가 표시됩니다.

---

## 🧪 Step 9: 배포 후 테스트

### 9-1. 기본 정보 확인 (Remix에서)

```typescript
// 1. 토큰 이름 확인
name() → "K-Trendz"

// 2. 심볼 확인
symbol() → "KTNZ"

// 3. Decimals 확인
decimals() → 18

// 4. 총 공급량 확인
totalSupply() → 5000000000000000000000000000 (500M * 10^18)

// 5. 최대 공급량 확인
MAX_SUPPLY() → 5000000000000000000000000000000 (5B * 10^18)

// 6. 현재 환율 확인
pointsToTokenRate() → 10 (10 포인트 = 1 KTNZ)

// 7. 환율 정보 확인
getExchangeRateInfo() → (10, "10 points = 1 KTNZ")
```

### 9-2. 권한 확인

```typescript
// 배포자(DEFAULT_ADMIN_ROLE) 확인
hasRole(0x00, [배포자 주소]) → true

// MINTER_ROLE 확인
hasRole(0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6, [서버 주소]) → true

// RATE_MANAGER_ROLE 확인
hasRole(0x00ccaa74e0fe7c58e4c9ba4e2d0c6aa0b6dbb8d45f5d0fa7e4c44e0ef0d8d5f0, [관리자 주소]) → true
```

### 9-3. 테스트 민팅 (서버 지갑으로)

서버 지갑으로 MetaMask 전환 후:

```typescript
// 소량 민팅 테스트 (10 KTNZ)
mint(
  [테스트 받을 주소],
  10000000000000000000  // 10 * 10^18
)

// 성공하면 ✅
```

---

## 🔐 Step 10: Supabase Secrets 설정

배포 완료 후 Supabase에 필요한 정보를 저장합니다.

### 필수 Secrets

```bash
# 1. 컨트랙트 주소
KTREND_CONTRACT_ADDRESS=0x[배포된 컨트랙트 주소]

# 2. 서버 민팅 지갑 Private Key (절대 노출 금지!)
MINTER_PRIVATE_KEY=0x[서버 지갑 Private Key]

# 3. Base RPC URL
BASE_RPC_URL=https://mainnet.base.org

# 4. Base Chain ID
BASE_CHAIN_ID=8453
```

### Supabase Dashboard에서 설정

1. **Supabase 프로젝트 대시보드 접속**
2. **Settings → Vault → Secrets**
3. **New Secret 클릭**
4. **각 Secret 추가**:
   - Name: `KTREND_CONTRACT_ADDRESS`
   - Secret: `0x...`
5. **반복하여 모든 Secret 추가**

---

## 💰 Step 11: 초기 공급량 분배

배포 시 1.5B KTREND가 배포자 지갑에 민팅됩니다. 이를 다음과 같이 분배하세요:

### 권장 분배 계획 (30% = 1.5B KTNZ)

```
1. 팀 & 어드바이저 (10% = 500M): 0x[팀 지갑]
2. 초기 투자자 (8% = 400M): 0x[투자자 지갑]
3. 유동성 풀 (7% = 350M): 0x[DEX 유동성 지갑]
4. 재단 리저브 (5% = 250M): 0x[재단 지갑]
```

### Remix에서 전송

```typescript
// ERC20 transfer 함수 사용
transfer([받는 주소], [금액 * 10^18])

// 예: 100M KTNZ 전송
transfer(0x[팀 지갑], 100000000000000000000000000)
```

---

## 🎯 Step 12: Edge Function 통합

### 민팅 Edge Function 생성

`supabase/functions/mint-ktrend-tokens/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ethers } from "https://esm.sh/ethers@6.9.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// KTREND 컨트랙트 ABI (필요한 함수만)
const KTREND_ABI = [
  "function mint(address to, uint256 amount) external",
  "function batchMint(address[] calldata recipients, uint256[] calldata amounts) external",
  "function calculateTokenAmount(uint256 points) public view returns (uint256)",
  "function pointsToTokenRate() public view returns (uint256)"
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Supabase 클라이언트 초기화
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 사용자 인증
    const authHeader = req.headers.get("authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { userId, points, reason } = await req.json();

    // 유효성 검사
    if (!userId || !points || points <= 0) {
      throw new Error("Invalid parameters");
    }

    console.log(`Minting tokens for user ${userId}: ${points} points`);

    // Ethers Provider 및 Wallet 설정
    const provider = new ethers.JsonRpcProvider(
      Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org"
    );
    
    const privateKey = Deno.env.get("MINTER_PRIVATE_KEY");
    if (!privateKey) {
      throw new Error("MINTER_PRIVATE_KEY not configured");
    }
    
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log("Minter wallet:", wallet.address);

    // KTREND 컨트랙트 연결
    const contractAddress = Deno.env.get("KTREND_CONTRACT_ADDRESS");
    if (!contractAddress) {
      throw new Error("KTREND_CONTRACT_ADDRESS not configured");
    }
    
    const contract = new ethers.Contract(contractAddress, KTREND_ABI, wallet);

    // 현재 환율 확인
    const currentRate = await contract.pointsToTokenRate();
    console.log(`Current exchange rate: ${currentRate} points = 1 KTREND`);

    // 포인트를 토큰으로 변환
    const tokenAmount = await contract.calculateTokenAmount(points);
    console.log(`Converting ${points} points to ${ethers.formatEther(tokenAmount)} KTNZ`);

    // 사용자 지갑 주소 가져오기
    const { data: walletData, error: walletError } = await supabaseAdmin
      .from("wallet_addresses")
      .select("wallet_address")
      .eq("user_id", userId)
      .single();

    if (walletError || !walletData) {
      throw new Error("User wallet not found");
    }

    const recipientAddress = walletData.wallet_address;

    // 토큰 민팅 트랜잭션 실행
    console.log(`Minting ${ethers.formatEther(tokenAmount)} KTNZ to ${recipientAddress}`);
    const tx = await contract.mint(recipientAddress, tokenAmount);
    console.log("Transaction hash:", tx.hash);

    // 트랜잭션 완료 대기
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);

    // 민팅 기록 저장 (선택사항)
    await supabaseAdmin.from("token_mints").insert({
      user_id: userId,
      points_spent: points,
      tokens_minted: ethers.formatEther(tokenAmount),
      transaction_hash: tx.hash,
      reason: reason || "reward",
      exchange_rate: currentRate.toString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        transactionHash: tx.hash,
        tokensMinted: ethers.formatEther(tokenAmount),
        recipient: recipientAddress,
        exchangeRate: currentRate.toString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error minting tokens:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

## 📝 Step 13: 환율 변경 방법

### Remix에서 환율 변경

1. **RATE_MANAGER_ROLE을 가진 지갑으로 MetaMask 전환**
2. **Remix의 Deployed Contracts에서 `setPointsToTokenRate` 함수 찾기**
3. **새로운 환율 입력**:
   ```
   예시:
   - 5 입력 → 5 points = 1 KTNZ ($0.20/token)
   - 20 입력 → 20 points = 1 KTNZ ($0.05/token)
   - 10 입력 → 10 points = 1 KTNZ ($0.10/token) - 기본값
   ```
4. **"transact" 클릭 및 트랜잭션 승인**
5. **✅ 환율 변경 완료**

### Edge Function으로 환율 변경

```typescript
// supabase/functions/update-token-rate/index.ts
const contract = new ethers.Contract(contractAddress, KTREND_ABI, wallet);
const tx = await contract.setPointsToTokenRate(newRate);
await tx.wait();
```

---

## ⚠️ 보안 주의사항

### 🔴 절대 노출 금지
- ✅ **MINTER_PRIVATE_KEY**: Supabase Secrets에만 저장, 절대 코드에 하드코딩 금지
- ✅ **배포자 지갑 Private Key**: 안전한 하드웨어 월렛 사용 권장
- ✅ **AWS KMS Key ID**: Secrets 관리

### 🟡 권장 보안 설정
- ✅ **Multi-sig 지갑**: 중요 권한은 멀티시그로 관리
- ✅ **역할 분리**: MINTER, RATE_MANAGER, PAUSER 역할 분리
- ✅ **정기 모니터링**: 민팅 이벤트 및 환율 변경 로그 모니터링

---

## 🎉 배포 완료 체크리스트

- [ ] ✅ KTREND 컨트랙트 Base Mainnet에 배포
- [ ] ✅ 컨트랙트 주소 기록 및 공유
- [ ] ✅ BaseScan에서 컨트랙트 검증 완료
- [ ] ✅ 서버 지갑에 MINTER_ROLE 부여
- [ ] ✅ (선택) 별도 관리자에게 RATE_MANAGER_ROLE 부여
- [ ] ✅ Supabase Secrets 설정 완료
- [ ] ✅ 초기 공급량 (500M) 분배 완료
- [ ] ✅ Edge Function 통합 및 테스트 완료
- [ ] ✅ 테스트 민팅 성공 확인
- [ ] ✅ 환율 변경 테스트 완료 (선택)
- [ ] ✅ 보안 점검 완료

---

## 📞 문제 해결 (Troubleshooting)

### 문제 1: "Gas estimation failed"
- **원인**: 가스비 부족 또는 권한 없음
- **해결**: Base ETH 충전 또는 MINTER_ROLE 확인

### 문제 2: "Daily mint limit exceeded"
- **원인**: 하루 민팅 한도 (1M KTNZ) 초과
- **해결**: 24시간 대기 또는 컨트랙트에서 한도 확인

### 문제 3: "Exceeds max supply"
- **원인**: 총 50억 한도 초과
- **해결**: 더 이상 민팅 불가, 공급량 확인

### 문제 4: 환율 변경 실패
- **원인**: RATE_MANAGER_ROLE 없음
- **해결**: 올바른 지갑으로 트랜잭션 실행

---

## 📚 추가 리소스

- **Base 공식 문서**: https://docs.base.org
- **BaseScan**: https://basescan.org
- **OpenZeppelin Contracts**: https://docs.openzeppelin.com/contracts
- **Ethers.js 문서**: https://docs.ethers.org
- **Remix IDE**: https://remix.ethereum.org

---

## 🚀 다음 단계

1. **DEX 유동성 추가**: Uniswap V3 또는 Aerodrome에 KTREND/ETH 페어 생성
2. **토큰 가격 피드 설정**: Chainlink 또는 다른 오라클 통합
3. **거버넌스 시스템 구축**: 커뮤니티 투표로 환율 및 정책 결정
4. **스테이킹 시스템**: KTREND 스테이킹으로 추가 보상 제공
5. **크로스체인 브릿지**: 다른 체인으로 KTREND 확장

---

**배포 완료를 축하합니다! 🎊**

문제가 발생하면 Base Discord 또는 개발팀에 문의하세요.
