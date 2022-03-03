//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

// load other contracts
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
// for debugging
import "hardhat/console.sol";

contract Lottery is Ownable {
  using SafeMath for uint256;
  using Math for uint256;

  // State Variables
  struct LotteryStruct {
    uint256 lotteryId;
    uint256 startTime;
    uint256 endTime;
    bool isActive; // minting tickets is allowed
    bool isCompleted; // winner was found; winnings were deposited
    bool isCreated; // is created
  }
  struct TicketDistributionStruct {
    address playerAddress;
    uint256 startIndex; // inclusive
    uint256 endIndex; // inclusive
  }
  struct WinningTicketStruct {
    uint256 currentLotteryId;
    uint256 winningTicketIndex;
    address addr;
  }
  /* TASK: rename MIN_DRAWING_INCREMENT to something more descriptive. Maybe TICKET_PRICE
   */
  uint256 public constant MIN_DRAWING_INCREMENT = 100000000000000; // 0.0001 ETH; min eth amount to enter lottery.
  uint256 public constant NUMBER_OF_HOURS = 168; // 1 week by default; configurable

  // max # loops allowed for binary search; to prevent some bugs causing infinite loops in binary search
  uint256 public maxLoops = 10;
  uint256 loopCount = 0; // for binary search
  uint256 public maxPlayersAllowed = 1000;

  uint256 public currentLotteryId = 0;
  uint256 public numLotteries = 0;
  uint256 public prizeAmount; // winnings. Probably duplicate and can be removed. Just use numTotalTickets.div(MIN_DRAWING_INCREMENT) to calculate prize amount

  WinningTicketStruct public winningTicket;
  TicketDistributionStruct[] public ticketDistribution;
  address[] public listOfPlayers; // won't be deleted; sucessive lotteries overwrite indices. Don't rely on this for current participants list

  uint256 public numActivePlayers;
  uint256 public numTotalTickets;

  mapping(uint256 => uint256) public prizes; // key is lotteryId
  mapping(uint256 => WinningTicketStruct) public winningTickets; // key is lotteryId
  mapping(address => bool) public players; // key is player address
  mapping(address => uint256) public tickets; // key is player address
  mapping(uint256 => LotteryStruct) public lotteries; // key is lotteryId
  mapping(uint256 => mapping(address => uint256)) public pendingWithdrawals; // pending withdrawals for each winner, key is lotteryId, then player address
  // withdrawal design pattern

  // modifiers

  /* check that new lottery is a valid implementation
  previous lottery must be inactive for new lottery to be saved
  for when new lottery will be saved
   */
  modifier isNewLotteryValid(uint256 startTime) {
    // active lottery
    LotteryStruct memory lottery = lotteries[currentLotteryId];
    require(
      lottery.isActive == false,
      "current lottery must be inactive to save a new one"
    );
    _;
  }
  /* check that minting period is still open
  for when user tries to mint more tickets
   */
  modifier isLotteryMintingOpen() {
    require(
      lotteries[currentLotteryId].isActive == true &&
        lotteries[currentLotteryId].endTime > block.timestamp &&
        lotteries[currentLotteryId].startTime <= block.timestamp,
      "current lottery must be active; current time must be within lottery time frame"
    );
    _;
  }
  /* check that minting period is completed, and lottery drawing can begin
  either:
  1) minting period manually ended, ie lottery is inactive. Then drawing can begin immediately.
  2) lottery minting period has ended organically, and lottery is still active at that point
   */
  modifier isLotteryMintingCompleted() {
    require(
      (lotteries[currentLotteryId].isActive == true &&
        lotteries[currentLotteryId].endTime < block.timestamp) ||
        lotteries[currentLotteryId].isActive == false,
      "current lottery must be active or minting period must be closed"
    );
    _;
  }
  /* check that new player has enough eth to buy at least 1 ticket
   */
  modifier isNewPlayerValid() {
    require(
      msg.value.min(MIN_DRAWING_INCREMENT) >= MIN_DRAWING_INCREMENT,
      "msg value must be greater than min amount allowed"
    );
    _;
  }

  // Events
  event NewLottery(address creator, uint256 startTime, uint256 endTime); // emit when lottery created
  event ticketsMinted(address player, uint256 numTicketsMinted); // emit when user purchases tix
  // emit when lottery drawing happens; winner found
  event triggerLotteryWinner(
    uint256 lotteryId,
    uint256 winningTicketIndex,
    address winningAddress
  );
  // emit when lottery winnings deposited in pending withdrawals
  event triggerLotteryWinningsDeposited(
    uint256 lotteryId,
    address winningAddress,
    uint256 amountDeposited
  );
  // emit when funds withdrawn by winner
  event withdrawalMade(address winnerAddress, uint256 withdrawalAmount);
  // emit when owner has changed max player param
  event maxPlayersAllowedUpdated(uint256 maxPlayersAllowed);

  constructor() {}

  /**
   * A function for owner to update max players allowed criteria
   */
  function setMaxPlayersAllowed(uint256 _maxPlayersAllowed) external onlyOwner {
    maxPlayersAllowed = _maxPlayersAllowed;
    emit maxPlayersAllowedUpdated(maxPlayersAllowed);
  }

  /**
   * A function for owner to force update lottery status isActive to false
   */
  function setLotteryInactive() public onlyOwner {
    lotteries[currentLotteryId].isActive = false;
  }

  /**
   * A function for owner to force update lottery to be cancelled
   * funds should be returned to players too
   */
  function cancelLottery() external onlyOwner {
    setLotteryInactive();
    resetLottery();
    // TASK: implement refund funds to users
  }

  /**
   * A function to initialize a lottery
   * probably should also be onlyOwner
   */
  function initLottery(uint256 startTime, uint256 numHours)
    external
    isNewLotteryValid(startTime)
  // TASK: add onlyOwner and re-test
  {
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
      isCompleted: false,
      isCreated: true
    });
    numLotteries = numLotteries.add(1);
    emit NewLottery(msg.sender, startTime, endTime);
  }

  /**
   * a function for players to mint lottery tix
   */
  function mintLotteryTickets() public payable isNewPlayerValid {
    uint256 numTicketsToMint = msg.value.div(MIN_DRAWING_INCREMENT);
    require(numTicketsToMint >= 1); // double check that user put in at least enough for 1 ticket
    // if player is "new" for current lottery, update the player lists
    if (players[msg.sender] == false) {
      require(numActivePlayers.add(1) <= maxPlayersAllowed); // capped max # of players
      if (listOfPlayers.length > numActivePlayers) {
        listOfPlayers[numActivePlayers] = msg.sender; // set based on index for when lottery is reset - overwrite array instead of delete to save gas
      } else {
        listOfPlayers.push(msg.sender); // otherwise append to array
      }
      players[msg.sender] = true;
      numActivePlayers = numActivePlayers.add(1);
    }
    tickets[msg.sender] = tickets[msg.sender].add(numTicketsToMint); // account for if user has already minted tix previously for this current lottery
    prizeAmount = prizeAmount.add(msg.value); // update the pot size
    numTotalTickets = numTotalTickets.add(numTicketsToMint); // update the total # of tickets minted
    emit ticketsMinted(msg.sender, numTicketsToMint);
  }

  /**
   * a function for owner to trigger lottery drawing
   */
  function triggerLotteryDrawing() public isLotteryMintingCompleted onlyOwner {
    // console.log("triggerLotteryDrawing");
    prizes[currentLotteryId] = prizeAmount; // keep track of prize amts for each of the previous lotteries

    playerTicketDistribution(); // create the distribution to get ticket indexes for each user
    // can't be done a priori bc of potential multiple mints per user
    uint256 winningTicketIndex = performRandomizedDrawing();
    // initialize what we can first
    winningTicket.currentLotteryId = currentLotteryId;
    winningTicket.winningTicketIndex = winningTicketIndex;
    findWinningAddress(winningTicketIndex); // via binary search

    emit triggerLotteryWinner(
      currentLotteryId,
      winningTicket.winningTicketIndex,
      winningTicket.addr
    );
  }

  /* function to deposit winnings for user withdrawal pattern
  then reset lottery params for new one to be created
   */
  function triggerDepositWinnings() public {
    // console.log("triggerDepositWinnings");
    pendingWithdrawals[currentLotteryId][winningTicket.addr] = prizeAmount;
    prizeAmount = 0;
    lotteries[currentLotteryId].isCompleted = true;
    winningTickets[currentLotteryId] = winningTicket;
    // emit before resetting lottery so vars still valid
    emit triggerLotteryWinningsDeposited(
      currentLotteryId,
      winningTicket.addr,
      pendingWithdrawals[currentLotteryId][winningTicket.addr]
    );
    resetLottery();
  }

  /* getter function for ticketDistribution bc its a struct
   */
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

  /* function to handle creating the ticket distribution
  if 1) player1 buys 10 tix, then 2) player2 buys 5 tix, and then 3) player1 buys 5 more
  player1's ticket indices will be 0-14; player2's from 15-19
  this is why ticketDistribution cannot be determined until minting period is closed
   */
  function playerTicketDistribution() private {
    // console.log("playerTicketDistribution");
    uint256 ticketIndex = 0; // counter within loop
    for (uint256 i = ticketIndex; i < numActivePlayers; i++) {
      address playerAddress = listOfPlayers[i];
      uint256 numTickets = tickets[playerAddress];

      TicketDistributionStruct memory newDistribution = TicketDistributionStruct({
        playerAddress: playerAddress,
        startIndex: ticketIndex,
        endIndex: ticketIndex.add(numTickets).sub(1) // sub 1 to account for array indices starting from 0
      });
      // gas optimization - overwrite existing values; otherwise append
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
   * function to generate random winning ticket index. Still need to find corresponding user afterwards. 
   v0.1.0 isn't randomized (for testing)
   */
  function performRandomizedDrawing() private view returns (uint256) {
    // console.log("performRandomizedDrawing");
    /* TASK: implement random drawing from 0 to numTotalTickets
    use chainlink https://docs.chain.link/docs/get-a-random-number/ to get random values
     */
    uint256 randomTicketIndex = numTotalTickets.mul(3).div(4).sub(1); // placeholder for now. Generate true random number later
    return randomTicketIndex;
  }

  /* function to find winning player address corresponding to winning ticket index
  calls binary search
   */
  function findWinningAddress(uint256 _winningTicketIndex) public {
    // console.log("findWinningAddress");
    // trivial case, no search required
    if (numActivePlayers == 1) {
      winningTicket.addr = ticketDistribution[0].playerAddress;
    } else {
      // do binary search on ticketDistribution array to find winner
      uint256 winningPlayerIndex = binarySearch(
        0,
        numActivePlayers - 1,
        _winningTicketIndex
      );
      require(winningPlayerIndex < numActivePlayers); // sanity check
      winningTicket.addr = ticketDistribution[winningPlayerIndex].playerAddress;
    }
  }

  /* function implementing binary search on ticket distribution var
  recursive function
   */
  function binarySearch(
    uint256 _leftIndex,
    uint256 _rightIndex,
    uint256 _ticketIndexToFind
  ) private returns (uint256) {
    uint256 searchIndex = _rightIndex.sub(_leftIndex).div(2).add(_leftIndex);

    // counter
    loopCount = loopCount.add(1);
    if (loopCount > maxLoops) {
      // emergency stop in case infinite loop due to unforeseen bug
      return numActivePlayers;
    }
    if (
      ticketDistribution[searchIndex].startIndex <= _ticketIndexToFind &&
      ticketDistribution[searchIndex].endIndex >= _ticketIndexToFind
    ) {
      return searchIndex;
    } else if (
      ticketDistribution[searchIndex].startIndex > _ticketIndexToFind
    ) {
      // go to left subarray
      _rightIndex = searchIndex.sub(_leftIndex);

      return binarySearch(_leftIndex, _rightIndex, _ticketIndexToFind);
    } else if (ticketDistribution[searchIndex].endIndex < _ticketIndexToFind) {
      // go to right subarray
      _leftIndex = searchIndex.add(_leftIndex).add(1);
      return binarySearch(_leftIndex, _rightIndex, _ticketIndexToFind);
    }

    // if nothing found (bug), return an impossible player index
    // this index is outside expected bound, bc indexes run from 0 to numActivePlayers-1
    return numActivePlayers;
  }

  /** function to reset lottery by setting state vars to defaults
  don't delete if possible, as it requires lots of gas
   */
  function resetLottery() private {
    // console.log("resetLottery");

    numTotalTickets = 0;
    numActivePlayers = 0;
    lotteries[currentLotteryId].isActive = false;
    lotteries[currentLotteryId].isCompleted = true;
    winningTicket = WinningTicketStruct({
      currentLotteryId: 0,
      winningTicketIndex: 0,
      addr: address(0)
    });

    currentLotteryId = currentLotteryId.add(1); // increment id counter
  }

  /* function to allow winner to withdraw prize
  implement withdrawal pattern
   */
  function withdraw(uint256 lotteryId) external payable {
    // console.log("withdraw");
    require(
      pendingWithdrawals[lotteryId][msg.sender] > 0,
      "require pending withdrawals to have funds for given user"
    );
    uint256 withdrawalAmount = pendingWithdrawals[lotteryId][msg.sender];
    pendingWithdrawals[lotteryId][msg.sender] = 0; // zero out pendingWithdrawals before transfer, to prevent attacks
    payable(msg.sender).transfer(withdrawalAmount); // must explicitly set payable address
    emit withdrawalMade(msg.sender, withdrawalAmount);
  }
}
