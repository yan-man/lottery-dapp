import React from "react";

// We'll use ethers to interact with the Ethereum network and our contract
import { BigNumber, ethers } from "ethers";

// We import the contract's artifacts and address here, as we are going to be
// using them with ethers
import LotteryArtifact from "../contracts/Lottery.json";
import contractAddress from "../contracts/contract-address.json";

// All the logic of this dapp is contained in the Dapp component.
// These other components are just presentational ones: they don't have any
// logic. They just render HTML.
import { NoWalletDetected } from "./NoWalletDetected";
import { ConnectWallet } from "./ConnectWallet";
import { Loading } from "./Loading";
import { Transfer } from "./Transfer";
import { TransactionErrorMessage } from "./TransactionErrorMessage";
import { WaitingForTransactionMessage } from "./WaitingForTransactionMessage";
import { NoTokensMessage } from "./NoTokensMessage";

import OwnerOptions from "./OwnerOptions";
import ActiveLotteryDisplay from "./ActiveLotteryDisplay";
import PreviousLotteryDisplay from "./PreviousLotteryDisplay";

import Header from "./Header";
import Footer from "./Footer";
import Rules from "./Rules";

// This is the Hardhat Network id, you might change it in the hardhat.config.js.
// If you are using MetaMask, be sure to change the Network id to 1337.
// Here's a list of network ids https://docs.metamask.io/guide/ethereum-provider.html#properties
// to use when deploying to other networks.
const HARDHAT_NETWORK_ID = "31337";

// This is an error code that indicates that the user canceled a transaction
const ERROR_CODE_TX_REJECTED_BY_USER = 4001;

// This component is in charge of doing these things:
//   1. It connects to the user's wallet
//   2. Initializes ethers and the Token contract
//   3. Polls the user balance to keep it updated.
//   4. Transfers tokens by sending transactions
//   5. Renders the whole application
//
// Note that (3) and (4) are specific of this sample application, but they show
// you how to keep your Dapp and contract's state in sync,  and how to send a
// transaction.
export class Dapp extends React.Component {
  constructor(props) {
    super(props);

    // We store multiple things in Dapp's state.
    // You don't need to follow this pattern, but it's an useful example.
    this.initialState = {
      // The info of the token (i.e. It's Name and symbol)
      tokenData: undefined,
      // The user's address and balance
      selectedAddress: undefined,
      balance: undefined,
      // The ID about transactions being sent, and any possible error with them
      txBeingSent: undefined,
      transactionError: undefined,
      networkError: undefined,
      lottery: {},
    };

    this.state = this.initialState;
  }

  render() {
    // Ethereum wallets inject the window.ethereum object. If it hasn't been
    // injected, we instruct the user to install MetaMask.
    if (window.ethereum === undefined) {
      return <NoWalletDetected />;
    }

    // The next thing we need to do, is to ask the user to connect their wallet.
    // When the wallet gets connected, we are going to save the users's address
    // in the component's state. So, if it hasn't been saved yet, we have
    // to show the ConnectWallet component.
    //
    // Note that we pass it a callback that is going to be called when the user
    // clicks a button. This callback just calls the _connectWallet method.
    if (!this.state.selectedAddress) {
      // this._connectWallet();
      return (
        <ConnectWallet
          connectWallet={() => this._connectWallet()}
          networkError={this.state.networkError}
          dismiss={() => this._dismissNetworkError()}
        />
      );
    }

    // If the token data or the user's balance hasn't loaded yet, we show
    // a loading component.
    if (!this.state.selectedAddress || !this.state.lottery.owner) {
      return <Loading />;
    }
    const { lottery, selectedAddress, balance } = {
      ...this.state,
    };
    const isOwner =
      selectedAddress.toUpperCase() === lottery.owner.toUpperCase();
    return (
      <>
        <Header />
        <main className="container h-100" style={{ paddingTop: "80px" }}>
          <div className="container ">
            <Rules
              minDrawingIncrement={ethers.utils.commify(
                ethers.utils.formatUnits(lottery.minDrawingIncrement).toString()
              )}
              maxPlayersAllowed={lottery.maxPlayersAllowed
                .toNumber()
                .toLocaleString("en")}
            />
            <div className="row">
              <div className="col-12 ">
                <p>
                  Welcome <b>{isOwner ? "OWNER" : selectedAddress}</b>, you have{" "}
                  <b>
                    {/* TASK: create a utility function for formatting wei into ethers
                     */}
                    {ethers.utils.commify(
                      ethers.utils.formatUnits(balance).toString()
                    )}{" "}
                    eth
                  </b>{" "}
                  to mint lottery tickets with.
                </p>
              </div>
            </div>
            {isOwner && (
              <OwnerOptions
                _initLottery={this._initLottery}
                _triggerLotteryDrawing={this._triggerLotteryDrawing}
                _triggerSetLotteryInactive={this._triggerSetLotteryInactive}
                lottery={lottery}
              />
            )}

            {lottery.isActive && (
              <ActiveLotteryDisplay
                selectedAddress={selectedAddress}
                lottery={lottery}
                _handleMintLotteryTickets={this._mintLotteryTickets}
              />
            )}
            {!lottery.isActive && lottery.isCreated && (
              <PreviousLotteryDisplay
                selectedAddress={selectedAddress}
                lottery={lottery}
                withdrawWinnings={this._withdrawWinnings}
              />
            )}
          </div>
        </main>
        <Footer myAddress={lottery.address} owner={lottery.owner} />
      </>
    );
  }

  componentWillUnmount() {
    // We poll the user's balance, so we have to stop doing that when Dapp
    // gets unmounted
    this._stopPollingData();
  }

  async _connectWallet() {
    // This method is run when the user clicks the Connect. It connects the
    // dapp to the user's wallet, and initializes it.

    // To connect to the user's wallet, we have to run this method.
    // It returns a promise that will resolve to the user's address.
    const [selectedAddress] = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    // Once we have the address, we can initialize the application.

    // First we check the network
    if (!this._checkNetwork()) {
      return;
    }

    this._initialize(selectedAddress);

    // We reinitialize it whenever the user changes their account.
    window.ethereum.on("accountsChanged", ([newAddress]) => {
      this._stopPollingData();
      // `accountsChanged` event can be triggered with an undefined newAddress.
      // This happens when the user removes the Dapp from the "Connected
      // list of sites allowed access to your addresses" (Metamask > Settings > Connections)
      // To avoid errors, we reset the dapp state
      if (newAddress === undefined) {
        return this._resetState();
      }

      this._initialize(newAddress);
    });

    // We reset the dapp state if the network is changed
    window.ethereum.on("chainChanged", ([networkId]) => {
      this._stopPollingData();
      this._resetState();
    });
  }

  _initialize(userAddress) {
    // This method initializes the dapp

    // We first store the user's address in the component's state
    this.setState({
      selectedAddress: userAddress,
    });

    // Then start polling lottery info

    // Fetching the token data and the user's balance are specific to this
    // sample project, but you can reuse the same initialization pattern.
    this._initializeEthers();
    // this._updateLotteryContractDetails();
    // this._getTokenData();
    this._startPollingData();
  }

  async _initializeEthers() {
    // We first initialize ethers by creating a provider using window.ethereum
    this._provider = new ethers.providers.Web3Provider(window.ethereum);

    // Then, we initialize the contract using that provider and the token's
    // artifact. You can do this same thing with your contracts.
    this._lottery = new ethers.Contract(
      contractAddress.Lottery,
      LotteryArtifact.abi,
      this._provider.getSigner(0)
    );
  }

  // The next two methods are needed to start and stop polling data. While
  // the data being polled here is specific to this example, you can use this
  // pattern to read any data from your contracts.
  //
  // Note that if you don't need it to update in near real time, you probably
  // don't need to poll it. If that's the case, you can just fetch it when you
  // initialize the app, as we do with the token data.
  _startPollingData() {
    this._pollDataInterval = setInterval(() => this._updateInfo(), 5000);
    // We run it once immediately so we don't have to wait for it
    this._updateInfo();
  }

  _stopPollingData() {
    clearInterval(this._pollDataInterval);
    this._pollDataInterval = undefined;
  }

  // The next two methods just read from the contract and store the results
  // in the component state.
  async _getTokenData() {
    const name = await this._token.name();
    const symbol = await this._token.symbol();

    this.setState({ tokenData: { name, symbol } });
  }

  async _updateInfo() {
    // console.log("_updateInfo");
    this._updateUser();
    this._updateLottery();
  }

  async _updateUser() {
    // console.log("_updateUser");
    const balance = await this._provider.getBalance(this.state.selectedAddress);
    this.setState({ balance });
  }

  _mintLotteryTickets = async (value) => {
    const mintValue = await ethers.utils.parseEther(value);
    await this._lottery.mintLotteryTickets({ value: mintValue });
    return true;
  };

  async _updateLottery() {
    // console.log("_updateLottery");
    const currentLotteryId = BigNumber.from(0);
    const numActivePlayers = await this._lottery.numActivePlayers();

    let activePlayers = [];
    let playerAddress;
    for (let ind = 0; ind < numActivePlayers; ind++) {
      playerAddress = await this._lottery.listOfPlayers(ind);
      activePlayers.push(playerAddress);
    }
    const winningTicket = await this._lottery.winningTickets(
      currentLotteryId.toNumber()
    );
    // console.log(winningTicket.winningTicketIndex.toString());
    // console.log(winningTicket);
    // console.log(
    //   await this._lottery.pendingWithdrawals(
    //     currentLotteryId.toNumber(),
    //     winningTicket.addr
    //   )
    // );

    const newState = {
      ...(await this._lottery.lotteries(currentLotteryId.toNumber())),
      ...(await this._lottery.winningTickets(currentLotteryId.toNumber())),
      id: currentLotteryId,
      address: contractAddress.Lottery,
      owner: await this._lottery.owner(),
      minDrawingIncrement: await this._lottery.MIN_DRAWING_INCREMENT(),
      maxPlayersAllowed: await this._lottery.maxPlayersAllowed(),
      numTotalTickets: await this._lottery.numTotalTickets(),
      activePlayers,
      numActivePlayers,
      prizeAmount: await this._lottery.prizeAmount(),
      isUserActive: await this._lottery.players(this.state.selectedAddress),
      numTickets: await this._lottery.tickets(this.state.selectedAddress),
      pendingWithdrawal: await this._lottery.pendingWithdrawals(
        currentLotteryId.toNumber(),
        winningTicket.addr
      ),
      winningTicket,
      prize: await this._lottery.prizes(currentLotteryId.toNumber()),
    };
    this.setState({
      lottery: newState,
    });
  }

  _initLottery = async () => {
    console.log("init lottery");
    const unixtimeNow = Math.floor(Date.now() / 1000);
    await this._lottery.initLottery(unixtimeNow, 1);
    this._updateInfo();
  };

  _triggerLotteryDrawing = async () => {
    console.log("_triggerLotteryDrawing");
    await this._lottery.triggerLotteryDrawing();
    const tx = await this._lottery.triggerDepositWinnings();
    const receipt = await tx.wait();

    const { lotteryId, winningAddress, amountDeposited } =
      receipt.events[0].args;
    console.log(amountDeposited.toString());
    this._updateInfo();
  };

  _triggerSetLotteryInactive = async () => {
    console.log("_triggerSetLotteryInactive");
    await this._lottery.setLotteryInactive();
    this._updateInfo();
  };

  _withdrawWinnings = async (currentLotteryId) => {
    await this._lottery.withdraw(currentLotteryId);
  };
  // This method just clears part of the state.
  _dismissTransactionError() {
    this.setState({ transactionError: undefined });
  }

  // This method just clears part of the state.
  _dismissNetworkError() {
    this.setState({ networkError: undefined });
  }

  // This is an utility method that turns an RPC error into a human readable
  // message.
  _getRpcErrorMessage(error) {
    if (error.data) {
      return error.data.message;
    }

    return error.message;
  }

  // This method resets the state
  _resetState() {
    this.setState(this.initialState);
  }

  // This method checks if Metamask selected network is Localhost:8545
  _checkNetwork() {
    if (window.ethereum.networkVersion === HARDHAT_NETWORK_ID) {
      return true;
    }

    this.setState({
      networkError: "Please connect Metamask to Localhost:8545",
    });

    return false;
  }
}
