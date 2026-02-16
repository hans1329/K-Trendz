# FanzToken V6 Specification
## Tiered Fee Structure for Liquidity Partners

---

## 1. 개요

V6는 **Liquidity Partners Program**을 도입하여 봇(시장 조성자)과 리테일 사용자에게 차등화된 수수료 체계를 적용합니다. 봇은 낮은 수수료로 유동성을 공급하고, 리테일 사용자는 프리미엄 수수료로 아티스트를 직접 후원하는 이원화된 구조입니다.

### 핵심 변경사항 (V5 → V6)

| 항목 | V5 | V6 |
|------|----|----|
| 수수료 구조 | 단일 30% | **Tiered (리테일 30% / 봇 10%)** |
| 봇 지원 | 없음 | **authorizedBots 화이트리스트** |
| 구매 제한 | 없음 | **봇: 1회 1개 제한** |

---

## 2. 수수료 구조

### 2.1 리테일 티어 (Retail Tier) - 30% 수수료

일반 사용자를 위한 기본 티어입니다.

| 항목 | 비율 | 수령처 |
|------|------|--------|
| **Reserve (유동성)** | 70% | 컨트랙트 내 보유 |
| **Artist Fund** | 20% | artistFundWallet |
| **Platform** | 10% | platformWallet |

**예시) $2.00 토큰 구매 시:**
```
Total Cost:     $2.60
├─ Reserve:     $1.40 (70%)
├─ Artist Fund: $0.40 (20%)
└─ Platform:    $0.20 (10%)
```

### 2.2 봇 티어 (Bot Tier) - 10% 수수료

화이트리스트된 Liquidity Partner를 위한 할인 티어입니다.

| 항목 | 비율 | 수령처 |
|------|------|--------|
| **Reserve (유동성)** | 90% | 컨트랙트 내 보유 |
| **Artist Fund** | 5% | artistFundWallet |
| **Platform** | 5% | platformWallet |

**예시) $2.00 토큰 구매 시:**
```
Total Cost:     $2.20
├─ Reserve:     $1.80 (90%)
├─ Artist Fund: $0.10 (5%)
└─ Platform:    $0.10 (5%)
```

### 2.3 플랫폼 순이익 비교

| 거래 유형 | 플랫폼 수익 | 운영 비용 | 순이익 |
|----------|-----------|----------|--------|
| **🤖 봇 (USDC)** | $0.10 (5%) | $0 (봇이 가스비 부담) | **$0.10 (100% 마진)** |
| **👤 리테일 (Stripe)** | $0.20 (10%) | ~$0.10 (Stripe + Gas) | **~$0.10 (50% 마진)** |
| **👤 리테일 (USDC)** | $0.20 (10%) | ~$0.02 (Paymaster) | **~$0.18 (90% 마진)** |

> 💡 **결론**: 봇의 5% 플랫폼 수수료는 리테일 Stripe 결제의 10%와 동일한 순이익을 창출합니다.

---

## 3. 봇 티어 제한사항

### 3.1 USDC 전용

- ❌ Stripe (신용카드) 결제 불가
- ✅ 온체인 USDC 직접 결제만 허용
- 봇은 컨트랙트와 직접 상호작용

### 3.2 1회 1개 구매 제한

본딩 커브의 정확한 가격 발견을 위해 봇은 **트랜잭션당 1개**만 구매 가능합니다.

```solidity
// V6 봇 구매 제한
if (authorizedBots[msg.sender]) {
    require(amount == 1, "Bots can only buy 1 token per tx");
}
```

**이유:**
- 대량 구매 시 가격 조작 방지
- 각 구매가 본딩 커브에 정확히 반영
- 공정한 가격 발견 메커니즘 유지

### 3.3 자체 가스비 부담

- 봇은 Paymaster 스폰서십 없음
- 자체 ETH로 가스비 지불
- 플랫폼 운영 비용 0

---

## 4. 기술 구현

### 4.1 상태 변수 추가

```solidity
// ============ V6 추가 상태 변수 ============

// 봇 화이트리스트
mapping(address => bool) public authorizedBots;

// 티어별 수수료 상수
uint256 public constant RETAIL_FEE_RESERVE = 7000;      // 70%
uint256 public constant RETAIL_FEE_ARTIST = 2000;       // 20%
uint256 public constant RETAIL_FEE_PLATFORM = 1000;     // 10%

uint256 public constant BOT_FEE_RESERVE = 9000;         // 90%
uint256 public constant BOT_FEE_ARTIST = 500;           // 5%
uint256 public constant BOT_FEE_PLATFORM = 500;         // 5%
```

### 4.2 봇 관리 함수

```solidity
/// @notice 봇 화이트리스트 관리 (Owner만 가능)
function setAuthorizedBot(address bot, bool status) external onlyOwner {
    require(bot != address(0), "Invalid bot address");
    authorizedBots[bot] = status;
    emit BotStatusUpdated(bot, status);
}

/// @notice 여러 봇 일괄 등록
function setAuthorizedBots(address[] calldata bots, bool status) external onlyOwner {
    for (uint256 i = 0; i < bots.length; i++) {
        require(bots[i] != address(0), "Invalid bot address");
        authorizedBots[bots[i]] = status;
        emit BotStatusUpdated(bots[i], status);
    }
}
```

### 4.3 티어 감지 및 수수료 계산

```solidity
/// @notice 호출자 티어 확인
function _isBot(address account) internal view returns (bool) {
    return authorizedBots[account];
}

/// @notice 티어별 구매 비용 계산
function calculateBuyCost(uint256 tokenId, uint256 amount, address buyer) public view returns (
    uint256 reserveCost,
    uint256 artistFundFee,
    uint256 platformFee,
    uint256 totalCost
) {
    TokenInfo memory token = tokens[tokenId];
    require(token.exists, "Token does not exist");
    
    // 본딩 커브 적분으로 기본 비용 계산
    uint256 baseCost = buyCostIntegral(token.basePrice, token.kValue, token.totalSupply, amount);
    
    if (_isBot(buyer)) {
        // 봇 티어: 10% 수수료
        reserveCost = baseCost;
        totalCost = (reserveCost * BASIS_POINTS) / BOT_FEE_RESERVE;  // 90%
        artistFundFee = (totalCost * BOT_FEE_ARTIST) / BASIS_POINTS; // 5%
        platformFee = (totalCost * BOT_FEE_PLATFORM) / BASIS_POINTS; // 5%
    } else {
        // 리테일 티어: 30% 수수료
        reserveCost = baseCost;
        totalCost = (reserveCost * BASIS_POINTS) / RETAIL_FEE_RESERVE;  // 70%
        artistFundFee = (totalCost * RETAIL_FEE_ARTIST) / BASIS_POINTS; // 20%
        platformFee = (totalCost * RETAIL_FEE_PLATFORM) / BASIS_POINTS; // 10%
    }
}
```

### 4.4 구매 함수 수정

```solidity
/// @notice 직접 구매 (봇 또는 리테일)
function buy(uint256 tokenId, uint256 amount, uint256 maxCost) external nonReentrant whenNotPaused {
    // 봇 티어 제한: 1회 1개
    if (authorizedBots[msg.sender]) {
        require(amount == 1, "Bots: max 1 per tx");
    }
    
    _executeBuy(tokenId, msg.sender, msg.sender, amount, maxCost);
}
```

### 4.5 이벤트 추가

```solidity
/// @notice 봇 상태 변경 이벤트
event BotStatusUpdated(address indexed bot, bool status);

/// @notice 구매 이벤트 (티어 정보 포함)
event TokenBought(
    address indexed operator,
    address indexed actualBuyer,
    uint256 indexed tokenId,
    uint256 amount,
    uint256 totalCost,
    uint256 newSupply,
    bool isBot,           // V6 추가
    uint256 timestamp
);
```

---

## 5. 판매 수수료

판매 수수료는 티어 구분 없이 **동일하게 4%** 적용됩니다.

| 항목 | 비율 | 수령처 |
|------|------|--------|
| User Refund | 96% | 판매자 지갑 |
| Platform Fee | 4% | platformWallet |

> 💡 **이유**: 판매는 유동성 제거 행위이므로 봇에게 추가 혜택을 제공하지 않습니다.

---

## 6. 보안 고려사항

### 6.1 온체인 보안 메커니즘

#### 6.1.1 Same-Block Trade Prevention

동일 블록 내 구매+판매를 통한 MEV 공격 및 가격 조작 방지:

```solidity
mapping(address => uint256) public lastTradeBlock;

modifier preventSameBlockTrade() {
    require(lastTradeBlock[msg.sender] != block.number, "No trade in same block");
    _;
    lastTradeBlock[msg.sender] = block.number;
}

function buy(...) external preventSameBlockTrade { ... }
function sell(...) external preventSameBlockTrade { ... }
```

#### 6.1.2 봇 일일 거래 한도

봇의 과도한 시장 점유 방지:

```solidity
mapping(address => uint256) public botDailyVolume;
mapping(address => uint256) public botLastTradeDay;
uint256 public constant BOT_DAILY_LIMIT = 100; // 일일 최대 100개

function _checkBotDailyLimit(address bot, uint256 amount) internal {
    uint256 today = block.timestamp / 1 days;
    if (botLastTradeDay[bot] != today) {
        botLastTradeDay[bot] = today;
        botDailyVolume[bot] = 0;
    }
    require(botDailyVolume[bot] + amount <= BOT_DAILY_LIMIT, "Bot daily limit exceeded");
    botDailyVolume[bot] += amount;
}
```

#### 6.1.3 Rate Limiting (출금 속도 제한)

급격한 유동성 이탈 방지:

```solidity
uint256 public constant WITHDRAWAL_PERIOD = 1 hours;
uint256 public constant WITHDRAWAL_LIMIT_PERCENT = 1000; // 10% per hour

mapping(uint256 => uint256) public periodWithdrawals; // tokenId => amount
mapping(uint256 => uint256) public periodStart; // tokenId => timestamp

function _checkWithdrawalLimit(uint256 tokenId, uint256 amount) internal {
    TokenInfo memory token = tokens[tokenId];
    uint256 currentPeriod = block.timestamp / WITHDRAWAL_PERIOD;
    
    if (periodStart[tokenId] != currentPeriod) {
        periodStart[tokenId] = currentPeriod;
        periodWithdrawals[tokenId] = 0;
    }
    
    uint256 maxWithdrawal = (token.reserve * WITHDRAWAL_LIMIT_PERCENT) / BASIS_POINTS;
    require(periodWithdrawals[tokenId] + amount <= maxWithdrawal, "Withdrawal limit exceeded");
    periodWithdrawals[tokenId] += amount;
}
```

### 6.2 오프체인 보안 메커니즘 (플랫폼 레벨)

| 메커니즘 | 설명 | 구현 위치 |
|---------|------|----------|
| **KYC/AML** | 봇 등록 시 운영자 신원 확인 | Admin Dashboard |
| **Spoofing Detection** | 허위 주문 패턴 모니터링 | Edge Function |
| **Wash Trading Detection** | 자전거래 탐지 (동일 IP/지갑 순환) | Bot Detector |
| **Circuit Breaker** | 급격한 가격 변동 시 자동 일시정지 | Edge Function |
| **Fingerprint Check** | 봇 운영자 디바이스 중복 확인 | check-fingerprint |

### 6.3 봇 화이트리스트 관리

- Owner만 봇 등록/해제 가능
- 봇 주소 검증 필수 (실제 활동 확인)
- 악용 시 즉시 해제 가능
- 봇 등록은 수동 승인 프로세스

### 6.4 Sybil Attack 방지

- 1회 1개 제한으로 대량 구매 차단
- 각 트랜잭션마다 본딩 커브 가격 반영
- 일일 거래 한도로 과점 방지

### 6.5 가격 조작 방지

```
봇이 100개 구매하려면:
- 100회 트랜잭션 필요
- 각 트랜잭션마다 가격 상승
- 리테일과 동일한 본딩 커브 경험
- 동일 블록 내 구매+판매 불가
```

### 6.6 Circuit Breaker (비상 정지)

급격한 가격 변동 또는 이상 거래 감지 시:

```solidity
uint256 public constant PRICE_CHANGE_THRESHOLD = 2000; // 20%
mapping(uint256 => uint256) public lastRecordedPrice;

function _checkCircuitBreaker(uint256 tokenId, uint256 newPrice) internal view {
    uint256 lastPrice = lastRecordedPrice[tokenId];
    if (lastPrice > 0) {
        uint256 priceChange = newPrice > lastPrice 
            ? ((newPrice - lastPrice) * BASIS_POINTS) / lastPrice
            : ((lastPrice - newPrice) * BASIS_POINTS) / lastPrice;
        require(priceChange <= PRICE_CHANGE_THRESHOLD, "Circuit breaker triggered");
    }
}
```

> ⚠️ **참고**: Circuit Breaker 트리거 시 Owner가 수동으로 상황 검토 후 재개

---

## 7. 비즈니스 전략

### 7.1 Liquidity Partners 명분

봇은 "팬"이 아닌 **"시장 조성자(Market Maker)"**로 정의됩니다:

- 5% 아티스트 펀드 기여 → 0%가 아닌 최소한의 기여
- 유동성 공급 → 리테일 거래 신뢰도 향상
- 가격 안정화 → 변동성 완화

### 7.2 선순환 구조

```
봇 유입 → 유동성 증가 → 리테일 신뢰도 상승 → 거래량 증가 → 아티스트 펀드 총액 증대
```

### 7.3 기대 효과

| 지표 | 예상 효과 |
|------|----------|
| 유동성 | 봇의 90% 리저브 기여로 풀 확대 |
| 거래량 | 봇 자동화로 24/7 거래 활성화 |
| 가격 안정성 | 봇의 지속적 거래로 변동성 완화 |
| 플랫폼 수익 | 거래량 증가로 총 수익 증대 |

---

## 8. 마이그레이션 계획

### 8.1 단계별 배포

1. **V6 컨트랙트 배포** (새 주소)
2. **기존 토큰 정보 마이그레이션** (createToken 호출)
3. **초기 봇 화이트리스트 등록**
4. **Edge Function 업데이트** (새 컨트랙트 주소)
5. **V5 컨트랙트 pause** (신규 거래 중단)
6. **사용자 안내** (기존 토큰은 V5에서 판매 가능)

### 8.2 호환성

- V5와 V6는 별개 컨트랙트
- 기존 V5 토큰 홀더는 V5에서 계속 판매 가능
- 신규 구매는 V6에서만 진행

---

## 9. 컨트랙트 정보

| 항목 | 값 |
|------|-----|
| Contract Name | FanzTokenUSDC_v6 |
| Solidity Version | ^0.8.20 |
| Network | Base Mainnet |
| USDC | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 |
| Platform Wallet | 0x354f221cb4a528f2a2a8e4a126ea39dd120e40ab |
| Artist Fund Wallet | 0xd5C1296990b9072302a627752E46061a40112342 |

---

## 10. 체크리스트

### 배포 전

- [ ] V6 컨트랙트 코드 작성
- [ ] 로컬 테스트 (Hardhat/Foundry)
- [ ] Testnet 배포 및 검증
- [ ] 보안 감사 (선택)

### 배포

- [ ] Mainnet 배포
- [ ] Basescan 검증
- [ ] Operator 설정 (Backend Smart Account)
- [ ] 초기 봇 화이트리스트 등록

### Edge Function 업데이트

- [ ] `buy-fanz-token` - V6 컨트랙트 주소
- [ ] `sell-fanz-token` - V6 컨트랙트 주소
- [ ] `get-fanztoken-price` - 티어별 가격 계산
- [ ] `issue-fanz-token` - V6 createToken 호출

---

## 부록: 상수 정리

```solidity
// V6 Fee Constants
uint256 public constant BASIS_POINTS = 10000;

// Retail Tier (30% total fee)
uint256 public constant RETAIL_FEE_RESERVE = 7000;   // 70%
uint256 public constant RETAIL_FEE_ARTIST = 2000;    // 20%
uint256 public constant RETAIL_FEE_PLATFORM = 1000;  // 10%

// Bot Tier (10% total fee)
uint256 public constant BOT_FEE_RESERVE = 9000;      // 90%
uint256 public constant BOT_FEE_ARTIST = 500;        // 5%
uint256 public constant BOT_FEE_PLATFORM = 500;      // 5%

// Sell Fee (same for all)
uint256 public constant SELL_FEE_PLATFORM = 400;     // 4%
```

---

*Last Updated: 2026-02-03*
*Author: KTRENDZ Team*
