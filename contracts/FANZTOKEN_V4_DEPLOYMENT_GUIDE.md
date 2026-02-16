# FanzTokenUSDC_v4 Deployment Guide

## 배포 완료 정보

| 항목 | 주소 |
|------|------|
| **V4 Contract** | `0xA6940CC3a11bC8e43Fd343C0c86ddcf67D5f7dCe` |
| **Owner** | `0xf1d20DF30aaD9ee0701C6ee33Fc1bb59466CaB36` |
| **Platform Wallet** | `0x354f221cb4a528f2a2a8e4a126ea39dd120e40ab` |
| **Artist Fund Wallet** | `0xd5C1296990b9072302a627752E46061a40112342` |

---

## V4 주요 개선사항 (V3 문제점 해결)

| 문제 | V3 | V4 |
|------|----|----|
| Reserve 출금 | ❌ 불가능 (자금 잠김) | ✅ `withdraw()` 함수 |
| 레거시 지갑 sell | ❌ 지갑 호환성 문제 | ✅ `sellFor()` |
| 토큰 파라미터 수정 | ❌ 불가능 | ✅ `setTokenParams()` |
| 긴급 정지 | ❌ 없음 | ✅ `pause()/unpause()` |
| 긴급 출금 | ❌ 없음 | ✅ `emergencyWithdraw()` |

## 수수료 구조 (V3와 동일)

### 구매 (Purchase)
| 항목 | 비율 | 수령처 |
|------|------|--------|
| Artist Fund | 20% | artistFundWallet |
| Platform | 10% | platformWallet |
| Reserve | 70% | 컨트랙트 내 보유 |

### 판매 (Sale)
| 항목 | 비율 | 수령처 |
|------|------|--------|
| User Refund | 96% | 판매자 지갑 |
| Platform Fee | 4% | platformWallet |

---

## 배포 절차

### 1. Remix에서 컨트랙트 배포

1. https://remix.ethereum.org 접속
2. `FanzTokenUSDC_v4.sol` 파일 생성
3. Solidity 0.8.20+ 로 컴파일
4. Base Mainnet에 배포 (constructor args):
   - `_platformWallet`: `0x354f221cb4a528f2a2a8e4a126ea39dd120e40ab`
   - `_artistFundWallet`: `0xd5C1296990b9072302a627752E46061a40112342`

### 2. 배포 후 설정

```solidity
// Backend Smart Account를 Operator로 등록
setOperator(0x8B4197d938b8F4212B067e9925F7251B6C21B856, true)
```

### 3. 기존 토큰 재등록

```solidity
// K-Trendz Supporters 토큰
createToken(
    1,                              // tokenId
    0x354f221cb4a528f2a2a8e4a126ea39dd120e40ab, // creator
    1650000,                        // basePrice: 1.65 USDC
    2000000000000000000             // kValue: 2.0 (scaled by 1e12 * 1e6)
)

// RIIZE 토큰 (예시)
createToken(
    <tokenId>,
    <creatorAddress>,
    1650000,
    2000000000000000000
)
```

### 4. 환경 변수 업데이트

Supabase Dashboard → Edge Functions → Secrets:
```
FANZTOKEN_CONTRACT_ADDRESS = <V4 주소>
```

### 5. Coinbase Gas Policy 업데이트

새 컨트랙트 주소와 메서드 allowlist:
- `buy(uint256,uint256,uint256)`
- `sell(uint256,uint256,uint256)`
- `sellByOperator(uint256,address,uint256,uint256)` ← 신규
- `setApprovalForAll(address,bool)` ← Operator 사용시 필요

---

## 새 기능 사용법

### 1. Reserve 출금 (V3에서 불가능했던 핵심 기능)

```solidity
// 특정 금액 출금
withdraw(0x354f221cb4a528f2a2a8e4a126ea39dd120e40ab, 9000000) // $9 USDC

// 전체 잔액 출금 (긴급 상황)
emergencyWithdraw(0x354f221cb4a528f2a2a8e4a126ea39dd120e40ab)
```

### 2. Operator를 통한 판매 (레거시 지갑 문제 해결)

사용자가 sell()을 직접 호출할 수 없는 경우:

1. **사용자**: `setApprovalForAll(컨트랙트주소, true)` 호출
2. **Operator**: `sellByOperator(tokenId, 사용자주소, amount, minRefund)` 호출
3. **결과**: 사용자에게 USDC 환불

### 3. 토큰 파라미터 수정

```solidity
// basePrice와 kValue 변경
setTokenParams(
    1,              // tokenId
    2000000,        // newBasePrice: 2.0 USDC
    3000000000000000000  // newKValue: 3.0
)
```

### 4. 긴급 정지

```solidity
// 모든 buy/sell 중지
pause()

// 재개
unpause()
```

---

## Edge Function 수정 필요 사항

### sell-fanz-token 수정
- 기존: 사용자 지갑에서 직접 sell() 호출
- V4: 레거시 지갑인 경우 `sellByOperator()` 사용

```typescript
// 레거시 지갑 감지시
if (isLegacyWallet) {
  // Operator (Backend Smart Account)가 대신 sell 실행
  const tx = await contract.sellByOperator(tokenId, userAddress, amount, minRefund);
}
```

---

## 마이그레이션 체크리스트

- [ ] V4 컨트랙트 배포
- [ ] Backend Smart Account를 Operator로 등록
- [ ] 기존 토큰 재등록 (createToken)
- [ ] `FANZTOKEN_CONTRACT_ADDRESS` 시크릿 업데이트
- [ ] Coinbase Gas Policy 업데이트
- [ ] `sell-fanz-token` Edge Function 수정 (sellByOperator 지원)
- [ ] 테스트: buy, sell, sellByOperator, withdraw
- [ ] V3 reserve 출금 불가 확인 후 손실 처리

---

## V3 → V4 전환시 주의사항

⚠️ **V3의 ~$9 USDC는 구출 불가능**
- V3에는 withdraw() 함수가 없음
- V3 토큰 홀더만 sell() 호출 가능하나 레거시 지갑 문제로 불가
- V4 배포 후 V3 reserve는 영구 잠김 상태로 유지

✅ **V4에서는 이런 문제 발생 안 함**
- `withdraw()`: Owner가 언제든 reserve 출금 가능
- `sellByOperator()`: Operator가 레거시 사용자 대신 sell 가능
- `emergencyWithdraw()`: 긴급 상황시 전체 출금 가능
