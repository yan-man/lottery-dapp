import React, { Component } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import { ethers } from "ethers";

class ActiveLotteryDisplay extends Component {
  constructor(props) {
    super(props);
    this.initialState = {
      value: "",
      numMoreTickets: 0,
      odds: 0,
      currentOdds: this._calculateInitialOdds(
        props.lottery.numTickets.toNumber()
      ),
      showText: true,
    };
    this.state = this.initialState;
    this._startPollingData();
  }

  render() {
    const { lottery } = { ...this.props };
    return (
      <React.Fragment className="h-100">
        <Col className="col-8">
          <div className="col-12">
            <Form>
              <Form.Group className="mb-3" controlId="formBasicEmail">
                <Form.Label>
                  <h2>
                    How much <b>eth</b> do you want to mint?
                  </h2>
                  <p>
                    <Form.Text className="text-muted">
                      You will get odds proportional to the amount of tickets
                      you mint.
                    </Form.Text>
                  </p>
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
                  {this.state.value !== 0 &&
                    this.state.value !== "" &&
                    this.state.showText && (
                      <>
                        You can mint{" "}
                        {Number(this.state.numMoreTickets).toLocaleString("en")}{" "}
                        {lottery.isUserActive && <>more </>}
                        tickets. You would have a {this.state.odds}% chance of
                        winning!
                      </>
                    )}
                </Form.Text>
              </Form.Group>
            </Form>
          </div>
          <div className="p-5 d-flex justify-content-center">
            <Button
              variant="primary"
              type="submit"
              onClick={this._handleMintLotteryTickets}
              className="btn-success px-5 py-2"
              type="button"
              style={{ fontSize: "20px" }}
            >
              Mint
            </Button>
          </div>
          <div className="d-flex ">
            {lottery.isUserActive && (
              <>
                <h4 className="justify-content-center">
                  You currently have a {this.state.currentOdds}% chance to win.
                </h4>
              </>
            )}
          </div>
          <div>
            <h4>
              Total Tickets Minted:{" "}
              {lottery.numTotalTickets.toNumber().toLocaleString("en")}
            </h4>
            <p>
              {`My Tickets: ${
                lottery.isUserActive
                  ? lottery.numTickets.toNumber().toLocaleString("en")
                  : 0
              }`}
            </p>
          </div>
        </Col>
        <div className="row">
          <div className="col-12">
            <h3>Active Lottery </h3>
            <p>ID#{lottery.lotteryId.toString()}</p>
            <p>
              Start of Minting:{" "}
              {this._timeConverter(lottery.startTime.toString())}
            </p>
            <p>
              End of Minting: {this._timeConverter(lottery.endTime.toString())}
            </p>
          </div>
        </div>
        <div className="row">
          <div className="col-16">
            <Row>
              <Col>
                <h4>
                  Total Degens:{" "}
                  {lottery.numActivePlayers.toNumber().toLocaleString("en")}{" "}
                </h4>
              </Col>
            </Row>
          </div>

          <div>
            <h2>Current Players</h2>
            <ul>
              {lottery.numActivePlayers.gt(0) ? (
                <>
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
                </>
              ) : (
                <>
                  <li>Empty</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </React.Fragment>
    );
  }
  _onChange = (e) => {
    const convertedNumTickets = this._convertToNumTickets(e.target.value);
    this.setState({
      value: e.target.value,
      numMoreTickets: convertedNumTickets,
      odds: this._calculateOdds(Number(convertedNumTickets)),
      /* TASK: DRY currentOdds this into separate function, 
      gets called a lot - calculateCurrentOdds
      recalculate it more frequently
      maybe move it to being a passed prop
       */
      currentOdds: this._calculateInitialOdds(
        this.props.lottery.numTickets.toNumber()
      ),
      showText: true,
    });
  };
  _startPollingData() {
    this._pollDataInterval = setInterval(() => {
      this.setState({
        currentOdds: this._calculateInitialOdds(
          this.props.lottery.numTickets.toNumber()
        ),
        showText: this.state.value !== "",
      });
    }, 3000);
  }
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
    this.props._handleMintLotteryTickets(this.state.value) &&
      this.setState({
        currentOdds: this._calculateInitialOdds(
          this.props.lottery.numTickets.toNumber()
        ),
      });
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
}

export default ActiveLotteryDisplay;
