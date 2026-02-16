// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title FanzTokenBot
 * @notice K-Trendz Lightstick Token - Bot-Only Contract (Independent Reserve)
 * 
 * 설계 목적:
 * - V5(리테일)와 병렬 운영되는 봇 전용 시장
 * - 독립 리저브 풀로 두 시장 간 차익거래(Arbitrage) 유도
 * - 낮은 수수료로 유동성 공급 인센티브 제공
 * 
 * 수수료 구조 (5% 왕복):
 * - 구매: 97% Reserve, 2% Artist Fund, 1% Platform (총 3%)
 * - 판매: 98% 사용자 환불, 2% Platform Fee
 * 
 * 보안 기능:
 * - authorizedBots 화이트리스트 (승인된 봇만 거래 가능)
 * - 1회 1개 거래 제한 (본딩커브 보호)
 * - 동일 블록 거래 방지 (MEV 방지)
 * - 일일 거래량 제한 (시장 조작 방지)
 * - 서킷 브레이커 (급격한 가격 변동 시)
 * 
 * 가스비: 봇이 직접 지불 (Paymaster 미사용)
 */
contract FanzTokenBot is ERC1155, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ 수수료 상수 ============
    uint256 public constant BUY_FEE_RESERVE = 9700;        // 97%
    uint256 public constant BUY_FEE_ARTIST_FUND = 200;     // 2%
    uint256 public constant BUY_FEE_PLATFORM = 100;        // 1%
    uint256 public constant SELL_FEE_PLATFORM = 200;       // 2%
    uint256 public constant BASIS_POINTS = 10000;

    // ============ 보안 상수 ============
    uint256 public constant BOT_DAILY_LIMIT = 100;         // 봇당 일일 최대 거래량
    uint256 public constant CIRCUIT_BREAKER_THRESHOLD = 2000; // 20% 가격 변동 시 발동

    // ============ 상태 변수 ============
    IERC20 public immutable usdc;
    address public platformWallet;
    address public artistFundWallet;
    
    bool public paused;
    bool public circuitBreakerTripped;
    
    // 봇 화이트리스트
    mapping(address => bool) public authorizedBots;
    
    // MEV 방지: 동일 블록 거래 차단
    mapping(address => mapping(uint256 => uint256)) public lastTradeBlock; // bot => tokenId => blockNumber
    
    // 일일 거래량 제한
    mapping(address => mapping(uint256 => uint256)) public dailyVolume;    // bot => day => volume
    
    // 서킷 브레이커용 가격 추적
    mapping(uint256 => uint256) public lastPrice;          // tokenId => price
    mapping(uint256 => uint256) public priceCheckBlock;    // tokenId => blockNumber
    
    struct TokenInfo {
        uint256 totalSupply;
        uint256 basePrice;      // USDC 단위 (6 decimals)
        uint256 kValue;         // 본딩커브 기울기 (스케일링됨)
        address creator;
        bool exists;
    }
    
    mapping(uint256 => TokenInfo) public tokens;

    // ============ 이벤트 ============
    
    event TokenCreated(
        uint256 indexed tokenId,
        address indexed creator,
        uint256 basePrice,
        uint256 kValue,
        uint256 timestamp
    );
    
    event TokenBought(
        address indexed bot,
        uint256 indexed tokenId,
        uint256 amount,
        uint256 totalCost,
        uint256 newSupply,
        uint256 timestamp
    );
    
    event TokenSold(
        address indexed bot,
        uint256 indexed tokenId,
        uint256 amount,
        uint256 netRefund,
        uint256 newSupply,
        uint256 timestamp
    );
    
    event BotUpdated(address indexed bot, bool status);
    event TokenParamsUpdated(uint256 indexed tokenId, uint256 newBasePrice, uint256 newKValue);
    event Paused(address account);
    event Unpaused(address account);
    event CircuitBreakerTripped(uint256 indexed tokenId, uint256 oldPrice, uint256 newPrice);
    event CircuitBreakerReset(address account);
    event Withdrawn(address indexed to, uint256 amount);
    event EmergencyWithdraw(address indexed to, uint256 amount);
    event URIUpdated(string newUri);

    // ============ Modifier ============
    
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    modifier whenCircuitBreakerOff() {
        require(!circuitBreakerTripped, "Circuit breaker tripped");
        _;
    }
    
    modifier onlyAuthorizedBot() {
        require(authorizedBots[msg.sender], "Not authorized bot");
        _;
    }
    
    modifier preventSameBlockTrade(uint256 tokenId) {
        require(lastTradeBlock[msg.sender][tokenId] < block.number, "Same block trade not allowed");
        _;
        lastTradeBlock[msg.sender][tokenId] = block.number;
    }
    
    modifier withinDailyLimit() {
        uint256 today = block.timestamp / 1 days;
        require(dailyVolume[msg.sender][today] < BOT_DAILY_LIMIT, "Daily limit exceeded");
        _;
        dailyVolume[msg.sender][today]++;
    }

    // ============ 생성자 ============
    
    constructor(
        address _platformWallet,
        address _artistFundWallet
    ) ERC1155("") Ownable(msg.sender) {
        require(_platformWallet != address(0), "Invalid platform wallet");
        require(_artistFundWallet != address(0), "Invalid artist fund wallet");
        
        platformWallet = _platformWallet;
        artistFundWallet = _artistFundWallet;
        usdc = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913); // Base USDC
    }

    // ============ 토큰 관리 ============
    
    /**
     * @notice 새 토큰 생성 (V5와 동일한 파라미터 사용 권장)
     */
    function createToken(
        uint256 tokenId,
        address creator,
        uint256 basePrice,
        uint256 kValue
    ) external onlyOwner {
        require(!tokens[tokenId].exists, "Token already exists");
        require(creator != address(0), "Invalid creator");
        require(basePrice > 0, "Invalid base price");
        require(kValue > 0, "Invalid k value");
        
        tokens[tokenId] = TokenInfo({
            totalSupply: 0,
            basePrice: basePrice,
            kValue: kValue,
            creator: creator,
            exists: true
        });
        
        // 서킷 브레이커 초기화
        lastPrice[tokenId] = basePrice;
        priceCheckBlock[tokenId] = block.number;
        
        emit TokenCreated(tokenId, creator, basePrice, kValue, block.timestamp);
    }
    
    function setTokenParams(
        uint256 tokenId,
        uint256 newBasePrice,
        uint256 newKValue
    ) external onlyOwner {
        require(tokens[tokenId].exists, "Token does not exist");
        require(newBasePrice > 0, "Invalid base price");
        require(newKValue > 0, "Invalid k value");
        
        tokens[tokenId].basePrice = newBasePrice;
        tokens[tokenId].kValue = newKValue;
        
        emit TokenParamsUpdated(tokenId, newBasePrice, newKValue);
    }
    
    function setTokenCreator(uint256 tokenId, address newCreator) external onlyOwner {
        require(tokens[tokenId].exists, "Token does not exist");
        require(newCreator != address(0), "Invalid creator");
        tokens[tokenId].creator = newCreator;
    }

    // ============ 가격 계산 ============
    
    function getCurrentPrice(uint256 tokenId) public view returns (uint256 price) {
        TokenInfo memory token = tokens[tokenId];
        require(token.exists, "Token does not exist");
        
        uint256 sqrtSupply = sqrtPrecision(token.totalSupply);
        return token.basePrice + (token.kValue * sqrtSupply) / 1e12;
    }
    
    /**
     * @notice 구매 비용 계산 (3% 수수료)
     */
    function calculateBuyCost(uint256 tokenId, uint256 amount) public view returns (
        uint256 reserveCost,
        uint256 artistFundFee,
        uint256 platformFee,
        uint256 totalCost
    ) {
        TokenInfo memory token = tokens[tokenId];
        require(token.exists, "Token does not exist");
        
        reserveCost = buyCostIntegral(token.basePrice, token.kValue, token.totalSupply, amount);
        
        // Total = Reserve / 0.97 (reserve는 97%)
        totalCost = (reserveCost * BASIS_POINTS) / BUY_FEE_RESERVE;
        artistFundFee = (totalCost * BUY_FEE_ARTIST_FUND) / BASIS_POINTS;
        platformFee = (totalCost * BUY_FEE_PLATFORM) / BASIS_POINTS;
    }
    
    /**
     * @notice 판매 환불액 계산 (2% 수수료)
     */
    function calculateSellRefund(uint256 tokenId, uint256 amount) public view returns (
        uint256 grossRefund,
        uint256 platformFee,
        uint256 netRefund
    ) {
        TokenInfo memory token = tokens[tokenId];
        require(token.exists, "Token does not exist");
        require(token.totalSupply >= amount, "Insufficient supply");
        
        grossRefund = buyCostIntegral(token.basePrice, token.kValue, token.totalSupply - amount, amount);
        platformFee = (grossRefund * SELL_FEE_PLATFORM) / BASIS_POINTS;
        netRefund = grossRefund - platformFee;
    }

    // ============ 구매 (봇 전용, 1개 제한) ============
    
    /**
     * @notice 봇 구매 (1개만 가능)
     * @param tokenId 토큰 ID
     * @param maxCost 최대 지불 금액 (슬리피지 보호)
     */
    function buy(
        uint256 tokenId,
        uint256 maxCost
    ) external 
        nonReentrant 
        whenNotPaused 
        whenCircuitBreakerOff
        onlyAuthorizedBot 
        preventSameBlockTrade(tokenId)
        withinDailyLimit
    {
        uint256 amount = 1; // 강제 1개
        
        uint256 reserveCost;
        uint256 totalCost;
        {
            uint256 artistFundFee;
            uint256 platformFee;
            (reserveCost, artistFundFee, platformFee, totalCost) = calculateBuyCost(tokenId, amount);
            require(totalCost <= maxCost, "Cost exceeds max");
            
            // USDC 전송 (봇이 직접 지불)
            usdc.safeTransferFrom(msg.sender, address(this), reserveCost);
            usdc.safeTransferFrom(msg.sender, artistFundWallet, artistFundFee);
            usdc.safeTransferFrom(msg.sender, platformWallet, platformFee);
        }
        
        // 토큰 발행 (봇에게)
        uint256 newSupply = tokens[tokenId].totalSupply + amount;
        tokens[tokenId].totalSupply = newSupply;
        _mint(msg.sender, tokenId, amount, "");
        
        // 서킷 브레이커 체크
        _checkCircuitBreaker(tokenId);
        
        emit TokenBought(msg.sender, tokenId, amount, totalCost, newSupply, block.timestamp);
    }

    // ============ 판매 (봇 전용, 1개 제한) ============
    
    /**
     * @notice 봇 판매 (1개만 가능)
     * @param tokenId 토큰 ID
     * @param minRefund 최소 환불액 (슬리피지 보호)
     */
    function sell(
        uint256 tokenId,
        uint256 minRefund
    ) external 
        nonReentrant 
        whenNotPaused 
        whenCircuitBreakerOff
        onlyAuthorizedBot 
        preventSameBlockTrade(tokenId)
        withinDailyLimit
    {
        uint256 amount = 1; // 강제 1개
        require(balanceOf(msg.sender, tokenId) >= amount, "Insufficient balance");
        
        uint256 netRefund;
        {
            uint256 grossRefund;
            uint256 platformFee;
            (grossRefund, platformFee, netRefund) = calculateSellRefund(tokenId, amount);
            require(netRefund >= minRefund, "Refund below minimum");
            require(usdc.balanceOf(address(this)) >= grossRefund, "Insufficient contract balance");
            
            // USDC 전송 (봇에게)
            usdc.safeTransfer(platformWallet, platformFee);
            usdc.safeTransfer(msg.sender, netRefund);
        }
        
        // 토큰 소각
        _burn(msg.sender, tokenId, amount);
        uint256 newSupply = tokens[tokenId].totalSupply - amount;
        tokens[tokenId].totalSupply = newSupply;
        
        // 서킷 브레이커 체크
        _checkCircuitBreaker(tokenId);
        
        emit TokenSold(msg.sender, tokenId, amount, netRefund, newSupply, block.timestamp);
    }

    // ============ 서킷 브레이커 ============
    
    function _checkCircuitBreaker(uint256 tokenId) internal {
        uint256 currentPrice = getCurrentPrice(tokenId);
        uint256 previousPrice = lastPrice[tokenId];
        
        // 가격 변동률 계산
        uint256 priceDiff;
        if (currentPrice > previousPrice) {
            priceDiff = ((currentPrice - previousPrice) * BASIS_POINTS) / previousPrice;
        } else {
            priceDiff = ((previousPrice - currentPrice) * BASIS_POINTS) / previousPrice;
        }
        
        // 임계값 초과 시 서킷 브레이커 발동
        if (priceDiff >= CIRCUIT_BREAKER_THRESHOLD) {
            circuitBreakerTripped = true;
            emit CircuitBreakerTripped(tokenId, previousPrice, currentPrice);
        }
        
        // 가격 업데이트 (10블록마다)
        if (block.number >= priceCheckBlock[tokenId] + 10) {
            lastPrice[tokenId] = currentPrice;
            priceCheckBlock[tokenId] = block.number;
        }
    }
    
    function resetCircuitBreaker() external onlyOwner {
        circuitBreakerTripped = false;
        emit CircuitBreakerReset(msg.sender);
    }

    // ============ 봇 관리 ============
    
    function setAuthorizedBot(address bot, bool status) external onlyOwner {
        require(bot != address(0), "Invalid bot");
        authorizedBots[bot] = status;
        emit BotUpdated(bot, status);
    }
    
    function isAuthorizedBot(address account) external view returns (bool) {
        return authorizedBots[account];
    }
    
    function getBotDailyVolume(address bot) external view returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        return dailyVolume[bot][today];
    }

    // ============ 출금 기능 ============
    
    function withdraw(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid address");
        require(amount > 0, "Amount must be > 0");
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient balance");
        
        usdc.safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }
    
    function emergencyWithdraw(address to) external onlyOwner {
        require(to != address(0), "Invalid address");
        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "No balance");
        
        usdc.safeTransfer(to, balance);
        emit EmergencyWithdraw(to, balance);
    }

    // ============ 긴급 정지 ============
    
    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }
    
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    // ============ 지갑 주소 변경 ============
    
    function setPlatformWallet(address _platformWallet) external onlyOwner {
        require(_platformWallet != address(0), "Invalid address");
        platformWallet = _platformWallet;
    }
    
    function setArtistFundWallet(address _artistFundWallet) external onlyOwner {
        require(_artistFundWallet != address(0), "Invalid address");
        artistFundWallet = _artistFundWallet;
    }

    // ============ 조회 함수 ============
    
    function getContractUSDCBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
    
    function getTokenInfo(uint256 tokenId) external view returns (
        uint256 totalSupply,
        uint256 basePrice,
        uint256 kValue,
        address creator,
        bool exists
    ) {
        TokenInfo memory token = tokens[tokenId];
        return (token.totalSupply, token.basePrice, token.kValue, token.creator, token.exists);
    }
    
    function getTotalSupply(uint256 tokenId) external view returns (uint256) {
        return tokens[tokenId].totalSupply;
    }

    // ============ URI 관리 ============
    
    function setURI(string memory newUri) external onlyOwner {
        _setURI(newUri);
        emit URIUpdated(newUri);
    }
    
    function uri(uint256 tokenId) public view virtual override returns (string memory) {
        string memory baseUri = super.uri(tokenId);
        if (bytes(baseUri).length == 0) {
            return "";
        }
        return baseUri;
    }

    // ============ 내부 함수 ============
    
    function buyCostIntegral(
        uint256 basePrice,
        uint256 kValue,
        uint256 startSupply,
        uint256 amount
    ) internal pure returns (uint256) {
        uint256 baseCost = basePrice * amount;
        
        uint256 s1 = startSupply;
        uint256 s2 = startSupply + amount;
        
        uint256 s1_sqrt = sqrtPrecision(s1);
        uint256 s2_sqrt = sqrtPrecision(s2);
        
        uint256 s1_pow15 = s1 * s1_sqrt;
        uint256 s2_pow15 = s2 * s2_sqrt;
        
        uint256 curveCost = 0;
        if (s2_pow15 > s1_pow15) {
            curveCost = (2 * kValue * (s2_pow15 - s1_pow15)) / (3 * 1e12);
        }
        
        return baseCost + curveCost;
    }
    
    function sqrtPrecision(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        
        uint256 scaled = x * 1e12;
        uint256 z = (scaled + 1) / 2;
        uint256 y = scaled;
        
        while (z < y) {
            y = z;
            z = (scaled / z + z) / 2;
        }
        
        return y;
    }
}
