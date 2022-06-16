import { expect } from "chai";
import { BigNumber, ContractFactory } from "ethers";
import { ethers, waffle } from "hardhat";
import { Lottery } from "../../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Sign } from "crypto";
import { MockProvider } from "ethereum-waffle";

const shouldManageLottery = (): void => {
  describe("Lottery contract", function () {
    let Lottery: ContractFactory;
    let LotteryContract: Lottery;
    let addrs: SignerWithAddress[];
    const unixtimeNow: number = Math.floor(Date.now() / 1000);
    const hoursInSeconds: number = 3600;
    const expectedMinAmountInWei: BigNumber = BigNumber.from("100000000000000");

    beforeEach(async function () {
      Lottery = await ethers.getContractFactory("Lottery");
      [...addrs] = await ethers.getSigners();

      LotteryContract = (await Lottery.deploy()) as Lottery;
      await LotteryContract.deployed();
    });

    it("*Happy Path: Should init lottery with default numHours = 0", async function () {
      await expect(LotteryContract.initLottery(unixtimeNow, 0)).to.not.be
        .reverted;
    });

    // You can nest describe calls to create subsections.
    describe("1)...Deployment", function () {
      // assume all variables related to uint256 are BigNumbers
      it("*Happy Path: Should set the right owner", async function () {
        expect(await LotteryContract.owner()).to.equal(addrs[0].address);
      });

      it("*Happy Path: Should return default values", async function () {
        expect(await LotteryContract.MIN_DRAWING_INCREMENT()).to.equal(
          expectedMinAmountInWei
        );
        expect(await LotteryContract.NUMBER_OF_HOURS()).to.equal(168);
        expect(await LotteryContract.maxPlayersAllowed()).to.equal(1000);
        expect(await LotteryContract.currentLotteryId()).to.equal(0);
      });

      it("*Happy Path: Should set new max players allowed", async function () {
        const tx = await LotteryContract.setMaxPlayersAllowed(3);
        const receipt = await tx.wait();

        const event = {
          ...receipt.events![0].args,
        };
        expect(event.maxPlayersAllowed).to.equal(3);
        expect(await LotteryContract.maxPlayersAllowed()).to.equal(3);
      });

      it("*Happy Path: Should initialize a new lottery from owner", async function () {
        const numHours = 7 * 24;
        const tx = await LotteryContract.initLottery(unixtimeNow, numHours);
        const receipt = await tx.wait();

        const expectedStartTime = unixtimeNow;
        const expectedEndTime = unixtimeNow + numHours * hoursInSeconds;
        const event = {
          ...receipt.events![0].args,
        };

        expect(receipt.events!.length).to.equal(1); // 1 event emitted
        expect(event.creator).to.equal(addrs[0].address);
        expect(event.startTime).to.equal(expectedStartTime);
        expect(event.endTime).to.equal(expectedEndTime);

        const currentLotteryId = await LotteryContract.currentLotteryId();
        expect(currentLotteryId).to.equal(0);

        const lottery = {
          ...(await LotteryContract.lotteries(currentLotteryId.toNumber())),
        };

        expect(lottery.startTime.toNumber()).to.equal(expectedStartTime);
        expect(lottery.endTime.toNumber()).to.equal(expectedEndTime);
        expect(lottery.isActive).to.be.true;
      });

      it("Should not allow withdrawals with no funds to withdraw", async function () {
        await expect(LotteryContract.withdraw(1)).to.be.revertedWith(
          "Lottery__InvalidWithdrawalAmount"
        );
      });

      it("Should not allow minting tickets from non-existent lottery", async function () {
        await expect(
          LotteryContract.mintLotteryTickets({
            value: "1000",
          })
        ).to.be.revertedWith("Lottery__InadequateFunds");
      });

      /* TASK: test init new lottery without being owner
       */
      it("Should not allow new lottery to be initialized by non owner", async function () {});

      describe("...After first lottery initialized", function () {
        /* TASK: refactor - maybe put currentLotteryId into lottery object
    for later tests when multiple lottos will be added (maybe concurrently)
     */
        let currentLotteryId: BigNumber, owner: SignerWithAddress;
        beforeEach(async function () {
          const tx = await LotteryContract.initLottery(unixtimeNow, 1);
          currentLotteryId = await LotteryContract.currentLotteryId();
          owner = addrs[0];
        });
        it("Should not allow an invalid lottery to be saved", async function () {
          await expect(
            LotteryContract.initLottery(unixtimeNow, 0)
          ).to.be.revertedWith("Lottery__ActiveLotteryExists");
        });
        it("*Happy Path: Should set existing lottery to be inactive", async function () {
          await LotteryContract.setLotteryInactive();
          const lottery = {
            ...(await LotteryContract.lotteries(currentLotteryId.toNumber())),
          };
          expect(lottery.isActive).to.be.false;
        });

        it("*Happy Path: should cancel lottery", async function () {
          await expect(LotteryContract.cancelLottery()).to.not.be.reverted;
        });

        describe("...After first lottery set inactive before any player has minted", function () {
          beforeEach(async function () {
            await LotteryContract.setLotteryInactive();
          });
          it("*Happy Path: Should allow a new lottery to be saved after previous lottery set inactive", async function () {
            await LotteryContract.initLottery(unixtimeNow, 7);
          });
          /* TASK: init a 2nd lottery after first one is set inactive
      should be allowed. Operate on that one
      - same flow, add p1, p2, p1 again, trigger lottery
      - collect winnings
       */
        });

        it("Should not mint lottery tickets for new player1 if funds insufficient", async function () {
          await expect(
            LotteryContract.mintLotteryTickets({
              value: ethers.utils.parseUnits(
                expectedMinAmountInWei.sub(100000).toString(),
                "wei"
              ), // Sends less than min allowed; min amount - 100000
            })
          ).to.be.revertedWith("Lottery__InadequateFunds");
        });

        it("*Happy Path: Should mint lottery tickets for new player1", async function () {
          const value = ethers.utils.parseEther("1.0");
          const tx = await LotteryContract.mintLotteryTickets({
            value: value, // Sends exactly 1.0 ether
          });
          const receipt = await tx.wait();
          const expectedNumTicketsMinted = value.div(expectedMinAmountInWei);

          // check emitted event details
          const event = {
            ...receipt.events![0].args,
          };
          expect(event.player).to.be.equal(addrs[0].address);
          expect(event.numTicketsMinted).to.be.equal(expectedNumTicketsMinted);

          expect(await LotteryContract.listOfPlayers(0)).to.be.equal(
            addrs[0].address
          );
          expect(await LotteryContract.numActivePlayers()).to.be.equal(1);
          expect(await LotteryContract.numTotalTickets()).to.be.equal(
            event.numTicketsMinted
          );
          expect(await LotteryContract.players(addrs[0].address)).to.be.equal(
            true
          );
          expect(await LotteryContract.tickets(addrs[0].address)).to.be.equal(
            expectedNumTicketsMinted
          );
        });

        describe("...After player1 mints tickets", function () {
          const players: any = [];
          let expectedNumTotalTicketsMinted: BigNumber;
          beforeEach(async function () {
            const player1: SignerWithAddress = addrs[0];
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

            /* TASK
        write a test to always check that total # of tickets per address is expected
        loop thru all players; match their expected mint # with their actual from contract state
         */
          });
          it("*Happy Path: Should mint lottery tickets for new player2", async function () {
            const player2 = addrs[1];

            const mintValue = ethers.utils.parseEther("0.5"); // eth
            const tx = await LotteryContract.connect(
              player2
            ).mintLotteryTickets({
              value: mintValue,
            });
            const receipt = await tx.wait();

            const expectedNumTicketsMinted = mintValue.div(
              expectedMinAmountInWei
            );
            expectedNumTotalTicketsMinted = expectedNumTotalTicketsMinted.add(
              expectedNumTicketsMinted
            );

            // event logs tests
            const event = {
              ...receipt.events![0].args,
            };
            expect(event.player).to.be.equal(player2.address);
            expect(event.numTicketsMinted).to.be.equal(
              expectedNumTicketsMinted
            );
            /* TASK: add tests here to check the total # of tickets for given address - tickets getter
             */
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
          it("*Happy Path: Find winning address with only 1 player", async function () {
            await LotteryContract.connect(owner).setLotteryInactive();
            await LotteryContract.triggerLotteryDrawing();
            const winningTicket = await LotteryContract.winningTicket();

            let ticketDistribution = await Promise.all(
              players.map(async (player: SignerWithAddress, ind: number) => {
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
          describe("...After player2 mints tickets", function () {
            let expectedNumTicketsPlayer2: BigNumber;
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
            it("*Happy Path: Should mint more lottery tickets for player1", async function () {
              const value = ethers.utils.parseEther("0.1");
              const tx = await LotteryContract.mintLotteryTickets({
                value: value,
              });
              const receipt = await tx.wait();

              const expectedNumTicketsMinted = value.div(
                expectedMinAmountInWei
              );
              const expectedNumTicketsPlayer1: BigNumber =
                players[0].expectedNumTickets.add(expectedNumTicketsMinted);
              expectedNumTotalTicketsMinted = expectedNumTotalTicketsMinted.add(
                expectedNumTicketsMinted
              );

              // check emitted event - player addr added / num lotto tickets granted
              const event = {
                ...receipt.events![0].args,
              };
              expect(event.player).to.be.equal(addrs[0].address);
              expect(event.numTicketsMinted).to.be.equal(
                expectedNumTicketsMinted
              );

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
              expect(
                await LotteryContract.players(addrs[0].address)
              ).to.be.equal(true);
              expect(
                await LotteryContract.tickets(addrs[0].address)
              ).to.be.equal(expectedNumTicketsPlayer1);
            });
            describe("...After more lottery tickets for player1 are minted", function () {
              beforeEach(async function () {
                const mintValue = ethers.utils.parseEther("0.1"); // eth
                const tx = await LotteryContract.connect(
                  players[0].addr
                ).mintLotteryTickets({
                  value: mintValue,
                });

                /* TASK: maybe turn this into "calculateTicketAmount" function, ie divide by expectedMinAmountInWei
                 */
                const expectedNumTicketsMinted = mintValue.div(
                  expectedMinAmountInWei
                );
                expectedNumTotalTicketsMinted =
                  expectedNumTotalTicketsMinted.add(expectedNumTicketsMinted);
                players[0].expectedNumTickets =
                  players[0].expectedNumTickets.add(expectedNumTicketsMinted);
                players[0].numTickets = await LotteryContract.tickets(
                  players[0].addr.address
                );
              });
              it("should not allow lottery drawing to be triggered while minting is open", async function () {
                await expect(
                  LotteryContract.triggerLotteryDrawing()
                ).to.be.revertedWith("Lottery__MintingNotCompleted");
              });
              it("*Happy Path: Should trigger lottery drawing", async function () {
                await LotteryContract.connect(owner).setLotteryInactive();
                const lottery = {
                  ...(await LotteryContract.lotteries(0)),
                };

                await LotteryContract.triggerLotteryDrawing();
                const winningTicket = await LotteryContract.winningTicket();

                let ticketDistribution = await Promise.all(
                  players.map(
                    async (player: SignerWithAddress, ind: number) => {
                      return await LotteryContract.getTicketDistribution(ind);
                    }
                  )
                );
                // confirm the winner
                const expectedWinner = ticketDistribution.filter(
                  (distribution) => {
                    return (
                      distribution.startIndex.lte(
                        winningTicket.winningTicketIndex
                      ) &&
                      distribution.endIndex.gte(
                        winningTicket.winningTicketIndex
                      )
                    );
                  }
                )[0];

                expect(expectedWinner.playerAddress).to.be.equal(
                  winningTicket.addr
                );
                expect(
                  expectedWinner.startIndex.lte(
                    winningTicket.winningTicketIndex
                  )
                ).to.be.equal(true);
                expect(
                  expectedWinner.endIndex.gte(winningTicket.winningTicketIndex)
                ).to.be.equal(true);
              });
              describe("...After lottery triggered", function () {
                beforeEach(async function () {
                  // trigger lottery
                  await LotteryContract.setLotteryInactive();
                  await LotteryContract.triggerLotteryDrawing();
                });
                it("*Happy Path: Should find winning address", async function () {
                  const winningTicket = await LotteryContract.winningTicket();
                  const winningTicketIndex = winningTicket.winningTicketIndex;

                  await LotteryContract.findWinningAddress(
                    winningTicketIndex.toNumber()
                  );
                  const winningTicketFull =
                    await LotteryContract.winningTicket();
                  expect(winningTicketFull.winningTicketIndex).to.be.equal(
                    winningTicketIndex
                  );
                });
                describe("...After winning address found", function () {
                  let winningTicketFull: any;
                  beforeEach(async function () {
                    const winningTicket = await LotteryContract.winningTicket();
                    const winningTicketIndex = winningTicket.winningTicketIndex;

                    await LotteryContract.findWinningAddress(
                      winningTicketIndex.toNumber()
                    );
                    winningTicketFull = await LotteryContract.winningTicket();
                  });
                  it("*Happy Path: Should deposit winnings", async function () {
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
                    let expectedWinnings: BigNumber,
                      currentLotteryId: BigNumber,
                      provider: MockProvider;
                    const winnerBalance: any = {};

                    beforeEach(async function () {
                      provider = waffle.provider;
                      currentLotteryId =
                        await LotteryContract.currentLotteryId();
                      winnerBalance.initial = await provider.getBalance(
                        winningTicketFull.addr
                      );
                      await LotteryContract.triggerDepositWinnings();
                      expectedWinnings = expectedNumTotalTicketsMinted.mul(
                        expectedMinAmountInWei
                      );
                    });
                    it("*Happy Path: Should allow winner to withdraw", async function () {
                      // winner should withdraw winnings

                      const expectedWinningAddr = addrs.filter((addr) => {
                        return addr.address == winningTicketFull.addr;
                      })[0];
                      const pendingWithdrawal =
                        await LotteryContract.pendingWithdrawals(
                          currentLotteryId.toNumber(),
                          expectedWinningAddr.address
                        );

                      expect(pendingWithdrawal).to.be.equal(expectedWinnings);

                      const tx = await LotteryContract.connect(
                        expectedWinningAddr
                      ).withdraw(currentLotteryId.toNumber());
                      const receipt = await tx.wait();

                      const event = {
                        ...receipt.events![0].args,
                      };

                      expect(event.winnerAddress).to.be.equal(
                        expectedWinningAddr.address
                      );
                      expect(pendingWithdrawal).to.be.equal(
                        event.withdrawalAmount
                      );

                      winnerBalance.final = await provider.getBalance(
                        event.winnerAddress
                      );

                      const winningsWithdrawnSuccessfully =
                        winnerBalance.final.sub(winnerBalance.initial);

                      // expect deposited winnings; ie at least some eth deposited
                      expect(winningsWithdrawnSuccessfully).to.be.above(0);
                      // expect winnings to be the expected winnings, minus gas and commission fees
                      expect(expectedWinnings).to.be.above(
                        winningsWithdrawnSuccessfully
                      );
                    });
                    describe(`...After 2nd lottery initiated`, function () {
                      beforeEach(async function () {
                        const tx = await LotteryContract.initLottery(
                          unixtimeNow,
                          1
                        );
                        await tx.wait();
                        this.currentLotteryId =
                          await LotteryContract.currentLotteryId();
                      });
                      it.only(`*Happy Path: Should init next lottery`, async function () {
                        const tx = await LotteryContract.mintLotteryTickets({
                          value: expectedMinAmountInWei.mul(5),
                        });
                        await tx.wait();
                        console.log(this.currentLotteryId);
                      });
                    });
                  });
                });
              });
              /* TASK: use a non-owner to try to trigger lottery
          confirm it fails bc onlyOwner function
           */
              it("Should not trigger lottery drawing if not owner", async function () {});
            });
          });
        });
      });
    });

    /* TASK: init a 2nd lottery after first one has been paid out
     */

    /* TASK: add >2 players to test. maybe 10
  in beforeEach, loop thru to check num tickets
   */
  });
};

export default { shouldManageLottery };
