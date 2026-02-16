// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title KTrendzDAU
 * @dev K-Trendz 플랫폼의 모든 유저 활동을 통합 기록하여 Dune Analytics에서 DAU 추적 가능
 * - 기존 컨트랙트 수정 없이 별도로 DAU 이벤트만 기록
 * - 모든 활동 타입을 단일 이벤트로 통합
 * - Coinbase Paymaster 호환 (Backend SA가 operator로 실행)
 */
contract KTrendzDAU {
    address public owner;
    address public operator;
    
    // 총 활동 수 카운터
    uint256 public totalActivities;
    
    // 활동 타입 상수 (가스 절약을 위해 bytes32 해시 사용)
    bytes32 public constant ACTIVITY_VOTE = keccak256("vote");
    bytes32 public constant ACTIVITY_CHALLENGE = keccak256("challenge");
    bytes32 public constant ACTIVITY_KTNZ_MINT = keccak256("ktnz_mint");
    bytes32 public constant ACTIVITY_KTNZ_BURN = keccak256("ktnz_burn");
    bytes32 public constant ACTIVITY_FANZ_BUY = keccak256("fanz_buy");
    bytes32 public constant ACTIVITY_FANZ_SELL = keccak256("fanz_sell");
    bytes32 public constant ACTIVITY_FANZ_TRANSFER = keccak256("fanz_transfer");
    
    // 통합 유저 활동 이벤트 - Dune에서 DAU 추적용
    event UserActivity(
        address indexed user,           // 실제 유저 지갑 주소 (DAU 추적 핵심)
        bytes32 indexed activityType,   // 활동 타입 해시
        bytes32 indexed referenceHash,  // 참조 데이터 해시 (아티스트명, 챌린지ID 등)
        uint256 timestamp               // 활동 시간
    );
    
    // 일일 통계 이벤트 (선택적 사용)
    event DailyStats(
        uint256 indexed date,           // YYYYMMDD 형식
        uint256 totalActivities,        // 해당일 총 활동 수
        uint256 uniqueUsers             // 해당일 고유 유저 수
    );
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier onlyOperator() {
        require(msg.sender == operator || msg.sender == owner, "Only operator");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        operator = msg.sender;
    }
    
    /**
     * @dev 운영자 주소 변경
     * @param newOperator 새 운영자 주소
     */
    function setOperator(address newOperator) external onlyOwner {
        require(newOperator != address(0), "Invalid address");
        operator = newOperator;
    }
    
    /**
     * @dev 유저 활동 기록
     * @param user 실제 유저 지갑 주소
     * @param activityType 활동 타입 해시 (ACTIVITY_* 상수 사용)
     * @param referenceHash 참조 데이터 해시 (선택적)
     */
    function recordActivity(
        address user,
        bytes32 activityType,
        bytes32 referenceHash
    ) external onlyOperator {
        require(user != address(0), "Invalid user");
        require(activityType != bytes32(0), "Activity type required");
        
        totalActivities++;
        
        emit UserActivity(user, activityType, referenceHash, block.timestamp);
    }
    
    /**
     * @dev 배치 활동 기록 (여러 유저 한번에)
     * @param users 유저 주소 배열
     * @param activityType 활동 타입 (모두 동일)
     * @param referenceHash 참조 해시 (모두 동일)
     */
    function recordBatchActivities(
        address[] calldata users,
        bytes32 activityType,
        bytes32 referenceHash
    ) external onlyOperator {
        require(activityType != bytes32(0), "Activity type required");
        
        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] != address(0)) {
                totalActivities++;
                emit UserActivity(users[i], activityType, referenceHash, block.timestamp);
            }
        }
    }
    
    /**
     * @dev 일일 통계 기록 (선택적 사용)
     * @param date YYYYMMDD 형식의 날짜
     * @param dailyActivities 해당일 총 활동 수
     * @param uniqueUsers 해당일 고유 유저 수
     */
    function recordDailyStats(
        uint256 date,
        uint256 dailyActivities,
        uint256 uniqueUsers
    ) external onlyOperator {
        emit DailyStats(date, dailyActivities, uniqueUsers);
    }
    
    /**
     * @dev 소유권 이전
     * @param newOwner 새 소유자 주소
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
    
    /**
     * @dev 헬퍼: 문자열을 bytes32 해시로 변환
     * @param str 원본 문자열
     * @return bytes32 해시값
     */
    function hashString(string calldata str) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(str));
    }
}
