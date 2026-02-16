// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FanzToken
 * @dev ERC-1155 based Fungible-like Fan Token with bonding curve pricing
 * Similar to friend.tech but for wiki entries and posts
 */
contract FanzToken is ERC1155, Ownable, ReentrancyGuard {
    // Token info for each page (wiki entry or post)
    struct TokenInfo {
        uint256 totalSupply;
        uint256 basePrice;      // in wei
        uint256 kValue;         // bonding curve coefficient
        address creator;
        bool isActive;
    }
    
    // Mapping from tokenId (pageId) to token info
    mapping(uint256 => TokenInfo) public tokens;
    
    // Fee percentages (in basis points: 100 = 1%)
    uint256 public constant BUY_FEE_CREATOR = 600;     // 6%
    uint256 public constant BUY_FEE_PLATFORM = 400;    // 4%
    uint256 public constant SELL_FEE = 300;             // 3%
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // Platform wallet
    address public platformWallet;
    
    // Events
    event TokenCreated(uint256 indexed tokenId, address indexed creator, uint256 basePrice, uint256 kValue);
    event Bought(uint256 indexed pageId, address indexed buyer, uint256 amount, uint256 price, uint256 totalCost);
    event Sold(uint256 indexed pageId, address indexed seller, uint256 amount, uint256 price, uint256 totalRefund);
    
    constructor(address _platformWallet) ERC1155("https://k-trendz.com/api/token/{id}.json") Ownable(msg.sender) {
        require(_platformWallet != address(0), "Invalid platform wallet");
        platformWallet = _platformWallet;
    }
    
    /**
     * @dev Create a new token for a page (wiki entry or post)
     * Only owner can create tokens to ensure synchronization with backend database
     * @param tokenId Unique identifier for the page
     * @param creator Address of the content creator who will receive fees
     * @param basePrice Base price in wei (e.g., 0.001 ETH = 1000000000000000)
     * @param kValue Bonding curve coefficient
     */
    function createToken(
        uint256 tokenId,
        address creator,
        uint256 basePrice,
        uint256 kValue
    ) external onlyOwner {
        require(!tokens[tokenId].isActive, "Token already exists");
        require(creator != address(0), "Invalid creator address");
        require(basePrice > 0, "Base price must be > 0");
        require(kValue > 0, "K value must be > 0");
        
        tokens[tokenId] = TokenInfo({
            totalSupply: 0,
            basePrice: basePrice,
            kValue: kValue,
            creator: creator,
            isActive: true
        });
        
        emit TokenCreated(tokenId, creator, basePrice, kValue);
    }
    
    /**
     * @dev Calculate current price using bonding curve: P(s) = basePrice + k * (sqrt(s + 9) - 3)
     * @param tokenId Token ID to get price for
     * @return Current price in wei
     */
    function getCurrentPrice(uint256 tokenId) public view returns (uint256) {
        TokenInfo memory token = tokens[tokenId];
        require(token.isActive, "Token does not exist");
        
        // P(s) = basePrice + k * (sqrt(s + 9) - 3)
        uint256 sqrtSupplyPlusC = sqrt(token.totalSupply + 9);
        uint256 offset = 3; // sqrt(9)
        
        if (sqrtSupplyPlusC <= offset) {
            return token.basePrice;
        }
        
        return token.basePrice + (token.kValue * (sqrtSupplyPlusC - offset));
    }
    
    /**
     * @dev Calculate total cost for buying multiple tokens including fees using integral
     * C = ∫[S→S+N] (a + k*(sqrt(s+9) - 3)) ds
     * @param tokenId Token ID
     * @param amount Amount to buy
     * @return totalCost Total cost in wei
     * @return creatorFee Fee for creator
     * @return platformFee Fee for platform
     */
    function calculateBuyCost(uint256 tokenId, uint256 amount) public view returns (
        uint256 totalCost,
        uint256 creatorFee,
        uint256 platformFee
    ) {
        require(amount > 0, "Amount must be > 0");
        TokenInfo memory token = tokens[tokenId];
        require(token.isActive, "Token does not exist");
        
        // Use integral formula for bonding curve
        uint256 baseCost = buyCostIntegral(token.basePrice, token.kValue, token.totalSupply, amount);
        
        // Calculate fees
        creatorFee = (baseCost * BUY_FEE_CREATOR) / FEE_DENOMINATOR;
        platformFee = (baseCost * BUY_FEE_PLATFORM) / FEE_DENOMINATOR;
        
        totalCost = baseCost + creatorFee + platformFee;
    }
    
    /**
     * @dev Calculate refund for selling tokens (3% fee deducted) using integral
     * @param tokenId Token ID
     * @param amount Amount to sell
     * @return refundAmount Amount to refund after fee
     * @return fee Sell fee
     */
    function calculateSellRefund(uint256 tokenId, uint256 amount) public view returns (
        uint256 refundAmount,
        uint256 fee
    ) {
        require(amount > 0, "Amount must be > 0");
        TokenInfo memory token = tokens[tokenId];
        require(token.isActive, "Token does not exist");
        require(token.totalSupply >= amount, "Not enough supply");
        
        // Use integral formula: refund from S-N to S
        uint256 newSupply = token.totalSupply - amount;
        uint256 baseRefund = buyCostIntegral(token.basePrice, token.kValue, newSupply, amount);
        
        // Deduct 3% fee
        fee = (baseRefund * SELL_FEE) / FEE_DENOMINATOR;
        refundAmount = baseRefund - fee;
    }
    
    /**
     * @dev Buy tokens
     * @param tokenId Token ID to buy
     * @param amount Amount to buy
     * @param maxCost Maximum cost willing to pay (slippage protection)
     */
    function buy(uint256 tokenId, uint256 amount, uint256 maxCost) external payable nonReentrant {
        require(amount > 0, "Amount must be > 0");
        TokenInfo storage token = tokens[tokenId];
        require(token.isActive, "Token does not exist");
        
        (uint256 totalCost, uint256 creatorFee, uint256 platformFee) = calculateBuyCost(tokenId, amount);
        require(totalCost <= maxCost, "Slippage: cost exceeds maxCost");
        require(msg.value >= totalCost, "Insufficient payment");
        
        // Update supply
        token.totalSupply += amount;
        
        // Mint tokens to buyer
        _mint(msg.sender, tokenId, amount, "");
        
        // Distribute fees
        if (creatorFee > 0) {
            (bool creatorSuccess, ) = token.creator.call{value: creatorFee}("");
            require(creatorSuccess, "Creator fee transfer failed");
        }
        
        if (platformFee > 0) {
            (bool platformSuccess, ) = platformWallet.call{value: platformFee}("");
            require(platformSuccess, "Platform fee transfer failed");
        }
        
        // Refund excess payment
        if (msg.value > totalCost) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - totalCost}("");
            require(refundSuccess, "Refund failed");
        }
        
        uint256 price = getCurrentPrice(tokenId);
        emit Bought(tokenId, msg.sender, amount, price, totalCost);
    }
    
    /**
     * @dev Sell tokens back to the contract
     * @param tokenId Token ID to sell
     * @param amount Amount to sell
     * @param minRefund Minimum refund amount expected (slippage protection)
     */
    function sell(uint256 tokenId, uint256 amount, uint256 minRefund) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(balanceOf(msg.sender, tokenId) >= amount, "Insufficient balance");
        
        TokenInfo storage token = tokens[tokenId];
        require(token.isActive, "Token does not exist");
        
        (uint256 refundAmount, uint256 fee) = calculateSellRefund(tokenId, amount);
        require(refundAmount >= minRefund, "Slippage: refund below minRefund");
        require(address(this).balance >= refundAmount + fee, "Insufficient contract balance");
        
        // Burn tokens
        _burn(msg.sender, tokenId, amount);
        
        // Update supply
        token.totalSupply -= amount;
        
        // Send refund to seller
        (bool success, ) = msg.sender.call{value: refundAmount}("");
        require(success, "Refund transfer failed");
        
        // Platform keeps the fee (already in contract)
        if (fee > 0) {
            (bool feeSuccess, ) = platformWallet.call{value: fee}("");
            require(feeSuccess, "Fee transfer failed");
        }
        
        uint256 price = getCurrentPrice(tokenId);
        emit Sold(tokenId, msg.sender, amount, price, refundAmount);
    }
    
    /**
     * @dev Update platform wallet (only owner)
     */
    function setPlatformWallet(address _platformWallet) external onlyOwner {
        require(_platformWallet != address(0), "Invalid address");
        platformWallet = _platformWallet;
    }
    
    /**
     * @dev Calculate integral cost for bonding curve with offset
     * C = ∫[S→S+N] (a + k*(sqrt(s+9) - 3)) ds
     *   = a·N + (2k/3)·[(S+N+9)^(3/2) - (S+9)^(3/2)] - 3k·N
     * @param basePrice Base price (a)
     * @param k Bonding curve coefficient
     * @param supply Current supply (S)
     * @param amount Amount to buy (N)
     * @return Total cost using integral formula
     */
    function buyCostIntegral(
        uint256 basePrice,
        uint256 k,
        uint256 supply,
        uint256 amount
    ) internal pure returns (uint256) {
        uint256 s0 = supply + 9;
        uint256 s1 = supply + amount + 9;

        uint256 sqrtS0 = sqrt(s0);
        uint256 sqrtS1 = sqrt(s1);

        // basePrice * amount + (2k/3) * ((s1^(3/2) - s0^(3/2))) - 3k*amount
        return basePrice * amount + 
               (2 * k * (sqrtS1 * s1 - sqrtS0 * s0)) / 3 - 
               k * 3 * amount;
    }
    
    /**
     * @dev Square root function using Babylonian method
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
    
    // Receive ETH
    receive() external payable {}
}
