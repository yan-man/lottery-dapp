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
  uint256 prizeAmount;
  uint256 lotteryId = 0;
  address[] public participants;
  mapping(uint256 => address[]) public historicalParticipants;
  mapping(uint256 => LotteryStruct) public lotteries;

  // Events
  event NewLottery(address creator);

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
    uint256 start = block.timestamp;
    LotteryStruct memory lottery = LotteryStruct({
      dateStart: start,
      dateEnd: start.add(1 weeks),
      isActive: true
    });
    lotteries[lotteryId] = lottery;
    emit NewLottery(msg.sender);
  }a

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
