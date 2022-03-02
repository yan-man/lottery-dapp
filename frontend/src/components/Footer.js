import React from "react";

const Footer = (props) => {
  return (
    <footer className="footer mt-auto py-3 bg-light">
      <div className="container">
        <span className="text-muted">
          <div>Me: {props.myAddress}</div>
          <div>Contract Owner: {props.owner}</div>
        </span>
      </div>
    </footer>
  );
};

export default Footer;
