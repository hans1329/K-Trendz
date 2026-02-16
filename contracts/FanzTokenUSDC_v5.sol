// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title FanzTokenUSDC_v5
 * @notice K-Trendz Lightstick Token with bonding curve pricing
 * 
 * V5 주요 변경사항 (V4.1 → V5):
 * 1. sellFor() Approval 우회 - Operator가 undeployed Smart Wallet 대신 판매 가능
 *    - 기존: isApprovedForAll 필수 → undeployed wallet 판매 불가
 *    - V5: Operator가 실행하면 approval 체크 생략 (토큰 소각은 직접 수행)
 * 
 * 2. DAU 추적 유지 - 모든 이벤트에 actualUser 포함 (Dune/CDP Analytics용)
 * 
 * 설계 원칙:
 * 1. DAU 추적 - 모든 이벤트에 actualUser 포함
 * 2. Operator Pattern - Backend Smart Account가 사용자 대신 실행 (Paymaster 호환)
 * 3. 온체인 기준 - 가격/공급량 모두 컨트랙트에서 계산
 * 4. 본딩커브 파라미터 외부 입력 - createToken 시 basePrice, kValue 필수
 * 5. 관리 기능 - withdraw, setTokenParams, pause 지원
 * 
 * 수수료 구조:
 * - 구매: 70% Reserve, 20% Artist Fund, 10% Platform
 * - 판매: 96% 사용자 환불, 4% Platform Fee
 */
contract FanzTokenUSDC_v5 is ERC1155, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ 상수 ============
    uint256 public constant BUY_FEE_RESERVE = 7000;        // 70%
    uint256 public constant BUY_FEE_ARTIST_FUND = 2000;    // 20%
    uint256 public constant BUY_FEE_PLATFORM = 1000;       // 10%
    uint256 public constant SELL_FEE_PLATFORM = 400;       // 4%
    uint256 public constant BASIS_POINTS = 10000;

    // ============ 상태 변수 ============
    IERC20 public immutable usdc;
    address public platformWallet;
    address public artistFundWallet;
    
    bool public paused;
    
    // Operator 관리 (Backend Smart Account)
    mapping(address => bool) public operators;
    
    struct TokenInfo {
        uint256 totalSupply;
        uint256 basePrice;      // USDC 단위 (6 decimals)
        uint256 kValue;         // 본딩커브 기울기 (스케일링됨)
        address creator;
        bool exists;
    }
    
    mapping(uint256 => TokenInfo) public tokens;

    // ============ 이벤트 (모두 actualUser 포함 - Dune DAU 추적용) ============
    
    /// @notice 토큰 생성 이벤트
    event TokenCreated(
        uint256 indexed tokenId,
        address indexed creator,
        uint256 basePrice,
        uint256 kValue,
        uint256 timestamp
    );
    
    /// @notice 토큰 구매 이벤트 - actualBuyer로 DAU 추적
    event TokenBought(
        address indexed operator,
        address indexed actualBuyer,
        uint256 indexed tokenId,
        uint256 amount,
        uint256 totalCost,
        uint256 newSupply,
        uint256 timestamp
    );
    
    /// @notice 토큰 판매 이벤트 - actualSeller로 DAU 추적
    event TokenSold(
        address indexed operator,
        address indexed actualSeller,
        uint256 indexed tokenId,
        uint256 amount,
        uint256 netRefund,
        uint256 newSupply,
        uint256 timestamp
    );
    
    /// @notice 토큰 전송 이벤트 - from/to로 DAU 추적
    event TokenTransferred(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256 tokenId,
        uint256 amount,
        uint256 timestamp
    );
    
    /// @notice 관리 이벤트
    event OperatorUpdated(address indexed operator, bool status);
    event TokenParamsUpdated(uint256 indexed tokenId, uint256 newBasePrice, uint256 newKValue);
    event Paused(address account);
    event Unpaused(address account);
    event Withdrawn(address indexed to, uint256 amount);
    event EmergencyWithdraw(address indexed to, uint256 amount);
    event URIUpdated(string newUri);

    // ============ Modifier ============
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    modifier onlyOperatorOrOwner() {
        require(operators[msg.sender] || msg.sender == owner(), "Not operator or owner");
        _;
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
     * @notice 새 토큰 생성 (본딩커브 파라미터 외부 입력)
     * @param tokenId 토큰 ID
     * @param creator 크리에이터 주소 (Artist Fund 수신자)
     * @param basePrice 기본 가격 (USDC 6 decimals, 예: 1.65 USDC = 1650000)
     * @param kValue 본딩커브 기울기 (예: 2.0 scaled = 2000000000000000000)
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
        
        emit TokenCreated(tokenId, creator, basePrice, kValue, block.timestamp);
    }
    
    /**
     * @notice 토큰 파라미터 수정
     */
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
    
    /**
     * @notice 토큰 creator 변경
     */
    function setTokenCreator(uint256 tokenId, address newCreator) external onlyOwner {
        require(tokens[tokenId].exists, "Token does not exist");
        require(newCreator != address(0), "Invalid creator");
        tokens[tokenId].creator = newCreator;
    }

    // ============ 가격 계산 (온체인 기준) ============
    
    /**
     * @notice 현재 토큰 가격 조회
     * @return price USDC 단위 (6 decimals)
     */
    function getCurrentPrice(uint256 tokenId) public view returns (uint256 price) {
        TokenInfo memory token = tokens[tokenId];
        require(token.exists, "Token does not exist");
        
        // P(s) = basePrice + k * sqrt(s)
        uint256 sqrtSupply = sqrtPrecision(token.totalSupply);
        return token.basePrice + (token.kValue * sqrtSupply) / 1e12;
    }
    
    /**
     * @notice 구매 비용 계산
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
        
        // Total = Reserve / 0.7 (reserve는 70%)
        totalCost = (reserveCost * BASIS_POINTS) / BUY_FEE_RESERVE;
        artistFundFee = (totalCost * BUY_FEE_ARTIST_FUND) / BASIS_POINTS;
        platformFee = (totalCost * BUY_FEE_PLATFORM) / BASIS_POINTS;
    }
    
    /**
     * @notice 판매 환불액 계산
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

    // ============ 구매 (Operator Pattern - DAU 추적) ============
    
    /**
     * @notice 직접 구매 (사용자가 직접 가스비 지불)
     */
    function buy(uint256 tokenId, uint256 amount, uint256 maxCost) external nonReentrant whenNotPaused {
        _executeBuy(tokenId, msg.sender, msg.sender, amount, maxCost);
    }
    
    /**
     * @notice Operator를 통한 구매 (Paymaster 사용, actualBuyer로 DAU 추적)
     * @param tokenId 토큰 ID
     * @param actualBuyer 실제 구매자 (DAU로 기록됨)
     * @param amount 구매 수량
     * @param maxCost 최대 지불 금액
     */
    function buyFor(
        uint256 tokenId,
        address actualBuyer,
        uint256 amount,
        uint256 maxCost
    ) external nonReentrant whenNotPaused onlyOperatorOrOwner {
        require(actualBuyer != address(0), "Invalid buyer");
        _executeBuy(tokenId, actualBuyer, msg.sender, amount, maxCost);
    }
    
    function _executeBuy(
        uint256 tokenId,
        address actualBuyer,
        address payer,
        uint256 amount,
        uint256 maxCost
    ) internal {
        require(amount > 0, "Amount must be > 0");
        
        // Stack depth 최적화: 구조체 분해 대신 직접 계산 후 저장
        uint256 reserveCost;
        uint256 totalCost;
        {
            uint256 artistFundFee;
            uint256 platformFee;
            (reserveCost, artistFundFee, platformFee, totalCost) = calculateBuyCost(tokenId, amount);
            require(totalCost <= maxCost, "Cost exceeds max");
            
            // USDC 전송 (payer = operator 또는 actualBuyer)
            usdc.safeTransferFrom(payer, address(this), reserveCost);
            usdc.safeTransferFrom(payer, artistFundWallet, artistFundFee);
            usdc.safeTransferFrom(payer, platformWallet, platformFee);
        }
        
        // 토큰 발행 (actualBuyer에게)
        uint256 newSupply = tokens[tokenId].totalSupply + amount;
        tokens[tokenId].totalSupply = newSupply;
        _mint(actualBuyer, tokenId, amount, "");
        
        emit TokenBought(msg.sender, actualBuyer, tokenId, amount, totalCost, newSupply, block.timestamp);
    }

    // ============ 판매 (Operator Pattern - DAU 추적) ============
    
    /**
     * @notice 직접 판매 (사용자가 직접 가스비 지불)
     */
    function sell(uint256 tokenId, uint256 amount, uint256 minRefund) external nonReentrant whenNotPaused {
        _executeSell(tokenId, msg.sender, msg.sender, amount, minRefund);
    }
    
    /**
     * @notice Operator를 통한 판매 (Paymaster 사용, actualSeller로 DAU 추적)
     * @param tokenId 토큰 ID
     * @param actualSeller 실제 판매자 (토큰 보유자, DAU로 기록됨)
     * @param amount 판매 수량
     * @param minRefund 최소 환불액
     * 
     * V5 변경: Operator가 호출하면 approval 체크 없이 판매 가능
     * - Undeployed Smart Wallet 대신 Backend가 판매 가능
     * - 토큰은 actualSeller 주소에서 직접 소각됨
     * - USDC는 actualSeller 주소로 전송됨
     * 
     * 보안: Operator만 호출 가능 (onlyOperatorOrOwner)
     */
    function sellFor(
        uint256 tokenId,
        address actualSeller,
        uint256 amount,
        uint256 minRefund
    ) external nonReentrant whenNotPaused onlyOperatorOrOwner {
        require(actualSeller != address(0), "Invalid seller");
        // V5: Operator가 호출하면 approval 체크 생략 (undeployed wallet 판매 지원)
        _executeSell(tokenId, actualSeller, msg.sender, amount, minRefund);
    }
    
    function _executeSell(
        uint256 tokenId,
        address actualSeller,
        address operator,
        uint256 amount,
        uint256 minRefund
    ) internal {
        require(amount > 0, "Amount must be > 0");
        require(balanceOf(actualSeller, tokenId) >= amount, "Insufficient balance");
        
        // Stack depth 최적화: 블록 스코프로 변수 분리
        uint256 netRefund;
        {
            uint256 grossRefund;
            uint256 platformFee;
            (grossRefund, platformFee, netRefund) = calculateSellRefund(tokenId, amount);
            require(netRefund >= minRefund, "Refund below minimum");
            require(usdc.balanceOf(address(this)) >= grossRefund, "Insufficient contract balance");
            
            // USDC 전송 (actualSeller에게)
            usdc.safeTransfer(platformWallet, platformFee);
            usdc.safeTransfer(actualSeller, netRefund);
        }
        
        // 토큰 소각 (actualSeller 주소에서 직접)
        _burn(actualSeller, tokenId, amount);
        uint256 newSupply = tokens[tokenId].totalSupply - amount;
        tokens[tokenId].totalSupply = newSupply;
        
        emit TokenSold(operator, actualSeller, tokenId, amount, netRefund, newSupply, block.timestamp);
    }

    // ============ 전송 (DAU 추적) ============
    
    /**
     * @notice Operator를 통한 토큰 전송 (Paymaster 사용)
     * 
     * V5 변경: Operator가 호출하면 approval 체크 없이 전송 가능
     * - Undeployed Smart Wallet에서 토큰 복구 가능
     */
    function transferFor(
        uint256 tokenId,
        address from,
        address to,
        uint256 amount
    ) external nonReentrant whenNotPaused onlyOperatorOrOwner {
        require(from != address(0) && to != address(0), "Invalid address");
        // V5: Operator가 호출하면 approval 체크 생략
        require(balanceOf(from, tokenId) >= amount, "Insufficient balance");
        
        _safeTransferFrom(from, to, tokenId, amount, "");
        
        emit TokenTransferred(
            msg.sender,
            from,
            to,
            tokenId,
            amount,
            block.timestamp
        );
    }

    // ============ Operator 관리 ============
    
    function setOperator(address operator, bool status) external onlyOwner {
        require(operator != address(0), "Invalid operator");
        operators[operator] = status;
        emit OperatorUpdated(operator, status);
    }
    
    function isOperator(address account) external view returns (bool) {
        return operators[account];
    }

    // ============ 출금 기능 ============
    
    /**
     * @notice Reserve에서 USDC 출금
     * @dev 주의: 출금하면 토큰 홀더들이 sell할 때 환불받을 수 없음
     */
    function withdraw(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid address");
        require(amount > 0, "Amount must be > 0");
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient balance");
        
        usdc.safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }
    
    /**
     * @notice 긴급 상황시 전체 USDC 출금
     */
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
    
    /**
     * @notice 토큰 총 공급량 조회 (온체인 기준)
     */
    function getTotalSupply(uint256 tokenId) external view returns (uint256) {
        return tokens[tokenId].totalSupply;
    }

    // ============ URI 관리 ============
    
    /**
     * @notice URI 설정 (Owner만 가능)
     * @param newUri 새 URI (예: https://k-trendz.com/api/token/{id}.json)
     */
    function setURI(string memory newUri) external onlyOwner {
        _setURI(newUri);
        emit URIUpdated(newUri);
    }
    
    /**
     * @notice 토큰 메타데이터 URI 조회 (ERC1155 표준)
     * @dev {id}는 토큰 ID로 대체됨 (16진수 64자리, 패딩)
     */
    function uri(uint256 tokenId) public view virtual override returns (string memory) {
        string memory baseUri = super.uri(tokenId);
        
        // 빈 URI면 기본값 반환
        if (bytes(baseUri).length == 0) {
            return "";
        }
        
        return baseUri;
    }

    // ============ 내부 함수 ============
    
    /**
     * @notice 본딩커브 적분 (구매/판매 비용 계산)
     * @dev ∫(basePrice + k*sqrt(s))ds from start to start+amount
     */
    function buyCostIntegral(
        uint256 basePrice,
        uint256 kValue,
        uint256 startSupply,
        uint256 amount
    ) internal pure returns (uint256) {
        // 기본 가격 부분: basePrice * amount
        uint256 baseCost = basePrice * amount;
        
        // 본딩커브 부분: (2/3) * k * (s2^1.5 - s1^1.5)
        uint256 s1 = startSupply;
        uint256 s2 = startSupply + amount;
        
        uint256 s1_sqrt = sqrtPrecision(s1);
        uint256 s2_sqrt = sqrtPrecision(s2);
        
        // s^1.5 = s * sqrt(s)
        uint256 s1_pow15 = s1 * s1_sqrt;
        uint256 s2_pow15 = s2 * s2_sqrt;
        
        // (2/3) * k * (s2^1.5 - s1^1.5) / 1e12 (kValue 스케일링)
        uint256 curveCost = 0;
        if (s2_pow15 > s1_pow15) {
            curveCost = (2 * kValue * (s2_pow15 - s1_pow15)) / (3 * 1e12);
        }
        
        return baseCost + curveCost;
    }
    
    /**
     * @notice 정밀도를 유지하는 제곱근 계산
     * @dev Babylonian method, 1e6 스케일링
     */
    function sqrtPrecision(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        
        // 1e6 스케일링으로 정밀도 유지
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
