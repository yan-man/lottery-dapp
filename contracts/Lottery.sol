//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

// load other contracts
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract Lottery is Ownable {
  using SafeMath for uint256;

  // State Variables
  struct LotteryStruct {
    uint256 startTime;
    uint256 endTime;
    bool isActive;
  }
  struct TicketStruct {
    address playerAddress;
    uint256 startIndex; // inclusive
    uint256 endIndex; // inclusive
  }
  // V1 - only allow 1 ACTIVE lottery at a time
  // save as many as you want; only 1 active at a time
  // don't need to explicitly record history, already on BC
  uint256 public constant MIN_DRAWING_INCREMENT = 100000000000000; //0.0001 ETH; min eth amount to enter lottery
  uint256 public constant NUMBER_OF_DAYS = 7;

  uint256 public maxPlayersAllowed = 1000;
  uint256 public currentLotteryId = 0;
  uint256 public prizeAmount; // key is lotteryId

  TicketStruct[] public ticketDistribution;
  address[] public listOfPlayers;

  uint256 numActivePlayers;
  uint256 totalNumTickets;
  uint256 winningTicketIndex;

  mapping(address => bool) public players;
  mapping(address => uint256) tickets;
  mapping(uint256 => LotteryStruct) public lotteries; // key is lotteryId
  mapping(uint256 => mapping(address => uint256)) public pendingWithdrawals; // pending withdrawals for each winner, key is lotteryId

  // modifiers
  // check lotto valid - is given start date >= prev end date?
  modifier isNewLotteryValid(uint256 startTime) {
    // active lottery
    LotteryStruct memory lottery = lotteries[currentLotteryId];
    require(
      lottery.isActive == false,
      "current lottery must be inactive to save a new one"
    );
    // if there is an existing lottery, the current time must be after end date of previous one
    if (currentLotteryId > 0) {
      require(
        startTime >= lottery.endTime,
        "if there is a previous lottery, new start date must be after prev one has ended"
      );
    }
    _;
  }
  modifier isLotteryMintingOpen() {
    LotteryStruct memory lottery = lotteries[currentLotteryId];
    require(
      lottery.isActive == true &&
        lottery.endTime > block.timestamp &&
        lottery.startTime <= block.timestamp,
      "current lottery must be active; current time must be within lottery time frame"
    );
    _;
  }
  modifier isNewPlayerValid() {
    // time is within start/end dates
    // amount sent is > floor amt
    require(
      msg.value >= MIN_DRAWING_INCREMENT,
      "msg value must be greater than min amount allowed"
    );
    _;
  }

  // Events
  event NewLottery(address creator, uint256 startTime, uint256 endTime); // emit when lottery created

  // emit when user added
  event ticketsMinted(address player, uint256 numTicketsMinted);
  // emit when lottery drawing happens; winner found
  event triggerLottery(uint256 lotteryId, uint256 _winningTicketIndex);
  // emit when funds withdrawn
  event withdrawalMade(address winner, uint256 lotteryId);
  event maxPlayersAllowedUpdated(uint256 maxPlayersAllowed);

  /**
   * Contract initialization.
   */
  constructor() {}

  function setMaxPlayersAllowed(uint256 _maxPlayersAllowed) external onlyOwner {
    maxPlayersAllowed = _maxPlayersAllowed;
    emit maxPlayersAllowedUpdated(maxPlayersAllowed);
  }

  /**
   * A function to initialize a lottery
   - check valid
   * - save new lottery
   can save any amount of lotteries, but the dates can't overlap; 
   start date must start after prev end date 
   * 
   */
  function initLottery(uint256 startTime, uint256 numDays)
    external
    isNewLotteryValid(startTime)
  {
    console.log("initLottery");
    /**
     - calculate end date
     - save new lottery
     - emit event
     */
    // basically default value
    // if set to 0, default to explicit default number of days
    if (numDays == 0) {
      numDays = NUMBER_OF_DAYS;
    }
    uint256 endTime = startTime.add(numDays * 1 days);
    lotteries[currentLotteryId] = LotteryStruct({
      startTime: startTime,
      endTime: endTime,
      isActive: true
    });
    emit NewLottery(msg.sender, startTime, endTime);
  }

  /**
   * A function to get info on a specific lottery
   *
   *
   */
  function getLottery(uint256 lotteryId)
    external
    view
    returns (
      uint256 startTime,
      uint256 endTime,
      bool isActive
    )
  {
    console.log("getLottery");
    LotteryStruct memory lottery = lotteries[lotteryId];
    return (lottery.startTime, lottery.endTime, lottery.isActive);
  }

  /**
   * a function for users to enter lottery drawing
   * - check user valid 
   modifier to check funds reach min threshold
   *
   */
  function mintLotteryTickets() public payable isNewPlayerValid {
    console.log("mintLotteryTickets");
    /**
   * - must be within time period, between start/end dates
       - user can submit multiple independent entries; ie buy different "tickets"
       - calculate how many lottery tickets user has gotten
       -transfer funds into account
       - update prize amt
   *
   */
    uint256 numTicketsToMint = msg.value.div(MIN_DRAWING_INCREMENT);
    require(numTicketsToMint >= 1); // double check that user put in at least enough for 1 ticket
    // if player is "new" for current lottery
    if (players[msg.sender] == false) {
      require(numActivePlayers.add(1) <= maxPlayersAllowed); // capped max # of players
      listOfPlayers[numActivePlayers] = msg.sender; // set based on index for when lottery is reset - overwrite array instead of delete to save gas
      players[msg.sender] = true;
      numActivePlayers = numActivePlayers.add(1);
    }
    tickets[msg.sender] = tickets[msg.sender].add(numTicketsToMint); // add existing, init 0
    prizeAmount = prizeAmount.add(msg.value);
    emit ticketsMinted(msg.sender, numTicketsToMint);
  }

  /**
   * a function for users to trigger lottery drawing
   *  - modifier - check that lottery end date reached
   */
  function triggerLotteryDrawing() public {
    console.log("getLottery");
    /*
    - calculate each player's odds
    - trigger lottery drawing with random numbers
    - transfer funds into account    
    - designateWinner
    - increment lotto id X
    - reset players/lotto vals in state
    */

    playerTicketDistribution();
    uint256 _winningTicketIndex = performRandomizedDrawing();
    address winningAddress = findWinningAddress(_winningTicketIndex);
    designateWinnerAndDepositePrize(winningAddress);
    resetLottery();

    emit triggerLottery(currentLotteryId, _winningTicketIndex);
  }

  /**
   * calculateOdds for each player in current lottery
   update state var for player odds 
   */
  function playerTicketDistribution() private {
    console.log("playerTicketDistribution");

    /**
    Each block of MIN_DRAWING represents one lottery ticket
    for each address, find how many lottery tickets exist
    create the award mapping
    - each address => [starting index, ending index]
    - goes from 0 to total length (ie # of lottery tickets)
    - saves the variable for total # lottery tickets

    return the total # of lottery tickets
   */

    uint256 ticketIndex = 0;
    // loop over player addresses
    for (uint256 i = ticketIndex; i < numActivePlayers; i++) {
      // create this distribution at the very end so that it isn't store long term on BC
      // if you do it in the moment, if a user adds some eth, then more eth in separate tranches
      // you have to track index -> user instead of user -> index, much less efficient
      // ie need an array of length numTickets instead of just length numPlayers
      address playerAddress = listOfPlayers[i];
      uint256 numTickets = tickets[playerAddress];
      ticketDistribution[i] = TicketStruct({
        playerAddress: playerAddress,
        startIndex: ticketIndex,
        endIndex: ticketIndex.add(numTickets).sub(1) // sub 1 to account for array indices starting from 0
      });
      tickets[playerAddress] = 0; // reset player's tickets to 0 after they've been counted
      ticketIndex = ticketIndex.add(numTickets);
      totalNumTickets = totalNumTickets.add(numTickets);
    }
  }

  /**
   * designate winner of a lottery
   * private internal function, only called during lottery triggered
   */
  function performRandomizedDrawing() private view returns (uint256) {
    console.log("performRandomizedDrawing");
    /**
   * take total # tickets
    generate random number between 0, # lottery tickets

    return thta number (ie winning index)
    call https://docs.chain.link/docs/chainlink-vrf/example-contracts/ to get random 
    https://docs.chain.link/docs/chainlink-vrf-best-practices/
   */

    // need random drawing from 0 to totalNumTickets
    uint256 randomTicketIndex = totalNumTickets.mul(3).div(4).sub(1); // placeholder for now. Generate true random number later
    return randomTicketIndex;
  }

  /**
   * designate winner of a lottery
   search for winning address
   * private internal function, only called during lottery triggered
   */
  function findWinningAddress(uint256 _winningTicketIndex)
    private
    returns (address winningAddress)
  {
    console.log("getLottery");
    /*
    - based on given winning index id:
    - set _winningTicketIndex state
    - search for  which user has won
    - 
    */
    winningTicketIndex = _winningTicketIndex;
    winningAddress = address(0);
    // do binary search on ticketDistribution array to find winner
    bool isWinnerFound = false;
    uint256 searchIndex = totalNumTickets.div(2);
    while (!isWinnerFound) {
      if (
        ticketDistribution[searchIndex].startIndex <= winningTicketIndex &&
        ticketDistribution[searchIndex].endIndex >= winningTicketIndex
      ) {
        isWinnerFound = true;
        winningAddress = ticketDistribution[searchIndex].playerAddress;
      } else if (
        ticketDistribution[searchIndex].startIndex > winningTicketIndex
      ) {
        // bottom half
        searchIndex = searchIndex.div(2);
      } else if (
        ticketDistribution[searchIndex].endIndex < winningTicketIndex
      ) {
        searchIndex = searchIndex.mul(2);
      }
    }
    return winningAddress;
  }

  /**
   *
   */
  function designateWinnerAndDepositePrize(address winningAddress) private {
    console.log("designateWinnerAndDepositePrize");
    /*
    - send funds to user
    - update pending withdrawals for user address
    - set prize to zero
    */
    pendingWithdrawals[currentLotteryId][winningAddress] = prizeAmount;
    prizeAmount = 0;
  }

  /**
   * designate winner of a lottery
   * private internal function, only called during lottery triggered
   */
  function resetLottery() private {
    console.log("getLottery");
    /*
    - reset winningTicketIndex
    - players delete
    - ticketDistribution delete
  mapping(address => uint256) tickets;
    - 
    */

    // keep running total of num tickets and players to reset so that gas is saved vs deleting arrays
    // ie overwrite arrays instead of deleting
    winningTicketIndex = 0;
    totalNumTickets = 0;
    numActivePlayers = 0;
    lotteries[currentLotteryId].isActive = false;
    currentLotteryId = currentLotteryId.add(1);
  }

  /**
   * allow winner to withdraw prize
   - check winner is calling this
   */
  function withdraw(uint256 lotteryId) external payable {
    console.log("withdraw");
    /*
    - send funds to user
    - update pending withdrawals var
    */

    require(pendingWithdrawals[lotteryId][msg.sender] > 0);
    uint256 withdrawalAmount = pendingWithdrawals[lotteryId][msg.sender];
    pendingWithdrawals[lotteryId][msg.sender] = 0;
    payable(msg.sender).transfer(withdrawalAmount);
    emit withdrawalMade(msg.sender, withdrawalAmount);
  }
}
