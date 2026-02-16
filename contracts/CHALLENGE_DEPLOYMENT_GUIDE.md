# KTrendzChallenge 컨트랙트 배포 가이드

## 개요

KTrendzChallenge는 K-Pop 예측 챌린지를 온체인화하여 Base 팀에 어필하기 위한 컨트랙트입니다.

### 주요 목표
- **TX 볼륨 극대화**: 각 참여가 개별 TX로 기록
- **사용자 지갑 활성화**: Coinbase Paymaster로 가스비 스폰서
- **투명성 확보**: 모든 참여/당첨 기록 온체인 검증 가능

---

## 배포 정보

### 네트워크
- **Base Mainnet**: chainId 8453
- **Base Sepolia (테스트)**: chainId 84532

### 의존성
- OpenZeppelin Contracts v4.9.0+
- Solidity ^0.8.20

### USDC 주소
- **Base Mainnet**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Base Sepolia**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

---

## 배포 순서

### 1. 컴파일

```bash
# Foundry 사용 시
forge build

# Hardhat 사용 시
npx hardhat compile
```

### 2. 배포

```bash
# Foundry
forge create --rpc-url https://mainnet.base.org \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --constructor-args 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  contracts/KTrendzChallenge.sol:KTrendzChallenge

# Hardhat
npx hardhat run scripts/deploy-challenge.js --network base
```

### 3. 검증

```bash
forge verify-contract \
  --chain-id 8453 \
  --constructor-args $(cast abi-encode "constructor(address)" 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) \
  $CONTRACT_ADDRESS \
  contracts/KTrendzChallenge.sol:KTrendzChallenge
```

---

## 초기 설정

### 1. Operator 설정

Edge Function 서버 지갑을 operator로 설정:

```solidity
setOperator(EDGE_FUNCTION_WALLET_ADDRESS)
```

### 2. USDC 예치

상금 분배를 위해 USDC를 컨트랙트에 예치:

```solidity
usdc.transfer(CONTRACT_ADDRESS, PRIZE_POOL_AMOUNT)
```

---

## 통합 플로우

### 1. 챌린지 생성 (Admin)

```javascript
// Edge Function에서 호출
const tx = await contract.createChallenge(
  questionHash,           // keccak256(challengeId)
  answerHash,            // keccak256(correctAnswer)
  prizePool,             // 총 상금 (USDC 6 decimals)
  prizeWithLightstick,   // 응원봉 보유자 상금
  prizeWithoutLightstick, // 일반 상금
  startTime,             // Unix timestamp
  endTime,               // Unix timestamp
  winnerCount            // 예상 당첨자 수
);
```

### 2. 사용자 참여 (핵심 TX!)

```javascript
// 사용자 임베디드 지갑에서 직접 호출
// Coinbase Paymaster로 가스비 스폰서

const answerHash = keccak256(encodePacked(challengeId, selectedAnswer));

const tx = await contract.participate(
  onchainChallengeId,
  answerHash,
  hasLightstick
);
```

### 3. 정답 공개

```javascript
await contract.revealAnswer(challengeId, correctAnswer);
```

### 4. 당첨자 선정

```javascript
await contract.selectWinners(challengeId, winnerAddresses);
```

### 5. 상금 분배

```javascript
// 옵션 A: 일괄 분배
await contract.distributePrizes(challengeId, winners, amounts);

// 옵션 B: 개별 수령
await contract.claimPrize(challengeId); // 당첨자가 직접 호출
```

---

## Coinbase Paymaster 연동

### 설정

```javascript
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { createSmartAccountClient } from '@coinbase/wallet-sdk';

const paymasterClient = createSmartAccountClient({
  chain: base,
  bundlerUrl: 'https://api.developer.coinbase.com/rpc/v1/base/...',
  paymasterUrl: 'https://api.developer.coinbase.com/rpc/v1/base/...',
});

// 스폰서 TX
const userOp = await paymasterClient.sendUserOperation({
  account: userSmartAccount,
  calls: [{
    to: CHALLENGE_CONTRACT_ADDRESS,
    data: encodeFunctionData({
      abi: KTrendzChallengeABI,
      functionName: 'participate',
      args: [challengeId, answerHash, hasLightstick]
    })
  }]
});
```

---

## 가스비 예상

| 함수 | 예상 가스 | 예상 비용 (Base) |
|------|----------|-----------------|
| createChallenge | ~150,000 | ~$0.01 |
| participate | ~80,000 | ~$0.001 |
| revealAnswer | ~50,000 | ~$0.005 |
| selectWinners (100명) | ~500,000 | ~$0.05 |
| distributePrizes (100명) | ~800,000 | ~$0.08 |

---

## 보안 고려사항

1. **Operator 키 보안**: Edge Function 환경변수로 관리
2. **정답 해시**: 사전에 커밋하여 조작 방지
3. **당첨자 선정**: 블록해시 기반 랜덤 (예측 불가)
4. **ReentrancyGuard**: 상금 수령 시 재진입 방지

---

## Base 팀 어필 포인트

1. **Consumer App**: K-Pop 팬 타겟 실제 유스케이스
2. **High TX Volume**: 참여자 × 챌린지 수
3. **Coinbase Integration**: Paymaster + Smart Wallet
4. **USDC Native**: 실제 가치 이동
5. **Verified Contract**: Basescan 공개 검증

---

## 환경 변수

```env
# 배포 및 운영에 필요한 시크릿
DEPLOYER_PRIVATE_KEY=       # 배포자 개인키
OPERATOR_PRIVATE_KEY=       # 운영자 (Edge Function) 개인키
COINBASE_PAYMASTER_URL=     # Coinbase Paymaster RPC URL
CHALLENGE_CONTRACT_ADDRESS= # 배포된 컨트랙트 주소
```

---

## 체크리스트

- [ ] Base Sepolia 테스트 배포
- [ ] Basescan 컨트랙트 검증
- [ ] Coinbase Paymaster 설정
- [ ] Edge Function 연동
- [ ] 테스트 챌린지 생성
- [ ] 참여 TX 테스트
- [ ] 상금 분배 테스트
- [ ] Base Mainnet 배포
- [ ] 운영 모니터링 대시보드 설정
