const { expect } = require("chai");

describe("Lottery contract", function () {
  let Lottery;
  let LotteryContract;
  let owner;
  let addr1;
  let addr2;
  let addrs;
  const unixtimeNow = Math.floor(Date.now() / 1000);
  const daysInSeconds = 24 * 3600;

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

    it("Should return default values", async function () {
      expect(await LotteryContract.MIN_DRAWING_INCREMENT()).to.equal(
        100000000000000
      );
      expect(await LotteryContract.NUMBER_OF_DAYS()).to.equal(7);
      expect(await LotteryContract.maxPlayersAllowed()).to.equal(1000);
      expect(await LotteryContract.currentLotteryId()).to.equal(0);
    });

    it("Should set new max players allowed", async function () {
      const tx = await LotteryContract.setMaxPlayersAllowed(3);
      const receipt = await tx.wait();

      const { maxPlayersAllowed } = receipt.events[0].args;
      expect(maxPlayersAllowed).to.equal(3);

      expect(await LotteryContract.maxPlayersAllowed()).to.equal(3);
    });

    it("Should initialize a new lottery from admin", async function () {
      const numDays = 10;
      const tx = await LotteryContract.initLottery(unixtimeNow, numDays);
      const receipt = await tx.wait();

      const expectedStartTime = unixtimeNow;
      const expectedEndTime = unixtimeNow + numDays * daysInSeconds;
      const { creator, startTime, endTime } = receipt.events[0].args;

      expect(receipt.events.length).to.equal(1); // 1 event emitted
      expect(creator).to.equal(owner.address);
      expect(startTime).to.equal(expectedStartTime);
      expect(endTime).to.equal(expectedEndTime);

      const currentLotteryId = await LotteryContract.currentLotteryId();
      expect(currentLotteryId).to.equal(0);

      // console.log(currentLotteryId);

      const lottery = {
        ...(await LotteryContract.getLottery(currentLotteryId.toNumber())),
      };

      expect(lottery.startTime.toNumber()).to.equal(expectedStartTime);
      expect(lottery.endTime.toNumber()).to.equal(expectedEndTime);
      expect(lottery.isActive).to.be.true;
    });

    it("Should not allow new lottery to be initialized by non admin", async function () {});
  });

  describe("After first already lottery initialized", function () {
    beforeEach(async function () {
      const tx = await LotteryContract.initLottery(unixtimeNow, 1);
    });
    it("Should not allow an invalid lottery to be saved", async function () {
      await expect(
        LotteryContract.initLottery(unixtimeNow, 7)
      ).to.be.revertedWith(
        "current lottery must be inactive to save a new one"
      );
    });
    it("Should not allow an invalid lottery to be saved", async function () {
      await LotteryContract.initLottery(unixtimeNow + daysInSeconds * 1, 7);
    });
    // it("Should initialize a new lottery", async function () {
    //   console.log(await LotteryContract.currentLotteryId());
    // });
  });

  // describe("After first already lottery initialized", function () {
  //   beforeEach(async function () {
  //     await LotteryContract.initLottery();
  //     // console.log(await LotteryContract.initLottery());
  //   });
  //   it("Should initialize a new lottery", async function () {
  //     console.log(await LotteryContract.currentLotteryId());
  //   });
  //   it("Should initialize a new lottery", async function () {
  //     console.log(await LotteryContract.currentLotteryId());
  //   });
  // });
});
