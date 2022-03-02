import React from "react";

import { Card, ListGroup, ListGroupItem } from "react-bootstrap";

const Rules = (props) => {
  return (
    <Card style={{ width: "18rem", float: "right" }}>
      <Card.Body>
        <Card.Title>Ground Rules</Card.Title>
        <Card.Text>Even DEGENS got rules.</Card.Text>
      </Card.Body>
      <ListGroup className="list-group-flush">
        <ListGroupItem>
          <ul>
            <li>
              Ticket Floor: <b>{props.minDrawingIncrement} eth</b>
            </li>
            <li>Max DEGENS Allowed Per Lottery: {props.maxPlayersAllowed}</li>
          </ul>
        </ListGroupItem>
      </ListGroup>
      {/* <span>
        <h3>Ground Rules</h3>
        <p>
          Individual Ticket Cost: <b>{props.minDrawingIncrement} eth</b>
        </p>
        <p>Max Degens Allowed: {props.maxPlayersAllowed}</p>
      </span> */}
    </Card>
  );
};

export default Rules;
