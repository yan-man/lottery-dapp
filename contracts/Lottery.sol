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
    uint256 startDate;
    uint256 endDate;
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

  uint256 public currentLotteryId = 0;
  uint256 public prizeAmount; // key is lotteryId
  address[] public players;
  TicketStruct[] public ticketDistribution;
  uint256 totalNumTickets;
  uint256 winningTicketIndex;
  mapping(address => uint256) tickets;
  mapping(uint256 => LotteryStruct) public lotteries; // key is lotteryId
  mapping(uint256 => mapping(address => uint256)) public pendingWithdrawals; // pending withdrawals for each winner, key is lotteryId

  // modifiers
  // check lotto valid - is given start date >= prev end date?
  modifier isNewLotteryValid(uint256 startDate) {
    // active lottery
    LotteryStruct memory lottery = lotteries[currentLotteryId];
    require(
      lottery.isActive == false,
      "current lottery must be inactive to save a new one"
    );
    // if there is an existing lottery, the current time must be after end date of previous one
    if (currentLotteryId > 0) {
      require(
        startDate >= lottery.endDate,
        "if there is a previous lottery, new start date must be after prev one has ended"
      );
    }
    _;
  }
  modifier isLotteryMintingOpen() {
    LotteryStruct memory lottery = lotteries[currentLotteryId];
    require(
      lottery.isActive == true &&
        lottery.endDate >= block.timestamp &&
        lottery.startDate <= block.timestamp,
      "current lottery must be active; current time must be within lottery time frame"
    );
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
  event NewLottery(address creator, uint256 start, uint256 end); // emit when lottery created

  // emit when user added
  event ticketsMinted(address player, uint256 numTicketsMinted);
  // emit when lottery drawing happens; winner found
  event triggerLottery(uint256 lotteryId, uint256 winningIndex);
  // emit when funds withdrawn
  event withdrawalMade(address winner, uint256 lotteryId);

  /**
   * Contract initialization.
   */
  constructor() {}

  /**
   * A function to initialize a lottery
   - check valid
   * - save new lottery
   can save any amount of lotteries, but the dates can't overlap; 
   start date must start after prev end date 
   * 
   */
  function initLottery(uint256 startDate, uint256 numDays)
    external
    isNewLotteryValid(startDate)
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
    uint256 endDate = startDate.add(numDays * 1 days);
    lotteries[currentLotteryId] = LotteryStruct({
      startDate: startDate,
      endDate: endDate,
      isActive: true
    });
    emit NewLottery(msg.sender, startDate, endDate);
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
      uint256 startDate,
      uint256 endDate,
      bool isActive
    )
  {
    console.log("getLottery");
    LotteryStruct memory lottery = lotteries[lotteryId];
    return (lottery.startDate, lottery.endDate, lottery.isActive);
  }

  /**
   * a function for users to enter lottery drawing
   * - check user valid 
   modifier to check funds reach min threshold
   *
   */
  function mintLotteryTickets()
    public
    payable
    isNewPlayerValid
    returns (bool isActive)
  {
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
    require(numTicketsToMint >= 1);
    //double check that at least one ticket to mint
    players.push(msg.sender);
    tickets[msg.sender] = tickets[msg.sender].add(numTicketsToMint); // add existing, init 0
    prizeAmount = prizeAmount.add(msg.value);
    emit ticketsMinted(msg.sender, numTicketsToMint);
  }

  /**
   * a function to get number of players in active lottery
   */
  function getNumPlayers() public view returns (uint256) {
    return players.length;
  }

  /**
   * a function for users to trigger lottery drawing
   *  - modifier - check that lottery end date reached
   */
  function triggerLotteryDrawing() public view {
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
    uint256 winningIndex = performRandomizedDrawing();
    address winningAddress = findWinningAddress(winningIndex);
    designateWinner();
    depositPrize(winningAddress);
    resetLottery();
    
    triggerLottery(uint256 currentLotteryId, uint256 winningIndex);
    currentLotteryId = currentLotteryId.add(1);
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

    uint256 ticketIndex = 1;
    // loop over player addresses
    for (uint256 i = ticketIndex; i < players.length; i++) {
      // create this distribution at the very end so that it isn't store long term on BC
      // if you do it in the moment, if a user adds some eth, then more eth in separate tranches
      // you have to track index -> user instead of user -> index, much less efficient
      // ie need an array of length numTickets instead of just length numPlayers
      address playerAddress = players[i];
      uint256 numTickets = tickets[playerAddress];
      ticketDistribution.push(
        TicketStruct({
          playerAddress: playerAddress,
          startIndex: ticketIndex,
          endIndex: ticketIndex.add(numTickets).sub(1) // sub 1 to account for array indices starting from 0
        })
      );
      ticketIndex = ticketIndex.add(numTickets);
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

    // need random drawing from 1 to totalNumTickets
    uint256 randomTicketIndex = ticketDistribution.mul(3).div(4); // placeholder for now. Generate true random number later
    return randomTicketIndex;
  }

  /**
   * designate winner of a lottery
   search for winning address
   * private internal function, only called during lottery triggered
   */
  function findWinningAddress(uint256 winningIndex) private returns (address) {
    console.log("getLottery");
    /*
    - based on given winning index id:
    - set winningIndex state
    - search for  which user has won
    - 
    */
    winningTicketIndex = winningIndex;
    // do binary search on ticketDistribution array to find winner
    bool isWinnerFound = false;
    uint256 searchIndex = ticketDistribution.length.div(2);
    while (!isWinnerFound) {
      if (
        ticketDistribution[searchIndex].startIndex <= winningTicketIndex &&
        ticketDistribution[searchIndex].endIndex >= winningTicketIndex
      ) {
        isWinnerFound = true;
        return ticketDistribution[searchIndex];
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
  }

  /**
   *
   */
  function designateWinner(address winningAddress)
    private
    returns (bool isActive)
  {
    console.log("getLottery");
    /*
    - send funds to user
    - update pending withdrawals for user address
    - set prize to zero
    */
    pendingWithdrawals[currentLotteryId][winningAddress] = prizeAmount;
    prizeAmount = 0;
  }

  /**
   * depositPrize
   - params: 
   */
  function depositPrize(address winningAddress)
    private
    returns (bool isActive)
  {
    console.log("getLottery");
    /*
    - send funds to user
    - update pending withdrawals for user address
    - set prize to zero
    */
    msg.sender.transfer(withdrawalAmount);
  }

  /**
   * designate winner of a lottery
   * private internal function, only called during lottery triggered
   */
  function resetLottery() private returns (bool isActive) {
    console.log("getLottery");
    /*
    - reset winningTicketIndex
    - players delete
    - ticketDistribution delete
  mapping(address => uint256) tickets;
    - 
    */

    winningTicketIndex = 0;
    delete players;
    delete ticketDistribution;
    delete tickets;
  }

  /**
   * allow winner to withdraw prize
   - check winner is calling this
   */
  function withdraw(uint256 lotteryId) external returns (bool isActive) {
    console.log("withdraw");
    /*
    - send funds to user
    - update pending withdrawals var
    */

    require(pendingWithdrawals[lotteryId][msg.sender] > 0);
    uint256 withdrawalAmount = pendingWithdrawals[lotteryId][msg.sender];
    pendingWithdrawals[lotteryId][msg.sender] = 0;
    msg.sender.transfer(withdrawalAmount);
    emit withdrawalMade(msg.sender, withdrawalAmount);
  }
}
