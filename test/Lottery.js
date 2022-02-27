const { expect } = require("chai");
const { BigNumber } = require("ethers");

describe("Lottery contract", function () {
  let Lottery;
  let LotteryContract;
  let owner;
  let addr1;
  let addr2;
  let addrs;
  const unixtimeNow = Math.floor(Date.now() / 1000);
  const daysInSeconds = 24 * 3600;
  const expectedMinAmountInWei = BigNumber.from("100000000000000");

  beforeEach(async function () {
    Lottery = await ethers.getContractFactory("Lottery");
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    LotteryContract = await Lottery.deploy();
    await LotteryContract.deployed();
  });

  // You can nest describe calls to create subsections.
  describe("1)...Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await LotteryContract.owner()).to.equal(owner.address);
    });

    it("Should return default values", async function () {
      expect(await LotteryContract.MIN_DRAWING_INCREMENT()).to.equal(
        expectedMinAmountInWei
      );
      expect(await LotteryContract.NUMBER_OF_DAYS()).to.equal(7);
      expect(await LotteryContract.maxPlayersAllowed()).to.equal(1000);
      expect(await LotteryContract.currentLotteryId()).to.equal(0);
    });

    it("Should set new max players allowed", async function () {
      const tx = await LotteryContract.setMaxPlayersAllowed(3);
      const receipt = await tx.wait();

      const { maxPlayersAllowed } = { ...receipt.events[0].args };
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

      const lottery = {
        ...(await LotteryContract.lotteries(currentLotteryId.toNumber())),
      };

      expect(lottery.startTime.toNumber()).to.equal(expectedStartTime);
      expect(lottery.endTime.toNumber()).to.equal(expectedEndTime);
      expect(lottery.isActive).to.be.true;
    });

    it("Should not allow new lottery to be initialized by non admin", async function () {});
  });

  describe("2)...After first lottery initialized", function () {
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
    it("Should set existing lottery to be inactive", async function () {
      await LotteryContract.setLotteryInactive();
      const currentLotteryId = await LotteryContract.currentLotteryId();
      const lottery = {
        ...(await LotteryContract.lotteries(currentLotteryId.toNumber())),
      };
      expect(lottery.isActive).to.be.false;
    });

    describe("...After first lottery set inactive", function () {
      beforeEach(async function () {
        await LotteryContract.setLotteryInactive();
      });
      it("Should allow a new lottery to be saved after previous lottery set inactive", async function () {
        await LotteryContract.initLottery(unixtimeNow, 7);
      });
    });

    it("Should not mint lottery tickets for new player1 if funds insufficient", async function () {
      await expect(
        LotteryContract.mintLotteryTickets({
          value: ethers.utils.parseUnits(
            expectedMinAmountInWei.sub(100000).toString(),
            "wei"
          ), // Sends less than min allowed; min amount - 100000
        })
      ).to.be.revertedWith("msg value must be greater than min amount allowed");
    });

    it("Should mint lottery tickets for new player1", async function () {
      const value = ethers.utils.parseEther("1.0");
      const tx = await LotteryContract.mintLotteryTickets({
        value: value, // Sends exactly 1.0 ether
      });
      const receipt = await tx.wait();
      const expectedNumTicketsMinted = value.div(expectedMinAmountInWei);

      // check emitted event details
      const { player, numTicketsMinted } = { ...receipt.events[0].args };
      expect(player).to.be.equal(owner.address);
      expect(numTicketsMinted).to.be.equal(expectedNumTicketsMinted);

      expect(await LotteryContract.listOfPlayers(0)).to.be.equal(owner.address);
      expect(await LotteryContract.numActivePlayers()).to.be.equal(1);
      expect(await LotteryContract.totalNumTickets()).to.be.equal(
        numTicketsMinted
      );
      expect(await LotteryContract.players(owner.address)).to.be.equal(true);
      expect(await LotteryContract.tickets(owner.address)).to.be.equal(
        expectedNumTicketsMinted
      );
    });

    describe("...After player1 mints tickets", function () {
      let expectedTotalNumTicketsMinted, numTicketsPlayer1;
      beforeEach(async function () {
        const value = ethers.utils.parseEther("1.0");
        const tx = await LotteryContract.mintLotteryTickets({
          value: value, // Sends exactly 1.0 ether
        });
        expectedTotalNumTicketsMinted = value.div(expectedMinAmountInWei);
        numTicketsPlayer1 = expectedTotalNumTicketsMinted;
      });
      it("Should mint lottery tickets for new player2", async function () {
        const value = ethers.utils.parseEther("0.5");
        const tx = await LotteryContract.connect(addr1).mintLotteryTickets({
          value: value, // Sends exactly 1.0 ether
        });
        const receipt = await tx.wait();

        player2 = addr1.address;

        const expectedNumTicketsMinted = value.div(expectedMinAmountInWei);
        expectedTotalNumTicketsMinted = expectedTotalNumTicketsMinted.add(
          expectedNumTicketsMinted
        );

        const { player, numTicketsMinted } = { ...receipt.events[0].args };
        expect(player).to.be.equal(player2);
        expect(numTicketsMinted).to.be.equal(expectedNumTicketsMinted);

        expect(await LotteryContract.listOfPlayers(1)).to.be.equal(player2);
        expect(await LotteryContract.numActivePlayers()).to.be.equal(2);
        expect(await LotteryContract.totalNumTickets()).to.be.equal(
          expectedTotalNumTicketsMinted
        );
        expect(await LotteryContract.players(player2)).to.be.equal(true);
        expect(await LotteryContract.tickets(player2)).to.be.equal(
          expectedNumTicketsMinted
        );
      });
      describe("...After player2 mints tickets", function () {
        beforeEach(async function () {
          const value = ethers.utils.parseEther("0.5");
          await LotteryContract.connect(addr1).mintLotteryTickets({
            value: value,
          });
          expectedTotalNumTicketsMinted = expectedTotalNumTicketsMinted.add(
            value.div(expectedMinAmountInWei)
          );
        });
        it("Should mint more lottery tickets for player1", async function () {
          const value = ethers.utils.parseEther("0.1");
          const tx = await LotteryContract.mintLotteryTickets({
            value: value,
          });
          const receipt = await tx.wait();

          const expectedNumTicketsMinted = value.div(expectedMinAmountInWei);
          numTicketsPlayer1 = numTicketsPlayer1.add(expectedNumTicketsMinted);
          expectedTotalNumTicketsMinted = expectedTotalNumTicketsMinted.add(
            expectedNumTicketsMinted
          );

          // check emitted event details
          const { player, numTicketsMinted } = { ...receipt.events[0].args };
          expect(player).to.be.equal(owner.address);
          expect(numTicketsMinted).to.be.equal(expectedNumTicketsMinted);

          expect(await LotteryContract.listOfPlayers(0)).to.be.equal(
            owner.address
          );
          expect(await LotteryContract.numActivePlayers()).to.be.equal(2);
          expect(await LotteryContract.totalNumTickets()).to.be.equal(
            expectedTotalNumTicketsMinted
          );
          expect(await LotteryContract.players(owner.address)).to.be.equal(
            true
          );
          expect(await LotteryContract.tickets(owner.address)).to.be.equal(
            numTicketsPlayer1
          );
        });
      });
    });
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
