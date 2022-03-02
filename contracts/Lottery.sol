//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

// load other contracts
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract Lottery is Ownable {
  using SafeMath for uint256;
  using Math for uint256;

  // State Variables
  struct LotteryStruct {
    uint256 lotteryId;
    uint256 startTime;
    uint256 endTime;
    bool isActive;
    bool isCompleted;
  }
  struct TicketDistributionStruct {
    address playerAddress;
    uint256 startIndex; // inclusive
    uint256 endIndex; // inclusive
  }
  struct WinningTicketStruct {
    uint256 winningTicketIndex;
    address addr;
  }
  // V1 - only allow 1 ACTIVE lottery at a time
  // save as many as you want; only 1 active at a time
  // don't need to explicitly record history, already on BC
  uint256 public constant MIN_DRAWING_INCREMENT = 100000000000000; //0.0001 ETH; min eth amount to enter lottery
  uint256 public constant NUMBER_OF_HOURS = 168; // 1 week by default
  uint256 public maxLoops = 10;

  uint256 public maxPlayersAllowed = 1000;
  uint256 public currentLotteryId = 0;
  uint256 public numLotteries = 0;
  uint256 public prizeAmount; // key is lotteryId

  WinningTicketStruct public winningTicket;
  TicketDistributionStruct[] public ticketDistribution;
  address[] public listOfPlayers;

  uint256 public numActivePlayers;
  uint256 public numTotalTickets;
  uint256 loopCount = 0;

  mapping(address => bool) public players;
  mapping(address => uint256) public tickets;
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
    _;
  }
  modifier isLotteryMintingOpen() {
    require(
      lotteries[currentLotteryId].isActive == true &&
        lotteries[currentLotteryId].endTime > block.timestamp &&
        lotteries[currentLotteryId].startTime <= block.timestamp,
      "current lottery must be active; current time must be within lottery time frame"
    );
    _;
  }
  modifier isLotteryMintingCompleted() {
    // console.log(lotteries[currentLotteryId].isActive);
    // console.log(block.timestamp);
    // console.log(lotteries[currentLotteryId].endTime);
    require(
      (lotteries[currentLotteryId].isActive == true &&
        lotteries[currentLotteryId].endTime < block.timestamp) ||
        lotteries[currentLotteryId].isActive == false,
      "current lottery must be active or minting period must be closed"
    );
    _;
  }
  modifier isNewPlayerValid() {
    // time is within start/end dates
    // amount sent is > floor amt
    require(
      msg.value.min(MIN_DRAWING_INCREMENT) >= MIN_DRAWING_INCREMENT,
      "msg value must be greater than min amount allowed"
    );
    _;
  }

  // Events
  event NewLottery(address creator, uint256 startTime, uint256 endTime); // emit when lottery created

  // emit when user added
  event ticketsMinted(address player, uint256 numTicketsMinted);
  // emit when lottery drawing happens; winner found
  event triggerLotteryWinner(
    uint256 lotteryId,
    uint256 winningTicketIndex,
    address winningAddress
  );
  event triggerLotteryWinningsDeposited(
    uint256 lotteryId,
    address winningAddress,
    uint256 amountDeposited
  );
  // emit when funds withdrawn
  event withdrawalMade(address winnerAddress, uint256 withdrawalAmount);
  event maxPlayersAllowedUpdated(uint256 maxPlayersAllowed);

  /**
   * Contract initialization.
   */
  constructor() {}

  /**
   * A function to update max players allowed criteria
   * owner only
   *
   */
  function setMaxPlayersAllowed(uint256 _maxPlayersAllowed) external onlyOwner {
    maxPlayersAllowed = _maxPlayersAllowed;
    emit maxPlayersAllowedUpdated(maxPlayersAllowed);
  }

  /**
   * A function to force update lottery status isActive = false
   * if valid and exists, set inactive
   * owner only
   *
   */
  function setLotteryInactive() public onlyOwner {
    // if lottery is set to inactive, return funds to participants
    lotteries[currentLotteryId].isActive = false;
  }

  /**
   * A function to force update lottery status isActive = false
   * if valid and exists, set inactive
   * owner only
   *
   */
  function cancelLottery() external onlyOwner {
    setLotteryInactive();
    resetLottery();
    // also refund funds to users
  }

  /**
   * A function to initialize a lottery
   - check valid
   * - save new lottery
   can save any amount of lotteries, but the dates can't overlap; 
   start date must start after prev end date 
   * 
   */
  function initLottery(uint256 startTime, uint256 numHours)
    external
    isNewLotteryValid(startTime)
  {
    // console.log("initLottery");
    /**
     - calculate end date
     - save new lottery
     - emit event
     */
    // basically default value
    // if set to 0, default to explicit default number of days
    if (numHours == 0) {
      numHours = NUMBER_OF_HOURS;
    }
    uint256 endTime = startTime.add(numHours * 1 hours);
    lotteries[currentLotteryId] = LotteryStruct({
      lotteryId: currentLotteryId,
      startTime: startTime,
      endTime: endTime,
      isActive: true,
      isCompleted: false
    });
    numLotteries = numLotteries.add(1);
    emit NewLottery(msg.sender, startTime, endTime);
  }

  /**
   * a function for users to enter lottery drawing
   * - check user valid 
   modifier to check funds reach min threshold
   *
   */
  function mintLotteryTickets() public payable isNewPlayerValid {
    // console.log("mintLotteryTickets");
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
      if (listOfPlayers.length > numActivePlayers) {
        listOfPlayers[numActivePlayers] = msg.sender; // set based on index for when lottery is reset - overwrite array instead of delete to save gas
      } else {
        listOfPlayers.push(msg.sender);
      }

      players[msg.sender] = true;
      numActivePlayers = numActivePlayers.add(1);
    }
    tickets[msg.sender] = tickets[msg.sender].add(numTicketsToMint); // add existing, init 0
    prizeAmount = prizeAmount.add(msg.value);
    numTotalTickets = numTotalTickets.add(numTicketsToMint);
    emit ticketsMinted(msg.sender, numTicketsToMint);
  }

  /**
   * a function for users to trigger lottery drawing
   *  - modifier - check that lottery end date reached
   */
  function triggerLotteryDrawing() public isLotteryMintingCompleted onlyOwner {
    // console.log("triggerLotteryDrawing");
    /*
    - calculate each player's odds
    - trigger lottery drawing with random numbers
    - transfer funds into account    
    - designateWinner
    - increment lotto id X
    - reset players/lotto vals in state
    */

    playerTicketDistribution();
    uint256 winningTicketIndex = performRandomizedDrawing();
    winningTicket.winningTicketIndex = winningTicketIndex;
    findWinningAddress(winningTicketIndex);

    emit triggerLotteryWinner(
      currentLotteryId,
      winningTicket.winningTicketIndex,
      winningTicket.addr
    );
  }

  function triggerDepositWinnings() public {
    // console.log("triggerDepositWinnings");
    /*
    - calculate each player's odds
    - trigger lottery drawing with random numbers
    - transfer funds into account    
    - designateWinner
    - increment lotto id X
    - reset players/lotto vals in state
    */

    pendingWithdrawals[currentLotteryId][winningTicket.addr] = prizeAmount;
    prizeAmount = 0;
    emit triggerLotteryWinningsDeposited(
      currentLotteryId,
      winningTicket.addr,
      pendingWithdrawals[currentLotteryId][winningTicket.addr]
    );
    resetLottery();
  }

  // to handle getting an array of structs
  function getTicketDistribution(uint256 playerIndex)
    public
    view
    returns (
      address playerAddress,
      uint256 startIndex, // inclusive
      uint256 endIndex // inclusive
    )
  {
    return (
      ticketDistribution[playerIndex].playerAddress,
      ticketDistribution[playerIndex].startIndex,
      ticketDistribution[playerIndex].endIndex
    );
  }

  /**
   * calculateOdds for each player in current lottery
   update state var for player odds 
   */
  function playerTicketDistribution() private {
    // console.log("playerTicketDistribution");

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

      TicketDistributionStruct memory newDistribution = TicketDistributionStruct({
        playerAddress: playerAddress,
        startIndex: ticketIndex,
        endIndex: ticketIndex.add(numTickets).sub(1) // sub 1 to account for array indices starting from 0
      });
      if (ticketDistribution.length > i) {
        ticketDistribution[i] = newDistribution;
      } else {
        ticketDistribution.push(newDistribution);
      }

      tickets[playerAddress] = 0; // reset player's tickets to 0 after they've been counted
      ticketIndex = ticketIndex.add(numTickets);
    }
  }

  /**
   * designate winner of a lottery
   * private internal function, only called during lottery triggered
   */
  function performRandomizedDrawing() private view returns (uint256) {
    // console.log("performRandomizedDrawing");
    /**
   * take total # tickets
    generate random number between 0, # lottery tickets

    return thta number (ie winning index)
    call https://docs.chain.link/docs/chainlink-vrf/example-contracts/ to get random 
    https://docs.chain.link/docs/chainlink-vrf-best-practices/
   */

    // need random drawing from 0 to numTotalTickets
    uint256 randomTicketIndex = numTotalTickets.mul(3).div(4).sub(1); // placeholder for now. Generate true random number later
    return randomTicketIndex;
  }

  /**
   * designate winner of a lottery
   search for winning address
   * private internal function, only called during lottery triggered
   */
  function findWinningAddress(uint256 _winningTicketIndex) public {
    // console.log("findWinningAddress");
    /*
    - based on given winning index id:
    - set _winningTicketIndex state
    - search for  which user has won
    - 
    */

    if (numActivePlayers == 1) {
      winningTicket.addr = ticketDistribution[0].playerAddress;
    } else {
      // do binary search on ticketDistribution array to find winner

      uint256 winningPlayerIndex = binarySearch(
        0,
        numActivePlayers - 1,
        _winningTicketIndex
      );
      require(winningPlayerIndex < numActivePlayers);
      winningTicket.addr = ticketDistribution[winningPlayerIndex].playerAddress;
    }
  }

  function binarySearch(
    uint256 _leftIndex,
    uint256 _rightIndex,
    uint256 _ticketIndexToFind
  ) private returns (uint256) {
    uint256 searchIndex = _rightIndex.sub(_leftIndex).div(2).add(_leftIndex);

    loopCount = loopCount.add(1);
    if (loopCount > maxLoops) {
      return numActivePlayers;
    }
    // console.log(loopCount);
    // console.log(ticketDistribution[searchIndex].startIndex);
    // console.log(ticketDistribution[searchIndex].endIndex);
    // console.log(searchIndex);
    if (
      ticketDistribution[searchIndex].startIndex <= _ticketIndexToFind &&
      ticketDistribution[searchIndex].endIndex >= _ticketIndexToFind
    ) {
      return searchIndex;
    } else if (
      ticketDistribution[searchIndex].startIndex > _ticketIndexToFind
    ) {
      // go to left subarray
      // console.log("go left");
      _rightIndex = searchIndex.sub(_leftIndex);

      return binarySearch(_leftIndex, _rightIndex, _ticketIndexToFind);
    } else if (ticketDistribution[searchIndex].endIndex < _ticketIndexToFind) {
      // go to right subarray
      // console.log("go right");
      _leftIndex = searchIndex.add(_leftIndex).add(1);
      return binarySearch(_leftIndex, _rightIndex, _ticketIndexToFind);
    }

    return numActivePlayers;
  }

  /**
   * designate winner of a lottery
   * private internal function, only called during lottery triggered
   */
  function resetLottery() private {
    // console.log("getLottery");
    /*
    - reset winningTicketIndex
    - players delete
    - ticketDistribution delete
  mapping(address => uint256) tickets;
    - 
    */

    // keep running total of num tickets and players to reset so that gas is saved vs deleting arrays
    // ie overwrite arrays instead of deleting
    winningTicket = WinningTicketStruct({
      winningTicketIndex: 0,
      addr: address(0)
    });
    numTotalTickets = 0;
    numActivePlayers = 0;
    lotteries[currentLotteryId].isActive = false;
    lotteries[currentLotteryId].isCompleted = true;
    currentLotteryId = currentLotteryId.add(1);
  }

  /**
   * allow winner to withdraw prize
   - check winner is calling this
   */
  function withdraw(uint256 lotteryId) external payable {
    // console.log("withdraw");
    /*
    - send funds to user
    - update pending withdrawals var
    */

    require(
      pendingWithdrawals[lotteryId][msg.sender] > 0,
      "require pending withdrawals to have funds for given user"
    );
    uint256 withdrawalAmount = pendingWithdrawals[lotteryId][msg.sender];
    pendingWithdrawals[lotteryId][msg.sender] = 0;
    payable(msg.sender).transfer(withdrawalAmount);
    emit withdrawalMade(msg.sender, withdrawalAmount);
  }
}
