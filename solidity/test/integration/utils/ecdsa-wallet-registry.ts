// TODO: Utils in this file are pulled from @keep-network/ecdsa test utils.
// We should consider exposing them in @keep-network/ecdsa for an external usage.

/* eslint-disable no-await-in-loop */
import { deployments, ethers, helpers } from "hardhat"

import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import type {
  ContractTransaction,
  BytesLike,
  BigNumber,
  BigNumberish,
  Contract,
  Signer,
} from "ethers"
import type { WalletRegistry, SortitionPool } from "../../../typechain"

// Number of members in the ECDSA Wallet.
const WALLET_SIZE = 100

export async function registerOperator(
  walletRegistry: WalletRegistry,
  sortitionPool: SortitionPool,
  stakingProvider: Signer,
  operator: Signer
): Promise<number> {
  await walletRegistry
    .connect(stakingProvider)
    .registerOperator(await operator.getAddress())

  await walletRegistry.connect(operator).joinSortitionPool()

  const operatorID = await sortitionPool.getOperatorID(
    await operator.getAddress()
  )

  return operatorID
}

export async function performEcdsaDkg(
  walletRegistry: WalletRegistry,
  groupPublicKey: BytesLike,
  startBlock: number
): Promise<{ approveDkgResultTx: ContractTransaction }> {
  const {
    dkgResult,
    submitter,
    submitDkgResultTx: dkgResultSubmissionTx,
  } = await signAndSubmitDkgResult(walletRegistry, groupPublicKey, startBlock)

  await helpers.time.mineBlocksTo(
    dkgResultSubmissionTx.blockNumber +
      (
        await walletRegistry.dkgParameters()
      ).resultChallengePeriodLength.toNumber()
  )

  const approveDkgResultTx = await walletRegistry
    .connect(submitter)
    .approveDkgResult(dkgResult)

  return { approveDkgResultTx }
}

export async function updateWalletRegistryDkgResultChallengePeriodLength(
  walletRegistry: WalletRegistry,
  governance: Signer,
  dkgResultChallengePeriodLength: BigNumberish
): Promise<void> {
  const walletRegistryGovernance = await ethers.getContractAt(
    (
      await deployments.getArtifact("WalletRegistryGovernance")
    ).abi,
    await walletRegistry.governance()
  )

  await walletRegistryGovernance
    .connect(governance)
    .beginDkgResultChallengePeriodLengthUpdate(dkgResultChallengePeriodLength)

  await helpers.time.increaseTime(
    await walletRegistryGovernance.governanceDelay()
  )

  await walletRegistryGovernance
    .connect(governance)
    .finalizeDkgResultChallengePeriodLengthUpdate()
}

async function selectGroup(
  walletRegistry: WalletRegistry
): Promise<Operator[]> {
  const sortitionPool = (await ethers.getContractAt(
    "SortitionPool",
    await walletRegistry.sortitionPool()
  )) as SortitionPool

  const identifiers = await walletRegistry.selectGroup()

  const addresses = await sortitionPool.getIDOperators(identifiers)

  return Promise.all(
    identifiers.map(
      async (identifier, i): Promise<Operator> => ({
        id: identifier,
        signer: await ethers.getSigner(addresses[i]),
      })
    )
  )
}

interface DkgResult {
  submitterMemberIndex: number
  groupPubKey: BytesLike
  misbehavedMembersIndices: number[]
  signatures: string
  signingMembersIndices: number[]
  members: number[]
  membersHash: string
}

type OperatorID = number

type Operator = {
  id: OperatorID
  signer: SignerWithAddress
}

const noMisbehaved: number[] = []

async function signAndSubmitDkgResult(
  walletRegistry: WalletRegistry,
  groupPublicKey: BytesLike,
  startBlock: number,
  misbehavedIndices = noMisbehaved
): Promise<{
  dkgResult: DkgResult
  submitter: SignerWithAddress
  submitDkgResultTx: ContractTransaction
}> {
  const signers = await selectGroup(walletRegistry)

  const submitterIndex = 1

  const { dkgResult } = await signDkgResult(
    signers,
    groupPublicKey,
    misbehavedIndices,
    startBlock,
    submitterIndex
  )

  const submitter = signers[submitterIndex - 1].signer

  const submitDkgResultTx = await walletRegistry
    .connect(submitter)
    .submitDkgResult(dkgResult)

  return {
    dkgResult,
    submitter,
    submitDkgResultTx,
  }
}

async function signDkgResult(
  signers: Operator[],
  groupPublicKey: BytesLike,
  misbehavedMembersIndices: number[],
  startBlock: number,
  submitterIndex: number
): Promise<{
  dkgResult: DkgResult
  signingMembersIndices: number[]
  signaturesBytes: string
}> {
  const numberOfSignatures: number = signers.length / 2 + 1

  const resultHash = ethers.utils.solidityKeccak256(
    ["bytes", "uint8[]", "uint256"],
    [groupPublicKey, misbehavedMembersIndices, startBlock]
  )

  const members: number[] = []
  const signingMembersIndices: number[] = []
  const signatures: string[] = []
  for (let i = 0; i < signers.length; i++) {
    const { id, signer: ethersSigner } = signers[i]
    members.push(id)

    if (signatures.length === numberOfSignatures) {
      // eslint-disable-next-line no-continue
      continue
    }

    const signerIndex: number = i + 1

    signingMembersIndices.push(signerIndex)

    const signature = await ethersSigner.signMessage(
      ethers.utils.arrayify(resultHash)
    )

    signatures.push(signature)
  }

  const signaturesBytes: string = ethers.utils.hexConcat(signatures)

  const dkgResult: DkgResult = {
    submitterMemberIndex: submitterIndex,
    groupPubKey: groupPublicKey,
    misbehavedMembersIndices,
    signatures: signaturesBytes,
    signingMembersIndices,
    members,
    membersHash: hashDKGMembers(members, misbehavedMembersIndices),
  }

  return { dkgResult, signingMembersIndices, signaturesBytes }
}

function hashDKGMembers(
  members: number[],
  misbehavedMembersIndices?: number[]
): string {
  if (misbehavedMembersIndices && misbehavedMembersIndices.length > 0) {
    const activeDkgMembers = [...members]
    for (let i = 0; i < misbehavedMembersIndices.length; i++) {
      if (misbehavedMembersIndices[i] !== 0) {
        activeDkgMembers.splice(misbehavedMembersIndices[i] - i - 1, 1)
      }
    }

    return ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(["uint32[]"], [activeDkgMembers])
    )
  }

  return ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["uint32[]"], [members])
  )
}