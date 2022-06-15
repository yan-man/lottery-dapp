import { ContractFactory } from "ethers";
import { run, ethers, network, artifacts } from "hardhat";
import { Artifact } from "hardhat/types";
import { Lottery } from "../typechain-types";

// This is a script for deploying your contracts. You can adapt it to deploy
// yours, or create new ones.
async function main() {
  await run("compile");
  // This is just a convenience check
  if (network.name === "hardhat") {
    console.warn(
      "You are trying to deploy a contract to the Hardhat Network, which" +
        "gets automatically created and destroyed every time. Use the Hardhat" +
        " option '--network localhost'"
    );
  }

  // ethers is available in the global scope
  const [deployer] = await ethers.getSigners();
  console.log(
    "Deploying the contracts with the account:",
    await deployer.getAddress()
  );

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const Lottery: ContractFactory = await ethers.getContractFactory("Lottery");
  const lottery: Lottery = (await Lottery.deploy()) as Lottery;
  await lottery.deployed();

  console.log("Lottery contract address:", lottery.address);

  // We also save the contract's artifacts and address in the frontend directory
  saveFrontendFiles(lottery);
}

function saveFrontendFiles(lottery: Lottery) {
  const fs = require("fs");
  const contractsDir = __dirname + "/../frontend/src/contracts";

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  fs.writeFileSync(
    contractsDir + "/contract-address.json",
    JSON.stringify({ Lottery: lottery.address }, undefined, 2)
  );

  const LotteryArtifact: Artifact = artifacts.readArtifactSync("Lottery");

  fs.writeFileSync(
    contractsDir + "/Lottery.json",
    JSON.stringify(LotteryArtifact, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
