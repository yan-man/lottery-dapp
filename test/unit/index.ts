import { ethers, waffle } from "hardhat";
import { Wallet } from "ethers";
import { unitLotteryFixture } from "../shared/fixtures";
import { Lottery } from "../../typechain-types";
import LotterySpec from "./Lottery/Lottery.spec";

describe("Unit tests", async () => {
  before(async function () {
    const wallets = waffle.provider.getWallets();
    this.loadFixture = waffle.createFixtureLoader(wallets);

    this.signers = wallets;
    this.mocks = {};
    this.users = {};
    this.orgs = {};

    this.users.deployer = this.signers[0]; // in practice, this would be the Appraiser contract
    this.users.ashylarry = this.signers[1];
    this.users.tybiggums = this.signers[2];
    this.users.rickjames = this.signers[3];
    this.users.dave = this.signers[4];
    this.users.prince = this.signers[5];

    this.orgs.WacArnolds = this.signers[10];
    this.orgs.studio54 = this.signers[11];
  });
  describe(`Lottery`, async () => {
    beforeEach(async function () {
      const {
        lottery,
      }: {
        lottery: Lottery;
      } = await this.loadFixture(unitLotteryFixture);
      this.lottery = lottery;
    });
    LotterySpec.shouldManageLottery();
  });
});
