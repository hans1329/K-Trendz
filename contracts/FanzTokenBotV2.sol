// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts@5.0.0/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts@5.0.0/access/Ownable.sol";
import "@openzeppelin/contracts@5.0.0/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts@5.0.0/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts@5.0.0/token/ERC20/IERC20.sol";

/// @title FanzTokenBotV2 - K-Trendz Lightstick with Paymaster
contract FanzTokenBotV2 is ERC1155, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 constant FEE_RESERVE = 9700;
    uint256 constant FEE_ARTIST = 200;
    uint256 constant FEE_PLATFORM = 100;
    uint256 constant SELL_FEE = 200;
    uint256 constant BP = 10000;
    uint256 constant DAILY_LIMIT = 100;
    uint256 constant CB_THRESHOLD = 2000;

    IERC20 public immutable usdc;
    address public platform;
    address public artistFund;
    address public operator;
    bool public paused;
    bool public cbTripped;
    
    mapping(address => bool) public bots;
    mapping(address => mapping(uint256 => uint256)) public lastBlock;
    mapping(address => mapping(uint256 => uint256)) public daily;
    mapping(uint256 => uint256) public lastPx;
    mapping(uint256 => uint256) public pxBlock;
    
    struct Token { uint256 supply; uint256 base; uint256 k; address creator; bool exists; }
    mapping(uint256 => Token) public tokens;

    event Buy(address indexed exec, address indexed agent, uint256 indexed id, uint256 cost, uint256 supply);
    event Sell(address indexed exec, address indexed agent, uint256 indexed id, uint256 refund, uint256 supply);
    event Created(uint256 indexed id, address creator, uint256 base, uint256 k);
    event Bot(address indexed bot, bool status);
    event Op(address indexed old, address indexed nw);

    modifier notPaused() { require(!paused, "P"); _; }
    modifier cbOff() { require(!cbTripped, "CB"); _; }
    modifier verified() { require(tx.origin == operator || bots[msg.sender], "V"); _; }

    constructor(address _p, address _a, address _o) ERC1155("") Ownable(msg.sender) {
        require(_p != address(0) && _a != address(0) && _o != address(0), "0");
        platform = _p; artistFund = _a; operator = _o;
        usdc = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
    }

    function create(uint256 id, address c, uint256 base, uint256 k) external onlyOwner {
        require(!tokens[id].exists && c != address(0) && base > 0 && k > 0, "I");
        tokens[id] = Token(0, base, k, c, true);
        lastPx[id] = base; pxBlock[id] = block.number;
        emit Created(id, c, base, k);
    }

    function price(uint256 id) public view returns (uint256) {
        Token memory t = tokens[id];
        require(t.exists, "N");
        return t.base + (t.k * _sqrt(t.supply)) / 1e12;
    }
    
    function buyCost(uint256 id) public view returns (uint256 res, uint256 art, uint256 plat, uint256 total) {
        Token memory t = tokens[id];
        require(t.exists, "N");
        res = _integral(t.base, t.k, t.supply, 1);
        total = (res * BP) / FEE_RESERVE;
        art = (total * FEE_ARTIST) / BP;
        plat = (total * FEE_PLATFORM) / BP;
    }
    
    function sellRefund(uint256 id) public view returns (uint256 gross, uint256 fee, uint256 net) {
        Token memory t = tokens[id];
        require(t.exists && t.supply >= 1, "I");
        gross = _integral(t.base, t.k, t.supply - 1, 1);
        fee = (gross * SELL_FEE) / BP;
        net = gross - fee;
    }

    function buy(uint256 id, uint256 max, address agent) external nonReentrant notPaused cbOff verified {
        address a = agent == address(0) ? msg.sender : agent;
        require(lastBlock[a][id] < block.number, "B");
        lastBlock[a][id] = block.number;
        uint256 d = block.timestamp / 1 days;
        require(daily[a][d] < DAILY_LIMIT, "L");
        daily[a][d]++;
        
        (uint256 res, uint256 art, uint256 plat, uint256 total) = buyCost(id);
        require(total <= max, "M");
        
        usdc.safeTransferFrom(msg.sender, address(this), res);
        usdc.safeTransferFrom(msg.sender, artistFund, art);
        usdc.safeTransferFrom(msg.sender, platform, plat);
        
        tokens[id].supply++;
        _mint(msg.sender, id, 1, "");
        _cb(id);
        emit Buy(msg.sender, a, id, total, tokens[id].supply);
    }

    function sell(uint256 id, uint256 min, address agent) external nonReentrant notPaused cbOff verified {
        address a = agent == address(0) ? msg.sender : agent;
        require(lastBlock[a][id] < block.number, "B");
        lastBlock[a][id] = block.number;
        uint256 d = block.timestamp / 1 days;
        require(daily[a][d] < DAILY_LIMIT, "L");
        daily[a][d]++;
        require(balanceOf(msg.sender, id) >= 1, "X");
        
        (uint256 gross, uint256 fee, uint256 net) = sellRefund(id);
        require(net >= min, "U");
        require(usdc.balanceOf(address(this)) >= gross, "F");
        
        usdc.safeTransfer(platform, fee);
        usdc.safeTransfer(msg.sender, net);
        _burn(msg.sender, id, 1);
        tokens[id].supply--;
        _cb(id);
        emit Sell(msg.sender, a, id, net, tokens[id].supply);
    }

    function _cb(uint256 id) internal {
        uint256 cur = price(id);
        uint256 prev = lastPx[id];
        uint256 diff = cur > prev ? ((cur - prev) * BP) / prev : ((prev - cur) * BP) / prev;
        if (diff >= CB_THRESHOLD) { cbTripped = true; }
        if (block.number >= pxBlock[id] + 10) { lastPx[id] = cur; pxBlock[id] = block.number; }
    }

    function _integral(uint256 base, uint256 k, uint256 s, uint256 n) internal pure returns (uint256) {
        uint256 s1 = _sqrt(s); uint256 s2 = _sqrt(s + n);
        uint256 p1 = s * s1; uint256 p2 = (s + n) * s2;
        return base * n + (p2 > p1 ? (2 * k * (p2 - p1)) / (3 * 1e12) : 0);
    }
    
    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 sc = x * 1e12;
        uint256 z = (sc + 1) / 2; uint256 y = sc;
        while (z < y) { y = z; z = (sc / z + z) / 2; }
        return y;
    }

    function resetCB() external onlyOwner { cbTripped = false; }
    function setOp(address o) external onlyOwner { require(o != address(0), "0"); emit Op(operator, o); operator = o; }
    function setBot(address b, bool s) external onlyOwner { require(b != address(0), "0"); bots[b] = s; emit Bot(b, s); }
    function setParams(uint256 id, uint256 base, uint256 k) external onlyOwner { require(tokens[id].exists && base > 0 && k > 0, "I"); tokens[id].base = base; tokens[id].k = k; }
    function setCreator(uint256 id, address c) external onlyOwner { require(tokens[id].exists && c != address(0), "I"); tokens[id].creator = c; }
    function setPlatform(address p) external onlyOwner { require(p != address(0), "0"); platform = p; }
    function setArtistFund(address a) external onlyOwner { require(a != address(0), "0"); artistFund = a; }
    function pause() external onlyOwner { paused = true; }
    function unpause() external onlyOwner { paused = false; }
    function withdraw(address to, uint256 amt) external onlyOwner { require(to != address(0) && amt > 0, "I"); usdc.safeTransfer(to, amt); }
    function emergencyWithdraw(address to) external onlyOwner { require(to != address(0), "0"); usdc.safeTransfer(to, usdc.balanceOf(address(this))); }
    function balance() external view returns (uint256) { return usdc.balanceOf(address(this)); }
    function info(uint256 id) external view returns (uint256, uint256, uint256, address, bool) { Token memory t = tokens[id]; return (t.supply, t.base, t.k, t.creator, t.exists); }
    function supply(uint256 id) external view returns (uint256) { return tokens[id].supply; }
    function dailyVol(address a) external view returns (uint256) { return daily[a][block.timestamp / 1 days]; }
    function isBot(address a) external view returns (bool) { return bots[a]; }
    function isVerified(address a) external view returns (bool) { return tx.origin == operator || bots[a]; }
    function setURI(string memory u) external onlyOwner { _setURI(u); }
}
