// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "openzeppelin-contracts/contracts/access/Ownable.sol";

contract OZCounter is Ownable {
    uint256 public number;

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setNumber(uint256 n) external onlyOwner {
        number = n;
    }

    function increment() external onlyOwner {
        number += 1;
    }
}
