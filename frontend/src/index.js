import React from "react";
import ReactDOM from "react-dom";
import { Dapp } from "./components/Dapp";
import "@fontsource/roboto";

// We import bootstrap here, but you can remove if you want
import "bootstrap/dist/css/bootstrap.css";
import "./styles/index.css";

// This is the entry point of your application, but it just renders the Dapp
// react component. All of the logic is contained in it.

ReactDOM.render(
  <React.StrictMode>
    <Dapp />
  </React.StrictMode>,
  document.getElementById("root")
);
