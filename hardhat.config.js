require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("hardhat-contract-sizer");

// The next line is part of the sample project, you don't need it in your
// project. It imports a Hardhat task definition, that can be used for
// testing the frontend.
require("./tasks/faucet");

// If you are using MetaMask, be sure to change the chainId to 1337
module.exports = {
  solidity: "0.8.12",
  networks: {
    hardhat: {
      chainId: 31337,
    },
  },
};
