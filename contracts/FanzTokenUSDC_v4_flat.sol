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

// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)
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

// OpenZeppelin Contracts (last updated v5.0.0) (utils/ReentrancyGuard.sol)
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

// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC1155/IERC1155.sol)
interface IERC1155 is IERC165 {
    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values);
    event ApprovalForAll(address indexed account, address indexed operator, bool approved);
    event URI(string value, uint256 indexed id);

    function balanceOf(address account, uint256 id) external view returns (uint256);
    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids) external view returns (uint256[] memory);
    function setApprovalForAll(address operator, bool approved) external;
    function isApprovedForAll(address account, address operator) external view returns (bool);
    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes calldata data) external;
    function safeBatchTransferFrom(address from, address to, uint256[] calldata ids, uint256[] calldata values, bytes calldata data) external;
}

// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC1155/extensions/IERC1155MetadataURI.sol)
interface IERC1155MetadataURI is IERC1155 {
    function uri(uint256 id) external view returns (string memory);
}

// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC1155/IERC1155Receiver.sol)
interface IERC1155Receiver is IERC165 {
    function onERC1155Received(address operator, address from, uint256 id, uint256 value, bytes calldata data) external returns (bytes4);
    function onERC1155BatchReceived(address operator, address from, uint256[] calldata ids, uint256[] calldata values, bytes calldata data) external returns (bytes4);
}

// OpenZeppelin Contracts (last updated v5.0.0) (utils/Arrays.sol)
library Arrays {
    function unsafeAccess(address[] storage arr, uint256 pos) internal pure returns (StorageSlot.AddressSlot storage) {
        bytes32 slot;
        assembly ("memory-safe") {
            mstore(0, arr.slot)
            slot := add(keccak256(0, 0x20), pos)
        }
        return StorageSlot.getAddressSlot(slot);
    }

    function unsafeAccess(bytes32[] storage arr, uint256 pos) internal pure returns (StorageSlot.Bytes32Slot storage) {
        bytes32 slot;
        assembly ("memory-safe") {
            mstore(0, arr.slot)
            slot := add(keccak256(0, 0x20), pos)
        }
        return StorageSlot.getBytes32Slot(slot);
    }

    function unsafeAccess(uint256[] storage arr, uint256 pos) internal pure returns (StorageSlot.Uint256Slot storage) {
        bytes32 slot;
        assembly ("memory-safe") {
            mstore(0, arr.slot)
            slot := add(keccak256(0, 0x20), pos)
        }
        return StorageSlot.getUint256Slot(slot);
    }

    function unsafeMemoryAccess(address[] memory arr, uint256 pos) internal pure returns (address res) {
        assembly {
            res := mload(add(add(arr, 0x20), mul(pos, 0x20)))
        }
    }

    function unsafeMemoryAccess(bytes32[] memory arr, uint256 pos) internal pure returns (bytes32 res) {
        assembly {
            res := mload(add(add(arr, 0x20), mul(pos, 0x20)))
        }
    }

    function unsafeMemoryAccess(uint256[] memory arr, uint256 pos) internal pure returns (uint256 res) {
        assembly {
            res := mload(add(add(arr, 0x20), mul(pos, 0x20)))
        }
    }
}

// OpenZeppelin Contracts (last updated v5.0.0) (utils/StorageSlot.sol)
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
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    function getBooleanSlot(bytes32 slot) internal pure returns (BooleanSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    function getBytes32Slot(bytes32 slot) internal pure returns (Bytes32Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    function getStringSlot(bytes32 slot) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    function getStringSlot(string storage store) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }

    function getBytesSlot(bytes32 slot) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    function getBytesSlot(bytes storage store) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }
}

// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC1155/ERC1155.sol)
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
        uint256[] memory ids = new uint256[](1);
        uint256[] memory values = new uint256[](1);
        ids[0] = id;
        values[0] = value;
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
        _update(from, address(0), ids, values);
    }

    function _burnBatch(address from, uint256[] memory ids, uint256[] memory values) internal {
        if (from == address(0)) {
            revert ERC1155InvalidSender(address(0));
        }
        _update(from, address(0), ids, values);
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
                    assembly ("memory-safe") {
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
                    assembly ("memory-safe") {
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
        assembly ("memory-safe") {
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

// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC20/extensions/IERC20Permit.sol)
interface IERC20Permit {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
    function nonces(address owner) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}

// OpenZeppelin Contracts (last updated v5.0.0) (utils/Address.sol)
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

    function verifyCallResultFromTarget(
        address target,
        bool success,
        bytes memory returndata
    ) internal view returns (bytes memory) {
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
            assembly ("memory-safe") {
                let returndata_size := mload(returndata)
                revert(add(32, returndata), returndata_size)
            }
        } else {
            revert FailedInnerCall();
        }
    }
}

// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC20/utils/SafeERC20.sol)
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

/**
 * @title FanzTokenUSDC_v4
 * @notice K-Trendz Lightstick Token with bonding curve pricing
 * 
 * V4 설계 원칙:
 * 1. DAU 추적 - 모든 이벤트에 actualUser 포함 (Dune Analytics용)
 * 2. Operator Pattern - Backend Smart Account가 사용자 대신 실행 (Paymaster 호환)
 * 3. 온체인 기준 - 가격/공급량 모두 컨트랙트에서 계산
 * 4. 본딩커브 파라미터 외부 입력 - createToken 시 basePrice, kValue 필수
 * 5. 관리 기능 - withdraw, setTokenParams, pause 지원
 * 
 * 수수료 구조:
 * - 구매: 70% Reserve, 20% Artist Fund, 10% Platform
 * - 판매: 96% 사용자 환불, 4% Platform Fee
 */
contract FanzTokenUSDC_v4_1 is ERC1155, Ownable, ReentrancyGuard {
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
    
    event TokenCreated(
        uint256 indexed tokenId,
        address indexed creator,
        uint256 basePrice,
        uint256 kValue,
        uint256 timestamp
    );
    
    event TokenBought(
        address indexed operator,
        address indexed actualBuyer,
        uint256 indexed tokenId,
        uint256 amount,
        uint256 totalCost,
        uint256 newSupply,
        uint256 timestamp
    );
    
    event TokenSold(
        address indexed operator,
        address indexed actualSeller,
        uint256 indexed tokenId,
        uint256 amount,
        uint256 netRefund,
        uint256 newSupply,
        uint256 timestamp
    );
    
    event TokenTransferred(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256 tokenId,
        uint256 amount,
        uint256 timestamp
    );
    
    event OperatorUpdated(address indexed operator, bool status);
    event TokenParamsUpdated(uint256 indexed tokenId, uint256 newBasePrice, uint256 newKValue);
    event TokenCreatorUpdated(uint256 indexed tokenId, address newCreator);
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
     * @param kValue 본딩커브 기울기 (예: 2.0 = 2000000000000, 1e12 스케일링)
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
        emit TokenCreatorUpdated(tokenId, newCreator);
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
     * 주의: actualSeller는 이 컨트랙트에 대해 setApprovalForAll을 호출해야 함
     */
    function sellFor(
        uint256 tokenId,
        address actualSeller,
        uint256 amount,
        uint256 minRefund
    ) external nonReentrant whenNotPaused onlyOperatorOrOwner {
        require(actualSeller != address(0), "Invalid seller");
        require(
            isApprovedForAll(actualSeller, address(this)) || 
            isApprovedForAll(actualSeller, msg.sender),
            "Not approved"
        );
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
        
        // 토큰 소각
        _burn(actualSeller, tokenId, amount);
        uint256 newSupply = tokens[tokenId].totalSupply - amount;
        tokens[tokenId].totalSupply = newSupply;
        
        emit TokenSold(operator, actualSeller, tokenId, amount, netRefund, newSupply, block.timestamp);
    }

    // ============ 전송 (DAU 추적) ============
    
    /**
     * @notice Operator를 통한 토큰 전송 (Paymaster 사용)
     */
    function transferFor(
        uint256 tokenId,
        address from,
        address to,
        uint256 amount
    ) external nonReentrant whenNotPaused onlyOperatorOrOwner {
        require(from != address(0) && to != address(0), "Invalid address");
        require(
            isApprovedForAll(from, address(this)) || 
            isApprovedForAll(from, msg.sender),
            "Not approved"
        );
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
        require(tokens[tokenId].exists, "Token does not exist");
        return super.uri(tokenId);
    }

    // ============ 내부 함수 ============
    
    function buyCostIntegral(
        uint256 basePrice,
        uint256 kValue,
        uint256 supply,
        uint256 amount
    ) internal pure returns (uint256) {
        // ∫[s, s+n] (basePrice + k*sqrt(x)) dx
        // = basePrice * n + k * (2/3) * (sqrt(s+n)^3 - sqrt(s)^3)
        
        uint256 linearPart = basePrice * amount;
        
        uint256 sqrtEnd = sqrtPrecision(supply + amount);
        uint256 sqrtStart = sqrtPrecision(supply);
        
        uint256 cubeEnd = sqrtEnd * sqrtEnd * sqrtEnd;
        uint256 cubeStart = sqrtStart * sqrtStart * sqrtStart;
        
        uint256 curvePart = (kValue * 2 * (cubeEnd - cubeStart)) / (3 * 1e18);
        
        return linearPart + curvePart;
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
