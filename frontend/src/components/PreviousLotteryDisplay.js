import React, { Component } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import { BigNumber, ethers } from "ethers";

class PreviousLotteryDisplay extends Component {
  constructor(props) {
    super(props);
    this.initialState = {
      value: "",
      numMoreTickets: 0,
      odds: 0,
      currentOdds: this._calculateInitialOdds(
        props.lottery.numTickets.toNumber()
      ),
    };
    this.state = this.initialState;
  }

  render() {
    const { lottery } = { ...this.props };
    return (
      <React.Fragment>
        <div className="row">
          <div className="col-12">
            <h2>Previous Lottery </h2>
            <p>ID#{lottery.lotteryId.toString()}</p>
            <p>
              Start Time: {this._timeConverter(lottery.startTime.toString())}
            </p>
            <p>End Time: {this._timeConverter(lottery.endTime.toString())}</p>
          </div>
        </div>
        <div className="row">
          {lottery.isActive && (
            <>
              <div className="col-16">
                <h4>
                  Total Degens:{" "}
                  {lottery.numActivePlayers.toNumber().toLocaleString("en")}{" "}
                  {lottery.isUserActive && <>{`(Including me!)`}</>}
                </h4>
                <h4>
                  Total Tickets Minted:{" "}
                  {lottery.numTotalTickets.toNumber().toLocaleString("en")}{" "}
                  {lottery.isUserActive && (
                    <>{`(You've already minted ${lottery.numTickets
                      .toNumber()
                      .toLocaleString("en")})`}</>
                  )}
                </h4>
              </div>
              <h4>
                {lottery.isUserActive && (
                  <>
                    You currently have a {this.state.currentOdds}% chance to
                    win.
                  </>
                )}
              </h4>
            </>
          )}
          {lottery.addr !== "0x0000000000000000000000000000000000000000" && (
            <div className="py-4 ">
              <h2 className="justify-content-left">Results</h2>
              <h3 className="justify-content-left">
                Winner:{" "}
                <b>
                  {lottery.addr.toUpperCase() ===
                  this.props.selectedAddress.toUpperCase()
                    ? "ME"
                    : lottery.addr}
                </b>
              </h3>
              <h3>
                Jackpot:{" "}
                <b>
                  {ethers.utils.commify(
                    ethers.utils.formatUnits(lottery.prize).toString()
                  )}{" "}
                  eth
                </b>
              </h3>
              <div className="pt-3 d-flex justify-content-left">
                <h3>Pending Withdrawal Remaining</h3>
              </div>
              <div className="d-flex justify-content-left">
                <h3>
                  {
                    <b>
                      {ethers.utils.commify(
                        ethers.utils
                          .formatUnits(lottery.pendingWithdrawal)
                          .toString()
                      )}{" "}
                      eth
                    </b>
                  }
                </h3>
              </div>

              {lottery.addr.toUpperCase() ===
                this.props.selectedAddress.toUpperCase() &&
                lottery.pendingWithdrawal.gt(BigNumber.from(0)) && (
                  <div className="p-5 d-flex justify-content-left">
                    <Button
                      variant="primary"
                      type="submit"
                      onClick={this._handleWithdrawWinnings}
                      className="btn-success px-5 py-2"
                      type="button"
                      style={{ fontSize: "20px" }}
                    >
                      Withdraw
                    </Button>
                  </div>
                )}
            </div>
          )}
          <hr />
          <div className="py-2">
            {lottery.isCreated && !this.props.lottery.isCompleted && (
              <>
                <h2>Current Players</h2>
                <ul>
                  {lottery.activePlayers.map((activePlayer, ind) => {
                    return (
                      <li key={ind}>
                        <div className="col-2">
                          {activePlayer.toUpperCase() ===
                          this.props.selectedAddress.toUpperCase()
                            ? "ME"
                            : activePlayer}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      </React.Fragment>
    );
  }

  _onChange = (e) => {
    const convertedNumTickets = this._convertToNumTickets(e.target.value);
    // console.log(convertedNumTickets);
    this.setState({
      value: e.target.value,
      numMoreTickets: convertedNumTickets,
      odds: this._calculateOdds(Number(convertedNumTickets)),
      currentOdds: this._calculateInitialOdds(
        this.props.lottery.numTickets.toNumber()
      ),
    });
  };
  _timeConverter = (UNIX_timestamp) => {
    const a = new Date(UNIX_timestamp * 1000);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const year = a.getFullYear();
    const month = months[a.getMonth()];
    const date = a.getDate();
    const hour = a.getHours();
    const min = a.getMinutes();
    const sec = a.getSeconds();
    const time =
      date + " " + month + " " + year + " " + hour + ":" + min + ":" + sec;
    return time;
  };
  _calculateInitialOdds = (numTickets) => {
    if (numTickets === 0) return 0;
    const { numTotalTickets } = this.props.lottery;
    let odds = ((numTickets / numTotalTickets.toNumber()) * 100).toFixed(2);
    return odds;
  };
  _calculateOdds = (numNewTickets) => {
    if (numNewTickets === 0) return 0;
    const { numTotalTickets, numTickets } = this.props.lottery;
    let odds = (
      ((numNewTickets + numTickets.toNumber()) /
        (numTotalTickets.toNumber() + numNewTickets)) *
      100
    ).toFixed(2);
    return odds;
  };
  _handleMintLotteryTickets = () => {
    this.props._handleMintLotteryTickets(this.state.value);
  };
  _convertToNumTickets = (value) => {
    if (value !== "" && value !== 0) {
      return ethers.utils
        .parseUnits(value)
        .div(this.props.lottery.minDrawingIncrement)
        .toNumber();
    }
    return 0;
  };
  _handleWithdrawWinnings = () => {
    this.props.withdrawWinnings(this.props.lottery.id.toNumber());
  };
}

export default PreviousLotteryDisplay;
