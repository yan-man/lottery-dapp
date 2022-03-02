import React from "react";

const Rules = (props) => {
  return (
    <div>
      <h3>Ground Rules</h3>
      <p>
        Individual Ticket Cost: <b>{props.minDrawingIncrement} eth</b>
      </p>
      <p>Max Degens Allowed: {props.maxPlayersAllowed}</p>
    </div>
  );
};

export default Rules;
