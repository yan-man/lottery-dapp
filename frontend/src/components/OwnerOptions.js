import React, { Component } from "react";

class OwnerOptions extends Component {
  state = {};
  handleInitLottery = () => {
    this.props._initLottery();
  };
  render() {
    return (
      <div>
        <p>
          *As the owner, you can also create new lotteries and do other shit.
        </p>
        <button
          onClick={this.handleInitLottery}
          type="button"
          className="btn btn-warning"
        >
          Create a new lottery
        </button>
      </div>
    );
  }
}

export default OwnerOptions;
