// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

contract Greeter {
    string public greeting;
    address public owner;

    constructor(string memory initialGreeting) {
        greeting = initialGreeting;
        owner = msg.sender;
    }

    function setGreeting(string memory newGreeting) external {
        greeting = newGreeting;
    }
}
