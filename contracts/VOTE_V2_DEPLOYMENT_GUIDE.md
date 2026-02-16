# KTrendzVoteV2 배포 가이드

## 개요
KTrendzVoteV2는 Coinbase Paymaster와 호환되도록 설계된 투표 기록 컨트랙트입니다.
- 기존 v1의 `string` 파라미터를 `bytes32` 해시로 변경
- Paymaster가 calldata를 유효하게 인식하여 가스 스폰서십 가능

## 배포 단계

### 1. 컨트랙트 배포 (Remix)

1. [Remix IDE](https://remix.ethereum.org) 접속
2. `KTrendzVoteV2.sol` 파일 생성 후 코드 붙여넣기
3. Solidity 컴파일러 0.8.20 이상 선택 후 컴파일
4. Deploy & Run Transactions 탭:
   - Environment: Injected Provider (MetaMask)
   - Network: Base Mainnet (Chain ID: 8453)
   - Account: 오퍼레이터 지갑 주소
5. Deploy 클릭

### 2. 환경변수 업데이트

배포 후 받은 컨트랙트 주소로 Supabase Edge Functions Secrets 업데이트:

```
VOTE_CONTRACT_ADDRESS=0x새로운_V2_컨트랙트_주소
```

### 3. CDP Gas Policy 업데이트

Coinbase Developer Portal에서 Gas Policy에 새 함수 시그니처 추가:

```
vote(address,bytes32,bytes32,uint256)
```

기존 v1 시그니처는 유지하거나 제거:
```
vote(address,string,string,uint256)  // 제거 가능
```

### 4. Operator 설정 (선택)

Backend Smart Account를 operator로 설정하려면:

```javascript
// Remix Console 또는 별도 스크립트
await contract.setOperator("0x20aAf9262C957B5fF0B5548c27F8cC6e843e79F2");
```

또는 EOA를 계속 사용하려면 현재 배포자 주소가 자동으로 owner/operator가 됩니다.

## 함수 시그니처

| 함수 | 시그니처 | 용도 |
|------|----------|------|
| vote | `vote(address,bytes32,bytes32,uint256)` | 투표 기록 (Paymaster 호환) |
| setOperator | `setOperator(address)` | 운영자 변경 |
| recordDailyStats | `recordDailyStats(uint256,uint256,uint256)` | 일일 통계 |
| hashString | `hashString(string)` | 문자열→bytes32 변환 (view) |

## 해시 계산 방법

Edge Function에서:
```typescript
import { ethers } from "ethers";

const artistHash = ethers.keccak256(ethers.toUtf8Bytes(artistName));
const inviteCodeHash = inviteCode 
  ? ethers.keccak256(ethers.toUtf8Bytes(inviteCode))
  : ethers.ZeroHash;
```

## 이벤트 구조

```solidity
event Vote(
    address indexed voter,      // 투표자 주소
    bytes32 indexed artistHash, // 아티스트 해시 (indexed로 필터링 가능)
    bytes32 inviteCodeHash,     // 초대코드 해시
    uint256 voteCount,          // 투표 수
    uint256 timestamp           // 블록 타임스탬프
);
```

## 검증

배포 후 BaseScan에서 컨트랙트 검증:
1. https://basescan.org/verifyContract
2. 컨트랙트 주소 입력
3. Compiler: 0.8.20, Optimization: 200 runs
4. 소스코드 붙여넣기
