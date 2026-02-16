// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FanzTokenUSDC_v3
 * @dev Fan token contract with USDC payments and bonding curve pricing
 * 
 * V3 Changes: Added 4% sell fee (Platform)
 * 
 * Fee Model:
 * - Purchase: 70% Reserve, 20% Artist Fund, 10% Platform
 * - Sale: 96% Refund to User, 4% Platform Fee
 * 
 * Bonding Curve:
 * P(s) = basePrice + k * (sqrt(s + 9) - 3)
 * where s = current supply, basePrice = 1.15 USDC, k = 2.0
 */

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FanzTokenUSDC_v3 is ERC1155, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public usdc;

    struct TokenInfo {
        uint256 totalSupply;
        uint256 basePrice;    // in USDC (6 decimals)
        uint256 kValue;       // k * 1e12 for precision
        address creator;
    }

    mapping(uint256 => TokenInfo) public tokens;

    // Fee constants (basis points, 10000 = 100%)
    uint256 public constant BUY_FEE_ARTIST_FUND = 2000;  // 20%
    uint256 public constant BUY_FEE_PLATFORM = 1000;     // 10%
    uint256 public constant RESERVE_PERCENT = 7000;      // 70%
    uint256 public constant SELL_FEE_PLATFORM = 400;     // 4% NEW in V3
    uint256 public constant BASIS_POINTS = 10000;

    address public platformWallet;
    address public artistFundWallet;

    // Precision for sqrt calculations
    uint256 private constant PRECISION = 1e12;

    // Events
    event TokenCreated(uint256 indexed tokenId, address creator, uint256 basePrice, uint256 kValue);
    event TokenPurchased(uint256 indexed tokenId, address buyer, uint256 amount, uint256 totalCost, uint256 artistFee, uint256 platformFee);
    event TokenSold(uint256 indexed tokenId, address seller, uint256 amount, uint256 refundAmount, uint256 platformFee);

    constructor(
        address _platformWallet,
        address _artistFundWallet,
        address _usdcAddress
    ) ERC1155("") Ownable(msg.sender) {
        platformWallet = _platformWallet;
        artistFundWallet = _artistFundWallet;
        usdc = IERC20(_usdcAddress);
    }

    /**
     * @dev Create a new token with bonding curve parameters
     */
    function createToken(
        uint256 tokenId,
        address creator,
        uint256 basePrice,
        uint256 kValue
    ) external onlyOwner {
        require(tokens[tokenId].creator == address(0), "Token already exists");
        require(creator != address(0), "Invalid creator");
        
        tokens[tokenId] = TokenInfo({
            totalSupply: 0,
            basePrice: basePrice,
            kValue: kValue,
            creator: creator
        });

        emit TokenCreated(tokenId, creator, basePrice, kValue);
    }

    /**
     * @dev Get current price using bonding curve
     * P(s) = basePrice + k * (sqrt(s + 9) - 3)
     */
    function getCurrentPrice(uint256 tokenId) public view returns (uint256) {
        TokenInfo storage token = tokens[tokenId];
        require(token.creator != address(0), "Token does not exist");

        uint256 supply = token.totalSupply;
        
        // sqrt(supply + 9) with precision
        uint256 sqrtValue = sqrtPrecision((supply + 9) * PRECISION * PRECISION);
        
        // (sqrt(s + 9) - 3) * k
        // sqrtValue is in PRECISION scale, subtract 3 * PRECISION
        uint256 kComponent;
        if (sqrtValue > 3 * PRECISION) {
            kComponent = ((sqrtValue - 3 * PRECISION) * token.kValue) / PRECISION;
        }
        
        return token.basePrice + kComponent;
    }

    /**
     * @dev Calculate total cost to buy amount of tokens
     * Uses integral of bonding curve for continuous pricing
     */
    function calculateBuyCost(uint256 tokenId, uint256 amount) public view returns (
        uint256 totalCost,
        uint256 artistFundFee,
        uint256 platformFee
    ) {
        TokenInfo storage token = tokens[tokenId];
        require(token.creator != address(0), "Token does not exist");

        uint256 reserveCost = buyCostIntegral(
            token.basePrice,
            token.kValue,
            token.totalSupply,
            amount
        );

        // reserveCost is 70% of total, calculate full cost
        totalCost = (reserveCost * BASIS_POINTS) / RESERVE_PERCENT;
        artistFundFee = (totalCost * BUY_FEE_ARTIST_FUND) / BASIS_POINTS;
        platformFee = (totalCost * BUY_FEE_PLATFORM) / BASIS_POINTS;
    }

    /**
     * @dev Calculate refund for selling tokens (V3: includes 4% platform fee)
     */
    function calculateSellRefund(uint256 tokenId, uint256 amount) public view returns (
        uint256 refundAmount,
        uint256 fee
    ) {
        TokenInfo storage token = tokens[tokenId];
        require(token.creator != address(0), "Token does not exist");
        require(token.totalSupply >= amount, "Insufficient supply");

        uint256 grossRefund = buyCostIntegral(
            token.basePrice,
            token.kValue,
            token.totalSupply - amount,
            amount
        );

        // V3: Apply 4% platform fee on sell
        fee = (grossRefund * SELL_FEE_PLATFORM) / BASIS_POINTS;
        refundAmount = grossRefund - fee;
    }

    /**
     * @dev Buy tokens with USDC
     */
    function buy(uint256 tokenId, uint256 amount, uint256 maxCost) external nonReentrant {
        require(amount > 0, "Amount must be positive");

        (uint256 totalCost, uint256 artistFundFee, uint256 platformFee) = calculateBuyCost(tokenId, amount);
        require(totalCost <= maxCost, "Cost exceeds maximum");

        // Transfer USDC from buyer
        usdc.safeTransferFrom(msg.sender, address(this), totalCost);

        // Distribute fees
        usdc.safeTransfer(artistFundWallet, artistFundFee);
        usdc.safeTransfer(platformWallet, platformFee);
        // Remaining (70%) stays in contract as reserve

        // Update supply and mint tokens
        tokens[tokenId].totalSupply += amount;
        _mint(msg.sender, tokenId, amount, "");

        emit TokenPurchased(tokenId, msg.sender, amount, totalCost, artistFundFee, platformFee);
    }

    /**
     * @dev Sell tokens for USDC (V3: 4% fee applied)
     */
    function sell(uint256 tokenId, uint256 amount, uint256 minRefund) external nonReentrant {
        require(amount > 0, "Amount must be positive");
        require(balanceOf(msg.sender, tokenId) >= amount, "Insufficient balance");

        (uint256 refundAmount, uint256 fee) = calculateSellRefund(tokenId, amount);
        require(refundAmount >= minRefund, "Refund below minimum");

        // Burn tokens first
        _burn(msg.sender, tokenId, amount);
        tokens[tokenId].totalSupply -= amount;

        // Transfer USDC to seller
        usdc.safeTransfer(msg.sender, refundAmount);
        
        // V3: Transfer fee to platform
        if (fee > 0) {
            usdc.safeTransfer(platformWallet, fee);
        }

        emit TokenSold(tokenId, msg.sender, amount, refundAmount, fee);
    }

    // ============ Admin Functions ============

    function setPlatformWallet(address _platformWallet) external onlyOwner {
        require(_platformWallet != address(0), "Invalid address");
        platformWallet = _platformWallet;
    }

    function setArtistFundWallet(address _artistFundWallet) external onlyOwner {
        require(_artistFundWallet != address(0), "Invalid address");
        artistFundWallet = _artistFundWallet;
    }

    function setTokenCreator(uint256 tokenId, address newCreator) external onlyOwner {
        require(tokens[tokenId].creator != address(0), "Token does not exist");
        require(newCreator != address(0), "Invalid creator");
        tokens[tokenId].creator = newCreator;
    }

    /**
     * @dev Update token bonding curve parameters (owner only)
     */
    function setTokenParams(uint256 tokenId, uint256 newBasePrice, uint256 newKValue) external onlyOwner {
        require(tokens[tokenId].creator != address(0), "Token does not exist");
        tokens[tokenId].basePrice = newBasePrice;
        tokens[tokenId].kValue = newKValue;
    }

    // ============ Internal Functions ============

    /**
     * @dev Calculate integral of bonding curve for given range
     * Integral of P(s) = basePrice*s + k*(2/3)*(s+9)^1.5
     */
    function buyCostIntegral(
        uint256 basePrice,
        uint256 kValue,
        uint256 supply,
        uint256 amount
    ) internal pure returns (uint256) {
        uint256 endSupply = supply + amount;
        
        // Base price component: basePrice * amount
        uint256 baseCost = basePrice * amount;
        
        // k component: k * (2/3) * [(endSupply+9)^1.5 - (supply+9)^1.5]
        // We compute (x+9)^1.5 = (x+9) * sqrt(x+9)
        uint256 startTerm = (supply + 9) * sqrtPrecision((supply + 9) * PRECISION * PRECISION) / PRECISION;
        uint256 endTerm = (endSupply + 9) * sqrtPrecision((endSupply + 9) * PRECISION * PRECISION) / PRECISION;
        
        uint256 kCost = 0;
        if (endTerm > startTerm) {
            // (2/3) * k * (endTerm - startTerm)
            // kValue is already scaled by 1e12
            kCost = (2 * kValue * (endTerm - startTerm)) / (3 * PRECISION);
        }
        
        return baseCost + kCost;
    }

    /**
     * @dev Square root with precision
     */
    function sqrtPrecision(uint256 x) internal pure returns (uint256) {
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
     * @dev Get contract USDC balance (reserve)
     */
    function getContractUSDCBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
