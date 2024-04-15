import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { ethers, artifacts } from "hardhat"
import { CCIPTransferToken } from "../typechain-types/contracts/CCIPTransferToken"
import { expect } from "chai"
import { IERC20 } from "../typechain-types"
import { deployMockContract, MockContract } from "@clrfund/waffle-mock-contract"

describe("CCIPTransferToken", function () {
  let cut: CCIPTransferToken
  let tokenToTransfer: IERC20
  let routerClient: MockContract
  let wallet: HardhatEthersSigner

  const receiver = "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59"
  const destinationSelector = 1001033144

  beforeEach("", async function () {
    let { ccipTransferToken, token, router } = await setupDeploy()

    cut = ccipTransferToken
    tokenToTransfer = token
    routerClient = router

    await routerClient.mock.isChainSupported.returns(true)
    await routerClient.mock.getFee.returns(0)
    await routerClient.mock.ccipSend.returns(ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [1]))

    await tokenToTransfer.connect(wallet).approve(await cut.getAddress(), 1e10)
  })

  async function setupDeploy(): Promise<{
    ccipTransferToken: CCIPTransferToken
    token: IERC20
    router: MockContract
  }> {
    ;[wallet] = await ethers.getSigners()

    const _router = await artifacts.readArtifact("RouterMock")
    const _routerMock = await deployMockContract(wallet, _router.abi)

    const _token = await ethers.getContractFactory("ERC20Mock")
    const _tokenMock = await _token.deploy()

    _tokenMock.mint(wallet.getAddress(), 1000)

    const _CCIPTransferToken = await ethers.getContractFactory("CCIPTransferToken")
    const _ccipTransferToken = await _CCIPTransferToken.deploy(_routerMock.getAddress())

    return { ccipTransferToken: _ccipTransferToken, token: _tokenMock, router: _routerMock }
  }

  describe("buildMessageAndCalculateTransferFee", async function () {
    it("Should return the correct transfer fee", async function () {
      const expectedFee: number = 21

      await routerClient.mock.getFee.returns(expectedFee)

      const [transferFee] = await cut.buildMessageAndCalculateTransferFee(0, receiver, tokenToTransfer.getAddress(), 0)

      expect(transferFee).equals(expectedFee)
    })

    it("Should return the correct message", async function () {
      const tokenAmountToBeTransferred: number = 200
      const destinationChainSelector: number = 213245

      await routerClient.mock.getFee.returns(0)

      const [, message] = await cut.buildMessageAndCalculateTransferFee(
        destinationChainSelector,
        receiver,
        tokenToTransfer.getAddress(),
        tokenAmountToBeTransferred,
      )

      expect(ethers.AbiCoder.defaultAbiCoder().decode(["address"], message.receiver)[0]).equals(
        receiver,
        "Receiver should be the same as sent to buildMessageAndCalculateFee",
      )
      expect(message.data).equals("0x", "Data should be empty, as we only want to transfer tokens")
      expect(message.tokenAmounts[0].amount).equals(tokenAmountToBeTransferred)
      expect(message.tokenAmounts[0].token).equals(await tokenToTransfer.getAddress())
      expect(message.feeToken).equals(
        "0x0000000000000000000000000000000000000000",
        "Fee token address should be zero, as we want to pay in native token",
      )
      expect(message.extraArgs).equals(
        "0x97a657c90000000000000000000000000000000000000000000000000000000000000000", // this is the return when the extra args is empty
        "Extra args should be empty",
      )
    })
  })

  describe("transferCCIP", function () {
    it("Should revert if the receiver is invalid", async function () {
      const invalidReceiver: string = "0x0000000000000000000000000000000000000000"

      await expect(cut.transferCCIP(0, invalidReceiver, tokenToTransfer.getAddress(), 0)).to.be.revertedWithCustomError(
        cut,
        "CCIPTransferToken__InvalidReceiver",
      )
    })

    it("Should revert if the specified chain is not supported", async function () {
      await routerClient.mock.isChainSupported.returns(false)
      const notSupportedChain = 11111

      await expect(cut.transferCCIP(notSupportedChain, tokenToTransfer.getAddress(), receiver, 21))
        .to.be.revertedWithCustomError(cut, "CCIPTransferToken__ChainNotSupported")
        .withArgs(notSupportedChain)
    })

    it("Should revert if the sent value in native token cannot cover the transfer fee", async function () {
      const fee = 100
      const feeSent = 80

      await routerClient.mock.getFee.returns(fee)

      await expect(cut.transferCCIP(0, tokenToTransfer.getAddress(), receiver, 21, { value: feeSent }))
        .to.be.revertedWithCustomError(cut, "CCIPTransferToken__CannotPayFees")
        .withArgs(fee, feeSent)
    })

    it("Should transfer the token to the contract", async function () {
      const amountToBeTransferred = 11

      await expect(
        cut.transferCCIP(0, receiver, await tokenToTransfer.getAddress(), amountToBeTransferred, {
          from: await wallet.getAddress(),
        }),
      ).to.changeTokenBalance(tokenToTransfer, await cut.getAddress(), amountToBeTransferred)
    })

    it("Should increase the allowance of router to spend from the contract", async function () {
      const amountToBeTransferred = 432

      await cut.transferCCIP(0, receiver, await tokenToTransfer.getAddress(), amountToBeTransferred)
      const allowanceAfter = await tokenToTransfer.allowance(await cut.getAddress(), await routerClient.getAddress())

      expect(allowanceAfter).equals(amountToBeTransferred)
    })

    it("Should call ccipSend with the correct params", async function () {
      const tokenAmountToBeTransferred = 10

      const [, message] = await cut.buildMessageAndCalculateTransferFee(
        destinationSelector,
        receiver,
        tokenToTransfer.getAddress(),
        tokenAmountToBeTransferred,
      )

      await routerClient.mock.ccipSend
        .withArgs(destinationSelector, message)
        .returns(ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [0]))

      await cut.transferCCIP(0, receiver, await tokenToTransfer.getAddress(), 10)
    })

    it("Should send the fee to router", async function () {
      const _router = await ethers.getContractFactory("RouterMock")
      const _routerDeployed = await _router.deploy()

      const _ccipTransferToken = await ethers.getContractFactory("CCIPTransferToken")
      const _ccipTransferTokenDeployed = await _ccipTransferToken.deploy(await _routerDeployed.getAddress())

      const fee: bigint = await _routerDeployed.getFeeWithoutArgs()

      await tokenToTransfer.connect(wallet).approve(await _ccipTransferTokenDeployed.getAddress(), 1000)

      await expect(
        _ccipTransferTokenDeployed.transferCCIP(0, receiver, await tokenToTransfer.getAddress(), 10, { value: fee }),
      ).to.changeEtherBalance(await _routerDeployed.getAddress(), fee)
    })

    it("Should emit the TokenBridged event", async function () {
      const expectedAmount = 432
      const expectedTransferFee = 345
      const expectedMessageId = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [212])

      await routerClient.mock.ccipSend.returns(expectedMessageId)
      await routerClient.mock.getFee.returns(expectedTransferFee)

      await expect(
        cut.transferCCIP(destinationSelector, receiver, await tokenToTransfer.getAddress(), expectedAmount, {
          value: expectedTransferFee,
        }),
      )
        .emit(cut, "CCIPTransferToken__TokenBridged")
        .withArgs(expectedMessageId, destinationSelector, receiver, expectedTransferFee, expectedAmount)
    })
  })
})
