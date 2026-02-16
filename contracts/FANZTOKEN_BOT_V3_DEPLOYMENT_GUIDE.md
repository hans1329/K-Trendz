# FanzTokenBotV3 배포 가이드

## 개요

V3는 **사용자 자금 모델(User-Funded Trading)**을 구현합니다.
- V2: 플랫폼 Admin 지갑의 USDC로 거래 → 토큰도 Admin 소유 (위탁 모델)
- V3: **유저 자신의 USDC**로 거래 → **토큰도 유저 소유** (자기 관리 모델)

## V2 → V3 핵심 변경 사항

| 항목 | V2 (현재) | V3 (신규) |
|------|-----------|-----------|
| USDC 출처 | Admin 지갑 (`msg.sender`) | **유저 지갑** (`buyFor(user, ...)`) |
| 토큰 소유 | Admin 지갑 | **유저 지갑** |
| 매도 시 USDC | Admin 지갑으로 | **유저 지갑으로** |
| 접근 제어 | `tx.origin == operator` | `msg.sender == operator` (안전) |
| 직접 거래 | 불가 | `buy()`/`sell()` 으로 직접 거래 가능 |
| 보안 | `tx.origin` 사용 (피싱 취약) | `onlyOperator` modifier |

## 사전 준비

### 1. 지갑 주소 확인

| 역할 | 주소 | 설명 |
|------|------|------|
| Platform | `0x8B4197d938b8F4212B067e9925F7251B6C21B856` | 플랫폼 수수료 수령 |
| Artist Fund | `0xd5C129c0ac57aE66C1D77E2cFf8c2EB9eF1b79E6` | 아티스트 펀드 수수료 |
| Operator | `0xf1d20DF30aaD9ee0701C6ee33Fc1bb59466CaB36` | 대리 거래 실행자 |

### 2. 필요 환경

- Remix IDE 또는 Foundry/Hardhat
- Base Mainnet RPC
- Operator 지갑에 충분한 ETH (가스비용)

## 배포 순서

### Step 1: Remix에서 컴파일

1. [Remix IDE](https://remix.ethereum.org) 접속
2. `FanzTokenBotV3.sol` 파일 생성 및 코드 붙여넣기
3. Compiler: `0.8.20`, Optimization: `200 runs`
4. 컴파일 확인

### Step 2: 배포

```
Network: Base Mainnet (Chain ID: 8453)
Constructor 파라미터:
  _platform:   0x8B4197d938b8F4212B067e9925F7251B6C21B856
  _artistFund: 0xd5C129c0ac57aE66C1D77E2cFf8c2EB9eF1b79E6
  _operator:   0xf1d20DF30aaD9ee0701C6ee33Fc1bb59466CaB36
```

### Step 3: 토큰 등록 (create)

V2에 등록된 토큰들을 V3에도 동일하게 등록합니다.

```
// BTS
create(9138265216282739420, <creator_address>, 1650000, 300000000000)

// RIIZE  
create(7963681970480434413, <creator_address>, 1650000, 300000000000)

// Cortis
create(13766662462343366758, <creator_address>, 1650000, 300000000000)

// K-Trendz Supporters
create(12666454296509763493, <creator_address>, 1650000, 300000000000)

// All Day Project
create(18115915419890895215, <creator_address>, 1650000, 300000000000)

// Ive
create(4607865675402095874, <creator_address>, 1650000, 300000000000)

// SEVENTEEN
create(14345496278571827420, <creator_address>, 1650000, 300000000000)
```

### Step 4: Basescan 검증

```bash
# Basescan에서 Verify & Publish
# Compiler: v0.8.20
# Optimization: Yes, 200 runs
# Constructor ABI-encoded 인자 포함
```

## 유저 온보딩 플로우

### 유저가 해야 할 것 (1회)

```
1. USDC.approve(V3ContractAddress, type(uint256).max)
   → 컨트랙트에 USDC 지출 권한 부여
   
2. (선택) 직접 거래하려면 별도 approve 불필요 — buy()/sell() 직접 호출
```

### 봇/에이전트가 하는 것

```
1. /api/bot/register로 API Key 발급 (실제 지갑 주소 포함)
2. USDC approve 트랜잭션 실행 (1회)
3. /api/bot/buy 호출 → Edge Function이 buyFor(user, ...) 실행
4. /api/bot/sell 호출 → Edge Function이 sellFor(user, ...) 실행
```

## Edge Function 변경 필요 사항

### bot-buy-token

```diff
- // Admin 지갑으로 직접 구매
- const buyData = contract.interface.encodeFunctionData('buy', [tokenId, maxCost, agent]);
- const buyTx = await wallet.sendTransaction({ to: CONTRACT, data: buyData });

+ // 유저 자금으로 대리 구매
+ const buyData = contract.interface.encodeFunctionData('buyFor', [userWallet, tokenId, maxCost, agent]);
+ const buyTx = await wallet.sendTransaction({ to: CONTRACT, data: buyData });
```

### bot-sell-token

```diff
- // Admin 지갑의 토큰 매도
- const sellData = contract.interface.encodeFunctionData('sell', [tokenId, minRefund, agent]);

+ // 유저 토큰 대리 매도
+ const sellData = contract.interface.encodeFunctionData('sellFor', [userWallet, tokenId, minRefund, agent]);
```

### bot-register-agent

```diff
  // 등록 시 실제 지갑 주소 필수
- const { agent_name } = await req.json();
+ const { agent_name, wallet_address } = await req.json();
+ if (!wallet_address || !ethers.isAddress(wallet_address)) {
+   return error('Valid wallet_address required');
+ }
```

## 보안 체크리스트

- [x] `onlyOperator` modifier로 `tx.origin` 제거 (피싱 방지)
- [x] `buyFor`/`sellFor`는 Operator만 호출 가능
- [x] `buy`/`sell` 직접 거래는 누구나 가능 (자기 자금)
- [x] 에이전트별 일일 100회 거래 한도
- [x] 같은 블록 연속 거래 방지
- [x] 20% 서킷 브레이커
- [x] ReentrancyGuard
- [ ] V3 배포 후 Edge Function 업데이트
- [ ] SKILL.md / OpenAPI / MCP 문서 갱신
- [ ] V2 → V3 리저브 USDC 이전 (emergencyWithdraw)

## 마이그레이션 체크리스트

1. V3 컨트랙트 배포
2. V3에 토큰 등록 (create)
3. V2에서 emergencyWithdraw로 리저브 USDC 인출
4. V3에 리저브 USDC 전송
5. Edge Function의 BOT_CONTRACT_ADDRESS 업데이트
6. DB의 fanz_tokens.bot_contract_registered 유지
7. bot_agents 테이블에 실제 wallet_address 필드 활용
8. SKILL.md, OpenAPI 스펙, MCP 서버 문서 갱신
