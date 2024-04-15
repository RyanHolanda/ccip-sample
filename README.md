# Chainlink CCIP Sample

This repository contains a sample contract that demonstrates how to bridge tokens with Chainlink CCIP.

**You can view the contract to bridge the tokens with CCIP [here](contracts/CCIPTransferToken.sol).**

## Try it out

_You'll need some allowed tokens (CCIP-BnM and CCIP-LnM) to test the transfer. You can mint them on [Chainlink Docs](https://docs.chain.link/ccip/test-tokens#mint-tokens-in-the-documentation)._
_Make sure you are on the Sepolia Network._

Now you can test this contract [deployed on Sepolia](https://sepolia.etherscan.io/address/0x22C7aE33CA92af1D166283076614ea1A652a0f76#code).

### Steps

1. #### Get the fee

   First, you will need to execute the `buildMessageAndCalculateTransferFee` function to determine how much ETH you need to send to cover the fees. You will need the `Destination Chain Selector` and the `Token Address` (CCIP-BnM or CCIP-LnM). Note that the `Token Address` needs to be for the current network (Sepolia).

   _The `Destination Chain Selector` can be found on [Chainlink Docs](https://docs.chain.link/ccip/supported-networks/v1_2_0/testnet#avalanche-fuji)._
   **`CCIP-BnM` Address on Sepolia:** 0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05\
   **`CCIP-LnM` Address on Sepolia:** 0x466D489b6d36E7E3b824ef491C225F5830E81cC1

   ⚠️ Both tokens use 18 decimals. Make sure to pass the `tokenAmount` parameter with the correct decimals.

   **Note that the output will be in wei. You can use an [ETH Unit Converter](https://eth-converter.com/) to convert the amount to ETH.**

2. #### Transfer the token

   ⚠️ Make sure to approve the spending of the chosen token(CCIP-BnM or CCIP-LnM) before executing the `transferCCIP` method. The spender will be the same as the contract address.

   Now you can execute the `transferCCIP` method to transfer the token.\
   In the payable amount, you will send the amount that you received from the `buildMessageAndCalculateTransferFee` method **(Make sure to input the amount in ETH)**.

   The other parameters will be the same as the `buildMessageAndCalculateTransferFee` method.

   After executing the `transferCCIP` method, your tokens will be bridged to the destination chain. You can copy the transaction hash and check its status on the [CCIP Explorer](https://ccip.chain.link/).
