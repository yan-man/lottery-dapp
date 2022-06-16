import { Fixture, MockContract } from "ethereum-waffle";
import { ContractFactory, Wallet } from "ethers";
import { ethers } from "hardhat";
import { Lottery } from "../../typechain-types";
import { deployMockLottery } from "./mocks";

type UnitLotteryFixtureType = {
  lottery: Lottery;
};

const unitLotteryFixture: Fixture<UnitLotteryFixtureType> = async (
  signers: Wallet[]
) => {
  const deployer: Wallet = signers[0];

  const lotteryFactory: ContractFactory = await ethers.getContractFactory(
    `Lottery`
  );
  const lottery: Lottery = (await lotteryFactory
    .connect(deployer)
    .deploy()) as Lottery;
  await lottery.deployed();

  return { lottery };
};

export { unitLotteryFixture };
