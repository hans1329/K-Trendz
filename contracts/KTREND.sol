// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title KTNZ Token
 * @dev ERC20 token for K-Trendz platform with the following features:
 * - Total Supply Cap: 5 billion tokens
 * - Initial Supply: 1.5 billion (30% for team, liquidity, investors, treasury)
 * - Progressive Minting: 3.5 billion (70% for community mining rewards)
 * - Dynamic Points-to-Token Exchange Rate (adjustable by admin)
 * - Role-based minting (server-only)
 * - Time-locked mints for large amounts
 * - Daily mint limits for security
 * - Pausable for emergency situations
 * - Burnable for deflationary mechanics
 */
contract KTREND is ERC20, ERC20Burnable, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant RATE_MANAGER_ROLE = keccak256("RATE_MANAGER_ROLE");

    // Token Economics
    uint256 public constant MAX_SUPPLY = 5_000_000_000 * 10**18; // 5 billion tokens
    uint256 public constant INITIAL_SUPPLY = 1_500_000_000 * 10**18; // 1.5 billion (30%)
    
    // Minting Limits
    uint256 public constant INSTANT_MINT_LIMIT = 10_000 * 10**18; // 10,000 KTNZ
    uint256 public constant DAILY_MINT_LIMIT = 1_000_000 * 10**18; // 1M KTNZ per day
    uint256 public constant TIME_LOCK_DURATION = 24 hours;

    // Exchange Rate (adjustable by RATE_MANAGER_ROLE)
    // pointsToTokenRate: How many points equal 1 token
    // Initial: 10 points = 1 KTNZ (rate = 10)
    // Examples: rate=10 means 100 points = 10 KTNZ
    //           rate=1 means 10 points = 10 KTNZ
    uint256 public pointsToTokenRate = 10; // 10 points = 1 KTNZ ($0.10 per token)

    // Daily Minting Tracking
    uint256 public lastMintDay;
    uint256 public todayMintedAmount;

    // Time-locked Mint Requests
    struct MintRequest {
        address to;
        uint256 amount;
        uint256 unlockTime;
        bool executed;
    }
    
    uint256 public nextRequestId;
    mapping(uint256 => MintRequest) public mintRequests;

    // Events
    event MintRequested(uint256 indexed requestId, address indexed to, uint256 amount, uint256 unlockTime);
    event MintExecuted(uint256 indexed requestId, address indexed to, uint256 amount);
    event PointsToTokenRateUpdated(uint256 oldRate, uint256 newRate);
    event BatchMinted(address[] recipients, uint256[] amounts, uint256 totalAmount);

    constructor() ERC20("K-Trendz", "KTNZ") {
        // Grant roles to deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(RATE_MANAGER_ROLE, msg.sender);
        
        // Mint initial supply to deployer
        _mint(msg.sender, INITIAL_SUPPLY);
        
        // Initialize daily tracking
        lastMintDay = block.timestamp / 1 days;
    }

    /**
     * @dev Update the points-to-token exchange rate
     * @param newRate New exchange rate (e.g., 10 means 10 points = 1 KTNZ)
     */
    function setPointsToTokenRate(uint256 newRate) external onlyRole(RATE_MANAGER_ROLE) {
        require(newRate > 0, "Rate must be greater than 0");
        require(newRate <= 1000, "Rate too high"); // Max 1000:1 ratio for safety
        
        uint256 oldRate = pointsToTokenRate;
        pointsToTokenRate = newRate;
        
        emit PointsToTokenRateUpdated(oldRate, newRate);
    }

    /**
     * @dev Calculate token amount from points based on current rate
     * @param points Number of points to convert
     * @return Token amount in wei (with 18 decimals)
     */
    function calculateTokenAmount(uint256 points) public view returns (uint256) {
        // points / pointsToTokenRate = tokens
        // Example: 100 points / 10 = 10 KTNZ
        return (points * 10**18) / pointsToTokenRate;
    }

    /**
     * @dev Calculate points needed for a specific token amount
     * @param tokenAmount Token amount in wei (with 18 decimals)
     * @return Points needed
     */
    function calculatePointsNeeded(uint256 tokenAmount) public view returns (uint256) {
        // tokenAmount * pointsToTokenRate / 10**18 = points
        return (tokenAmount * pointsToTokenRate) / 10**18;
    }

    /**
     * @dev Mint tokens instantly (for amounts below INSTANT_MINT_LIMIT)
     * @param to Recipient address
     * @param amount Amount to mint (in wei)
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        require(amount <= INSTANT_MINT_LIMIT, "Amount exceeds instant mint limit, use requestMint");
        
        _updateDailyLimit(amount);
        _mint(to, amount);
    }

    /**
     * @dev Batch mint tokens to multiple addresses (gas efficient)
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to mint (in wei)
     */
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) 
        external 
        onlyRole(MINTER_ROLE) 
        whenNotPaused 
    {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        require(recipients.length <= 100, "Too many recipients"); // Prevent gas issues
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        require(totalSupply() + totalAmount <= MAX_SUPPLY, "Exceeds max supply");
        require(totalAmount <= INSTANT_MINT_LIMIT, "Total amount exceeds instant mint limit");
        
        _updateDailyLimit(totalAmount);
        
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amounts[i]);
        }
        
        emit BatchMinted(recipients, amounts, totalAmount);
    }

    /**
     * @dev Request a time-locked mint for large amounts
     * @param to Recipient address
     * @param amount Amount to mint (in wei)
     * @return requestId ID of the mint request
     */
    function requestMint(address to, uint256 amount) 
        external 
        onlyRole(MINTER_ROLE) 
        whenNotPaused 
        returns (uint256 requestId) 
    {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        require(amount > INSTANT_MINT_LIMIT, "Use mint() for smaller amounts");
        
        requestId = nextRequestId++;
        uint256 unlockTime = block.timestamp + TIME_LOCK_DURATION;
        
        mintRequests[requestId] = MintRequest({
            to: to,
            amount: amount,
            unlockTime: unlockTime,
            executed: false
        });
        
        emit MintRequested(requestId, to, amount, unlockTime);
        return requestId;
    }

    /**
     * @dev Execute a time-locked mint request
     * @param requestId ID of the mint request
     */
    function executeMint(uint256 requestId) external onlyRole(MINTER_ROLE) whenNotPaused {
        MintRequest storage request = mintRequests[requestId];
        
        require(!request.executed, "Already executed");
        require(block.timestamp >= request.unlockTime, "Time lock not expired");
        require(totalSupply() + request.amount <= MAX_SUPPLY, "Exceeds max supply");
        
        _updateDailyLimit(request.amount);
        
        request.executed = true;
        _mint(request.to, request.amount);
        
        emit MintExecuted(requestId, request.to, request.amount);
    }

    /**
     * @dev Update daily minting limit tracking
     * @param amount Amount being minted
     */
    function _updateDailyLimit(uint256 amount) private {
        uint256 currentDay = block.timestamp / 1 days;
        
        if (currentDay > lastMintDay) {
            // New day, reset counter
            lastMintDay = currentDay;
            todayMintedAmount = 0;
        }
        
        require(todayMintedAmount + amount <= DAILY_MINT_LIMIT, "Daily mint limit exceeded");
        todayMintedAmount += amount;
    }

    /**
     * @dev Get remaining daily mint allowance
     * @return Remaining amount that can be minted today
     */
    function getRemainingDailyAllowance() external view returns (uint256) {
        uint256 currentDay = block.timestamp / 1 days;
        
        if (currentDay > lastMintDay) {
            return DAILY_MINT_LIMIT;
        }
        
        return DAILY_MINT_LIMIT - todayMintedAmount;
    }

    /**
     * @dev Pause all token transfers and minting
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause token transfers and minting
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Get current exchange rate information
     * @return rate Current points-to-token rate
     * @return example Example: X points = 1 KTNZ
     */
    function getExchangeRateInfo() external view returns (uint256 rate, string memory example) {
        rate = pointsToTokenRate;
        example = string(abi.encodePacked(
            _uint2str(pointsToTokenRate),
            " points = 1 KTNZ"
        ));
    }

    // Helper function to convert uint to string
    function _uint2str(uint256 _i) private pure returns (string memory str) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        j = _i;
        while (j != 0) {
            bstr[--k] = bytes1(uint8(48 + j % 10));
            j /= 10;
        }
        str = string(bstr);
    }

    /**
     * @dev Override required by Solidity for Pausable
     */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20)
        whenNotPaused
    {
        super._update(from, to, value);
    }
}
