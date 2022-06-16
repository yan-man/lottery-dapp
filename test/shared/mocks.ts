import { waffle } from "hardhat";
import { MockContract } from "ethereum-waffle";
import { Signer } from "ethers";
import Lottery_ABI from "../../artifacts/contracts/Lottery.sol/Lottery.json";

const deployMockLottery = async (deployer: Signer): Promise<MockContract> => {
  const Lottery = await waffle.deployMockContract(deployer, Lottery_ABI.abi);
  return Lottery;
};

export { deployMockLottery };
