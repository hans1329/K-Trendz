# KTrendzDAU 배포 가이드

## 개요
KTrendzDAU는 플랫폼의 모든 유저 활동을 통합 기록하여 Dune Analytics에서 DAU(일일 활성 사용자)를 추적할 수 있게 해주는 컨트랙트입니다.

### 특징
- 기존 컨트랙트(VoteV3, Challenge, FanzToken, KTREND) 수정 없음
- 모든 활동 타입을 단일 이벤트로 통합
- `user` 필드가 indexed로 Dune DAU 쿼리 최적화
- 최소 가스비 (이벤트만 emit)

### 활동 타입
| 활동 | activityType 해시 | Edge Function |
|------|------------------|---------------|
| 투표 | `keccak256("vote")` | record-onchain-vote |
| 챌린지 참여 | `keccak256("challenge")` | participate-challenge |
| KTNZ 민팅 | `keccak256("ktnz_mint")` | mint-daily-tokens |
| KTNZ 소각 | `keccak256("ktnz_burn")` | exchange-ktnz-to-points |
| FanzToken 구매 | `keccak256("fanz_buy")` | buy-fanz-token |
| FanzToken 판매 | `keccak256("fanz_sell")` | sell-fanz-token |
| FanzToken 전송 | `keccak256("fanz_transfer")` | (future) |

## 배포 단계

### 1. 컨트랙트 배포 (Remix)

1. [Remix IDE](https://remix.ethereum.org) 접속
2. `KTrendzDAU.sol` 파일 생성 후 코드 붙여넣기
3. Solidity 컴파일러 0.8.20 이상 선택 후 컴파일
4. Deploy & Run Transactions 탭:
   - Environment: Injected Provider (MetaMask)
   - Network: Base Mainnet (Chain ID: 8453)
   - Account: Owner 지갑 주소
5. Deploy 클릭

### 2. Operator 설정

Backend Smart Account를 operator로 설정:

```javascript
// Remix Console 또는 BaseScan
await contract.setOperator("0x8B4197d938b8F4212B067e9925F7251B6C21B856");
```

### 3. 환경변수 추가

Supabase Dashboard → Edge Functions → Secrets:

```
DAU_CONTRACT_ADDRESS=0x새로운_DAU_컨트랙트_주소
```

### 4. CDP Gas Policy 업데이트

Coinbase Developer Portal에서 Gas Policy에 DAU 컨트랙트 추가:

**Contract Address**: `0x새로운_DAU_컨트랙트_주소`

**Allowed Methods**:
```
recordActivity(address,bytes32,bytes32)
recordBatchActivities(address[],bytes32,bytes32)
```

### 5. Edge Functions 업데이트

각 Edge Function에 DAU 기록 로직 추가:

```typescript
// DAU 컨트랙트 ABI
const DAU_CONTRACT_ABI = [
  "function recordActivity(address user, bytes32 activityType, bytes32 referenceHash) external"
];

// 활동 타입 해시 (ethers.js)
const ACTIVITY_VOTE = ethers.keccak256(ethers.toUtf8Bytes("vote"));
const ACTIVITY_CHALLENGE = ethers.keccak256(ethers.toUtf8Bytes("challenge"));
const ACTIVITY_KTNZ_MINT = ethers.keccak256(ethers.toUtf8Bytes("ktnz_mint"));
const ACTIVITY_KTNZ_BURN = ethers.keccak256(ethers.toUtf8Bytes("ktnz_burn"));
const ACTIVITY_FANZ_BUY = ethers.keccak256(ethers.toUtf8Bytes("fanz_buy"));
const ACTIVITY_FANZ_SELL = ethers.keccak256(ethers.toUtf8Bytes("fanz_sell"));

// DAU 기록 호출 예시
const dauContract = new ethers.Contract(DAU_CONTRACT_ADDRESS, DAU_CONTRACT_ABI, wallet);
await dauContract.recordActivity(userAddress, ACTIVITY_VOTE, artistHash);
```

## Dune Analytics 쿼리

### DAU (일일 활성 사용자)
```sql
SELECT 
    DATE(block_time) as date,
    COUNT(DISTINCT "user") as dau
FROM base.logs
WHERE contract_address = 0xDAU_CONTRACT_ADDRESS
  AND topic0 = 0x... -- UserActivity 이벤트 시그니처
GROUP BY 1
ORDER BY 1 DESC
```

### 활동 타입별 DAU
```sql
SELECT 
    DATE(block_time) as date,
    activityType,
    COUNT(DISTINCT "user") as dau
FROM base.logs
WHERE contract_address = 0xDAU_CONTRACT_ADDRESS
  AND topic0 = 0x...
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC
```

### WAU/MAU
```sql
-- WAU
SELECT 
    DATE_TRUNC('week', block_time) as week,
    COUNT(DISTINCT "user") as wau
FROM base.logs
WHERE contract_address = 0xDAU_CONTRACT_ADDRESS
GROUP BY 1
ORDER BY 1 DESC

-- MAU
SELECT 
    DATE_TRUNC('month', block_time) as month,
    COUNT(DISTINCT "user") as mau
FROM base.logs
WHERE contract_address = 0xDAU_CONTRACT_ADDRESS
GROUP BY 1
ORDER BY 1 DESC
```

### 유저별 활동 횟수
```sql
SELECT 
    "user",
    COUNT(*) as total_activities,
    COUNT(DISTINCT DATE(block_time)) as active_days
FROM base.logs
WHERE contract_address = 0xDAU_CONTRACT_ADDRESS
GROUP BY 1
ORDER BY 2 DESC
LIMIT 100
```

## BaseScan 검증

배포 후 BaseScan에서 컨트랙트 검증:
1. https://basescan.org/verifyContract
2. 컨트랙트 주소 입력
3. Compiler: 0.8.20, Optimization: 200 runs
4. 소스코드 붙여넣기

## 업데이트할 Edge Functions 체크리스트

- [x] `record-onchain-vote/index.ts` - 투표 후 DAU 기록 ✅ 완료 (executeBatch 통합)
- [x] `participate-challenge/index.ts` - 챌린지 참여 후 DAU 기록 ✅ 완료 (백그라운드)
- [ ] `mint-daily-tokens/index.ts` - KTNZ 민팅 후 DAU 기록
- [ ] `exchange-ktnz-to-points/index.ts` - KTNZ 소각 후 DAU 기록
- [x] `buy-fanz-token/index.ts` - FanzToken 구매 후 DAU 기록 ✅ 완료 (maybeSingle→limit(1) 수정)
- [x] `sell-fanz-token/index.ts` - FanzToken 판매 후 DAU 기록 ✅ 완료 (백그라운드)

## 컨트랙트 주소 기록

| 컨트랙트 | 주소 | 용도 |
|----------|------|------|
| KTrendzDAU | 0xf7F05cEd0F2c905aD59C370265D67846FAb9959E | 통합 DAU 추적 |
| Backend SA | 0x8B4197d938b8F4212B067e9925F7251B6C21B856 | Operator |

## 이벤트 시그니처

```
UserActivity(address indexed user, bytes32 indexed activityType, bytes32 indexed referenceHash, uint256 timestamp)
```

Topic0 (이벤트 시그니처 해시):
```
keccak256("UserActivity(address,bytes32,bytes32,uint256)")
```

## Dune Analytics - 봇 활동 추적 쿼리

### 활동 타입 해시 참조
```
agent_batch = keccak256("agent_batch")  -- 에이전트 메시지 배치 해시
fanz_buy    = keccak256("fanz_buy")     -- FanzToken 구매
fanz_sell   = keccak256("fanz_sell")    -- FanzToken 판매
vote        = keccak256("vote")         -- 투표
challenge   = keccak256("challenge")    -- 챌린지 참여
```

### 봇 거래 활동 (DB 기반 - bot_transactions 테이블)
```sql
-- 일별 봇 거래 요약
SELECT 
    DATE(created_at) as trade_date,
    transaction_type,
    COUNT(*) as trade_count,
    SUM(amount) as total_tokens,
    SUM(total_cost_usdc) as total_volume_usd,
    SUM(fee_usdc) as total_fees_usd,
    COUNT(DISTINCT agent_id) as unique_agents
FROM bot_transactions
WHERE status = 'completed'
GROUP BY 1, 2
ORDER BY 1 DESC;
```

### 에이전트 배치 해시 온체인 기록 (Dune)
```sql
-- 에이전트 메시지 배치 해시 기록 추적
SELECT 
    DATE(block_time) as date,
    COUNT(*) as batch_count,
    COUNT(DISTINCT topic2) as unique_batch_hashes
FROM base.logs
WHERE contract_address = 0xf7F05cEd0F2c905aD59C370265D67846FAb9959E
  AND topic0 = 0x... -- UserActivity 이벤트 시그니처
  AND topic2 = keccak256("agent_batch") -- activityType = agent_batch
GROUP BY 1
ORDER BY 1 DESC;
```

### 봇 vs 유저 활동 비교 (Dune)
```sql
-- 봇과 일반 유저 활동 비율 비교
SELECT 
    DATE(block_time) as date,
    CASE 
        WHEN topic2 = keccak256("agent_batch") THEN 'bot'
        ELSE 'user'
    END as actor_type,
    COUNT(*) as activity_count,
    COUNT(DISTINCT topic1) as unique_actors
FROM base.logs
WHERE contract_address = 0xf7F05cEd0F2c905aD59C370265D67846FAb9959E
  AND topic0 = 0x... -- UserActivity 이벤트 시그니처
GROUP BY 1, 2
ORDER BY 1 DESC, 2;
```

### 봇 에이전트별 거래 랭킹 (DB)
```sql
-- 에이전트별 총 거래 실적
SELECT 
    ba.name as agent_name,
    COUNT(*) as total_trades,
    SUM(CASE WHEN bt.transaction_type = 'buy' THEN 1 ELSE 0 END) as buys,
    SUM(CASE WHEN bt.transaction_type = 'sell' THEN 1 ELSE 0 END) as sells,
    SUM(bt.total_cost_usdc) as total_volume_usd,
    SUM(bt.fee_usdc) as total_fees_usd
FROM bot_transactions bt
JOIN bot_agents ba ON bt.agent_id = ba.id
WHERE bt.status = 'completed'
GROUP BY 1
ORDER BY total_volume_usd DESC;
```

### 주간 봇 활동 트렌드 (Dune)
```sql
-- 주간 봇 온체인 활동 트렌드
SELECT 
    DATE_TRUNC('week', block_time) as week,
    COUNT(*) as batch_recordings,
    COUNT(DISTINCT topic3) as unique_reference_hashes
FROM base.logs
WHERE contract_address = 0xf7F05cEd0F2c905aD59C370265D67846FAb9959E
  AND topic2 = keccak256("agent_batch")
GROUP BY 1
ORDER BY 1 DESC;
```
