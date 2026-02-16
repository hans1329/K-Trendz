// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title KTrendzVoteV2
 * @dev K-Trendz 플랫폼의 투표 기록을 온체인에 저장하는 컨트랙트 (Paymaster 호환 버전)
 * - string 파라미터 대신 bytes32 해시를 사용하여 Coinbase Paymaster 호환성 확보
 * - Base 재단에 활동 증명을 위한 이벤트 로그 생성
 */
contract KTrendzVoteV2 {
    address public owner;
    address public operator;
    
    // 총 투표 수 카운터
    uint256 public totalVotes;
    
    // 투표 이벤트 - Base 재단 증명용 (bytes32 해시 버전)
    event Vote(
        address indexed voter,      // 투표자 지갑 주소
        bytes32 indexed artistHash, // 아티스트명 해시 (keccak256)
        bytes32 inviteCodeHash,     // 초대코드 해시 (keccak256)
        uint256 voteCount,          // 이번 투표 수
        uint256 timestamp           // 투표 시간
    );
    
    // 일일 집계 이벤트 (선택적 사용)
    event DailyStats(
        uint256 indexed date,       // YYYYMMDD 형식
        uint256 totalVotes,         // 해당일 총 투표 수
        uint256 uniqueVoters        // 해당일 고유 투표자 수
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
     * @dev 투표 기록 - 플랫폼 백엔드에서 호출 (Paymaster 호환 버전)
     * @param voter 투표자 지갑 주소
     * @param artistHash 아티스트명 해시 (keccak256(abi.encodePacked(artistName)))
     * @param inviteCodeHash 초대코드 해시 (없으면 bytes32(0))
     * @param voteCount 투표 수
     */
    function vote(
        address voter,
        bytes32 artistHash,
        bytes32 inviteCodeHash,
        uint256 voteCount
    ) external onlyOperator {
        require(voter != address(0), "Invalid voter");
        require(artistHash != bytes32(0), "Artist hash required");
        require(voteCount > 0, "Vote count must be positive");
        
        totalVotes += voteCount;
        
        emit Vote(voter, artistHash, inviteCodeHash, voteCount, block.timestamp);
    }
    
    /**
     * @dev 일일 통계 기록 (선택적 사용)
     * @param date YYYYMMDD 형식의 날짜
     * @param dailyVotes 해당일 총 투표 수
     * @param uniqueVoters 해당일 고유 투표자 수
     */
    function recordDailyStats(
        uint256 date,
        uint256 dailyVotes,
        uint256 uniqueVoters
    ) external onlyOperator {
        emit DailyStats(date, dailyVotes, uniqueVoters);
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
     * @dev 헬퍼: 문자열을 bytes32 해시로 변환 (오프체인에서도 동일하게 계산 가능)
     * @param str 원본 문자열
     * @return bytes32 해시값
     */
    function hashString(string calldata str) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(str));
    }
}
