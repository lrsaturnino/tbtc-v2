// TODO: Consider exports refactoring as per discussion https://github.com/keep-network/tbtc-v2/pull/460#discussion_r1084530007

import { validateBitcoinSpvProof } from "./lib/bitcoin"

import {
  calculateDepositAddress,
  getRevealedDeposit,
  revealDeposit,
  suggestDepositWallet,
} from "./deposit"

import { submitDepositSweepProof } from "./deposit-sweep"

import {
  requestRedemption,
  submitRedemptionProof,
  getRedemptionRequest,
  findWalletForRedemption,
} from "./redemption"

import {
  requestOptimisticMint,
  cancelOptimisticMint,
  finalizeOptimisticMint,
  getOptimisticMintingRequest,
} from "./optimistic-minting"

export const TBTC = {
  calculateDepositAddress,
  suggestDepositWallet,
  revealDeposit,
  getRevealedDeposit,
  requestRedemption,
  getRedemptionRequest,
  findWalletForRedemption,
}

export const SpvMaintainer = {
  submitDepositSweepProof,
  submitRedemptionProof,
}

export const OptimisticMinting = {
  requestOptimisticMint,
  cancelOptimisticMint,
  finalizeOptimisticMint,
  getOptimisticMintingRequest,
}

export const Bitcoin = {
  validateBitcoinSpvProof,
}

export {
  BitcoinTxHash,
  BitcoinTx,
  BitcoinTxOutput,
  BitcoinLocktimeUtils,
  BitcoinNetwork,
} from "./lib/bitcoin"

export { Client as ElectrumClient } from "./lib/electrum"

export {
  Bridge as EthereumBridge,
  WalletRegistry as EthereumWalletRegistry,
  Address as EthereumAddress,
  TBTCVault as EthereumTBTCVault,
  TBTCToken as EthereumTBTCToken,
} from "./lib/ethereum"

export { Hex } from "./lib/utils"

export {
  OptimisticMintingRequest,
  OptimisticMintingRequestedEvent,
} from "./lib/contracts"
