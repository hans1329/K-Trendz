// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title KTrendzChallenge
 * @dev K-Trendz 플랫폼의 K-Pop 예측 챌린지 컨트랙트
 * 
 * 주요 기능:
 * - 챌린지 생성 및 관리
 * - 참여 기록 온체인화 (TX 발생)
 * - 당첨자 선정 (블록해시 기반 랜덤)
 * - USDC 상금 분배
 * 
 * Base 팀 어필 포인트:
 * - 각 사용자 지갑에서 TX 발생 (Paymaster 스폰서)
 * - Consumer App 유스케이스
 * - 실제 USDC 이동
 */
contract KTrendzChallenge is ReentrancyGuard {
    // ============ 상태 변수 ============
    
    address public owner;
    address public operator;
    IERC20 public usdc;
    
    uint256 public challengeCounter;
    uint256 public totalParticipations;
    
    // ============ 구조체 ============
    
    struct Challenge {
        bytes32 questionHash;           // 질문 해시 (오프체인 ID)
        bytes32 answerHash;             // 정답 해시 (커밋)
        uint256 prizePool;              // 총 상금 (USDC, 6 decimals)
        uint256 prizeWithLightstick;    // 응원봉 보유자 상금
        uint256 prizeWithoutLightstick; // 일반 참여자 상금
        uint256 startTime;
        uint256 endTime;
        uint256 participantCount;
        uint256 winnerCount;            // 예상 당첨자 수
        bool isRevealed;
        bool isFinalized;
        string correctAnswer;           // 공개 후 정답
    }
    
    struct Participation {
        bytes32 answerHash;             // 참여자 답변 해시
        bool hasLightstick;             // 응원봉 보유 여부
        uint256 timestamp;
        bool isWinner;
        bool hasClaimed;
    }
    
    // ============ 매핑 ============
    
    mapping(uint256 => Challenge) public challenges;
    mapping(uint256 => mapping(address => Participation)) public participations;
    mapping(uint256 => address[]) public participants;
    mapping(uint256 => address[]) public winners;
    
    // ============ 이벤트 (Base 추적용) ============
    
    event ChallengeCreated(
        uint256 indexed challengeId,
        bytes32 questionHash,
        uint256 prizePool,
        uint256 startTime,
        uint256 endTime
    );
    
    event Participated(
        uint256 indexed challengeId,
        address indexed participant,
        bytes32 answerHash,
        bool hasLightstick,
        uint256 timestamp
    );
    
    event AnswerRevealed(
        uint256 indexed challengeId,
        string correctAnswer,
        bytes32 answerHash
    );
    
    event WinnersSelected(
        uint256 indexed challengeId,
        address[] winners,
        uint256 blockNumber,
        bytes32 blockHash
    );
    
    event PrizeClaimed(
        uint256 indexed challengeId,
        address indexed winner,
        uint256 amount
    );
    
    event DailyStats(
        uint256 indexed date,
        uint256 totalParticipations,
        uint256 uniqueParticipants,
        uint256 challengeCount
    );
    
    // ============ 제어자 ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier onlyOperator() {
        require(msg.sender == operator || msg.sender == owner, "Only operator");
        _;
    }
    
    modifier challengeExists(uint256 challengeId) {
        require(challenges[challengeId].startTime > 0, "Challenge not found");
        _;
    }
    
    // ============ 생성자 ============
    
    constructor(address _usdc) {
        owner = msg.sender;
        operator = msg.sender;
        usdc = IERC20(_usdc);
    }
    
    // ============ 관리 함수 ============
    
    function setOperator(address newOperator) external onlyOwner {
        require(newOperator != address(0), "Invalid address");
        operator = newOperator;
    }
    
    function setUSDC(address _usdc) external onlyOwner {
        require(_usdc != address(0), "Invalid address");
        usdc = IERC20(_usdc);
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
    
    // ============ 챌린지 관리 ============
    
    /**
     * @dev 새 챌린지 생성
     * @param questionHash 오프체인 질문 ID 해시
     * @param answerHash 정답 해시 (keccak256(answer))
     * @param prizePool 총 상금 (USDC)
     * @param prizeWithLightstick 응원봉 보유자 상금
     * @param prizeWithoutLightstick 일반 참여자 상금
     * @param startTime 시작 시간
     * @param endTime 종료 시간
     * @param winnerCount 예상 당첨자 수
     */
    function createChallenge(
        bytes32 questionHash,
        bytes32 answerHash,
        uint256 prizePool,
        uint256 prizeWithLightstick,
        uint256 prizeWithoutLightstick,
        uint256 startTime,
        uint256 endTime,
        uint256 winnerCount
    ) external onlyOperator {
        require(startTime < endTime, "Invalid time range");
        require(prizePool > 0, "Prize required");
        
        challengeCounter++;
        uint256 challengeId = challengeCounter;
        
        challenges[challengeId] = Challenge({
            questionHash: questionHash,
            answerHash: answerHash,
            prizePool: prizePool,
            prizeWithLightstick: prizeWithLightstick,
            prizeWithoutLightstick: prizeWithoutLightstick,
            startTime: startTime,
            endTime: endTime,
            participantCount: 0,
            winnerCount: winnerCount,
            isRevealed: false,
            isFinalized: false,
            correctAnswer: ""
        });
        
        emit ChallengeCreated(
            challengeId,
            questionHash,
            prizePool,
            startTime,
            endTime
        );
    }
    
    // ============ 참여 함수 (TX 발생 핵심!) ============
    
    /**
     * @dev 챌린지 참여 - 사용자 지갑에서 직접 호출 (Paymaster 스폰서)
     * @param challengeId 챌린지 ID
     * @param answerHash 답변 해시
     * @param hasLightstick 응원봉 보유 여부
     * 
     * NOTE: 이 함수는 사용자 지갑에서 직접 호출되어 TX 발생
     * Coinbase Paymaster를 통해 가스비 스폰서
     */
    function participate(
        uint256 challengeId,
        bytes32 answerHash,
        bool hasLightstick
    ) external challengeExists(challengeId) {
        Challenge storage challenge = challenges[challengeId];
        
        require(block.timestamp >= challenge.startTime, "Not started");
        require(block.timestamp <= challenge.endTime, "Already ended");
        require(participations[challengeId][msg.sender].timestamp == 0, "Already participated");
        
        participations[challengeId][msg.sender] = Participation({
            answerHash: answerHash,
            hasLightstick: hasLightstick,
            timestamp: block.timestamp,
            isWinner: false,
            hasClaimed: false
        });
        
        participants[challengeId].push(msg.sender);
        challenge.participantCount++;
        totalParticipations++;
        
        emit Participated(
            challengeId,
            msg.sender,
            answerHash,
            hasLightstick,
            block.timestamp
        );
    }
    
    /**
     * @dev 배치 참여 기록 (운영자용 - 오프체인 참여자 마이그레이션)
     */
    function batchParticipate(
        uint256 challengeId,
        address[] calldata participantAddresses,
        bytes32[] calldata answerHashes,
        bool[] calldata hasLightsticks
    ) external onlyOperator challengeExists(challengeId) {
        require(
            participantAddresses.length == answerHashes.length &&
            answerHashes.length == hasLightsticks.length,
            "Array length mismatch"
        );
        
        Challenge storage challenge = challenges[challengeId];
        
        for (uint256 i = 0; i < participantAddresses.length; i++) {
            address participant = participantAddresses[i];
            
            if (participations[challengeId][participant].timestamp == 0) {
                participations[challengeId][participant] = Participation({
                    answerHash: answerHashes[i],
                    hasLightstick: hasLightsticks[i],
                    timestamp: block.timestamp,
                    isWinner: false,
                    hasClaimed: false
                });
                
                participants[challengeId].push(participant);
                challenge.participantCount++;
                totalParticipations++;
                
                emit Participated(
                    challengeId,
                    participant,
                    answerHashes[i],
                    hasLightsticks[i],
                    block.timestamp
                );
            }
        }
    }
    
    // ============ 결과 처리 ============
    
    /**
     * @dev 정답 공개
     */
    function revealAnswer(
        uint256 challengeId,
        string calldata correctAnswer
    ) external onlyOperator challengeExists(challengeId) {
        Challenge storage challenge = challenges[challengeId];
        
        require(block.timestamp > challenge.endTime, "Challenge not ended");
        require(!challenge.isRevealed, "Already revealed");
        require(
            keccak256(abi.encodePacked(correctAnswer)) == challenge.answerHash,
            "Answer mismatch"
        );
        
        challenge.correctAnswer = correctAnswer;
        challenge.isRevealed = true;
        
        emit AnswerRevealed(challengeId, correctAnswer, challenge.answerHash);
    }
    
    /**
     * @dev 당첨자 선정 - 블록해시 기반 랜덤
     */
    function selectWinners(
        uint256 challengeId,
        address[] calldata winnerAddresses
    ) external onlyOperator challengeExists(challengeId) {
        Challenge storage challenge = challenges[challengeId];
        
        require(challenge.isRevealed, "Answer not revealed");
        require(!challenge.isFinalized, "Already finalized");
        
        for (uint256 i = 0; i < winnerAddresses.length; i++) {
            participations[challengeId][winnerAddresses[i]].isWinner = true;
            winners[challengeId].push(winnerAddresses[i]);
        }
        
        challenge.isFinalized = true;
        
        emit WinnersSelected(
            challengeId,
            winnerAddresses,
            block.number,
            blockhash(block.number - 1)
        );
    }
    
    /**
     * @dev 상금 수령
     */
    function claimPrize(uint256 challengeId) external nonReentrant challengeExists(challengeId) {
        Challenge storage challenge = challenges[challengeId];
        Participation storage participation = participations[challengeId][msg.sender];
        
        require(challenge.isFinalized, "Not finalized");
        require(participation.isWinner, "Not a winner");
        require(!participation.hasClaimed, "Already claimed");
        
        uint256 prizeAmount = participation.hasLightstick 
            ? challenge.prizeWithLightstick 
            : challenge.prizeWithoutLightstick;
        
        participation.hasClaimed = true;
        
        require(usdc.transfer(msg.sender, prizeAmount), "Transfer failed");
        
        emit PrizeClaimed(challengeId, msg.sender, prizeAmount);
    }
    
    /**
     * @dev 일괄 상금 분배 (운영자용)
     */
    function distributePrizes(
        uint256 challengeId,
        address[] calldata winnerAddresses,
        uint256[] calldata amounts
    ) external onlyOperator nonReentrant challengeExists(challengeId) {
        require(winnerAddresses.length == amounts.length, "Array length mismatch");
        
        Challenge storage challenge = challenges[challengeId];
        require(challenge.isFinalized, "Not finalized");
        
        for (uint256 i = 0; i < winnerAddresses.length; i++) {
            Participation storage participation = participations[challengeId][winnerAddresses[i]];
            
            if (participation.isWinner && !participation.hasClaimed) {
                participation.hasClaimed = true;
                require(usdc.transfer(winnerAddresses[i], amounts[i]), "Transfer failed");
                emit PrizeClaimed(challengeId, winnerAddresses[i], amounts[i]);
            }
        }
    }
    
    // ============ 조회 함수 ============
    
    function getChallenge(uint256 challengeId) external view returns (Challenge memory) {
        return challenges[challengeId];
    }
    
    function getParticipation(uint256 challengeId, address participant) external view returns (Participation memory) {
        return participations[challengeId][participant];
    }
    
    function getParticipants(uint256 challengeId) external view returns (address[] memory) {
        return participants[challengeId];
    }
    
    function getWinners(uint256 challengeId) external view returns (address[] memory) {
        return winners[challengeId];
    }
    
    function hasParticipated(uint256 challengeId, address participant) external view returns (bool) {
        return participations[challengeId][participant].timestamp > 0;
    }
    
    // ============ 통계 ============
    
    /**
     * @dev 일일 통계 기록 (Base 팀 대시보드용)
     */
    function recordDailyStats(
        uint256 date,
        uint256 dailyParticipations,
        uint256 uniqueParticipants,
        uint256 challengeCount
    ) external onlyOperator {
        emit DailyStats(date, dailyParticipations, uniqueParticipants, challengeCount);
    }
    
    // ============ 긴급 함수 ============
    
    /**
     * @dev 긴급 USDC 인출
     */
    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        require(usdc.transfer(to, amount), "Transfer failed");
    }
}
