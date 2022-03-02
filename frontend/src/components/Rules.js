import React from "react";

import { Card, ListGroup, ListGroupItem } from "react-bootstrap";

const Rules = (props) => {
  return (
    <Card style={{ width: "18rem", float: "right" }}>
      <Card.Img variant="top" src="holder.js/100px180?text=Image cap" />
      <Card.Body>
        <Card.Title>Ground Rules</Card.Title>
        <Card.Text>Even degens got rules.</Card.Text>
      </Card.Body>
      <ListGroup className="list-group-flush">
        <ListGroupItem>
          <ul>
            <li>
              Ticket Floor: <b>{props.minDrawingIncrement} eth</b>
            </li>
            <li>Max Degens Allowed Per Lottery: {props.maxPlayersAllowed}</li>
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
