# KTrendzVoteV3 배포 가이드

## 개요
KTrendzVoteV3는 Dune 등 블록체인 분석 도구에서 DAU(일일 활성 사용자)를 정확히 추적할 수 있도록 설계된 투표 컨트랙트입니다.

### V2 대비 변경사항
| 항목 | V2 | V3 |
|------|----|----|
| Vote 이벤트 첫 번째 indexed | `voter` | `operator` (Backend SA) |
| 실제 투표자 추적 | voter (파라미터) | `actualVoter` (indexed) |
| Dune DAU 쿼리 | voter 필드 사용 | actualVoter indexed 필드 사용 |

### 이벤트 구조 비교
```solidity
// V2
event Vote(
    address indexed voter,      // 투표자 (파라미터로 전달받은 값)
    bytes32 indexed artistHash,
    bytes32 inviteCodeHash,
    uint256 voteCount,
    uint256 timestamp
);

// V3 - operator와 actualVoter 구분
event Vote(
    address indexed operator,       // Backend Smart Account (msg.sender)
    address indexed actualVoter,    // 실제 투표자 (Dune DAU용)
    bytes32 indexed artistHash,
    bytes32 inviteCodeHash,
    uint256 voteCount,
    uint256 timestamp
);
```

## 배포 단계

### 1. 컨트랙트 배포 (Remix)

1. [Remix IDE](https://remix.ethereum.org) 접속
2. `KTrendzVoteV3.sol` 파일 생성 후 코드 붙여넣기
3. Solidity 컴파일러 0.8.20 이상 선택 후 컴파일
4. Deploy & Run Transactions 탭:
   - Environment: Injected Provider (MetaMask)
   - Network: Base Mainnet (Chain ID: 8453)
   - Account: Owner 지갑 주소
5. Deploy 클릭

### 2. Operator 설정

Backend Smart Account를 operator로 설정:

```javascript
// Remix Console 또는 Etherscan
await contract.setOperator("0x8B4197d938b8F4212B067e9925F7251B6C21B856");
```

### 3. 환경변수 업데이트

Supabase Dashboard → Edge Functions → Secrets:

```
VOTE_CONTRACT_ADDRESS=0x새로운_V3_컨트랙트_주소
```

### 4. CDP Gas Policy 업데이트

Coinbase Developer Portal에서 Gas Policy에 함수 시그니처 추가:

```
vote(address,bytes32,bytes32,uint256)
```

> 참고: V3의 함수 시그니처는 V2와 동일합니다 (파라미터 타입 순서 동일)

### 5. Edge Function 업데이트

`record-onchain-vote/index.ts`와 `record-proposal-vote-onchain/index.ts`에서:

```typescript
// ABI 업데이트 - V3 이벤트 구조 반영
const VOTE_CONTRACT_ABI = [
  "function vote(address actualVoter, bytes32 artistHash, bytes32 inviteCodeHash, uint256 voteCount) external",
  "function setOperator(address newOperator) external",
  "function owner() view returns (address)",
  "function operator() view returns (address)",
  "function totalVotes() view returns (uint256)"
];
```

## Dune Analytics 쿼리

### DAU (일일 활성 사용자)
```sql
SELECT 
    DATE(block_time) as date,
    COUNT(DISTINCT actualVoter) as dau
FROM base.logs
WHERE contract_address = 0x새로운_V3_주소
  AND topic0 = 0x... -- Vote 이벤트 시그니처
GROUP BY 1
ORDER BY 1 DESC
```

### 주간/월간 활성 사용자
```sql
SELECT 
    DATE_TRUNC('week', block_time) as week,
    COUNT(DISTINCT actualVoter) as wau
FROM base.logs
WHERE contract_address = 0x새로운_V3_주소
  AND topic0 = 0x...
GROUP BY 1
ORDER BY 1 DESC
```

## 검증

배포 후 BaseScan에서 컨트랙트 검증:
1. https://basescan.org/verifyContract
2. 컨트랙트 주소 입력
3. Compiler: 0.8.20, Optimization: 200 runs
4. 소스코드 붙여넣기

## 마이그레이션 체크리스트

- [ ] V3 컨트랙트 배포
- [ ] BaseScan 컨트랙트 검증
- [ ] Backend Smart Account를 operator로 설정
- [ ] `VOTE_CONTRACT_ADDRESS` 환경변수 업데이트
- [ ] CDP Gas Policy 확인 (시그니처 동일하므로 변경 불필요할 수 있음)
- [ ] Edge Functions 업데이트 및 배포
- [ ] 테스트 투표 실행
- [ ] BaseScan에서 Vote 이벤트 로그 확인 (actualVoter indexed)

## 컨트랙트 주소 기록

| 버전 | 주소 | 상태 |
|------|------|------|
| V1 | 0x341176e85D9D76eB9C04dDbCA9305d2aD7CAa086 | Deprecated |
| V2 | 0x9c08BB23352173800a725F208a438FfE32d59D05 | Deprecated |
| V3 | 0x70E4B129B624Fc99775D23382568209Bf9c2d923 | Active |
