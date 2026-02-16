// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FanzTokenUSDC_v3 (Flattened)
 * @dev Fan token contract with USDC payments and bonding curve pricing
 * 
 * V3 Changes: Added 4% sell fee (Platform)
 * 
 * Fee Model:
 * - Purchase: 70% Reserve, 20% Artist Fund, 10% Platform
 * - Sale: 96% Refund to User, 4% Platform Fee
 */

// ============ OpenZeppelin Interfaces & Libraries ============

interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

interface IERC1155 is IERC165 {
    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values);
    event ApprovalForAll(address indexed account, address indexed operator, bool approved);
    event URI(string value, uint256 indexed id);

    function balanceOf(address account, uint256 id) external view returns (uint256);
    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids) external view returns (uint256[] memory);
    function setApprovalForAll(address operator, bool approved) external;
    function isApprovedForAll(address account, address operator) external view returns (bool);
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external;
    function safeBatchTransferFrom(address from, address to, uint256[] calldata ids, uint256[] calldata amounts, bytes calldata data) external;
}

interface IERC1155Receiver is IERC165 {
    function onERC1155Received(address operator, address from, uint256 id, uint256 value, bytes calldata data) external returns (bytes4);
    function onERC1155BatchReceived(address operator, address from, uint256[] calldata ids, uint256[] calldata values, bytes calldata data) external returns (bytes4);
}

interface IERC1155MetadataURI is IERC1155 {
    function uri(uint256 id) external view returns (string memory);
}

interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IERC20Permit {
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
    function nonces(address owner) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}

library Address {
    error AddressInsufficientBalance(address account);
    error AddressEmptyCode(address target);
    error FailedInnerCall();

    function sendValue(address payable recipient, uint256 amount) internal {
        if (address(this).balance < amount) {
            revert AddressInsufficientBalance(address(this));
        }
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) {
            revert FailedInnerCall();
        }
    }

    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0);
    }

    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        if (address(this).balance < value) {
            revert AddressInsufficientBalance(address(this));
        }
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        (bool success, bytes memory returndata) = target.staticcall(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    function functionDelegateCall(address target, bytes memory data) internal returns (bytes memory) {
        (bool success, bytes memory returndata) = target.delegatecall(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    function verifyCallResultFromTarget(address target, bool success, bytes memory returndata) internal view returns (bytes memory) {
        if (!success) {
            _revert(returndata);
        } else {
            if (returndata.length == 0 && target.code.length == 0) {
                revert AddressEmptyCode(target);
            }
            return returndata;
        }
    }

    function verifyCallResult(bool success, bytes memory returndata) internal pure returns (bytes memory) {
        if (!success) {
            _revert(returndata);
        } else {
            return returndata;
        }
    }

    function _revert(bytes memory returndata) private pure {
        if (returndata.length > 0) {
            assembly {
                let returndata_size := mload(returndata)
                revert(add(32, returndata), returndata_size)
            }
        } else {
            revert FailedInnerCall();
        }
    }
}

library SafeERC20 {
    using Address for address;

    error SafeERC20FailedOperation(address token);
    error SafeERC20FailedDecreaseAllowance(address spender, uint256 currentAllowance, uint256 requestedDecrease);

    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transfer, (to, value)));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transferFrom, (from, to, value)));
    }

    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 oldAllowance = token.allowance(address(this), spender);
        forceApprove(token, spender, oldAllowance + value);
    }

    function safeDecreaseAllowance(IERC20 token, address spender, uint256 requestedDecrease) internal {
        unchecked {
            uint256 currentAllowance = token.allowance(address(this), spender);
            if (currentAllowance < requestedDecrease) {
                revert SafeERC20FailedDecreaseAllowance(spender, currentAllowance, requestedDecrease);
            }
            forceApprove(token, spender, currentAllowance - requestedDecrease);
        }
    }

    function forceApprove(IERC20 token, address spender, uint256 value) internal {
        bytes memory approvalCall = abi.encodeCall(token.approve, (spender, value));
        if (!_callOptionalReturnBool(token, approvalCall)) {
            _callOptionalReturn(token, abi.encodeCall(token.approve, (spender, 0)));
            _callOptionalReturn(token, approvalCall);
        }
    }

    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        bytes memory returndata = address(token).functionCall(data);
        if (returndata.length != 0 && !abi.decode(returndata, (bool))) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    function _callOptionalReturnBool(IERC20 token, bytes memory data) private returns (bool) {
        (bool success, bytes memory returndata) = address(token).call(data);
        return success && (returndata.length == 0 || abi.decode(returndata, (bool))) && address(token).code.length > 0;
    }
}

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

abstract contract Ownable is Context {
    address private _owner;

    error OwnableUnauthorizedAccount(address account);
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

abstract contract ReentrancyGuard {
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private _status;

    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        _status = NOT_ENTERED;
    }

    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}

abstract contract ERC165 is IERC165 {
    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
        return interfaceId == type(IERC165).interfaceId;
    }
}

library Arrays {
    function unsafeAccess(uint256[] storage arr, uint256 pos) internal pure returns (StorageSlot.Uint256Slot storage) {
        bytes32 slot;
        assembly {
            mstore(0, arr.slot)
            slot := add(keccak256(0, 0x20), pos)
        }
        return StorageSlot.getUint256Slot(slot);
    }

    function unsafeMemoryAccess(uint256[] memory arr, uint256 pos) internal pure returns (uint256 res) {
        assembly {
            res := mload(add(add(arr, 0x20), mul(pos, 0x20)))
        }
    }

    function unsafeMemoryAccess(address[] memory arr, uint256 pos) internal pure returns (address res) {
        assembly {
            res := mload(add(add(arr, 0x20), mul(pos, 0x20)))
        }
    }
}

library StorageSlot {
    struct AddressSlot {
        address value;
    }

    struct BooleanSlot {
        bool value;
    }

    struct Bytes32Slot {
        bytes32 value;
    }

    struct Uint256Slot {
        uint256 value;
    }

    struct StringSlot {
        string value;
    }

    struct BytesSlot {
        bytes value;
    }

    function getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage r) {
        assembly {
            r.slot := slot
        }
    }

    function getBooleanSlot(bytes32 slot) internal pure returns (BooleanSlot storage r) {
        assembly {
            r.slot := slot
        }
    }

    function getBytes32Slot(bytes32 slot) internal pure returns (Bytes32Slot storage r) {
        assembly {
            r.slot := slot
        }
    }

    function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage r) {
        assembly {
            r.slot := slot
        }
    }

    function getStringSlot(bytes32 slot) internal pure returns (StringSlot storage r) {
        assembly {
            r.slot := slot
        }
    }

    function getStringSlot(string storage store) internal pure returns (StringSlot storage r) {
        assembly {
            r.slot := store.slot
        }
    }

    function getBytesSlot(bytes32 slot) internal pure returns (BytesSlot storage r) {
        assembly {
            r.slot := slot
        }
    }

    function getBytesSlot(bytes storage store) internal pure returns (BytesSlot storage r) {
        assembly {
            r.slot := store.slot
        }
    }
}

abstract contract ERC1155 is Context, ERC165, IERC1155, IERC1155MetadataURI {
    using Arrays for uint256[];
    using Arrays for address[];

    mapping(uint256 id => mapping(address account => uint256)) private _balances;
    mapping(address account => mapping(address operator => bool)) private _operatorApprovals;
    string private _uri;

    error ERC1155InsufficientBalance(address sender, uint256 balance, uint256 needed, uint256 tokenId);
    error ERC1155InvalidSender(address sender);
    error ERC1155InvalidReceiver(address receiver);
    error ERC1155MissingApprovalForAll(address operator, address owner);
    error ERC1155InvalidApprover(address approver);
    error ERC1155InvalidOperator(address operator);
    error ERC1155InvalidArrayLength(uint256 idsLength, uint256 valuesLength);

    constructor(string memory uri_) {
        _setURI(uri_);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return
            interfaceId == type(IERC1155).interfaceId ||
            interfaceId == type(IERC1155MetadataURI).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function uri(uint256) public view virtual returns (string memory) {
        return _uri;
    }

    function balanceOf(address account, uint256 id) public view virtual returns (uint256) {
        return _balances[id][account];
    }

    function balanceOfBatch(
        address[] memory accounts,
        uint256[] memory ids
    ) public view virtual returns (uint256[] memory) {
        if (accounts.length != ids.length) {
            revert ERC1155InvalidArrayLength(ids.length, accounts.length);
        }

        uint256[] memory batchBalances = new uint256[](accounts.length);

        for (uint256 i = 0; i < accounts.length; ++i) {
            batchBalances[i] = balanceOf(accounts.unsafeMemoryAccess(i), ids.unsafeMemoryAccess(i));
        }

        return batchBalances;
    }

    function setApprovalForAll(address operator, bool approved) public virtual {
        _setApprovalForAll(_msgSender(), operator, approved);
    }

    function isApprovedForAll(address account, address operator) public view virtual returns (bool) {
        return _operatorApprovals[account][operator];
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes memory data) public virtual {
        address sender = _msgSender();
        if (from != sender && !isApprovedForAll(from, sender)) {
            revert ERC1155MissingApprovalForAll(sender, from);
        }
        _safeTransferFrom(from, to, id, value, data);
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values,
        bytes memory data
    ) public virtual {
        address sender = _msgSender();
        if (from != sender && !isApprovedForAll(from, sender)) {
            revert ERC1155MissingApprovalForAll(sender, from);
        }
        _safeBatchTransferFrom(from, to, ids, values, data);
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal virtual {
        if (ids.length != values.length) {
            revert ERC1155InvalidArrayLength(ids.length, values.length);
        }

        address operator = _msgSender();

        for (uint256 i = 0; i < ids.length; ++i) {
            uint256 id = ids.unsafeMemoryAccess(i);
            uint256 value = values.unsafeMemoryAccess(i);

            if (from != address(0)) {
                uint256 fromBalance = _balances[id][from];
                if (fromBalance < value) {
                    revert ERC1155InsufficientBalance(from, fromBalance, value, id);
                }
                unchecked {
                    _balances[id][from] = fromBalance - value;
                }
            }

            if (to != address(0)) {
                _balances[id][to] += value;
            }
        }

        if (ids.length == 1) {
            uint256 id = ids.unsafeMemoryAccess(0);
            uint256 value = values.unsafeMemoryAccess(0);
            emit TransferSingle(operator, from, to, id, value);
        } else {
            emit TransferBatch(operator, from, to, ids, values);
        }
    }

    function _updateWithAcceptanceCheck(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values,
        bytes memory data
    ) internal virtual {
        _update(from, to, ids, values);
        if (to != address(0)) {
            address operator = _msgSender();
            if (ids.length == 1) {
                uint256 id = ids.unsafeMemoryAccess(0);
                uint256 value = values.unsafeMemoryAccess(0);
                _doSafeTransferAcceptanceCheck(operator, from, to, id, value, data);
            } else {
                _doSafeBatchTransferAcceptanceCheck(operator, from, to, ids, values, data);
            }
        }
    }

    function _safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes memory data) internal {
        if (to == address(0)) {
            revert ERC1155InvalidReceiver(address(0));
        }
        if (from == address(0)) {
            revert ERC1155InvalidSender(address(0));
        }
        (uint256[] memory ids, uint256[] memory values) = _asSingletonArrays(id, value);
        _updateWithAcceptanceCheck(from, to, ids, values, data);
    }

    function _safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values,
        bytes memory data
    ) internal {
        if (to == address(0)) {
            revert ERC1155InvalidReceiver(address(0));
        }
        if (from == address(0)) {
            revert ERC1155InvalidSender(address(0));
        }
        _updateWithAcceptanceCheck(from, to, ids, values, data);
    }

    function _setURI(string memory newuri) internal virtual {
        _uri = newuri;
    }

    function _mint(address to, uint256 id, uint256 value, bytes memory data) internal {
        if (to == address(0)) {
            revert ERC1155InvalidReceiver(address(0));
        }
        (uint256[] memory ids, uint256[] memory values) = _asSingletonArrays(id, value);
        _updateWithAcceptanceCheck(address(0), to, ids, values, data);
    }

    function _mintBatch(address to, uint256[] memory ids, uint256[] memory values, bytes memory data) internal {
        if (to == address(0)) {
            revert ERC1155InvalidReceiver(address(0));
        }
        _updateWithAcceptanceCheck(address(0), to, ids, values, data);
    }

    function _burn(address from, uint256 id, uint256 value) internal {
        if (from == address(0)) {
            revert ERC1155InvalidSender(address(0));
        }
        (uint256[] memory ids, uint256[] memory values) = _asSingletonArrays(id, value);
        _updateWithAcceptanceCheck(from, address(0), ids, values, "");
    }

    function _burnBatch(address from, uint256[] memory ids, uint256[] memory values) internal {
        if (from == address(0)) {
            revert ERC1155InvalidSender(address(0));
        }
        _updateWithAcceptanceCheck(from, address(0), ids, values, "");
    }

    function _setApprovalForAll(address owner, address operator, bool approved) internal virtual {
        if (operator == address(0)) {
            revert ERC1155InvalidOperator(address(0));
        }
        _operatorApprovals[owner][operator] = approved;
        emit ApprovalForAll(owner, operator, approved);
    }

    function _doSafeTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256 id,
        uint256 value,
        bytes memory data
    ) private {
        if (to.code.length > 0) {
            try IERC1155Receiver(to).onERC1155Received(operator, from, id, value, data) returns (bytes4 response) {
                if (response != IERC1155Receiver.onERC1155Received.selector) {
                    revert ERC1155InvalidReceiver(to);
                }
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert ERC1155InvalidReceiver(to);
                } else {
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        }
    }

    function _doSafeBatchTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values,
        bytes memory data
    ) private {
        if (to.code.length > 0) {
            try IERC1155Receiver(to).onERC1155BatchReceived(operator, from, ids, values, data) returns (
                bytes4 response
            ) {
                if (response != IERC1155Receiver.onERC1155BatchReceived.selector) {
                    revert ERC1155InvalidReceiver(to);
                }
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert ERC1155InvalidReceiver(to);
                } else {
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        }
    }

    function _asSingletonArrays(
        uint256 element1,
        uint256 element2
    ) private pure returns (uint256[] memory array1, uint256[] memory array2) {
        assembly {
            array1 := mload(0x40)
            mstore(array1, 1)
            mstore(add(array1, 0x20), element1)
            array2 := add(array1, 0x40)
            mstore(array2, 1)
            mstore(add(array2, 0x20), element2)
            mstore(0x40, add(array2, 0x40))
        }
    }
}

// ============ FanzTokenUSDC_v3 Contract ============

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
