const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { ethers, waffle } = require("hardhat");

describe("Lottery contract", function () {
  let Lottery;
  let LotteryContract;
  let addrs;
  const unixtimeNow = Math.floor(Date.now() / 1000);
  const daysInSeconds = 24 * 3600;
  const expectedMinAmountInWei = BigNumber.from("100000000000000");

  beforeEach(async function () {
    Lottery = await ethers.getContractFactory("Lottery");
    [...addrs] = await ethers.getSigners();

    LotteryContract = await Lottery.deploy();
    await LotteryContract.deployed();
  });

  // You can nest describe calls to create subsections.
  describe("1)...Deployment", function () {
    it("*Happy Path: Should set the right owner", async function () {
      expect(await LotteryContract.owner()).to.equal(addrs[0].address);
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
      expect(creator).to.equal(addrs[0].address);
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
      expect(player).to.be.equal(addrs[0].address);
      expect(numTicketsMinted).to.be.equal(expectedNumTicketsMinted);

      expect(await LotteryContract.listOfPlayers(0)).to.be.equal(
        addrs[0].address
      );
      expect(await LotteryContract.numActivePlayers()).to.be.equal(1);
      expect(await LotteryContract.numTotalTickets()).to.be.equal(
        numTicketsMinted
      );
      expect(await LotteryContract.players(addrs[0].address)).to.be.equal(true);
      expect(await LotteryContract.tickets(addrs[0].address)).to.be.equal(
        expectedNumTicketsMinted
      );
    });

    describe("...After player1 mints tickets", function () {
      let expectedNumTotalTicketsMinted,
        expectedNumTicketsPlayer1,
        expectedNumTicketsPlayer2;
      beforeEach(async function () {
        const value = ethers.utils.parseEther("1.0");
        const tx = await LotteryContract.mintLotteryTickets({
          value: value, // Sends exactly 1.0 ether
        });
        expectedNumTotalTicketsMinted = value.div(expectedMinAmountInWei);
        expectedNumTicketsPlayer1 = expectedNumTotalTicketsMinted;
      });
      it("Should mint lottery tickets for new player2", async function () {
        const value = ethers.utils.parseEther("0.5");
        const tx = await LotteryContract.connect(addrs[1]).mintLotteryTickets({
          value: value, // Sends exactly 1.0 ether
        });
        const receipt = await tx.wait();

        player2 = addrs[1].address;

        const expectedNumTicketsMinted = value.div(expectedMinAmountInWei);
        expectedNumTotalTicketsMinted = expectedNumTotalTicketsMinted.add(
          expectedNumTicketsMinted
        );

        const { player, numTicketsMinted } = { ...receipt.events[0].args };
        expect(player).to.be.equal(player2);
        expect(numTicketsMinted).to.be.equal(expectedNumTicketsMinted);

        expect(await LotteryContract.listOfPlayers(1)).to.be.equal(player2);
        expect(await LotteryContract.numActivePlayers()).to.be.equal(2);
        expect(await LotteryContract.numTotalTickets()).to.be.equal(
          expectedNumTotalTicketsMinted
        );
        expect(await LotteryContract.players(player2)).to.be.equal(true);
        expect(await LotteryContract.tickets(player2)).to.be.equal(
          expectedNumTicketsMinted
        );
      });
      describe("...After player2 mints tickets", function () {
        beforeEach(async function () {
          const value = ethers.utils.parseEther("0.5");
          await LotteryContract.connect(addrs[1]).mintLotteryTickets({
            value: value,
          });
          expectedNumTotalTicketsMinted = expectedNumTotalTicketsMinted.add(
            value.div(expectedMinAmountInWei)
          );
          expectedNumTicketsPlayer2 = value.div(expectedMinAmountInWei);
        });
        it("Should mint more lottery tickets for player1", async function () {
          const value = ethers.utils.parseEther("0.1");
          const tx = await LotteryContract.mintLotteryTickets({
            value: value,
          });
          const receipt = await tx.wait();

          const expectedNumTicketsMinted = value.div(expectedMinAmountInWei);
          expectedNumTicketsPlayer1 = expectedNumTicketsPlayer1.add(
            expectedNumTicketsMinted
          );
          expectedNumTotalTicketsMinted = expectedNumTotalTicketsMinted.add(
            expectedNumTicketsMinted
          );

          // check emitted event - player addr added / num lotto tickets granted
          const { player, numTicketsMinted } = { ...receipt.events[0].args };
          expect(player).to.be.equal(addrs[0].address);
          expect(numTicketsMinted).to.be.equal(expectedNumTicketsMinted);

          expect(await LotteryContract.listOfPlayers(0)).to.be.equal(
            addrs[0].address
          );
          expect(await LotteryContract.numActivePlayers()).to.be.equal(2);
          expect(await LotteryContract.numTotalTickets()).to.be.equal(
            expectedNumTotalTicketsMinted
          );
          expect(await LotteryContract.numTotalTickets()).to.be.equal(
            expectedNumTicketsPlayer1.add(expectedNumTicketsPlayer2)
          );
          expect(await LotteryContract.players(addrs[0].address)).to.be.equal(
            true
          );
          expect(await LotteryContract.tickets(addrs[0].address)).to.be.equal(
            expectedNumTicketsPlayer1
          );
        });
        describe("...After more lottery tickets for player1 are minted", function () {
          beforeEach(async function () {
            const value = ethers.utils.parseEther("0.1");
            const tx = await LotteryContract.mintLotteryTickets({
              value: value,
            });
            const expectedNumTicketsMinted = value.div(expectedMinAmountInWei);
            expectedNumTotalTicketsMinted = expectedNumTotalTicketsMinted.add(
              expectedNumTicketsMinted
            );
          });
          it("Should trigger lottery drawing", async function () {
            // check ticket distribution, perform randomized drawing, designated winner, deposited prize, reset
            // emit event
            // console.log(await LotteryContract.tickets(addrs[0].address));
            // console.log(await LotteryContract.tickets(addrs[1].address));
            await LotteryContract.triggerLotteryDrawing();
            const winningTicket = await LotteryContract.winningTicket();

            expect(winningTicket.addr).to.be.equal(
              "0x0000000000000000000000000000000000000000"
            );
          });
          describe("...After lottery triggered", function () {
            beforeEach(async function () {
              // trigger lottery
              await LotteryContract.triggerLotteryDrawing();
            });
            it("Should find winning address", async function () {
              const winningTicket = await LotteryContract.winningTicket();
              const winningTicketIndex = winningTicket.winningTicketIndex;

              await LotteryContract.findWinningAddress(
                winningTicketIndex.toNumber()
              );
              const winningTicketFull = await LotteryContract.winningTicket();
              expect(winningTicketFull.winningTicketIndex).to.be.equal(
                winningTicketIndex
              );
            });
            describe("...After winning address found", function () {
              let winningTicketFull;
              beforeEach(async function () {
                const winningTicket = await LotteryContract.winningTicket();
                const winningTicketIndex = winningTicket.winningTicketIndex;

                await LotteryContract.findWinningAddress(
                  winningTicketIndex.toNumber()
                );
                winningTicketFull = await LotteryContract.winningTicket();
              });
              it("Should deposit winnings", async function () {
                const currentLotteryId =
                  await LotteryContract.currentLotteryId();
                await LotteryContract.triggerDepositWinnings();

                // total winnings, prize amount is number of tickets x ticket denomination
                const expectedWinnings = expectedNumTotalTicketsMinted.mul(
                  expectedMinAmountInWei
                );
                expect(
                  await LotteryContract.pendingWithdrawals(
                    currentLotteryId.toNumber(),
                    winningTicketFull.addr
                  )
                ).to.be.equal(expectedWinnings);
              });
              describe("...After deposit winnings", function () {
                let expectedWinnings, currentLotteryId;
                beforeEach(async function () {
                  currentLotteryId = await LotteryContract.currentLotteryId();
                  await LotteryContract.triggerDepositWinnings();
                  expectedWinnings = expectedNumTotalTicketsMinted.mul(
                    expectedMinAmountInWei
                  );
                });
                it("Should allow winner to withdarw", async function () {
                  // winner should withdraw winnings
                  const winningAddr = addrs.filter((addr) => {
                    return addr.address == winningTicketFull.addr;
                  })[0];
                  console.log(
                    await LotteryContract.pendingWithdrawals(
                      currentLotteryId.toNumber(),
                      winningTicketFull.addr
                    )
                  );
                  // console.log(addrs[1] == winningAddr);
                  // console.log(winningAddr);
                  // console.log(addrs[1]);
                  const tx = await LotteryContract.connect(
                    winningAddr
                  ).withdraw(currentLotteryId.toNumber());
                  // // console.log(tx);
                  const receipt = await tx.wait();

                  const { winnerAddress, lotteryId } = {
                    ...receipt.events[0].args,
                  };

                  // console.log(winnerAddress);
                  // console.log(lotteryId);

                  console.log(receipt.events[0].args);

                  // const provider = waffle.provider;
                  // const balance0ETH = await provider.getBalance(
                  //   addrs[1].address
                  // );
                  // console.log(balance0ETH);
                });
              });
            });
          });
          it("Should not trigger lottery drawing if not owner", async function () {});
        });
      });
    });
  });

  // need to test after first lottery triggered and data is overwritten on 2nd one
});
