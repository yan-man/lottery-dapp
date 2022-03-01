import React, { Component } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";

class OwnerOptions extends Component {
  state = {};
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
          <div className="col-12">
            <Form>
              <Form.Group className="mb-3" controlId="formBasicEmail">
                <Form.Label>
                  How much eth do you want to convert into lottery tickets?
                </Form.Label>
                <Form.Control
                  type="email"
                  placeholder={`Min Buy In: ${"asdf"}`}
                />
                <Form.Text className="text-muted">
                  We'll never share your email with anyone else.
                </Form.Text>
              </Form.Group>
              <Button
                variant="primary"
                type="submit"
                onClick={this.handleInitLottery}
                type="button"
                className="btn btn-warning"
              >
                Submit
              </Button>
            </Form>
          </div>
        </div>
      </React.Fragment>
    );
  }
}

export default OwnerOptions;
