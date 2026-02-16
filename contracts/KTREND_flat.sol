// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// OpenZeppelin Contracts (last updated v5.0.0) (utils/Context.sol)
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}

// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC20/IERC20.sol)
interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC20/extensions/IERC20Metadata.sol)
interface IERC20Metadata is IERC20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

// OpenZeppelin Contracts (last updated v5.0.0) (interfaces/draft-IERC6093.sol)
interface IERC20Errors {
    error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed);
    error ERC20InvalidSender(address sender);
    error ERC20InvalidReceiver(address receiver);
    error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed);
    error ERC20InvalidApprover(address approver);
    error ERC20InvalidSpender(address spender);
}

interface IERC721Errors {
    error ERC721InvalidOwner(address owner);
    error ERC721NonexistentToken(uint256 tokenId);
    error ERC721IncorrectOwner(address sender, uint256 tokenId, address owner);
    error ERC721InvalidSender(address sender);
    error ERC721InvalidReceiver(address receiver);
    error ERC721InsufficientApproval(address operator, uint256 tokenId);
    error ERC721InvalidApprover(address approver);
    error ERC721InvalidOperator(address operator);
}

interface IERC1155Errors {
    error ERC1155InsufficientBalance(address sender, uint256 balance, uint256 needed, uint256 tokenId);
    error ERC1155InvalidSender(address sender);
    error ERC1155InvalidReceiver(address receiver);
    error ERC1155MissingApprovalForAll(address operator, address owner);
    error ERC1155InvalidApprover(address approver);
    error ERC1155InvalidOperator(address operator);
    error ERC1155InvalidArrayLength(uint256 idsLength, uint256 valuesLength);
}

// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC20/ERC20.sol)
abstract contract ERC20 is Context, IERC20, IERC20Metadata, IERC20Errors {
    mapping(address account => uint256) private _balances;
    mapping(address account => mapping(address spender => uint256)) private _allowances;
    uint256 private _totalSupply;
    string private _name;
    string private _symbol;

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    function name() public view virtual returns (string memory) {
        return _name;
    }

    function symbol() public view virtual returns (string memory) {
        return _symbol;
    }

    function decimals() public view virtual returns (uint8) {
        return 18;
    }

    function totalSupply() public view virtual returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view virtual returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 value) public virtual returns (bool) {
        address owner = _msgSender();
        _transfer(owner, to, value);
        return true;
    }

    function allowance(address owner, address spender) public view virtual returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 value) public virtual returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public virtual returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, value);
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        if (from == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        if (to == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _update(from, to, value);
    }

    function _update(address from, address to, uint256 value) internal virtual {
        if (from == address(0)) {
            _totalSupply += value;
        } else {
            uint256 fromBalance = _balances[from];
            if (fromBalance < value) {
                revert ERC20InsufficientBalance(from, fromBalance, value);
            }
            unchecked {
                _balances[from] = fromBalance - value;
            }
        }

        if (to == address(0)) {
            unchecked {
                _totalSupply -= value;
            }
        } else {
            unchecked {
                _balances[to] += value;
            }
        }

        emit Transfer(from, to, value);
    }

    function _mint(address account, uint256 value) internal {
        if (account == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _update(address(0), account, value);
    }

    function _burn(address account, uint256 value) internal {
        if (account == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        _update(account, address(0), value);
    }

    function _approve(address owner, address spender, uint256 value) internal {
        _approve(owner, spender, value, true);
    }

    function _approve(address owner, address spender, uint256 value, bool emitEvent) internal virtual {
        if (owner == address(0)) {
            revert ERC20InvalidApprover(address(0));
        }
        if (spender == address(0)) {
            revert ERC20InvalidSpender(address(0));
        }
        _allowances[owner][spender] = value;
        if (emitEvent) {
            emit Approval(owner, spender, value);
        }
    }

    function _spendAllowance(address owner, address spender, uint256 value) internal virtual {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < value) {
                revert ERC20InsufficientAllowance(spender, currentAllowance, value);
            }
            unchecked {
                _approve(owner, spender, currentAllowance - value, false);
            }
        }
    }
}

// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC20/extensions/ERC20Burnable.sol)
abstract contract ERC20Burnable is Context, ERC20 {
    function burn(uint256 value) public virtual {
        _burn(_msgSender(), value);
    }

    function burnFrom(address account, uint256 value) public virtual {
        _spendAllowance(account, _msgSender(), value);
        _burn(account, value);
    }
}

// OpenZeppelin Contracts (last updated v5.0.0) (access/IAccessControl.sol)
interface IAccessControl {
    error AccessControlUnauthorizedAccount(address account, bytes32 neededRole);
    error AccessControlBadConfirmation();
    event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole);
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);
    function hasRole(bytes32 role, address account) external view returns (bool);
    function getRoleAdmin(bytes32 role) external view returns (bytes32);
    function grantRole(bytes32 role, address account) external;
    function revokeRole(bytes32 role, address account) external;
    function renounceRole(bytes32 role, address callerConfirmation) external;
}

// OpenZeppelin Contracts (last updated v5.0.0) (utils/introspection/IERC165.sol)
interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

// OpenZeppelin Contracts (last updated v5.0.0) (utils/introspection/ERC165.sol)
abstract contract ERC165 is IERC165 {
    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
        return interfaceId == type(IERC165).interfaceId;
    }
}

// OpenZeppelin Contracts (last updated v5.0.0) (access/AccessControl.sol)
abstract contract AccessControl is Context, IAccessControl, ERC165 {
    struct RoleData {
        mapping(address account => bool) hasRole;
        bytes32 adminRole;
    }

    mapping(bytes32 role => RoleData) private _roles;

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    modifier onlyRole(bytes32 role) {
        _checkRole(role);
        _;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IAccessControl).interfaceId || super.supportsInterface(interfaceId);
    }

    function hasRole(bytes32 role, address account) public view virtual returns (bool) {
        return _roles[role].hasRole[account];
    }

    function _checkRole(bytes32 role) internal view virtual {
        _checkRole(role, _msgSender());
    }

    function _checkRole(bytes32 role, address account) internal view virtual {
        if (!hasRole(role, account)) {
            revert AccessControlUnauthorizedAccount(account, role);
        }
    }

    function getRoleAdmin(bytes32 role) public view virtual returns (bytes32) {
        return _roles[role].adminRole;
    }

    function grantRole(bytes32 role, address account) public virtual onlyRole(getRoleAdmin(role)) {
        _grantRole(role, account);
    }

    function revokeRole(bytes32 role, address account) public virtual onlyRole(getRoleAdmin(role)) {
        _revokeRole(role, account);
    }

    function renounceRole(bytes32 role, address callerConfirmation) public virtual {
        if (callerConfirmation != _msgSender()) {
            revert AccessControlBadConfirmation();
        }

        _revokeRole(role, callerConfirmation);
    }

    function _setRoleAdmin(bytes32 role, bytes32 adminRole) internal virtual {
        bytes32 previousAdminRole = getRoleAdmin(role);
        _roles[role].adminRole = adminRole;
        emit RoleAdminChanged(role, previousAdminRole, adminRole);
    }

    function _grantRole(bytes32 role, address account) internal virtual returns (bool) {
        if (!hasRole(role, account)) {
            _roles[role].hasRole[account] = true;
            emit RoleGranted(role, account, _msgSender());
            return true;
        } else {
            return false;
        }
    }

    function _revokeRole(bytes32 role, address account) internal virtual returns (bool) {
        if (hasRole(role, account)) {
            _roles[role].hasRole[account] = false;
            emit RoleRevoked(role, account, _msgSender());
            return true;
        } else {
            return false;
        }
    }
}

// OpenZeppelin Contracts (last updated v5.0.0) (utils/Pausable.sol)
abstract contract Pausable is Context {
    bool private _paused;

    event Paused(address account);
    event Unpaused(address account);

    error EnforcedPause();
    error ExpectedPause();

    constructor() {
        _paused = false;
    }

    modifier whenNotPaused() {
        _requireNotPaused();
        _;
    }

    modifier whenPaused() {
        _requirePaused();
        _;
    }

    function paused() public view virtual returns (bool) {
        return _paused;
    }

    function _requireNotPaused() internal view virtual {
        if (paused()) {
            revert EnforcedPause();
        }
    }

    function _requirePaused() internal view virtual {
        if (!paused()) {
            revert ExpectedPause();
        }
    }

    function _pause() internal virtual whenNotPaused {
        _paused = true;
        emit Paused(_msgSender());
    }

    function _unpause() internal virtual whenPaused {
        _paused = false;
        emit Unpaused(_msgSender());
    }
}

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
    uint256 public pointsToTokenRate = 10; // 10 points = 1 KTNZ

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
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(RATE_MANAGER_ROLE, msg.sender);
        _mint(msg.sender, INITIAL_SUPPLY);
        lastMintDay = block.timestamp / 1 days;
    }

    function setPointsToTokenRate(uint256 newRate) external onlyRole(RATE_MANAGER_ROLE) {
        require(newRate > 0, "Rate must be greater than 0");
        require(newRate <= 1000, "Rate too high");
        uint256 oldRate = pointsToTokenRate;
        pointsToTokenRate = newRate;
        emit PointsToTokenRateUpdated(oldRate, newRate);
    }

    function calculateTokenAmount(uint256 points) public view returns (uint256) {
        return (points * 10**18) / pointsToTokenRate;
    }

    function calculatePointsNeeded(uint256 tokenAmount) public view returns (uint256) {
        return (tokenAmount * pointsToTokenRate) / 10**18;
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        require(amount <= INSTANT_MINT_LIMIT, "Amount exceeds instant mint limit, use requestMint");
        _updateDailyLimit(amount);
        _mint(to, amount);
    }

    function batchMint(address[] calldata recipients, uint256[] calldata amounts) 
        external 
        onlyRole(MINTER_ROLE) 
        whenNotPaused 
    {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        require(recipients.length <= 100, "Too many recipients");
        
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

    function _updateDailyLimit(uint256 amount) private {
        uint256 currentDay = block.timestamp / 1 days;
        
        if (currentDay > lastMintDay) {
            lastMintDay = currentDay;
            todayMintedAmount = 0;
        }
        
        require(todayMintedAmount + amount <= DAILY_MINT_LIMIT, "Daily mint limit exceeded");
        todayMintedAmount += amount;
    }

    function getRemainingDailyAllowance() external view returns (uint256) {
        uint256 currentDay = block.timestamp / 1 days;
        
        if (currentDay > lastMintDay) {
            return DAILY_MINT_LIMIT;
        }
        
        return DAILY_MINT_LIMIT - todayMintedAmount;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function getExchangeRateInfo() external view returns (uint256 rate, string memory example) {
        rate = pointsToTokenRate;
        example = string(abi.encodePacked(
            _uint2str(pointsToTokenRate),
            " points = 1 KTNZ"
        ));
    }

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

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20)
        whenNotPaused
    {
        super._update(from, to, value);
    }
}
