//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

// load other contracts
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "hardhat/console.sol";

contract Lottery is Ownable {
  using SafeMath for uint256;

  // Variables
  struct LotteryStruct {
    uint256 dateStart;
    uint256 dateEnd;
    bool isActive;
  }
  uint256 public prizeAmount;
  uint256 public currentLotteryId = 0;
  address[] public participants;
  mapping(uint256 => address[]) public historicalParticipants;
  mapping(uint256 => LotteryStruct) public lotteries;

  // Events
  event NewLottery(address creator, uint256 start, uint256 end);

  /**
   * Contract initialization.
   */
  constructor() {}

  /**
   * A function to transfer tokens.
   *
   *
   */
  function initLottery() external {
    console.log("initLottery");
    uint256 dateStart = block.timestamp;
    uint256 dateEnd = dateStart.add(1 weeks);

    currentLotteryId = currentLotteryId.add(1);
    lotteries[currentLotteryId] = LotteryStruct({
      dateStart: dateStart,
      dateEnd: dateEnd,
      isActive: true
    });

    emit NewLottery(msg.sender, dateStart, dateEnd);
  }

  /**
   * A function to transfer tokens.
   *
   *
   */
  function getLottery(uint256 lotteryId)
    public
    view
    returns (
      uint256 dateStart,
      uint256 dateEnd,
      bool isActive
    )
  {
    console.log("getLottery");
    LotteryStruct memory lottery = lotteries[lotteryId];
    return (lottery.dateStart, lottery.dateEnd, lottery.isActive);
  }

  /**
   * A function to transfer tokens.
   *
   *
   */
  function initLotteryWithSettings(
    // uint256 dateStart,
    // uint256 dateEnd,
    bool isActive
  ) external {
    // console.log("initLottery");
    // LotteryStruct storage lottery = LotteryStruct({
    //   dateStart: dateStart,
    //   dateEnd: dateEnd,
    //   isActive: isActive
    // });
    // lotteries[lotteryId] = lottery;
    // emit NewLottery(msg.sender);
  }
}
