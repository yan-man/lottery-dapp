import React, { Component } from "react";
import Button from "react-bootstrap/Button";
const { BigNumber } = require("ethers");
class OwnerOptions extends Component {
  constructor(props) {
    super(props);

    this._initialState = {};
    this.state = this._initialState;
  }
  handleInitLottery = () => {
    this.props._initLottery();
  };
  _handleTriggerLotteryDrawing = () => {
    this.props._triggerLotteryDrawing();
  };
  _handleTriggerSetLotteryInactive = () => {
    this.props._triggerSetLotteryInactive();
  };
  /* TASK: refactor this unixtime function into separate utility function
   */
  _unixtimeNow = () => {
    return Math.floor(Date.now() / 1000);
  };
  render() {
    return (
      <React.Fragment>
        <div className="col-8">
          <p>
            Because you're the owner, you can also create new lotteries and do
            other shit.
          </p>
          <p>
            {!this.props.lottery.isCreated && (
              <Button
                onClick={this.handleInitLottery}
                type="button"
                className="btn-primary"
              >
                Create a new lottery
              </Button>
            )}

            {this.props.lottery.isCompleted && (
              <h1>Redeploy the Contract to Start Over</h1>
            )}
          </p>
          <p>
            {this.props.lottery.isActive && (
              <Button
                onClick={this._handleTriggerSetLotteryInactive}
                type="button"
                className="btn btn-danger"
              >
                {/* TASK: better button name, confusing. Maybe like close minting period? something */}
                [Emergency] End Minting Period
              </Button>
            )}
          </p>
          <p>
            {!this.props.lottery.isActive &&
              this.props.lottery.isCreated &&
              !this.props.lottery.isCompleted && (
                <Button
                  onClick={this._handleTriggerLotteryDrawing}
                  type="button"
                  className="btn btn-warning"
                >
                  Start Lottery Drawing
                </Button>
              )}
          </p>
        </div>
      </React.Fragment>
    );
  }
}

export default OwnerOptions;
