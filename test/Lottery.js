const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { ethers, waffle } = require("hardhat");

describe("Lottery contract", function () {
  let Lottery;
  let LotteryContract;
  let addrs;
  const unixtimeNow = Math.floor(Date.now() / 1000);
  const hoursInSeconds = 3600;
  const expectedMinAmountInWei = BigNumber.from("100000000000000");

  beforeEach(async function () {
    Lottery = await ethers.getContractFactory("Lottery");
    [...addrs] = await ethers.getSigners();

    LotteryContract = await Lottery.deploy();
    await LotteryContract.deployed();
  });

  // You can nest describe calls to create subsections.
  describe("1)...Deployment", function () {
    // assume all variables related to uint256 are BigNumbers
    it("*Happy Path: Should set the right owner", async function () {
      expect(await LotteryContract.owner()).to.equal(addrs[0].address);
    });

    it("Should return default values", async function () {
      expect(await LotteryContract.MIN_DRAWING_INCREMENT()).to.equal(
        expectedMinAmountInWei
      );
      expect(await LotteryContract.NUMBER_OF_HOURS()).to.equal(168);
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
      const numHours = 7 * 24;
      const tx = await LotteryContract.initLottery(unixtimeNow, numHours);
      const receipt = await tx.wait();

      const expectedStartTime = unixtimeNow;
      const expectedEndTime = unixtimeNow + numHours * hoursInSeconds;
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
    /// TASK: maybe put currentLotteryId into lottery object
    /// for later tests when multiple lottos will be added (maybe concurrently)
    let currentLotteryId, owner;
    beforeEach(async function () {
      const tx = await LotteryContract.initLottery(unixtimeNow, 1);
      currentLotteryId = await LotteryContract.currentLotteryId();
      owner = addrs[0];
    });
    it("Should not allow an invalid lottery to be saved", async function () {
      await expect(
        LotteryContract.initLottery(unixtimeNow, 0)
      ).to.be.revertedWith(
        "current lottery must be inactive to save a new one"
      );
    });
    it("Should set existing lottery to be inactive", async function () {
      await LotteryContract.setLotteryInactive();
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
      /// TASK
      /// refactor players to be one large array with all players, rather than each being coded as separate variable
      /// 30 min
      const players = [];
      let expectedNumTotalTicketsMinted;
      beforeEach(async function () {
        const player1 = addrs[0];
        const mintValue = ethers.utils.parseEther("1.0");
        const tx = await LotteryContract.mintLotteryTickets({
          value: mintValue, // Sends exactly 1.0 ether
        });
        expectedNumTotalTicketsMinted = BigNumber.from(
          mintValue.div(expectedMinAmountInWei)
        );
        players[0] = {
          addr: player1,
          mintValue: mintValue,
          expectedNumTickets: expectedNumTotalTicketsMinted,
          numTickets: await LotteryContract.tickets(player1.address),
        };

        /// TASK
        /// write a test to always check that total # of tickets per address is expected
        /// loop thru all players; match their expected mint # with their actual from contract state
      });
      it("Should mint lottery tickets for new player2", async function () {
        const player2 = addrs[1];

        const mintValue = ethers.utils.parseEther("0.5"); // eth
        const tx = await LotteryContract.connect(player2).mintLotteryTickets({
          value: mintValue,
        });
        const receipt = await tx.wait();

        const expectedNumTicketsMinted = mintValue.div(expectedMinAmountInWei);
        expectedNumTotalTicketsMinted = expectedNumTotalTicketsMinted.add(
          expectedNumTicketsMinted
        );

        // event logs tests
        const { player, numTicketsMinted } = { ...receipt.events[0].args };
        expect(player).to.be.equal(player2.address);
        expect(numTicketsMinted).to.be.equal(expectedNumTicketsMinted);

        /// add tests here for # of tickets for given address - tickets getter
        expect(await LotteryContract.listOfPlayers(1)).to.be.equal(
          player2.address
        );
        expect(await LotteryContract.numActivePlayers()).to.be.equal(2);
        expect(await LotteryContract.numTotalTickets()).to.be.equal(
          expectedNumTotalTicketsMinted
        );
        expect(await LotteryContract.players(player2.address)).to.be.equal(
          true
        );
        expect(await LotteryContract.tickets(player2.address)).to.be.equal(
          expectedNumTicketsMinted
        );
      });
      describe("...After player2 mints tickets", function () {
        beforeEach(async function () {
          const mintValue = ethers.utils.parseEther("0.5");
          const player2 = addrs[1];
          await LotteryContract.connect(player2).mintLotteryTickets({
            value: mintValue,
          });
          expectedNumTotalTicketsMinted = expectedNumTotalTicketsMinted.add(
            mintValue.div(expectedMinAmountInWei)
          );
          expectedNumTicketsPlayer2 = mintValue.div(expectedMinAmountInWei);

          players[1] = {
            addr: player2,
            mintValue: mintValue,
            expectedNumTickets: expectedNumTicketsPlayer2,
            numTickets: await LotteryContract.tickets(player2.address),
          };
        });
        it("Should mint more lottery tickets for player1", async function () {
          const value = ethers.utils.parseEther("0.1");
          const tx = await LotteryContract.mintLotteryTickets({
            value: value,
          });
          const receipt = await tx.wait();

          const expectedNumTicketsMinted = value.div(expectedMinAmountInWei);
          expectedNumTicketsPlayer1 = players[0].expectedNumTickets.add(
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
            const mintValue = ethers.utils.parseEther("0.1"); // eth
            const tx = await LotteryContract.connect(
              players[0].addr
            ).mintLotteryTickets({
              value: mintValue,
            });

            /// TASK: maybe turn this into "calculateTicketAmount" function, ie divide by expectedMinAmountInWei
            const expectedNumTicketsMinted = mintValue.div(
              expectedMinAmountInWei
            );
            expectedNumTotalTicketsMinted = expectedNumTotalTicketsMinted.add(
              expectedNumTicketsMinted
            );
            players[0].expectedNumTickets = players[0].expectedNumTickets.add(
              expectedNumTicketsMinted
            );
            players[0].numTickets = await LotteryContract.tickets(
              players[0].addr.address
            );
          });
          it("Should trigger lottery drawing", async function () {
            // check ticket distribution, perform randomized drawing, designated winner, deposited prize, reset
            // emit event
            // console.log(await LotteryContract.tickets(addrs[0].address));
            // console.log(await LotteryContract.tickets(addrs[1].address));
            await LotteryContract.connect(owner).setLotteryInactive();
            const lottery = {
              ...(await LotteryContract.lotteries(0)),
            };

            await LotteryContract.triggerLotteryDrawing();
            const winningTicket = await LotteryContract.winningTicket();

            let ticketDistribution = await Promise.all(
              players.map(async (player, ind) => {
                return await LotteryContract.getTicketDistribution(ind);
              })
            );
            // confirm the winner
            const expectedWinner = ticketDistribution.filter((distribution) => {
              return (
                distribution.startIndex.lte(winningTicket.winningTicketIndex) &&
                distribution.endIndex.gte(winningTicket.winningTicketIndex)
              );
            })[0];

            expect(expectedWinner.playerAddress).to.be.equal(
              winningTicket.addr
            );
            expect(
              expectedWinner.startIndex.lte(winningTicket.winningTicketIndex)
            ).to.be.equal(true);
            expect(
              expectedWinner.endIndex.gte(winningTicket.winningTicketIndex)
            ).to.be.equal(true);
          });
          // describe("...After lottery triggered", function () {
          //   beforeEach(async function () {
          //     // trigger lottery
          //     await LotteryContract.triggerLotteryDrawing();
          //   });
          //   it("Should find winning address", async function () {
          //     const winningTicket = await LotteryContract.winningTicket();
          //     const winningTicketIndex = winningTicket.winningTicketIndex;

          //     await LotteryContract.findWinningAddress(
          //       winningTicketIndex.toNumber()
          //     );
          //     const winningTicketFull = await LotteryContract.winningTicket();
          //     expect(winningTicketFull.winningTicketIndex).to.be.equal(
          //       winningTicketIndex
          //     );
          //   });
          //   describe("...After winning address found", function () {
          //     let winningTicketFull;
          //     beforeEach(async function () {
          //       const winningTicket = await LotteryContract.winningTicket();
          //       const winningTicketIndex = winningTicket.winningTicketIndex;

          //       await LotteryContract.findWinningAddress(
          //         winningTicketIndex.toNumber()
          //       );
          //       winningTicketFull = await LotteryContract.winningTicket();
          //     });
          //     it("Should deposit winnings", async function () {
          //       const currentLotteryId =
          //         await LotteryContract.currentLotteryId();
          //       await LotteryContract.triggerDepositWinnings();

          //       // total winnings, prize amount is number of tickets x ticket denomination
          //       const expectedWinnings = expectedNumTotalTicketsMinted.mul(
          //         expectedMinAmountInWei
          //       );
          //       expect(
          //         await LotteryContract.pendingWithdrawals(
          //           currentLotteryId.toNumber(),
          //           winningTicketFull.addr
          //         )
          //       ).to.be.equal(expectedWinnings);
          //     });
          //     describe("...After deposit winnings", function () {
          //       let expectedWinnings, currentLotteryId, provider;
          //       const winnerBalance = {};

          //       beforeEach(async function () {
          //         provider = waffle.provider;
          //         currentLotteryId = await LotteryContract.currentLotteryId();
          //         winnerBalance.initial = await provider.getBalance(
          //           winningTicketFull.addr
          //         );
          //         await LotteryContract.triggerDepositWinnings();
          //         expectedWinnings = expectedNumTotalTicketsMinted.mul(
          //           expectedMinAmountInWei
          //         );
          //       });
          //       it("Should allow winner to withdarw", async function () {
          //         // winner should withdraw winnings

          //         const expectedWinningAddr = addrs.filter((addr) => {
          //           return addr.address == winningTicketFull.addr;
          //         })[0];
          //         const pendingWithdrawal =
          //           await LotteryContract.pendingWithdrawals(
          //             currentLotteryId.toNumber(),
          //             expectedWinningAddr.address
          //           );

          //         expect(pendingWithdrawal).to.be.equal(expectedWinnings);

          //         const tx = await LotteryContract.connect(
          //           expectedWinningAddr
          //         ).withdraw(currentLotteryId.toNumber());
          //         const receipt = await tx.wait();

          //         const { winnerAddress, withdrawalAmount } = {
          //           ...receipt.events[0].args,
          //         };

          //         expect(winnerAddress).to.be.equal(
          //           expectedWinningAddr.address
          //         );
          //         expect(pendingWithdrawal).to.be.equal(withdrawalAmount);

          //         winnerBalance.final = await provider.getBalance(
          //           winnerAddress
          //         );

          //         const winningsWithdrawnSuccessfully = winnerBalance.final.sub(
          //           winnerBalance.initial
          //         );

          //         // expect deposited winnings; ie at least some eth deposited
          //         expect(winningsWithdrawnSuccessfully).to.be.above(0);
          //         // expect winnings to be the expected winnings, minus gas and commission fees
          //         expect(expectedWinnings).to.be.above(
          //           winningsWithdrawnSuccessfully
          //         );
          //       });
          //     });
          //   });
          // });
          it("Should not trigger lottery drawing if not owner", async function () {});
        });
      });
    });
  });

  // need to test after first lottery triggered and data is overwritten on 2nd one
});
