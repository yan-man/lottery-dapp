import React from "react";

const Footer = (props) => {
  return (
    <footer class="footer mt-auto py-3 bg-light">
      <div class="container">
        <span class="text-muted">
          <div>Me: {props.myAddress}</div>
          <div>Contract Owner: {props.owner}</div>
        </span>
      </div>
    </footer>
  );
};

export default Footer;
