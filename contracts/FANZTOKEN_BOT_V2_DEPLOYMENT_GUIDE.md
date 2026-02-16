# FanzTokenBot V2 Deployment Guide

## 배포 완료 ✅

| 항목 | 값 |
|------|-----|
| **컨트랙트 주소** | `0x28bE702CC3A611A1EB875E277510a74fD20CDD9C` |
| **네트워크** | Base Mainnet (Chain ID: 8453) |
| **배포일** | 2025-02-06 |

### 배포 파라미터

| 파라미터 | 주소 | 설명 |
|----------|------|------|
| platform | `0x8B4197d938b8F4212B067e9925F7251B6C21B856` | 백엔드 스마트 어카운트 |
| artistFund | `0xd5C1296990b9072302a627752E46061a40112342` | 아티스트 펀드 지갑 |
| operator | `0xf1d20DF30aaD9ee0701C6ee33Fc1bb59466CaB36` | Admin EOA (Paymaster tx.origin) |

---

## V1 vs V2 차이점

| 항목 | V1 | V2 |
|------|----|----|
| **접근 제어** | `authorizedBots` 화이트리스트 | `trustedOperator` + 화이트리스트 |
| **에이전트 추가** | 컨트랙트에서 수동 `setBot()` | Paymaster 자동 검증 |
| **DAU 추적** | 단일 지갑으로 집계됨 | `actualAgent` 파라미터로 개별 추적 |
| **가스비** | 에이전트 직접 부담 | Paymaster 스폰서링 |

---

## 배포 후 설정

### 1. 토큰 생성 (V1과 동일한 본딩커브 파라미터)

```solidity
// Base Mainnet 표준 파라미터
basePrice = 1650000  // 1.65 USDC
kValue = 300000000000

// 기존 6개 토큰 생성
create(1, creatorAddress, 1650000, 300000000000)  // K-Trendz Supporters
create(2, creatorAddress, 1650000, 300000000000)  // RIIZE
create(3, creatorAddress, 1650000, 300000000000)  // Ive
create(4, creatorAddress, 1650000, 300000000000)  // Cortis
create(5, creatorAddress, 1650000, 300000000000)  // BTS
create(6, creatorAddress, 1650000, 300000000000)  // All Day Project
```

### 2. 기존 봇 화이트리스트 (하위 호환성)

```solidity
setBot(0xf1d20DF30aaD9ee0701C6ee33Fc1bb59466CaB36, true)
```

### 3. URI 설정

```solidity
setURI("https://k-trendz.com/api/token-metadata/{id}")
```

---

## Edge Function 업데이트

### 컨트랙트 주소 변경

```typescript
// V1 (기존)
const BOT_CONTRACT_V1 = "0xfe7791e3078FD183FD1c08dE2F1e4ab732024489";

// V2 (신규)
const BOT_CONTRACT_V2 = "0x28bE702CC3A611A1EB875E277510a74fD20CDD9C";
```

### V2 함수 호출

```typescript
// V2 buy with actualAgent (DAU 추적)
const tx = await contract.buy(tokenId, maxCost, agentWalletAddress);

// V2 sell with actualAgent
const tx = await contract.sell(tokenId, minRefund, agentWalletAddress);
```

---

## Basescan 링크

- **컨트랙트**: https://basescan.org/address/0x28bE702CC3A611A1EB875E277510a74fD20CDD9C
- **Verify**: Remix에서 "Verify & Publish" 또는 Basescan 직접 인증

---

## 검증 체크리스트

### 배포 후 즉시
- [ ] Basescan에서 Verify & Publish
- [ ] `create()` 함수로 파일럿 토큰 생성
- [ ] `setBot()` 함수로 Admin Wallet 화이트리스트 등록
- [ ] `setURI()` 함수로 메타데이터 URL 설정

### Edge Function 연동
- [ ] `bot-buy-token` 컨트랙트 주소 변경
- [ ] `bot-sell-token` 컨트랙트 주소 변경
- [ ] `bot-get-token-price` 컨트랙트 주소 변경
- [ ] 테스트 거래 실행

### 모니터링
- [ ] 첫 거래 성공 확인
- [ ] DAU 이벤트 로깅 확인
- [ ] 서킷 브레이커 동작 테스트

---

## 보안 설정

### trustedOperator
- 백엔드 EOA (`0xf1d20DF30aaD9ee0701C6ee33Fc1bb59466CaB36`)
- 탈취 시 `setOp()` 함수로 즉시 교체

### 일일 한도
- 컨트랙트 레벨: `DAILY_LIMIT = 100` (에이전트당)
- 한도 초과 시 "L" 에러 반환

### 서킷 브레이커
- 20% 가격 변동 시 자동 발동
- 발동 시 "CB" 에러로 모든 거래 중단
- `resetCB()` 함수로 해제 (Owner만)
