import React, { Component } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { ethers } from "ethers";

class OwnerOptions extends Component {
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
  render() {
    const { lottery } = { ...this.props };
    return (
      <React.Fragment>
        <div className="row">
          <div className="col-12">
            <h3>Active Lottery </h3>
            <p>ID#: {lottery.lotteryId.toString()}</p>
            <p>
              Start Time: {this._timeConverter(lottery.startTime.toString())}
            </p>
            <p>End Time: {this._timeConverter(lottery.endTime.toString())}</p>
          </div>
        </div>
        <div className="row">
          <div className="col-16">
            <h2>
              Total Degens:{" "}
              {lottery.numActivePlayers.toNumber().toLocaleString("en")}{" "}
              {lottery.isUserActive && <>{`(Including me!)`}</>}
            </h2>
            <h2>
              Total Tickets Minted:{" "}
              {lottery.numTotalTickets.toNumber().toLocaleString("en")}{" "}
              {lottery.isUserActive && (
                <>{`(You've already minted ${lottery.numTickets
                  .toNumber()
                  .toLocaleString("en")})`}</>
              )}
            </h2>
          </div>
          <div className="col-12">
            <Form>
              <Form.Group className="mb-3" controlId="formBasicEmail">
                <Form.Label>
                  How much eth do you want to convert into lottery tickets?
                </Form.Label>
                <Form.Control
                  type="number"
                  value={this.state.value}
                  onChange={this._onChange}
                  placeholder={`Min: ${ethers.utils.commify(
                    ethers.utils
                      .formatUnits(lottery.minDrawingIncrement)
                      .toString()
                  )} eth`}
                />
                <Form.Text className="text-muted">
                  You will get odds proportional to the amount of tickets you
                  mint
                </Form.Text>
              </Form.Group>
              <Button
                variant="primary"
                type="submit"
                onClick={this._handleMintLotteryTickets}
                type="button"
                className="btn btn-warning"
              >
                Mint
              </Button>
            </Form>
          </div>
          <h2>
            {lottery.isUserActive && (
              <>You currently have a {this.state.currentOdds}% chance to win.</>
            )}
          </h2>
          <h2>
            {this.state.value !== 0 && this.state.value !== "" && (
              <>
                You can mint{" "}
                {Number(this.state.numMoreTickets).toLocaleString("en")}{" "}
                {lottery.isUserActive && <>more </>}
                tickets. You would have a {this.state.odds}% chance of winning!
              </>
            )}
          </h2>
          <hr />
          <div>
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
          </div>
        </div>
      </React.Fragment>
    );
  }
}

export default OwnerOptions;
