import {
  Transaction,
  TxOutput,
  Stack,
  Signer,
  payments,
  script,
} from "bitcoinjs-lib"
import { BigNumber } from "ethers"
import { Hex } from "./hex"
import {
  RawTransaction,
  UnspentTransactionOutput,
  Client as BitcoinClient,
  decomposeRawTransaction,
  isCompressedPublicKey,
  publicKeyToAddress,
  TransactionHash,
  computeHash160,
  isP2PKHScript,
  isP2WPKHScript,
  isP2SHScript,
  isP2WSHScript,
  createOutputScriptFromAddress,
} from "./bitcoin"
import { assembleDepositScript, Deposit } from "./deposit"
import { Bridge, Identifier } from "./chain"
import { assembleTransactionProof } from "./proof"
import { ECPairFactory } from "ecpair"
import * as tinysecp from "tiny-secp256k1"
import { BitcoinNetwork, toBitcoinJsLibNetwork } from "./bitcoin-network"

/**
 * Submits a deposit sweep by combining all the provided P2(W)SH UTXOs and
 * broadcasting a Bitcoin P2(W)PKH deposit sweep transaction.
 * @dev The caller is responsible for ensuring the provided UTXOs are correctly
 *      formed, can be spent by the wallet and their combined value is greater
 *      then the fee. Note that broadcasting transaction may fail silently (e.g.
 *      when the provided UTXOs are not spendable) and no error will be returned.
 * @param bitcoinClient - Bitcoin client used to interact with the network.
 * @param fee - the value that should be subtracted from the sum of the UTXOs
 *        values and used as the transaction fee.
 * @param walletPrivateKey - Bitcoin private key of the wallet in WIF format.
 * @param witness - The parameter used to decide about the type of the new main
 *        UTXO output. P2WPKH if `true`, P2PKH if `false`.
 * @param utxos - P2(W)SH UTXOs to be combined into one output.
 * @param deposits - Array of deposits. Each element corresponds to UTXO.
 *        The number of UTXOs and deposit elements must equal.
 * @param mainUtxo - main UTXO of the wallet, which is a P2WKH UTXO resulting
 *        from the previous wallet transaction (optional).
 * @returns The outcome consisting of:
 *          - the sweep transaction hash,
 *          - the new wallet's main UTXO produced by this transaction.
 */
export async function submitDepositSweepTransaction(
  bitcoinClient: BitcoinClient,
  fee: BigNumber,
  walletPrivateKey: string,
  witness: boolean,
  utxos: UnspentTransactionOutput[],
  deposits: Deposit[],
  mainUtxo?: UnspentTransactionOutput
): Promise<{
  transactionHash: TransactionHash
  newMainUtxo: UnspentTransactionOutput
}> {
  const utxosWithRaw: (UnspentTransactionOutput & RawTransaction)[] = []
  for (const utxo of utxos) {
    const utxoRawTransaction = await bitcoinClient.getRawTransaction(
      utxo.transactionHash
    )

    utxosWithRaw.push({
      ...utxo,
      transactionHex: utxoRawTransaction.transactionHex,
    })
  }

  let mainUtxoWithRaw

  if (mainUtxo) {
    const mainUtxoRawTransaction = await bitcoinClient.getRawTransaction(
      mainUtxo.transactionHash
    )
    mainUtxoWithRaw = {
      ...mainUtxo,
      transactionHex: mainUtxoRawTransaction.transactionHex,
    }
  }

  const bitcoinNetwork = await bitcoinClient.getNetwork()

  const { transactionHash, newMainUtxo, rawTransaction } =
    await assembleDepositSweepTransaction(
      bitcoinNetwork,
      fee,
      walletPrivateKey,
      witness,
      utxosWithRaw,
      deposits,
      mainUtxoWithRaw
    )

  // Note that `broadcast` may fail silently (i.e. no error will be returned,
  // even if the transaction is rejected by other nodes and does not enter the
  // mempool, for example due to an UTXO being already spent).
  await bitcoinClient.broadcast(rawTransaction)

  return { transactionHash, newMainUtxo }
}

/**
 * Constructs a Bitcoin deposit sweep transaction using provided UTXOs.
 * @dev The caller is responsible for ensuring the provided UTXOs are correctly
 *      formed, can be spent by the wallet and their combined value is greater
 *      then the fee.
 * @param bitcoinNetwork - The target Bitcoin network (mainnet or testnet).
 * @param fee - Transaction fee to be subtracted from the sum of the UTXOs'
 *        values.
 * @param walletPrivateKey - Bitcoin private key of the wallet in WIF format.
 * @param witness - Determines the type of the new main UTXO output: P2WPKH if
 *        `true`, P2PKH if `false`.
 * @param utxos - UTXOs from new deposit transactions. Must be P2(W)SH.
 * @param deposits - Deposit data corresponding to each UTXO. The number of
 *        UTXOs and deposits must match.
 * @param mainUtxo - The wallet's main UTXO (optional), which is a P2(W)PKH UTXO
 *        from a previous transaction.
 * @returns An object containing the sweep transaction hash, new wallet's main
 *          UTXO, and the raw deposit sweep transaction representation.
 * @throws Error if the provided UTXOs and deposits mismatch or if an unsupported
 *         UTXO script type is encountered.
 */
export async function assembleDepositSweepTransaction(
  bitcoinNetwork: BitcoinNetwork,
  fee: BigNumber,
  walletPrivateKey: string,
  witness: boolean,
  utxos: (UnspentTransactionOutput & RawTransaction)[],
  deposits: Deposit[],
  mainUtxo?: UnspentTransactionOutput & RawTransaction
): Promise<{
  transactionHash: TransactionHash
  newMainUtxo: UnspentTransactionOutput
  rawTransaction: RawTransaction
}> {
  if (utxos.length < 1) {
    throw new Error("There must be at least one deposit UTXO to sweep")
  }

  if (utxos.length != deposits.length) {
    throw new Error("Number of UTXOs must equal the number of deposit elements")
  }

  const network = toBitcoinJsLibNetwork(bitcoinNetwork)
  // eslint-disable-next-line new-cap
  const walletKeyPair = ECPairFactory(tinysecp).fromWIF(
    walletPrivateKey,
    network
  )
  const walletAddress = publicKeyToAddress(
    Hex.from(walletKeyPair.publicKey),
    bitcoinNetwork,
    witness
  )

  const transaction = new Transaction()

  let outputValue = BigNumber.from(0)
  if (mainUtxo) {
    transaction.addInput(
      mainUtxo.transactionHash.reverse().toBuffer(),
      mainUtxo.outputIndex
    )
    outputValue = outputValue.add(mainUtxo.value)
  }
  for (const utxo of utxos) {
    transaction.addInput(
      utxo.transactionHash.reverse().toBuffer(),
      utxo.outputIndex
    )
    outputValue = outputValue.add(utxo.value)
  }
  outputValue = outputValue.sub(fee)

  const outputScript = createOutputScriptFromAddress(walletAddress)
  transaction.addOutput(outputScript.toBuffer(), outputValue.toNumber())

  // Sign the main UTXO input if there is main UTXO.
  if (mainUtxo) {
    const inputIndex = 0 // Main UTXO is the first input.
    const previousOutput = Transaction.fromHex(mainUtxo.transactionHex).outs[
      mainUtxo.outputIndex
    ]

    await signMainUtxoInput(
      transaction,
      inputIndex,
      previousOutput,
      walletKeyPair,
      bitcoinNetwork
    )
  }

  // Sign the deposit inputs.
  for (let depositIndex = 0; depositIndex < deposits.length; depositIndex++) {
    // If there is a main UTXO index, we must adjust input index as the first
    // input is the main UTXO input.
    const inputIndex = mainUtxo ? depositIndex + 1 : depositIndex

    const utxo = utxos[depositIndex]
    const previousOutput = Transaction.fromHex(utxo.transactionHex).outs[
      utxo.outputIndex
    ]
    const previousOutputValue = previousOutput.value
    const previousOutputScript = previousOutput.script

    const deposit = deposits[depositIndex]

    if (isP2SHScript(previousOutputScript)) {
      // P2SH (deposit UTXO)
      await signP2SHDepositInput(
        transaction,
        inputIndex,
        deposit,
        previousOutputValue,
        walletKeyPair
      )
    } else if (isP2WSHScript(previousOutputScript)) {
      // P2WSH (deposit UTXO)
      await signP2WSHDepositInput(
        transaction,
        inputIndex,
        deposit,
        previousOutputValue,
        walletKeyPair
      )
    } else {
      throw new Error("Unsupported UTXO script type")
    }
  }

  const transactionHash = TransactionHash.from(transaction.getId())

  return {
    transactionHash,
    newMainUtxo: {
      transactionHash,
      outputIndex: 0, // There is only one output.
      value: BigNumber.from(transaction.outs[0].value),
    },
    rawTransaction: {
      transactionHex: transaction.toHex(),
    },
  }
}

/**
 * Signs the main UTXO transaction input and sets the appropriate script or
 * witness data.
 * @param transaction - The transaction containing the input to be signed.
 * @param inputIndex - Index pointing to the input within the transaction.
 * @param previousOutput - The previous output for the main UTXO input.
 * @param walletKeyPair - A Signer object with the wallet's public and private
 *        key pair.
 * @param bitcoinNetwork - The Bitcoin network type.
 * @returns An empty promise upon successful signing.
 * @throws Error if the UTXO doesn't belong to the wallet, or if the script
 *         format is invalid or unknown.
 */
async function signMainUtxoInput(
  transaction: Transaction,
  inputIndex: number,
  previousOutput: TxOutput,
  walletKeyPair: Signer,
  bitcoinNetwork: BitcoinNetwork
) {
  if (!ownsUtxo(walletKeyPair, previousOutput.script, bitcoinNetwork)) {
    throw new Error("UTXO does not belong to the wallet")
  }

  const sigHashType = Transaction.SIGHASH_ALL

  if (isP2PKHScript(previousOutput.script)) {
    // P2PKH
    const sigHash = transaction.hashForSignature(
      inputIndex,
      previousOutput.script,
      sigHashType
    )

    const signature = script.signature.encode(
      walletKeyPair.sign(sigHash),
      sigHashType
    )

    const scriptSig = payments.p2pkh({
      signature: signature,
      pubkey: walletKeyPair.publicKey,
    }).input!

    transaction.ins[inputIndex].script = scriptSig
  } else if (isP2WPKHScript(previousOutput.script)) {
    // P2WPKH
    const decompiledScript = script.decompile(previousOutput.script)
    if (
      !decompiledScript ||
      decompiledScript.length !== 2 ||
      decompiledScript[0] !== 0x00 ||
      !Buffer.isBuffer(decompiledScript[1]) ||
      decompiledScript[1].length !== 20
    ) {
      throw new Error("Invalid script format")
    }

    const publicKeyHash = decompiledScript[1]
    const p2pkhScript = payments.p2pkh({ hash: publicKeyHash }).output!

    const sigHash = transaction.hashForWitnessV0(
      inputIndex,
      p2pkhScript,
      previousOutput.value,
      sigHashType
    )

    const signature = script.signature.encode(
      walletKeyPair.sign(sigHash),
      sigHashType
    )

    transaction.ins[inputIndex].witness = [signature, walletKeyPair.publicKey]
  } else {
    throw new Error("Unknown type of main UTXO")
  }
}

/**
 * Signs a P2SH deposit transaction input and sets the `scriptSig`.
 * @param transaction - The transaction containing the input to be signed.
 * @param inputIndex - Index pointing to the input within the transaction.
 * @param deposit - Details of the deposit transaction.
 * @param previousOutputValue - The value from the previous transaction output.
 * @param walletKeyPair - A Signer object with the wallet's public and private
 *        key pair.
 * @returns An empty promise upon successful signing.
 */
async function signP2SHDepositInput(
  transaction: Transaction,
  inputIndex: number,
  deposit: Deposit,
  previousOutputValue: number,
  walletKeyPair: Signer
) {
  const depositScript = await prepareDepositScript(
    deposit,
    previousOutputValue,
    walletKeyPair
  )

  const sigHashType = Transaction.SIGHASH_ALL

  const sigHash = transaction.hashForSignature(
    inputIndex,
    depositScript,
    sigHashType
  )

  const signature = script.signature.encode(
    walletKeyPair.sign(sigHash),
    sigHashType
  )

  const scriptSig: Stack = []
  scriptSig.push(signature)
  scriptSig.push(walletKeyPair.publicKey)
  scriptSig.push(depositScript)

  transaction.ins[inputIndex].script = script.compile(scriptSig)
}

/**
 * Signs a P2WSH deposit transaction input and sets the witness script.
 * @param transaction - The transaction containing the input to be signed.
 * @param inputIndex - Index pointing to the input within the transaction.
 * @param deposit - Details of the deposit transaction.
 * @param previousOutputValue - The value from the previous transaction output.
 * @param walletKeyPair - A Signer object with the wallet's public and private
 *        key pair.
 * @returns An empty promise upon successful signing.
 */
async function signP2WSHDepositInput(
  transaction: Transaction,
  inputIndex: number,
  deposit: Deposit,
  previousOutputValue: number,
  walletKeyPair: Signer
) {
  const depositScript = await prepareDepositScript(
    deposit,
    previousOutputValue,
    walletKeyPair
  )

  const sigHashType = Transaction.SIGHASH_ALL

  const sigHash = transaction.hashForWitnessV0(
    inputIndex,
    depositScript,
    previousOutputValue,
    sigHashType
  )

  const signature = script.signature.encode(
    walletKeyPair.sign(sigHash),
    sigHashType
  )

  const witness: Buffer[] = []
  witness.push(signature)
  witness.push(walletKeyPair.publicKey)
  witness.push(depositScript)

  transaction.ins[inputIndex].witness = witness
}

/**
 * Assembles the deposit script based on the given deposit details. Performs
 * validations on values and key formats.
 * @param deposit - The deposit details.
 * @param previousOutputValue - Value from the previous transaction output.
 * @param walletKeyPair - Signer object containing the wallet's key pair.
 * @returns A Promise resolving to the assembled deposit script as a Buffer.
 * @throws Error if there are discrepancies in values or key formats.
 */
async function prepareDepositScript(
  deposit: Deposit,
  previousOutputValue: number,
  walletKeyPair: Signer
): Promise<Buffer> {
  if (previousOutputValue != deposit.amount.toNumber()) {
    throw new Error("Mismatch between amount in deposit and deposit tx")
  }

  const walletPublicKey = walletKeyPair.publicKey.toString("hex")

  if (computeHash160(walletPublicKey) != deposit.walletPublicKeyHash) {
    throw new Error(
      "Wallet public key does not correspond to wallet private key"
    )
  }

  if (!isCompressedPublicKey(walletPublicKey)) {
    throw new Error("Wallet public key must be compressed")
  }

  // eslint-disable-next-line no-unused-vars
  const { amount, vault, ...depositScriptParameters } = deposit

  const depositScript = Buffer.from(
    await assembleDepositScript(depositScriptParameters),
    "hex"
  )

  return depositScript
}

/**
 * Prepares the proof of a deposit sweep transaction and submits it to the
 * Bridge on-chain contract.
 * @param transactionHash - Hash of the transaction being proven.
 * @param mainUtxo - Recent main UTXO of the wallet as currently known on-chain.
 * @param bridge - Handle to the Bridge on-chain contract.
 * @param bitcoinClient - Bitcoin client used to interact with the network.
 * @param vault - (Optional) The vault pointed by swept deposits.
 * @returns Empty promise.
 */
export async function submitDepositSweepProof(
  transactionHash: TransactionHash,
  mainUtxo: UnspentTransactionOutput,
  bridge: Bridge,
  bitcoinClient: BitcoinClient,
  vault?: Identifier
): Promise<void> {
  const confirmations = await bridge.txProofDifficultyFactor()
  const proof = await assembleTransactionProof(
    transactionHash,
    confirmations,
    bitcoinClient
  )
  // TODO: Write a converter and use it to convert the transaction part of the
  // proof to the decomposed transaction data (version, inputs, outputs, locktime).
  // Use raw transaction data for now.
  const rawTransaction = await bitcoinClient.getRawTransaction(transactionHash)
  const decomposedRawTransaction = decomposeRawTransaction(rawTransaction)
  await bridge.submitDepositSweepProof(
    decomposedRawTransaction,
    proof,
    mainUtxo,
    vault
  )
}

/**
 * Checks if a UTXO is owned by a provided key pair based on its previous output
 * script.
 * @dev The function assumes previous output script comes form the P2PKH or
 *      P2WPKH UTXO.
 * @param keyPair - A Signer object containing the public key and private key
 *        pair.
 * @param prevOutScript - A Buffer containing the previous output script of the
 *        UTXO.
 * @param bitcoinNetwork - The Bitcoin network type.
 * @returns A boolean indicating whether the derived address from the UTXO's
 *          previous output script matches either of the P2PKH or P2WPKH
 *          addresses derived from the provided key pair.
 */
export function ownsUtxo(
  keyPair: Signer,
  prevOutScript: Buffer,
  bitcoinNetwork: BitcoinNetwork
): boolean {
  const network = toBitcoinJsLibNetwork(bitcoinNetwork)

  // Derive P2PKH and P2WPKH addresses from the public key.
  const p2pkhAddress =
    payments.p2pkh({ pubkey: keyPair.publicKey, network }).address || ""
  const p2wpkhAddress =
    payments.p2wpkh({ pubkey: keyPair.publicKey, network }).address || ""

  // Try to extract an address from the provided prevOutScript.
  let addressFromOutput = ""
  try {
    addressFromOutput =
      payments.p2pkh({ output: prevOutScript, network }).address || ""
  } catch (e) {
    // If not P2PKH, try P2WPKH.
    try {
      addressFromOutput =
        payments.p2wpkh({ output: prevOutScript, network }).address || ""
    } catch (err) {
      // If neither p2pkh nor p2wpkh address can be derived, assume the previous
      // output script comes from a different UTXO type or is corrupted.
      return false
    }
  }

  // Check if the UTXO's address matches either of the derived addresses.
  return (
    addressFromOutput === p2pkhAddress || addressFromOutput === p2wpkhAddress
  )
}
