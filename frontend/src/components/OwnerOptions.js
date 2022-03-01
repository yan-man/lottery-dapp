import React, { Component } from "react";
import Button from "react-bootstrap/Button";

class OwnerOptions extends Component {
  state = {};
  handleInitLottery = () => {
    this.props._initLottery();
  };
  _handleTriggerLotteryDrawing = () => {
    this.props._triggerLotteryDrawing();
  };
  _handleTriggerSetLotteryInactive = () => {
    this.props._triggerSetLotteryInactive();
  };
  render() {
    return (
      <React.Fragment>
        <div>
          <p>
            *As the owner, you can also create new lotteries and do other shit.
          </p>
          <p>
            <Button
              onClick={this.handleInitLottery}
              type="button"
              className="btn btn-warning"
            >
              Create a new lottery
            </Button>
          </p>
          <p>
            <Button
              onClick={this._handleTriggerLotteryDrawing}
              type="button"
              className="btn btn-warning"
            >
              Trigger Lottery Drawing
            </Button>
          </p>
          <p>
            <Button
              onClick={this._handleTriggerSetLotteryInactive}
              type="button"
              className="btn btn-warning"
            >
              Set Lottery Inactive
            </Button>
          </p>
        </div>
      </React.Fragment>
    );
  }
}

export default OwnerOptions;
