import { BitcoinNetwork } from "./network"
import { BitcoinRawTx, BitcoinTx, BitcoinTxHash, BitcoinUtxo } from "./tx"
import { BitcoinTxMerkleBranch } from "./spv"

/**
 * Represents a Bitcoin client.
 */
export interface BitcoinClient {
  /**
   * Gets the network supported by the server the client connected to.
   * @returns Bitcoin network.
   */
  getNetwork(): Promise<BitcoinNetwork>

  /**
   * Finds all unspent transaction outputs (UTXOs) for given Bitcoin address.
   * @param address - Bitcoin address UTXOs should be determined for.
   * @returns List of UTXOs.
   */
  findAllUnspentTransactionOutputs(address: string): Promise<BitcoinUtxo[]>

  /**
   * Gets the history of confirmed transactions for given Bitcoin address.
   * Returned transactions are sorted from oldest to newest. The returned
   * result does not contain unconfirmed transactions living in the mempool
   * at the moment of request.
   * @param address - Bitcoin address transaction history should be determined for.
   * @param limit - Optional parameter that can limit the resulting list to
   *        a specific number of last transaction. For example, limit = 5 will
   *        return only the last 5 transactions for the given address.
   */
  getTransactionHistory(address: string, limit?: number): Promise<BitcoinTx[]>

  /**
   * Gets the full transaction object for given transaction hash.
   * @param transactionHash - Hash of the transaction.
   * @returns Transaction object.
   */
  getTransaction(transactionHash: BitcoinTxHash): Promise<BitcoinTx>

  /**
   * Gets the raw transaction data for given transaction hash.
   * @param transactionHash - Hash of the transaction.
   * @returns Raw transaction.
   */
  getRawTransaction(transactionHash: BitcoinTxHash): Promise<BitcoinRawTx>

  /**
   * Gets the number of confirmations that a given transaction has accumulated
   * so far.
   * @param transactionHash - Hash of the transaction.
   * @returns The number of confirmations.
   */
  getTransactionConfirmations(transactionHash: BitcoinTxHash): Promise<number>

  /**
   * Gets height of the latest mined block.
   * @return Height of the last mined block.
   */
  latestBlockHeight(): Promise<number>

  /**
   * Gets concatenated chunk of block headers built on a starting block.
   * @param blockHeight - Starting block height.
   * @param chainLength - Number of subsequent blocks built on the starting
   *                      block.
   * @return Concatenation of block headers in a hexadecimal format.
   */
  getHeadersChain(blockHeight: number, chainLength: number): Promise<string>

  /**
   * Get Merkle branch for a given transaction.
   * @param transactionHash - Hash of a transaction.
   * @param blockHeight - Height of the block where transaction was confirmed.
   * @return Merkle branch.
   */
  getTransactionMerkle(
    transactionHash: BitcoinTxHash,
    blockHeight: number
  ): Promise<BitcoinTxMerkleBranch>

  /**
   * Broadcasts the given transaction over the network.
   * @param transaction - Transaction to broadcast.
   */
  broadcast(transaction: BitcoinRawTx): Promise<void>
}
