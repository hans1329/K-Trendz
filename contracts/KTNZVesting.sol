// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title KTNZVesting
 * @dev KTNZ 토큰 베스팅 컨트랙트 - Cliff + Linear 방식
 * 
 * 베스팅 스케줄:
 * - Cliff 기간: 토큰이 잠금 상태로 유지됨
 * - Linear 기간: Cliff 이후 선형적으로 언락
 * 
 * 예시: 12개월 Cliff + 24개월 Linear
 * - 0-12개월: 클레임 불가 (Cliff)
 * - 12-36개월: 매월 1/24씩 언락
 */
contract KTNZVesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable ktnzToken;

    struct VestingSchedule {
        address beneficiary;        // 수혜자 지갑 주소
        uint256 totalAmount;        // 총 베스팅 토큰 수량
        uint256 claimedAmount;      // 이미 클레임한 수량
        uint256 startTime;          // 베스팅 시작 시간
        uint256 cliffDuration;      // Cliff 기간 (초)
        uint256 vestingDuration;    // Linear 베스팅 기간 (초)
        bool revoked;               // 취소 여부
    }

    // 베스팅 스케줄 ID => 스케줄 정보
    mapping(uint256 => VestingSchedule) public vestingSchedules;
    
    // 수혜자 주소 => 베스팅 스케줄 ID 배열
    mapping(address => uint256[]) public beneficiarySchedules;
    
    // 다음 스케줄 ID
    uint256 public nextScheduleId;

    // 이벤트
    event VestingScheduleCreated(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint256 totalAmount,
        uint256 startTime,
        uint256 cliffDuration,
        uint256 vestingDuration
    );
    
    event TokensClaimed(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint256 amount
    );
    
    event VestingRevoked(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint256 refundAmount
    );

    constructor(address _ktnzToken) Ownable(msg.sender) {
        require(_ktnzToken != address(0), "Invalid token address");
        ktnzToken = IERC20(_ktnzToken);
    }

    /**
     * @dev 새로운 베스팅 스케줄 생성
     * @param _beneficiary 수혜자 지갑 주소
     * @param _totalAmount 총 베스팅 토큰 수량
     * @param _startTime 베스팅 시작 시간 (Unix timestamp)
     * @param _cliffDuration Cliff 기간 (초)
     * @param _vestingDuration Linear 베스팅 기간 (초)
     */
    function createVestingSchedule(
        address _beneficiary,
        uint256 _totalAmount,
        uint256 _startTime,
        uint256 _cliffDuration,
        uint256 _vestingDuration
    ) external onlyOwner returns (uint256 scheduleId) {
        require(_beneficiary != address(0), "Invalid beneficiary");
        require(_totalAmount > 0, "Amount must be > 0");
        require(_vestingDuration > 0, "Vesting duration must be > 0");
        require(_startTime >= block.timestamp, "Start time must be in future");

        // 토큰 전송 (컨트랙트로)
        ktnzToken.safeTransferFrom(msg.sender, address(this), _totalAmount);

        scheduleId = nextScheduleId++;

        vestingSchedules[scheduleId] = VestingSchedule({
            beneficiary: _beneficiary,
            totalAmount: _totalAmount,
            claimedAmount: 0,
            startTime: _startTime,
            cliffDuration: _cliffDuration,
            vestingDuration: _vestingDuration,
            revoked: false
        });

        beneficiarySchedules[_beneficiary].push(scheduleId);

        emit VestingScheduleCreated(
            scheduleId,
            _beneficiary,
            _totalAmount,
            _startTime,
            _cliffDuration,
            _vestingDuration
        );
    }

    /**
     * @dev 현재 클레임 가능한 토큰 수량 계산
     * @param _scheduleId 베스팅 스케줄 ID
     */
    function getClaimableAmount(uint256 _scheduleId) public view returns (uint256) {
        VestingSchedule storage schedule = vestingSchedules[_scheduleId];
        
        if (schedule.revoked) {
            return 0;
        }

        uint256 vestedAmount = _calculateVestedAmount(schedule);
        return vestedAmount - schedule.claimedAmount;
    }

    /**
     * @dev 베스팅된 총 토큰 수량 계산 (내부 함수)
     */
    function _calculateVestedAmount(VestingSchedule storage schedule) internal view returns (uint256) {
        if (block.timestamp < schedule.startTime) {
            return 0;
        }

        uint256 cliffEndTime = schedule.startTime + schedule.cliffDuration;
        
        // Cliff 기간 중이면 0
        if (block.timestamp < cliffEndTime) {
            return 0;
        }

        uint256 vestingEndTime = cliffEndTime + schedule.vestingDuration;

        // 베스팅 완료되었으면 전체 수량
        if (block.timestamp >= vestingEndTime) {
            return schedule.totalAmount;
        }

        // Linear 베스팅 계산
        uint256 timeElapsed = block.timestamp - cliffEndTime;
        uint256 vestedAmount = (schedule.totalAmount * timeElapsed) / schedule.vestingDuration;
        
        return vestedAmount;
    }

    /**
     * @dev 토큰 클레임
     * @param _scheduleId 베스팅 스케줄 ID
     */
    function claim(uint256 _scheduleId) external nonReentrant {
        VestingSchedule storage schedule = vestingSchedules[_scheduleId];
        
        require(schedule.beneficiary == msg.sender, "Not beneficiary");
        require(!schedule.revoked, "Schedule revoked");

        uint256 claimableAmount = getClaimableAmount(_scheduleId);
        require(claimableAmount > 0, "Nothing to claim");

        schedule.claimedAmount += claimableAmount;

        ktnzToken.safeTransfer(msg.sender, claimableAmount);

        emit TokensClaimed(_scheduleId, msg.sender, claimableAmount);
    }

    /**
     * @dev 베스팅 취소 (미베스팅 토큰 회수)
     * @param _scheduleId 베스팅 스케줄 ID
     */
    function revokeVesting(uint256 _scheduleId) external onlyOwner {
        VestingSchedule storage schedule = vestingSchedules[_scheduleId];
        
        require(!schedule.revoked, "Already revoked");

        // 현재까지 베스팅된 수량은 수혜자에게 전송
        uint256 vestedAmount = _calculateVestedAmount(schedule);
        uint256 unclaimedVested = vestedAmount - schedule.claimedAmount;
        
        if (unclaimedVested > 0) {
            schedule.claimedAmount = vestedAmount;
            ktnzToken.safeTransfer(schedule.beneficiary, unclaimedVested);
        }

        // 미베스팅 토큰 회수
        uint256 refundAmount = schedule.totalAmount - vestedAmount;
        if (refundAmount > 0) {
            ktnzToken.safeTransfer(owner(), refundAmount);
        }

        schedule.revoked = true;

        emit VestingRevoked(_scheduleId, schedule.beneficiary, refundAmount);
    }

    /**
     * @dev 특정 수혜자의 모든 베스팅 스케줄 ID 조회
     */
    function getBeneficiarySchedules(address _beneficiary) external view returns (uint256[] memory) {
        return beneficiarySchedules[_beneficiary];
    }

    /**
     * @dev 베스팅 스케줄 상세 정보 조회
     */
    function getVestingScheduleInfo(uint256 _scheduleId) external view returns (
        address beneficiary,
        uint256 totalAmount,
        uint256 claimedAmount,
        uint256 claimableAmount,
        uint256 startTime,
        uint256 cliffEndTime,
        uint256 vestingEndTime,
        bool revoked
    ) {
        VestingSchedule storage schedule = vestingSchedules[_scheduleId];
        
        return (
            schedule.beneficiary,
            schedule.totalAmount,
            schedule.claimedAmount,
            getClaimableAmount(_scheduleId),
            schedule.startTime,
            schedule.startTime + schedule.cliffDuration,
            schedule.startTime + schedule.cliffDuration + schedule.vestingDuration,
            schedule.revoked
        );
    }
}
