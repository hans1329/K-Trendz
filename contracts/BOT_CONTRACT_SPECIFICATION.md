# FanzToken Bot Contract Specification
## V5 병렬 운영 - Liquidity Partners 전용

---

## 1. 개요

Bot Contract는 기존 **V5 컨트랙트를 유지**하면서 화이트리스트된 Liquidity Partners(봇)에게 저수수료 거래 환경을 제공하는 **별도의 병렬 컨트랙트**입니다.

### 핵심 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                      동일 아티스트 토큰 (예: BTS)                    │
├────────────────────────────┬────────────────────────────────────────┤
│      V5 Contract (기존)     │       Bot Contract (신규)              │
│ ──────────────────────────  │  ────────────────────────────────────  │
│ • 30% Buy / 4% Sell        │  • 3% Buy / 2% Sell                    │
│ • 기존 리저브 유지          │  • 독립 리저브 (별도 풀)               │
│ • 리테일 + 봇 모두 가능     │  • 화이트리스트 봇만 가능              │
│ • Immutable (수정 불가)    │  • 신규 배포                           │
└────────────────────────────┴────────────────────────────────────────┘
                    ↑              Arbitrage              ↑
                    └─────────────────────────────────────┘
```

### V5와의 차이점

| 항목 | V5 (리테일) | Bot Contract |
|------|------------|--------------|
| Buy 수수료 | 30% | **3%** |
| Sell 수수료 | 4% | **2%** |
| 왕복 수수료 | 34% | **5%** |
| 리저브 기여 | 70% | **97%** |
| 접근 권한 | 누구나 | **화이트리스트 봇만** |
| 리저브 풀 | 기존 풀 | **독립 풀** |

---

## 2. 수수료 구조

### 2.1 Buy 수수료 (3%)

| 항목 | 비율 | 수령처 |
|------|------|--------|
| **Reserve (유동성)** | 97% | 컨트랙트 내 보유 |
| **Artist Fund** | 2% | artistFundWallet |
| **Platform** | 1% | platformWallet |

**예시) $2.00 토큰 구매 시:**
```
Total Cost:     $2.06
├─ Reserve:     $1.94 (97%)
├─ Artist Fund: $0.04 (2%)
└─ Platform:    $0.02 (1%)
```

### 2.2 Sell 수수료 (2%)

| 항목 | 비율 | 수령처 |
|------|------|--------|
| **User Refund** | 98% | 판매자 지갑 |
| **Platform Fee** | 2% | platformWallet |

**예시) $2.00 토큰 판매 시:**
```
Sell Value:     $2.00
├─ User Refund: $1.96 (98%)
└─ Platform:    $0.04 (2%)
```

### 2.3 수수료 설계 근거

| 요소 | 설명 |
|------|------|
| **97% 리저브** | 유동성 풀 극대화 → 가격 안정성 향상 |
| **2% 아티스트** | 봇도 최소한의 아티스트 지원 기여 |
| **1% 플랫폼 (Buy)** | 봇 가스비 자체 부담으로 마진 확보 |
| **2% 플랫폼 (Sell)** | 유동성 제거에 대한 페널티 |

---

## 3. 접근 제어

### 3.1 화이트리스트 전용

```solidity
mapping(address => bool) public authorizedBots;

modifier onlyAuthorizedBot() {
    require(authorizedBots[msg.sender], "Not authorized bot");
    _;
}

function buy(uint256 tokenId, uint256 amount, uint256 maxCost) 
    external 
    onlyAuthorizedBot 
    nonReentrant 
    whenNotPaused 
{
    // 봇만 구매 가능
}
```

### 3.2 봇 등록/해제

```solidity
function setAuthorizedBot(address bot, bool status) external onlyOwner {
    require(bot != address(0), "Invalid bot address");
    authorizedBots[bot] = status;
    emit BotStatusUpdated(bot, status);
}
```

### 3.3 USDC 직접 결제만

- ❌ Stripe (신용카드) 결제 불가
- ✅ 온체인 USDC 직접 결제만 허용
- 봇은 컨트랙트와 직접 상호작용

---

## 4. 거래 제한

### 4.1 1회 1개 구매 제한

본딩 커브의 정확한 가격 발견을 위해 **트랜잭션당 1개**만 구매 가능:

```solidity
function buy(uint256 tokenId, uint256 amount, uint256 maxCost) external onlyAuthorizedBot {
    require(amount == 1, "Bots can only buy 1 token per tx");
    _executeBuy(tokenId, msg.sender, amount, maxCost);
}
```

**이유:**
- 대량 구매 시 가격 조작 방지
- 각 구매가 본딩 커브에 정확히 반영
- 공정한 가격 발견 메커니즘 유지

### 4.2 자체 가스비 부담

- Paymaster 스폰서십 없음
- 봇이 자체 ETH로 가스비 지불
- 플랫폼 운영 비용 0

---

## 5. 독립 리저브 풀

### 5.1 구조

```
V5 BTS Token                    Bot Contract BTS Token
┌─────────────────┐             ┌─────────────────┐
│ Reserve: $1,000 │             │ Reserve: $0     │ ← 시작 시점
│ Supply: 50      │             │ Supply: 0       │
│ Price: $X       │             │ Price: $0.50    │ ← Base Price
└─────────────────┘             └─────────────────┘
        │                               │
        └───────── Arbitrage ───────────┘
```

### 5.2 가격 수렴 메커니즘

두 풀의 가격 차이 발생 시 차익거래자가 개입:

```
1. V5 가격 < Bot 가격
   → V5에서 구매, Bot에서 판매
   → V5 가격 상승, Bot 가격 하락
   
2. Bot 가격 < V5 가격
   → Bot에서 구매, V5에서 판매
   → Bot 가격 상승, V5 가격 하락
```

### 5.3 유동성 분산 트레이드오프

| 장점 | 단점 |
|------|------|
| V5 기존 홀더 영향 없음 | 유동성 분산 |
| 봇 저수수료 거래 가능 | 두 시장 관리 필요 |
| 차익거래로 가격 수렴 | 초기 Bot 유동성 부족 |

---

## 6. 보안 메커니즘

### 6.1 Same-Block Trade Prevention

동일 블록 내 구매+판매 방지:

```solidity
mapping(address => uint256) public lastTradeBlock;

modifier preventSameBlockTrade() {
    require(lastTradeBlock[msg.sender] != block.number, "No trade in same block");
    _;
    lastTradeBlock[msg.sender] = block.number;
}
```

### 6.2 봇 일일 거래 한도

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

### 6.3 Rate Limiting (출금 속도 제한)

```solidity
uint256 public constant WITHDRAWAL_PERIOD = 1 hours;
uint256 public constant WITHDRAWAL_LIMIT_PERCENT = 1000; // 10% per hour
```

### 6.4 Circuit Breaker

급격한 가격 변동 시 자동 일시정지:

```solidity
uint256 public constant PRICE_CHANGE_THRESHOLD = 2000; // 20%
```

---

## 7. 기술 구현

### 7.1 상태 변수

```solidity
// ============ Bot Contract 상태 변수 ============

// 화이트리스트
mapping(address => bool) public authorizedBots;

// 수수료 상수
uint256 public constant BASIS_POINTS = 10000;

// Buy Fee (3% total)
uint256 public constant BUY_FEE_RESERVE = 9700;      // 97%
uint256 public constant BUY_FEE_ARTIST = 200;        // 2%
uint256 public constant BUY_FEE_PLATFORM = 100;      // 1%

// Sell Fee (2% total)
uint256 public constant SELL_FEE_USER = 9800;        // 98%
uint256 public constant SELL_FEE_PLATFORM = 200;     // 2%
```

### 7.2 구매 비용 계산

```solidity
function calculateBuyCost(uint256 tokenId, uint256 amount) public view returns (
    uint256 reserveCost,
    uint256 artistFundFee,
    uint256 platformFee,
    uint256 totalCost
) {
    TokenInfo memory token = tokens[tokenId];
    require(token.exists, "Token does not exist");
    
    // 본딩 커브 적분으로 기본 비용 계산
    uint256 baseCost = buyCostIntegral(token.basePrice, token.kValue, token.totalSupply, amount);
    
    // 3% 수수료 적용 (97%가 리저브)
    reserveCost = baseCost;
    totalCost = (reserveCost * BASIS_POINTS) / BUY_FEE_RESERVE;
    artistFundFee = (totalCost * BUY_FEE_ARTIST) / BASIS_POINTS;
    platformFee = (totalCost * BUY_FEE_PLATFORM) / BASIS_POINTS;
}
```

### 7.3 판매 환불 계산

```solidity
function calculateSellRefund(uint256 tokenId, uint256 amount) public view returns (
    uint256 userRefund,
    uint256 platformFee,
    uint256 totalValue
) {
    TokenInfo memory token = tokens[tokenId];
    require(token.exists, "Token does not exist");
    
    // 본딩 커브 적분으로 기본 가치 계산
    totalValue = sellValueIntegral(token.basePrice, token.kValue, token.totalSupply, amount);
    
    // 2% 수수료 적용 (98%가 사용자)
    userRefund = (totalValue * SELL_FEE_USER) / BASIS_POINTS;
    platformFee = (totalValue * SELL_FEE_PLATFORM) / BASIS_POINTS;
}
```

### 7.4 이벤트

```solidity
event BotStatusUpdated(address indexed bot, bool status);

event TokenBought(
    address indexed buyer,
    uint256 indexed tokenId,
    uint256 amount,
    uint256 totalCost,
    uint256 newSupply,
    uint256 timestamp
);

event TokenSold(
    address indexed seller,
    uint256 indexed tokenId,
    uint256 amount,
    uint256 userRefund,
    uint256 newSupply,
    uint256 timestamp
);
```

---

## 8. 배포 및 운영

### 8.1 배포 순서

1. **Bot Contract 배포** (새 주소)
2. **토큰 정보 등록** (V5와 동일한 tokenId 사용)
   ```solidity
   // BTS 토큰 등록 예시
   createToken(12666454296509763493, artistFundWallet, 1650000, 300000)
   ```
3. **초기 봇 화이트리스트 등록**
4. **Edge Function 추가** (bot-buy-fanz-token, bot-sell-fanz-token)

### 8.2 V5와의 공존

- V5 컨트랙트: 기존대로 유지 (수정 없음)
- Bot Contract: 새로 배포
- 프론트엔드: 리테일은 V5, 봇은 Bot Contract 호출

### 8.3 봇 등록 프로세스

1. 봇 운영자 KYC/AML 확인
2. 봇 지갑 주소 제출
3. Owner가 `setAuthorizedBot()` 호출
4. 봇 운영 시작

---

## 9. 컨트랙트 정보

| 항목 | 값 |
|------|-----|
| Contract Name | FanzTokenBot |
| Solidity Version | ^0.8.20 |
| Network | Base Mainnet |
| USDC | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 |
| Platform Wallet | 0x354f221cb4a528f2a2a8e4a126ea39dd120e40ab |
| Artist Fund Wallet | 0xd5C1296990b9072302a627752E46061a40112342 |

---

## 10. 체크리스트

### 배포 전

- [ ] Bot Contract 코드 작성
- [ ] 로컬 테스트 (Hardhat/Foundry)
- [ ] Testnet 배포 및 검증
- [ ] 보안 감사 (선택)

### 배포

- [ ] Mainnet 배포
- [ ] Basescan 검증
- [ ] 토큰 등록 (V5와 동일 tokenId)
- [ ] 초기 봇 화이트리스트 등록

### Edge Function

- [ ] `bot-buy-fanz-token` 생성
- [ ] `bot-sell-fanz-token` 생성
- [ ] `get-bot-fanztoken-price` 생성 (봇 전용 가격 계산)

### 모니터링

- [ ] 봇 거래 대시보드 구축
- [ ] 일일 거래량 모니터링
- [ ] 이상 거래 탐지 알림

---

## 부록: 상수 정리

```solidity
// Bot Contract Fee Constants
uint256 public constant BASIS_POINTS = 10000;

// Buy Fee (3% total)
uint256 public constant BUY_FEE_RESERVE = 9700;      // 97%
uint256 public constant BUY_FEE_ARTIST = 200;        // 2%
uint256 public constant BUY_FEE_PLATFORM = 100;      // 1%

// Sell Fee (2% total)
uint256 public constant SELL_FEE_USER = 9800;        // 98%
uint256 public constant SELL_FEE_PLATFORM = 200;     // 2%

// Security Limits
uint256 public constant BOT_DAILY_LIMIT = 100;
uint256 public constant WITHDRAWAL_PERIOD = 1 hours;
uint256 public constant WITHDRAWAL_LIMIT_PERCENT = 1000;  // 10%
uint256 public constant PRICE_CHANGE_THRESHOLD = 2000;    // 20%
```

---

*Last Updated: 2026-02-04*
*Author: KTRENDZ Team*
