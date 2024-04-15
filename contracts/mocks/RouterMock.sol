//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

contract RouterMock is IRouterClient {
  uint256 private constant FEE = 200;

  function isChainSupported(uint64 /* chainSelector */) external pure override returns (bool supported) {
    return true;
  }

  function getSupportedTokens(uint64 chainSelector) external view override returns (address[] memory tokens) {}

  function getFee(
    uint64 /* destinationChainSelector */,
    Client.EVM2AnyMessage memory /* message */
  ) external pure override returns (uint256 fee) {
    return FEE;
  }

  function getFeeWithoutArgs() external pure returns (uint256 fee) {
    return FEE;
  }

  function ccipSend(
    uint64 destinationChainSelector,
    Client.EVM2AnyMessage calldata message
  ) external payable override returns (bytes32) {}
}
