# FanzTokenUSDC v4.1 배포 가이드

## 배포된 컨트랙트
- **V4.1 Contract**: `0xB0b27762672d6c27494b563f6a44cb9E6D19Fc24`
- **Owner**: `0xf1d20DF30aaD9ee0701C6ee33Fc1bb59466CaB36`
- **Platform Wallet**: `0x354f221cb4a528f2a2a8e4a126ea39dd120e40ab`
- **Artist Fund Wallet**: `0xd5C1296990b9072302a627752E46061a40112342`

## 변경 사항 (v4 → v4.1)
- `setURI(string memory newUri)` 함수 추가 - ERC-1155 메타데이터 URI 설정 기능

## 배포 절차

### 1. Remix에서 컨트랙트 배포

1. [Remix IDE](https://remix.ethereum.org) 접속
2. `contracts/FanzTokenUSDC_v4_flat.sol` 내용 복사하여 새 파일 생성
3. Solidity Compiler 탭에서:
   - Compiler: 0.8.20
   - EVM Version: paris
   - Enable optimization: 200 runs
4. Deploy & Run 탭에서:
   - Environment: Injected Provider (MetaMask - Base Mainnet)
   - Contract: FanzTokenUSDC_v4_1
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
   - License: MIT
4. Flattened 소스코드 붙여넣기
5. Constructor Arguments ABI-encoded 입력

### 3. 초기 설정

#### 3.1 Operator 등록
```solidity
setOperator(0x8B4197d938b8F4212B067e9925F7251B6C21B856, true)
```

#### 3.2 메타데이터 URI 설정
```solidity
setURI("https://jguylowswwgjvotdcsfj.supabase.co/functions/v1/get-token-metadata/api/token/{id}.json")
```

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

다음 파일들의 V4 주소를 새 주소로 변경:
- `src/components/Navbar.tsx`
- `src/components/MyFanStatusCard.tsx`
- `src/pages/Earn.tsx`
- `src/pages/MyFanzTokens.tsx`
- `src/components/FanzTokenHoldersDialog.tsx`

### 6. V4 컨트랙트에서 자금 이전 (선택)

기존 V4 컨트랙트(0xA6940CC3...)에 USDC 잔액이 있다면:
```solidity
// V4 컨트랙트에서 실행
emergencyWithdraw(새_V4.1_컨트랙트_주소)
```

## 검증 체크리스트

- [ ] 새 컨트랙트 배포 완료
- [ ] BaseScan 검증 완료
- [ ] Operator 등록 완료
- [ ] setURI 호출 완료
- [ ] 기존 토큰 3개 재등록 완료
- [ ] FANZTOKEN_CONTRACT_ADDRESS 시크릿 업데이트
- [ ] 프론트엔드 하드코딩 주소 업데이트
- [ ] 메타데이터 URL 테스트 (BaseScan에서 토큰 메타데이터 표시 확인)
