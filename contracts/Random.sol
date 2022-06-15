// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

library Random {
    /*
     * @dev startingValue is inclusive, endingValue is inclusive
     * naive implementation! Do not use in production
     * ie if 1, 10, rand int can include 1-10
     */
    function naiveRandInt(uint256 _startingValue, uint256 _endingValue)
        internal
        view
        returns (uint256)
    {
        // hash of the given block when blocknumber is one of the 256 most recent blocks; otherwise returns zero
        // create random value from block number; use previous block number just to make sure we aren't on 0
        uint randomInt = uint(blockhash(block.number - 1));
        // convert this into a number within range
        uint range = _endingValue - _startingValue + 1; // add 1 to ensure it is inclusive within endingValue

        randomInt = randomInt % range; // modulus ensures value is within range
        randomInt += _startingValue; // now shift by startingValue to ensure it is >= startingValue

        return randomInt;
    }
}
