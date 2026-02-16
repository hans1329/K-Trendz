// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts@5.0.0/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts@5.0.0/access/Ownable.sol";
import "@openzeppelin/contracts@5.0.0/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts@5.0.0/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts@5.0.0/token/ERC20/IERC20.sol";

/// @title FanzTokenBotV3 - 사용자 자금 모델 (User-Funded Trading)
/// @notice 사용자가 USDC approve 후 플랫폼 오퍼레이터가 대리 거래 실행
/// @dev V2와 동일한 본딩 커브 + buyFor/sellFor 추가
contract FanzTokenBotV3 is ERC1155, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── 수수료 상수 (BP 기준, 1BP = 0.01%) ───
    uint256 constant FEE_RESERVE = 9700;   // 97% → 리저브
    uint256 constant FEE_ARTIST  = 200;    // 2% → 아티스트 펀드
    uint256 constant FEE_PLATFORM = 100;   // 1% → 플랫폼
    uint256 constant SELL_FEE    = 200;    // 2% → 매도 수수료
    uint256 constant BP          = 10000;

    // ─── 레이트 리밋 ───
    uint256 constant DAILY_LIMIT  = 100;   // 에이전트당 일일 최대 거래 횟수
    uint256 constant CB_THRESHOLD = 2000;  // 20% 가격 변동 시 서킷 브레이커

    // ─── 상태 변수 ───
    IERC20 public immutable usdc;
    address public platform;
    address public artistFund;
    address public operator;      // 대리 거래 실행자 (Admin EOA)
    bool public paused;
    bool public cbTripped;

    // ─── 레이트 리밋 매핑 ───
    mapping(address => mapping(uint256 => uint256)) public lastBlock; // agent → tokenId → lastBlock
    mapping(address => mapping(uint256 => uint256)) public daily;     // agent → day → count
    
    // ─── 서킷 브레이커 ───
    mapping(uint256 => uint256) public lastPx;
    mapping(uint256 => uint256) public pxBlock;

    // ─── 토큰 데이터 ───
    struct Token {
        uint256 supply;
        uint256 base;     // 기본 가격 (USDC 6 decimals)
        uint256 k;        // 본딩 커브 기울기
        address creator;
        bool exists;
    }
    mapping(uint256 => Token) public tokens;

    // ─── 사용자 자금 모델: Allowance 추적 ───
    // 유저가 이 컨트랙트에 USDC approve 했는지 확인용
    mapping(address => bool) public approvedTraders;

    // ─── 이벤트 ───
    event Buy(address indexed user, address indexed agent, uint256 indexed id, uint256 cost, uint256 supply);
    event Sell(address indexed user, address indexed agent, uint256 indexed id, uint256 refund, uint256 supply);
    event BuyDirect(address indexed buyer, uint256 indexed id, uint256 cost, uint256 supply);
    event SellDirect(address indexed seller, uint256 indexed id, uint256 refund, uint256 supply);
    event Created(uint256 indexed id, address creator, uint256 base, uint256 k);
    event TraderApproved(address indexed trader, bool status);
    event OperatorChanged(address indexed oldOp, address indexed newOp);

    // ─── 접근 제어 ───
    modifier notPaused() { require(!paused, "Paused"); _; }
    modifier cbOff() { require(!cbTripped, "CircuitBreaker"); _; }
    modifier onlyOperator() { require(msg.sender == operator, "NotOperator"); _; }

    constructor(address _platform, address _artistFund, address _operator) 
        ERC1155("") 
        Ownable(msg.sender) 
    {
        require(_platform != address(0) && _artistFund != address(0) && _operator != address(0), "ZeroAddr");
        platform = _platform;
        artistFund = _artistFund;
        operator = _operator;
        usdc = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913); // Base USDC
    }

    // ═══════════════════════════════════════════════════════════════
    //                     토큰 관리 (Owner Only)
    // ═══════════════════════════════════════════════════════════════

    function create(uint256 id, address creator, uint256 base, uint256 k) external onlyOwner {
        require(!tokens[id].exists && creator != address(0) && base > 0 && k > 0, "InvalidParams");
        tokens[id] = Token(0, base, k, creator, true);
        lastPx[id] = base;
        pxBlock[id] = block.number;
        emit Created(id, creator, base, k);
    }

    // ═══════════════════════════════════════════════════════════════
    //                     가격 조회 (View Functions)
    // ═══════════════════════════════════════════════════════════════

    function price(uint256 id) public view returns (uint256) {
        Token memory t = tokens[id];
        require(t.exists, "NotFound");
        return t.base + (t.k * _sqrt(t.supply)) / 1e12;
    }

    function buyCost(uint256 id) public view returns (uint256 res, uint256 art, uint256 plat, uint256 total) {
        Token memory t = tokens[id];
        require(t.exists, "NotFound");
        res = _integral(t.base, t.k, t.supply, 1);
        total = (res * BP) / FEE_RESERVE;
        art = (total * FEE_ARTIST) / BP;
        plat = (total * FEE_PLATFORM) / BP;
    }

    function sellRefund(uint256 id) public view returns (uint256 gross, uint256 fee, uint256 net) {
        Token memory t = tokens[id];
        require(t.exists && t.supply >= 1, "Invalid");
        gross = _integral(t.base, t.k, t.supply - 1, 1);
        fee = (gross * SELL_FEE) / BP;
        net = gross - fee;
    }

    // ═══════════════════════════════════════════════════════════════
    //           V3 핵심: 대리 거래 (Operator → 유저 자금)
    // ═══════════════════════════════════════════════════════════════

    /// @notice 유저 자금으로 대리 구매. 유저가 USDC approve 필수.
    /// @param user 유저 지갑 주소 (USDC 출처 & 토큰 수령자)
    /// @param id 토큰 ID
    /// @param max 최대 허용 비용 (슬리피지)
    /// @param agent 에이전트 식별자 (DAU 추적용)
    function buyFor(address user, uint256 id, uint256 max, address agent) 
        external 
        nonReentrant 
        notPaused 
        cbOff 
        onlyOperator 
    {
        require(user != address(0), "ZeroUser");
        address a = agent == address(0) ? user : agent;
        _checkRateLimit(a, id);

        (uint256 res, uint256 art, uint256 plat, uint256 total) = buyCost(id);
        require(total <= max, "SlippageExceeded");

        // 유저 지갑에서 USDC 직접 인출 (유저가 사전에 approve 필요)
        usdc.safeTransferFrom(user, address(this), res);
        usdc.safeTransferFrom(user, artistFund, art);
        usdc.safeTransferFrom(user, platform, plat);

        // 유저에게 토큰 민팅
        tokens[id].supply++;
        _mint(user, id, 1, "");
        _cb(id);

        emit Buy(user, a, id, total, tokens[id].supply);
    }

    /// @notice 유저 토큰 대리 매도. USDC는 유저에게 환불.
    /// @param user 유저 지갑 주소 (토큰 소유자 & USDC 수령자)
    /// @param id 토큰 ID
    /// @param min 최소 환불액 (슬리피지)
    /// @param agent 에이전트 식별자 (DAU 추적용)
    function sellFor(address user, uint256 id, uint256 min, address agent)
        external
        nonReentrant
        notPaused
        cbOff
        onlyOperator
    {
        require(user != address(0), "ZeroUser");
        address a = agent == address(0) ? user : agent;
        _checkRateLimit(a, id);

        require(balanceOf(user, id) >= 1, "InsufficientBalance");

        (uint256 gross, uint256 fee, uint256 net) = sellRefund(id);
        require(net >= min, "SlippageExceeded");
        require(usdc.balanceOf(address(this)) >= gross, "InsufficientReserve");

        // 유저에게 USDC 환불
        usdc.safeTransfer(platform, fee);
        usdc.safeTransfer(user, net);

        // 유저의 토큰 소각
        _burn(user, id, 1);
        tokens[id].supply--;
        _cb(id);

        emit Sell(user, a, id, net, tokens[id].supply);
    }

    // ═══════════════════════════════════════════════════════════════
    //          V2 호환: 직접 거래 (msg.sender 자금 사용)
    // ═══════════════════════════════════════════════════════════════

    /// @notice 직접 구매 (V2 호환 — msg.sender의 USDC 사용)
    function buy(uint256 id, uint256 max) external nonReentrant notPaused cbOff {
        _checkRateLimit(msg.sender, id);

        (uint256 res, uint256 art, uint256 plat, uint256 total) = buyCost(id);
        require(total <= max, "SlippageExceeded");

        usdc.safeTransferFrom(msg.sender, address(this), res);
        usdc.safeTransferFrom(msg.sender, artistFund, art);
        usdc.safeTransferFrom(msg.sender, platform, plat);

        tokens[id].supply++;
        _mint(msg.sender, id, 1, "");
        _cb(id);

        emit BuyDirect(msg.sender, id, total, tokens[id].supply);
    }

    /// @notice 직접 매도 (V2 호환 — USDC를 msg.sender에게)
    function sell(uint256 id, uint256 min) external nonReentrant notPaused cbOff {
        _checkRateLimit(msg.sender, id);
        require(balanceOf(msg.sender, id) >= 1, "InsufficientBalance");

        (uint256 gross, uint256 fee, uint256 net) = sellRefund(id);
        require(net >= min, "SlippageExceeded");
        require(usdc.balanceOf(address(this)) >= gross, "InsufficientReserve");

        usdc.safeTransfer(platform, fee);
        usdc.safeTransfer(msg.sender, net);
        _burn(msg.sender, id, 1);
        tokens[id].supply--;
        _cb(id);

        emit SellDirect(msg.sender, id, net, tokens[id].supply);
    }

    // ═══════════════════════════════════════════════════════════════
    //                       내부 함수
    // ═══════════════════════════════════════════════════════════════

    function _checkRateLimit(address agent, uint256 id) internal {
        require(lastBlock[agent][id] < block.number, "SameBlock");
        lastBlock[agent][id] = block.number;
        uint256 d = block.timestamp / 1 days;
        require(daily[agent][d] < DAILY_LIMIT, "DailyLimitExceeded");
        daily[agent][d]++;
    }

    function _cb(uint256 id) internal {
        uint256 cur = price(id);
        uint256 prev = lastPx[id];
        uint256 diff = cur > prev 
            ? ((cur - prev) * BP) / prev 
            : ((prev - cur) * BP) / prev;
        if (diff >= CB_THRESHOLD) { cbTripped = true; }
        if (block.number >= pxBlock[id] + 10) {
            lastPx[id] = cur;
            pxBlock[id] = block.number;
        }
    }

    function _integral(uint256 base, uint256 k, uint256 s, uint256 n) internal pure returns (uint256) {
        uint256 s1 = _sqrt(s);
        uint256 s2 = _sqrt(s + n);
        uint256 p1 = s * s1;
        uint256 p2 = (s + n) * s2;
        return base * n + (p2 > p1 ? (2 * k * (p2 - p1)) / (3 * 1e12) : 0);
    }

    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 sc = x * 1e12;
        uint256 z = (sc + 1) / 2;
        uint256 y = sc;
        while (z < y) { y = z; z = (sc / z + z) / 2; }
        return y;
    }

    // ═══════════════════════════════════════════════════════════════
    //                     관리 함수 (Owner Only)
    // ═══════════════════════════════════════════════════════════════

    function resetCB() external onlyOwner { cbTripped = false; }
    
    function setOperator(address op) external onlyOwner {
        require(op != address(0), "ZeroAddr");
        emit OperatorChanged(operator, op);
        operator = op;
    }
    
    function setParams(uint256 id, uint256 base, uint256 k) external onlyOwner {
        require(tokens[id].exists && base > 0 && k > 0, "Invalid");
        tokens[id].base = base;
        tokens[id].k = k;
    }
    
    function setCreator(uint256 id, address c) external onlyOwner {
        require(tokens[id].exists && c != address(0), "Invalid");
        tokens[id].creator = c;
    }
    
    function setPlatform(address p) external onlyOwner {
        require(p != address(0), "ZeroAddr");
        platform = p;
    }
    
    function setArtistFund(address a) external onlyOwner {
        require(a != address(0), "ZeroAddr");
        artistFund = a;
    }
    
    function pause() external onlyOwner { paused = true; }
    function unpause() external onlyOwner { paused = false; }
    
    function withdraw(address to, uint256 amt) external onlyOwner {
        require(to != address(0) && amt > 0, "Invalid");
        usdc.safeTransfer(to, amt);
    }
    
    function emergencyWithdraw(address to) external onlyOwner {
        require(to != address(0), "ZeroAddr");
        usdc.safeTransfer(to, usdc.balanceOf(address(this)));
    }

    // ═══════════════════════════════════════════════════════════════
    //                     조회 함수 (View)
    // ═══════════════════════════════════════════════════════════════

    function balance() external view returns (uint256) { return usdc.balanceOf(address(this)); }
    
    function info(uint256 id) external view returns (uint256, uint256, uint256, address, bool) {
        Token memory t = tokens[id];
        return (t.supply, t.base, t.k, t.creator, t.exists);
    }
    
    function supply(uint256 id) external view returns (uint256) { return tokens[id].supply; }
    
    function dailyVol(address a) external view returns (uint256) {
        return daily[a][block.timestamp / 1 days];
    }

    /// @notice 유저의 USDC allowance 확인 (프론트엔드용)
    function userAllowance(address user) external view returns (uint256) {
        return usdc.allowance(user, address(this));
    }

    function setURI(string memory u) external onlyOwner { _setURI(u); }
}