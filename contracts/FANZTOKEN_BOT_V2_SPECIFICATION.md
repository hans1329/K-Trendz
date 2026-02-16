# FanzTokenBot V2 Specification

## 개요

V1의 화이트리스트 기반 접근 제어를 **Paymaster 기반 검증**으로 대체하여, 소셜 인증된 에이전트가 직접 온체인 거래를 수행할 수 있도록 합니다.

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                     OpenClaw Agent (Local)                       │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │ ethers.js   │ -> │ Smart Wallet│ -> │ UserOperation 생성   │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   K-Trendz Paymaster Service                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 1. verified_agents 테이블에서 agent 검증                     │ │
│  │ 2. 일일 한도 확인 (check_agent_daily_limit)                  │ │
│  │ 3. paymasterAndData 서명 반환                                │ │
│  └─────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FanzTokenBot V2 Contract                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 검증: paymasterAndData에 우리 Paymaster 서명 포함 여부       │ │
│  │ → 검증 통과 시 buy()/sell() 실행                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## V1 vs V2 비교

| 항목 | V1 (현재) | V2 (목표) |
|------|-----------|-----------|
| 접근 제어 | `authorizedBots` 화이트리스트 | Paymaster 서명 검증 |
| 에이전트 추가 | 수동 `setAuthorizedBot()` 호출 | 소셜 인증 후 자동 승인 |
| 가스비 | 에이전트 직접 부담 | Paymaster 스폰서링 |
| DAU 추적 | 단일 지갑 (Admin) | 에이전트별 Smart Wallet |
| Sybil 방지 | 수동 검증 | X/Discord OAuth 연동 |

## 컨트랙트 변경사항

### 1. 접근 제어 수정

```solidity
// V1: 화이트리스트 기반
modifier onlyAuthorizedBot() {
    require(authorizedBots[msg.sender], "Not authorized bot");
    _;
}

// V2: Paymaster 검증 기반
address public trustedPaymaster;

modifier onlyVerifiedAgent() {
    // EntryPoint에서 호출된 경우 (Smart Wallet via Paymaster)
    // 또는 기존 화이트리스트 (하위 호환성)
    require(
        msg.sender == address(entryPoint) || 
        authorizedBots[msg.sender],
        "Not verified agent"
    );
    _;
}
```

### 2. Paymaster 설정

```solidity
IEntryPoint public immutable entryPoint;

constructor(
    address _platformWallet,
    address _artistFundWallet,
    address _entryPoint
) ERC1155("") Ownable(msg.sender) {
    // ... 기존 초기화
    entryPoint = IEntryPoint(_entryPoint);
}

function setTrustedPaymaster(address _paymaster) external onlyOwner {
    trustedPaymaster = _paymaster;
}
```

### 3. 이벤트 확장 (DAU 추적용)

```solidity
event TokenBought(
    address indexed agent,      // 에이전트 Smart Wallet
    uint256 indexed tokenId,
    uint256 amount,
    uint256 totalCost,
    uint256 newSupply,
    uint256 timestamp,
    bytes32 agentId            // DB agent UUID (optional)
);
```

## Paymaster Service 스펙

### 엔드포인트

```
POST /api/paymaster/sponsor
```

### 요청

```json
{
  "userOp": {
    "sender": "0x...",       // Agent Smart Wallet
    "callData": "0x...",     // buy() 또는 sell() calldata
    ...
  },
  "agentWallet": "0x..."     // 검증할 에이전트 지갑
}
```

### 검증 로직

```typescript
async function validateSponsorRequest(agentWallet: string, amount: number) {
  // 1. verified_agents 테이블에서 에이전트 확인
  const agent = await supabase
    .from('verified_agents')
    .select('*')
    .eq('wallet_address', agentWallet)
    .eq('status', 'verified')
    .eq('paymaster_approved', true)
    .single();
  
  if (!agent) throw new Error('Agent not verified');
  
  // 2. 일일 한도 확인
  const { data: canProceed } = await supabase
    .rpc('check_agent_daily_limit', { 
      _agent_id: agent.id, 
      _amount_usd: amount 
    });
  
  if (!canProceed) throw new Error('Daily limit exceeded');
  
  // 3. paymasterAndData 생성 및 서명
  return signPaymasterData(userOp);
}
```

## 소셜 인증 플로우

### X (Twitter) OAuth

```
1. 에이전트가 K-Trendz 인증 페이지 접속
2. X 계정으로 로그인 (OAuth 2.0)
3. Smart Wallet 주소 입력
4. verified_agents 테이블에 등록 (status: 'pending')
5. 관리자 승인 → status: 'verified', paymaster_approved: true
```

### Discord OAuth

```
1. 에이전트가 Discord 서버 참여
2. /verify 명령어 실행
3. Smart Wallet 주소 입력
4. verified_agents 테이블에 등록
5. 특정 역할 부여 시 자동 승인
```

## Rate Limiting

| 레벨 | 일일 한도 (USD) | 일일 TX 한도 |
|------|-----------------|--------------|
| Basic | $100 | 50 |
| Verified | $500 | 200 |
| Partner | $5,000 | 1,000 |

## 배포 현황

### Phase 1: DB 인프라 ✅ 완료
- [x] verified_agents 테이블
- [x] agent_daily_usage 테이블
- [x] agent_transactions 테이블
- [x] check_agent_daily_limit 헬퍼 함수

### Phase 2: 에이전트 등록 API ✅ 완료
- [x] `/api/agent/register` 엔드포인트 (agent-register Edge Function)
- [x] 소셜 인증 정보 + 지갑 주소 연결
- [x] 중복 등록 방지 (소셜 계정당 1개 지갑)
- [x] Admin 승인 대기 상태 (status: pending)

### Phase 3: Paymaster Service ✅ 완료
- [x] `/api/paymaster/sponsor` 엔드포인트 (paymaster-sponsor Edge Function)
- [x] Coinbase Paymaster 연동 (pm_getPaymasterData)
- [x] 일일 한도 확인 (check_agent_daily_limit)
- [x] 트랜잭션 사전 기록

### Phase 4: 관리자 UI ✅ 완료
- [x] Admin 페이지 AgentVerificationManager 컴포넌트
- [x] Pending 에이전트 승인/거부/정지 기능
- [x] 일일 한도 설정 UI
- [x] Paymaster 승인 토글

### Phase 5: 컨트랙트 배포 ✅ 코드 완료
- [x] FanzTokenBotV2.sol 개발 완료
- [x] 배포 가이드 문서 작성 (FANZTOKEN_BOT_V2_DEPLOYMENT_GUIDE.md)
- [ ] 테스트넷 배포 및 테스트
- [ ] 메인넷 배포
- [ ] 기존 토큰 마이그레이션

### Phase 6: OpenClaw Skill 업데이트 (예정)
- [ ] index.js → ethers.js 직접 통신
- [ ] Smart Wallet 생성 로직
- [ ] Paymaster 연동

## V2 컨트랙트 핵심 변경사항

### 검증 로직

```solidity
modifier onlyVerifiedAgent() {
    require(
        tx.origin == trustedOperator || authorizedBots[msg.sender],
        "Not verified agent"
    );
    _;
}
```

### DAU 추적용 이벤트

```solidity
event TokenBought(
    address indexed executor,      // 실제 tx 실행자 (Smart Account)
    address indexed actualAgent,   // 논리적 에이전트 (DAU 추적용)
    uint256 indexed tokenId,
    uint256 amount,
    uint256 totalCost,
    uint256 newSupply,
    uint256 timestamp
);
```

### 새로운 buy/sell 시그니처

```solidity
// V2 (DAU 추적)
function buy(uint256 tokenId, uint256 maxCost, address actualAgent) external;
function sell(uint256 tokenId, uint256 minRefund, address actualAgent) external;

// V1 호환 (기존 봇용)
function buy(uint256 tokenId, uint256 maxCost) external;
function sell(uint256 tokenId, uint256 minRefund) external;
```

## 보안 고려사항

### Sybil Attack 방지
- 소셜 계정 1개당 Smart Wallet 1개만 등록 가능
- UNIQUE (social_provider, social_id) 제약조건
- 의심스러운 계정 관리자 수동 검토

### Rate Limit Bypass 방지
- 서버사이드 한도 체크 (SECURITY DEFINER 함수)
- Paymaster에서 이중 검증
- 일일 리셋 시간 UTC 기준 고정

### 컨트랙트 보안
- Paymaster 주소 Owner만 변경 가능
- 기존 화이트리스트 하위 호환성 유지
- Circuit Breaker 유지
