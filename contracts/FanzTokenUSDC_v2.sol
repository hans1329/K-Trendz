// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title FanzTokenUSDC_v2
 * @dev ERC-1155 기반 Fanz Token with USDC payments
 * 
 * 수수료 모델 (v2):
 * - 구매: 결제액 100% = 리저브 70% + 아티스트펀드 20% + 플랫폼 10%
 * - 판매: 리저브 100% 환불 (수수료 없음)
 * - 표시가격: 본딩커브 가격 / 0.7 로 정규화
 * 
 * 본딩 커브: P(s) = basePrice + k * (sqrt(s + 9) - 3)
 */
contract FanzTokenUSDC_v2 is ERC1155, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // USDC contract address (Base Mainnet)
    IERC20 public immutable usdc;
    
    // USDC has 6 decimals
    uint256 public constant USDC_DECIMALS = 6;
    
    struct TokenInfo {
        uint256 totalSupply;
        uint256 basePrice;    // in USDC (6 decimals), e.g., 1150000 = $1.15 (새 모델 기본값)
        uint256 kValue;       // in USDC (6 decimals), e.g., 2000000 = $2.00
        address creator;
    }
    
    mapping(uint256 => TokenInfo) public tokens;
    
    // 수수료 구조 (basis points, 100 = 1%)
    // 구매시: 표시가격 100% = 리저브 70% + 아티스트펀드 20% + 플랫폼 10%
    uint256 public constant BUY_FEE_ARTIST_FUND = 2000;   // 20% 아티스트 펀드
    uint256 public constant BUY_FEE_PLATFORM = 1000;      // 10% 플랫폼
    uint256 public constant RESERVE_PERCENT = 7000;       // 70% 리저브 (본딩커브)
    uint256 public constant BASIS_POINTS = 10000;
    // 판매시: 수수료 없음 (리저브 100% 환불)
    
    address public platformWallet;
    address public artistFundWallet;  // 아티스트 펀드 지갑 (커뮤니티 펀드)
    
    event TokenCreated(uint256 indexed tokenId, address indexed creator, uint256 basePrice, uint256 kValue);
    event Bought(uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 totalCost, uint256 artistFundFee, uint256 platformFee);
    event Sold(uint256 indexed tokenId, address indexed seller, uint256 amount, uint256 refund);
    
    constructor(
        address _platformWallet,
        address _artistFundWallet,
        address _usdcAddress
    ) ERC1155("https://k-trendz.com/api/token/{id}.json") Ownable(msg.sender) {
        require(_platformWallet != address(0), "Invalid platform wallet");
        require(_artistFundWallet != address(0), "Invalid artist fund wallet");
        require(_usdcAddress != address(0), "Invalid USDC address");
        platformWallet = _platformWallet;
        artistFundWallet = _artistFundWallet;
        usdc = IERC20(_usdcAddress);
    }
    
    /**
     * @dev 새 토큰 생성 (Owner only)
     * @param tokenId 토큰 ID (wiki entry UUID의 keccak256 해시)
     * @param creator 크리에이터 주소 (레거시 호환용, 현재 미사용)
     * @param basePrice 기본 가격 (USDC, 6 decimals)
     * @param kValue 본딩 커브 k 값 (USDC, 6 decimals)
     */
    function createToken(
        uint256 tokenId,
        address creator,
        uint256 basePrice,
        uint256 kValue
    ) external onlyOwner {
        require(tokens[tokenId].basePrice == 0, "Token already exists");
        require(creator != address(0), "Invalid creator address");
        require(basePrice > 0, "Base price must be > 0");
        
        tokens[tokenId] = TokenInfo({
            totalSupply: 0,
            basePrice: basePrice,
            kValue: kValue,
            creator: creator
        });
        
        emit TokenCreated(tokenId, creator, basePrice, kValue);
    }
    
    // 고정 소수점 정밀도 (1e12 = 소수점 12자리)
    uint256 public constant PRECISION = 1e12;
    
    /**
     * @dev 현재 토큰 가격 계산 (본딩 커브, 고정 소수점 사용)
     * P(s) = basePrice + k * (sqrt(s + 9) - 3)
     */
    function getCurrentPrice(uint256 tokenId) public view returns (uint256) {
        TokenInfo storage token = tokens[tokenId];
        require(token.basePrice > 0, "Token does not exist");
        
        uint256 supply = token.totalSupply;
        // 고정 소수점 sqrt 사용: sqrtScaled는 PRECISION 스케일
        uint256 sqrtScaled = sqrtPrecision(supply + 9);
        uint256 threeScaled = 3 * PRECISION;
        
        if (sqrtScaled <= threeScaled) {
            return token.basePrice;
        }
        
        // (sqrtScaled - 3*PRECISION) * kValue / PRECISION
        return token.basePrice + (token.kValue * (sqrtScaled - threeScaled)) / PRECISION;
    }
    
    /**
     * @dev 구매 비용 계산 (새 수수료 모델)
     * 표시가격 = 본딩커브 / 0.7
     * @return totalCost 총 비용 (표시가격, USDC)
     * @return artistFundFee 아티스트 펀드 (20%)
     * @return platformFee 플랫폼 수수료 (10%)
     */
    function calculateBuyCost(uint256 tokenId, uint256 amount) public view returns (
        uint256 totalCost,
        uint256 artistFundFee,
        uint256 platformFee
    ) {
        TokenInfo storage token = tokens[tokenId];
        require(token.basePrice > 0, "Token does not exist");
        require(amount > 0, "Amount must be > 0");
        
        uint256 supply = token.totalSupply;
        
        // 본딩 커브 적분으로 리저브 비용 계산
        uint256 reserveCost = buyCostIntegral(
            token.basePrice,
            token.kValue,
            supply,
            amount
        );
        
        // 표시가격 계산: 리저브 = 70% → 총액 = 리저브 / 0.7
        totalCost = (reserveCost * BASIS_POINTS) / RESERVE_PERCENT;
        
        // 수수료 계산
        artistFundFee = (totalCost * BUY_FEE_ARTIST_FUND) / BASIS_POINTS;  // 20%
        platformFee = (totalCost * BUY_FEE_PLATFORM) / BASIS_POINTS;       // 10%
        
        return (totalCost, artistFundFee, platformFee);
    }
    
    /**
     * @dev 판매 환불액 계산 (수수료 없음)
     * 리저브에 있는 금액 전액 환불
     * @return refund 환불액 (USDC, 리저브 100%)
     */
    function calculateSellRefund(uint256 tokenId, uint256 amount) public view returns (uint256 refund) {
        TokenInfo storage token = tokens[tokenId];
        require(token.basePrice > 0, "Token does not exist");
        require(amount > 0, "Amount must be > 0");
        require(token.totalSupply >= amount, "Insufficient supply");
        
        uint256 supply = token.totalSupply;
        
        // 본딩 커브 적분으로 리저브 금액 계산 = 환불액
        refund = buyCostIntegral(
            token.basePrice,
            token.kValue,
            supply - amount,
            amount
        );
        
        return refund;
    }
    
    /**
     * @dev 토큰 구매 (USDC 사용)
     * @param tokenId 토큰 ID
     * @param amount 구매 수량
     * @param maxCost 최대 허용 비용 (슬리피지 보호)
     */
    function buy(uint256 tokenId, uint256 amount, uint256 maxCost) external nonReentrant {
        TokenInfo storage token = tokens[tokenId];
        require(token.basePrice > 0, "Token does not exist");
        require(amount == 1, "Only 1 token per transaction");
        
        (uint256 totalCost, uint256 artistFundFee, uint256 platformFee) = calculateBuyCost(tokenId, amount);
        require(totalCost <= maxCost, "Slippage: cost > maxCost");
        
        // USDC 전송 받기
        usdc.safeTransferFrom(msg.sender, address(this), totalCost);
        
        // 수수료 분배 (아티스트펀드 20% + 플랫폼 10%)
        if (artistFundFee > 0) {
            usdc.safeTransfer(artistFundWallet, artistFundFee);
        }
        if (platformFee > 0) {
            usdc.safeTransfer(platformWallet, platformFee);
        }
        // 나머지 70%는 컨트랙트에 리저브로 보관
        
        // 토큰 발행
        token.totalSupply += amount;
        _mint(msg.sender, tokenId, amount, "");
        
        emit Bought(tokenId, msg.sender, amount, totalCost, artistFundFee, platformFee);
    }
    
    /**
     * @dev 토큰 판매 (수수료 없음, 리저브 전액 환불)
     * @param tokenId 토큰 ID
     * @param amount 판매 수량
     * @param minRefund 최소 환불액 (슬리피지 보호)
     */
    function sell(uint256 tokenId, uint256 amount, uint256 minRefund) external nonReentrant {
        TokenInfo storage token = tokens[tokenId];
        require(token.basePrice > 0, "Token does not exist");
        require(amount == 1, "Only 1 token per transaction");
        require(balanceOf(msg.sender, tokenId) >= amount, "Insufficient balance");
        
        uint256 refund = calculateSellRefund(tokenId, amount);
        require(refund >= minRefund, "Slippage: refund < minRefund");
        require(usdc.balanceOf(address(this)) >= refund, "Insufficient USDC in contract");
        
        // 토큰 소각
        _burn(msg.sender, tokenId, amount);
        token.totalSupply -= amount;
        
        // USDC 환불 (수수료 없음, 리저브 전액)
        usdc.safeTransfer(msg.sender, refund);
        
        emit Sold(tokenId, msg.sender, amount, refund);
    }
    
    /**
     * @dev 플랫폼 지갑 주소 변경
     */
    function setPlatformWallet(address _platformWallet) external onlyOwner {
        require(_platformWallet != address(0), "Invalid address");
        platformWallet = _platformWallet;
    }
    
    /**
     * @dev 아티스트 펀드 지갑 주소 변경
     */
    function setArtistFundWallet(address _artistFundWallet) external onlyOwner {
        require(_artistFundWallet != address(0), "Invalid address");
        artistFundWallet = _artistFundWallet;
    }
    
    /**
     * @dev 크리에이터 주소 변경 (레거시 호환)
     */
    function setTokenCreator(uint256 tokenId, address newCreator) external onlyOwner {
        require(tokens[tokenId].basePrice > 0, "Token does not exist");
        require(newCreator != address(0), "Invalid address");
        tokens[tokenId].creator = newCreator;
    }
    
    /**
     * @dev 본딩 커브 적분 계산
     * ∫[s, s+n] (basePrice + k*(sqrt(x+9) - 3)) dx
     */
    function buyCostIntegral(
        uint256 basePrice,
        uint256 kValue,
        uint256 supply,
        uint256 amount
    ) internal pure returns (uint256) {
        // 기본 가격 부분: basePrice * amount
        uint256 baseCost = basePrice * amount;
        
        // sqrt 부분 적분 (고정 소수점 사용): k * (2/3 * (x+9)^(3/2) - 3x) 
        uint256 s0 = supply + 9;
        uint256 s1 = supply + amount + 9;
        
        // x^(3/2) = x * sqrt(x) 계산 (고정 소수점)
        uint256 s0_sqrt = sqrtPrecision(s0);  // PRECISION 스케일
        uint256 s1_sqrt = sqrtPrecision(s1);  // PRECISION 스케일
        
        // integral = 2/3 * x * sqrt(x) = 2/3 * x * (sqrtScaled / PRECISION)
        // = (2 * x * sqrtScaled) / (3 * PRECISION)
        uint256 integral0 = (2 * s0 * s0_sqrt) / (3 * PRECISION);
        uint256 integral1 = (2 * s1 * s1_sqrt) / (3 * PRECISION);
        
        // -3x 부분
        uint256 linear0 = 3 * supply;
        uint256 linear1 = 3 * (supply + amount);
        
        uint256 sqrtCost = 0;
        if (integral1 + linear0 > integral0 + linear1) {
            sqrtCost = kValue * ((integral1 + linear0) - (integral0 + linear1));
        }
        
        return baseCost + sqrtCost;
    }
    
    /**
     * @dev 고정 소수점 제곱근 계산 (Babylonian method)
     * @param x 입력값
     * @return PRECISION 스케일의 제곱근 (예: sqrt(2) ≈ 1.414... * PRECISION)
     */
    function sqrtPrecision(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        
        // x * PRECISION^2 의 정수 제곱근을 계산하면 결과는 PRECISION 스케일
        uint256 scaled = x * PRECISION * PRECISION;
        
        uint256 z = (scaled + 1) / 2;
        uint256 y = scaled;
        
        while (z < y) {
            y = z;
            z = (scaled / z + z) / 2;
        }
        
        return y;
    }
    
    /**
     * @dev 정수 제곱근 (레거시 호환용)
     */
    function sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        
        return y;
    }
    
    /**
     * @dev 컨트랙트 USDC 잔액 조회
     */
    function getContractUSDCBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
