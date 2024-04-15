// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title a Sample contract to Bridge tokens with CCIP
contract CCIPTransferToken {
  using SafeERC20 for IERC20;

  IRouterClient private immutable i_routerClient;

  /// @notice thrown if the ETH is not enough to cover the transfer fee
  error CCIPTransferToken__CannotPayFees(uint256 amountNeeded, uint256 amountSent);

  /// @notice thrown if the receiver is invalid. e.g address 0
  error CCIPTransferToken__InvalidReceiver();

  /// @notice thrown if the specified chain is not supported
  error CCIPTransferToken__ChainNotSupported(uint64 chainSelector);

  /// @notice Emitted when a token is transferred to another chain
  event CCIPTransferToken__TokenBridged(
    bytes32 indexed messageId,
    uint64 indexed destinationChainSelector,
    address indexed receiver,
    uint256 fees,
    uint256 amount
  );

  constructor(address routerClient) {
    i_routerClient = IRouterClient(routerClient);
  }

  /// @notice returns the fee of a transfer.
  /// @param destinationChainSelector the destination chain selector
  /// @param receiver who will receive the token
  /// @param token the token to be transferred
  /// @param amount the amount of token to be transferred (with token decimals)
  /// @return transferFee the fee to be paid to transfer the specified token
  /// @return message the message to be sent
  function buildMessageAndCalculateTransferFee(
    uint64 destinationChainSelector,
    address receiver,
    address token,
    uint256 amount
  ) public view returns (uint256 transferFee, Client.EVM2AnyMessage memory message) {
    Client.EVM2AnyMessage memory _message = _buildCCIPMessage(token, amount, receiver);

    return (i_routerClient.getFee(destinationChainSelector, message), _message);
  }

  /// @notice transfers a token to another chain
  /// @param destinationChainSelector the destination chain selector
  /// @param receiver who will receive the token
  /// @param token the token to be transferred
  /// @param amount the amount of token to be transferred (with token decimals)
  function transferCCIP(
    uint64 destinationChainSelector,
    address receiver,
    address token,
    uint256 amount
  ) external payable returns (bytes32 messageId) {
    IERC20 _token = IERC20(token);

    if (receiver == address(0)) revert CCIPTransferToken__InvalidReceiver();

    if (!i_routerClient.isChainSupported(destinationChainSelector)) {
      revert CCIPTransferToken__ChainNotSupported(destinationChainSelector);
    }

    (uint256 transferFee, Client.EVM2AnyMessage memory message) = buildMessageAndCalculateTransferFee(
      destinationChainSelector,
      receiver,
      token,
      amount
    );

    if (msg.value < transferFee) {
      revert CCIPTransferToken__CannotPayFees({amountNeeded: transferFee, amountSent: msg.value});
    }

    _token.safeTransferFrom(msg.sender, address(this), amount);
    _token.forceApprove(address(i_routerClient), amount);

    messageId = i_routerClient.ccipSend{value: transferFee}(destinationChainSelector, message);

    emit CCIPTransferToken__TokenBridged(messageId, destinationChainSelector, receiver, transferFee, amount);
  }

  function _buildCCIPMessage(
    address token,
    uint256 amount,
    address receiver
  ) private pure returns (Client.EVM2AnyMessage memory) {
    Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
    tokenAmounts[0] = Client.EVMTokenAmount({token: token, amount: amount});

    return
      Client.EVM2AnyMessage({
        receiver: abi.encode(receiver),
        data: "",
        tokenAmounts: tokenAmounts,
        feeToken: address(0),
        extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({gasLimit: 0})) // No args
      });
  }
}
