import { BitcoinTxHash } from "../bitcoin"
import { Hex } from "../utils"
import { Identifier } from "./chain-identifier"
import { Event, GetEvents } from "./chain-event"
import { BigNumber } from "ethers"

/**
 * Interface for communication with the TBTCVault on-chain contract.
 */
export interface TBTCVault {
  /**
   * Gets optimistic minting delay.
   *
   * The time that needs to pass between the moment the optimistic minting is
   * requested and the moment optimistic minting is finalized with minting TBTC.
   * @returns Optimistic Minting Delay in seconds.
   */
  optimisticMintingDelay(): Promise<number>

  /**
   * Gets currently registered minters.
   *
   * @returns Array containing identifiers of all currently registered minters.
   */
  getMinters(): Promise<Identifier[]>

  /**
   * Checks if given identifier is registered as minter.
   *
   * @param identifier Chain identifier to check.
   */
  isMinter(identifier: Identifier): Promise<boolean>

  /**
   * Checks if given identifier is registered as guardian.
   *
   * @param identifier Chain identifier to check.
   */
  isGuardian(identifier: Identifier): Promise<boolean>

  /**
   * Requests optimistic minting for a deposit in an on-chain contract.
   *
   * @param depositTxHash The revealed deposit transaction's hash.
   * @param depositOutputIndex Index of the deposit transaction output that
   *        funds the revealed deposit.
   * @returns Transaction hash of the optimistic mint request transaction.
   */
  requestOptimisticMint(
    depositTxHash: BitcoinTxHash,
    depositOutputIndex: number
  ): Promise<Hex>

  /**
   * Cancels optimistic minting for a deposit in an on-chain contract.
   *
   * @param depositTxHash The revealed deposit transaction's hash.
   * @param depositOutputIndex Index of the deposit transaction output that
   *        funds the revealed deposit.
   * @returns Transaction hash of the optimistic mint cancel transaction.
   */
  cancelOptimisticMint(
    depositTxHash: BitcoinTxHash,
    depositOutputIndex: number
  ): Promise<Hex>

  /**
   * Finalizes optimistic minting for a deposit in an on-chain contract.
   *
   * @param depositTxHash The revealed deposit transaction's hash.
   * @param depositOutputIndex Index of the deposit transaction output that
   *        funds the revealed deposit.
   * @returns Transaction hash of the optimistic mint finalize transaction.
   */
  finalizeOptimisticMint(
    depositTxHash: BitcoinTxHash,
    depositOutputIndex: number
  ): Promise<Hex>

  /**
   * Gets optimistic minting request for a deposit.
   * @param depositTxHash The revealed deposit transaction's hash.
   * @param depositOutputIndex Index of the deposit transaction output that
   *        funds the revealed deposit.
   * @returns Optimistic minting request.
   */
  optimisticMintingRequests(
    depositTxHash: BitcoinTxHash,
    depositOutputIndex: number
  ): Promise<OptimisticMintingRequest>

  /**
   * Get emitted OptimisticMintingRequested events.
   * @see GetEventsFunction
   */
  getOptimisticMintingRequestedEvents: GetEvents.Function<OptimisticMintingRequestedEvent>

  /**
   * Get emitted OptimisticMintingCancelled events.
   * @see GetEventsFunction
   */
  getOptimisticMintingCancelledEvents: GetEvents.Function<OptimisticMintingCancelledEvent>

  /**
   * Get emitted OptimisticMintingFinalized events.
   * @see GetEventsFunction
   */
  getOptimisticMintingFinalizedEvents: GetEvents.Function<OptimisticMintingFinalizedEvent>
}

/**
 * Represents optimistic minting request for the given deposit revealed to the
 * Bridge.
 */
export type OptimisticMintingRequest = {
  /**
   * UNIX timestamp at which the optimistic minting was requested.
   */
  requestedAt: number
  /**
   * UNIX timestamp at which the optimistic minting was finalized.
   * 0 if not yet finalized.
   */
  finalizedAt: number
}

/**
 * Represents an event that is emitted when a new optimistic minting is requested
 * on chain.
 */
export type OptimisticMintingRequestedEvent = {
  /**
   * Minter's chain identifier.
   */
  minter: Identifier
  /**
   * Unique deposit identifier.
   * @see Bridge.buildDepositKey
   */
  depositKey: Hex
  /**
   * Depositor's chain identifier.
   */
  depositor: Identifier
  /**
   * Amount of tokens requested to mint.
   * This value is in ERC 1e18 precision, it has to be converted before using
   * as Bitcoin value with 1e8 precision in satoshi.
   */
  // TODO: Consider adding a custom type to handle conversion from ERC with 1e18
  //       precision to Bitcoin in 1e8 precision (satoshi).
  amount: BigNumber
  /**
   * Hash of a Bitcoin transaction made to fund the deposit.
   */
  fundingTxHash: BitcoinTxHash
  /**
   * Index of an output in the funding transaction made to fund the deposit.
   */
  fundingOutputIndex: number
} & Event

/**
 * Represents an event that is emitted when an optimistic minting request
 * is cancelled on chain.
 */
export type OptimisticMintingCancelledEvent = {
  /**
   * Guardian's chain identifier.
   */
  guardian: Identifier
  /**
   * Unique deposit identifier.
   * @see Bridge.buildDepositKey
   */
  depositKey: Hex
} & Event

/**
 * Represents an event that is emitted when an optimistic minting request
 * is finalized on chain.
 */
export type OptimisticMintingFinalizedEvent = {
  /**
   * Minter's chain identifier.
   */
  minter: Identifier
  /**
   * Unique deposit identifier.
   * @see Bridge.buildDepositKey
   */
  depositKey: Hex
  /**
   * Depositor's chain identifier.
   */
  depositor: Identifier
  /**
   * Value of the new optimistic minting debt of the depositor.
   * This value is in ERC 1e18 precision, it has to be converted before using
   * as Bitcoin value with 1e8 precision in satoshi.
   */
  // TODO: Consider adding a custom type to handle conversion from ERC with 1e18
  //       precision to Bitcoin in 1e8 precision (satoshi).
  optimisticMintingDebt: BigNumber
} & Event
