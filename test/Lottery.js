const { expect } = require("chai");

describe("Lottery contract", function () {
  let Lottery;
  let LotteryContract;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  beforeEach(async function () {
    Lottery = await ethers.getContractFactory("Lottery");
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    LotteryContract = await Lottery.deploy();

    console.log("first be");
    await LotteryContract.deployed();
  });

  // You can nest describe calls to create subsections.
  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await LotteryContract.owner()).to.equal(owner.address);
    });

    it("Should initialize a new lottery", async function () {
      const tx = await LotteryContract.initLottery();
      const receipt = await tx.wait();

      for (const event of receipt.events) {
        console.log(`Event ${event.event} with args ${event.args}`);
      }

      const lotteryId = await LotteryContract.currentLotteryId();
      expect(lotteryId).to.equal(1);

      const lottery = {
        ...(await LotteryContract.getLottery(lotteryId.toNumber())),
      };

      expect(lottery.dateEnd.sub(lottery.dateStart).toNumber()).to.equal(
        3600 * 24 * 7
      );
    });

    // it("Should assign the total supply of tokens to the owner", async function () {
    //   const ownerBalance = await hardhatToken.balanceOf(owner.address);
    //   expect(await hardhatToken.totalSupply()).to.equal(ownerBalance);
    // });
  });

  describe("After lottery initialized", function () {
    beforeEach(async function () {
      await LotteryContract.initLottery();
      // console.log(await LotteryContract.initLottery());
    });
    it("Should initialize a new lottery", async function () {
      console.log(await LotteryContract.currentLotteryId());
    });
    it("Should initialize a new lottery", async function () {
      console.log(await LotteryContract.currentLotteryId());
    });
  });
});
