# FanzTokenUSDC V5 배포 가이드

## V5 주요 변경사항 (V4.1 → V5)

### 핵심 변경: `sellFor()` Approval 우회
- **기존 V4.1**: `isApprovedForAll` 필수 → undeployed Smart Wallet은 판매 불가
- **V5**: Operator가 호출하면 approval 체크 없이 판매 가능
  - Undeployed Smart Wallet 대신 Backend가 판매 가능
  - 가스비 $0.72-$1.44 절약 (Smart Wallet 배포 불필요)
  - DAU는 `actualSeller` 파라미터로 정상 추적

### 보안
- `sellFor()`, `transferFor()`는 여전히 `onlyOperatorOrOwner` modifier로 제한
- 일반 사용자는 `sell()`로 직접 판매 (기존과 동일)
- Operator만 타인의 토큰을 판매/전송 가능 (신뢰된 Backend만 Operator)

## 배포 절차

### 1. Remix에서 컨트랙트 배포

1. [Remix IDE](https://remix.ethereum.org) 접속
2. `contracts/FanzTokenUSDC_v5.sol` 내용 복사하여 새 파일 생성
3. Solidity Compiler 탭에서:
   - Compiler: 0.8.20
   - EVM Version: paris
   - Enable optimization: 200 runs
4. Deploy & Run 탭에서:
   - Environment: Injected Provider (MetaMask - Base Mainnet)
   - Contract: FanzTokenUSDC_v5
   - Constructor 파라미터:
     - `_platformWallet`: `0x354f221cb4a528f2a2a8e4a126ea39dd120e40ab`
     - `_artistFundWallet`: `0xd5C1296990b9072302a627752E46061a40112342`
5. Deploy 클릭 및 트랜잭션 승인

### 2. 컨트랙트 검증 (BaseScan)

1. BaseScan에서 새 컨트랙트 주소 검색
2. "Contract" → "Verify and Publish" 클릭
3. 설정:
   - Compiler Type: Solidity (Single file)
   - Compiler Version: v0.8.20+commit.a1b79de6
   - Optimization: Yes with 200 runs
   - EVM Version: paris
   - License: MIT
4. Flattened 소스코드 붙여넣기
5. Constructor Arguments ABI-encoded 입력

### 3. 초기 설정

#### 3.1 Operator 등록
```solidity
setOperator(0x8B4197d938b8F4212B067e9925F7251B6C21B856, true)
```

#### 3.2 메타데이터 URI 설정 (중요!)
```solidity
setURI("https://k-trendz.com/api/token/{id}.json")
```
**주의**: `{id}`를 그대로 입력! ERC-1155 표준에 따라 자동 치환됨

#### 3.3 기존 토큰 재등록
```solidity
// K-Trendz Supporters
createToken(12666454296509763493, 0x354f221cb4a528f2a2a8e4a126ea39dd120e40ab, 1650000, 300000)

// RIIZE  
createToken(7963681970480434413, 0x354f221cb4a528f2a2a8e4a126ea39dd120e40ab, 1650000, 300000)

// IVE
createToken(4607865675402095874, 0x354f221cb4a528f2a2a8e4a126ea39dd120e40ab, 1650000, 300000)
```

### 4. Supabase Secret 업데이트

Lovable 대시보드에서 `FANZTOKEN_CONTRACT_ADDRESS` 시크릿을 새 컨트랙트 주소로 업데이트

### 5. 프론트엔드 하드코딩 주소 업데이트

다음 파일들의 V4.1 주소를 새 주소로 변경:
- `src/components/Navbar.tsx`
- `src/components/MyFanStatusCard.tsx`
- `src/pages/Earn.tsx`
- `src/pages/MyFanzTokens.tsx`
- `src/components/FanzTokenHoldersDialog.tsx`

### 6. Edge Function 업데이트

`sell-fanz-token` Edge Function에서:
- V5 컨트랙트 주소로 변경
- `sellFor()` 호출 시 approval 체크 로직 제거 (V5에서는 불필요)

### 7. Coinbase CDP Gas Policy 업데이트

새 V5 컨트랙트 주소에 대해 다음 함수들 allowlist:
- `sell(uint256,uint256,uint256)`
- `sellFor(uint256,address,uint256,uint256)`
- `buy(uint256,uint256,uint256)`
- `buyFor(uint256,address,uint256,uint256)`
- `safeTransferFrom(address,address,uint256,uint256,bytes)`
- `transferFor(uint256,address,address,uint256)`
- `setURI(string)`

### 8. V4.1 컨트랙트에서 자금 이전

기존 V4.1 컨트랙트(0xB0b27...)에 USDC 잔액이 있다면:
```solidity
// V4.1 컨트랙트에서 실행
emergencyWithdraw(새_V5_컨트랙트_주소)
```

## V4.1에서 메타데이터가 안 나오는 문제 해결

### 즉시 조치 (V4.1에서)
V4.1 컨트랙트 Owner가 `setURI` 호출:
```solidity
setURI("https://k-trendz.com/api/token/{id}.json")
```

### 확인 방법
1. BaseScan에서 V4.1 컨트랙트 → Read Contract → `uri` 함수 호출
2. 아무 tokenId 입력 (예: 12666454296509763493)
3. 결과에 `https://k-trendz.com/api/token/...` 형태로 나오면 성공

### BaseScan 메타데이터 갱신
1. BaseScan 토큰 페이지 → "NFTs" 탭
2. 특정 토큰 클릭 → "Refresh Metadata" 버튼 클릭
3. 또는 BaseScan에 Token Update Request 제출

## 검증 체크리스트

- [ ] 새 컨트랙트 배포 완료
- [ ] BaseScan 검증 완료
- [ ] Operator 등록 완료
- [ ] setURI 호출 완료 (`https://k-trendz.com/api/token/{id}.json`)
- [ ] 기존 토큰 3개 재등록 완료
- [ ] FANZTOKEN_CONTRACT_ADDRESS 시크릿 업데이트
- [ ] 프론트엔드 하드코딩 주소 업데이트
- [ ] Coinbase CDP Gas Policy allowlist 업데이트
- [ ] sell-fanz-token Edge Function 업데이트
- [ ] V4.1에서 V5로 USDC 잔액 이전
- [ ] 메타데이터 URL 테스트 (BaseScan에서 토큰 메타데이터 표시 확인)

## 기술 참고

### 왜 V5가 필요한가?
V4.1의 `sellFor()`는 다음 체크가 있음:
```solidity
require(
    isApprovedForAll(actualSeller, address(this)) || 
    isApprovedForAll(actualSeller, msg.sender),
    "Not approved"
);
```

Undeployed Smart Wallet은 `setApprovalForAll`을 호출할 수 없어서:
1. 판매하려면 먼저 Smart Wallet 배포 필요 ($0.72-$1.44 가스비)
2. 그 후 `setApprovalForAll` 호출 필요
3. 그 후에야 `sellFor()` 가능

V5는 Operator가 호출하면 이 체크를 생략하여 가스비 절약.
