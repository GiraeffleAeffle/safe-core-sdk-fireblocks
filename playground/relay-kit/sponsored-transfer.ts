import { ethers } from 'ethers'
import { GelatoRelayPack } from '@safe-global/relay-kit'
import Safe, { EthersAdapter, getSafeContract } from '@safe-global/protocol-kit'
import {
  MetaTransactionData,
  MetaTransactionOptions,
  OperationType,
  RelayTransaction
} from '@safe-global/safe-core-sdk-types'

import { configDotenv } from 'dotenv'
import { abi } from '../api-kit/abi'
import { ApiBaseUrl, ChainId, FireblocksWeb3Provider } from '@fireblocks/fireblocks-web3-provider'
configDotenv()

const eip1193Provider = new FireblocksWeb3Provider({
  privateKey: String(process.env.FIREBLOCKS_API_PRIVATE_KEY_PATH),
  apiKey: String(process.env.FIREBLOCKS_API_KEY),
  vaultAccountIds: 0,
  chainId: ChainId.GOERLI,
  apiBaseUrl: ApiBaseUrl.Sandbox,
  logTransactionStatusChanges: true
})
const provider = new ethers.providers.Web3Provider(eip1193Provider)
const signer = provider.getSigner()

const safeAddress = '0x013f3BA9a4D4744A72CD33d1c1F8107D236c6bcb'
const chainId = 5
const targetAddress = '0x42441776d0e60fd8258e587B04738BD095569B1C'
const GELATO_RELAY_API_KEY = process.env.GELATO_RELAY_API_KEY
const myToken = new ethers.Contract(targetAddress, abi, signer)
const amount = BigInt(0xde0b6b3a7640000) // 1000000000000000000 wei

async function relayTransaction() {
  // Create a transaction object
  const relayKit = new GelatoRelayPack(GELATO_RELAY_API_KEY)

  const ethAdapter = new EthersAdapter({
    ethers,
    signerOrProvider: signer
  })

  const safeSDK = await Safe.create({
    ethAdapter,
    safeAddress
  })

  const safeTransactionData: MetaTransactionData = {
    to: targetAddress,
    data: myToken.interface.encodeFunctionData('transfer', [
      '0x1853159F242AcAae47a833a2e2c24DAf9A04AaDF',
      amount
    ]),
    value: '0',
    operation: OperationType.Call
  }
  const options: MetaTransactionOptions = {
    isSponsored: true
  }

  const standardizedSafeTx = await relayKit.createRelayedTransaction({
    safe: safeSDK,
    transactions: [safeTransactionData],
    options
  })

  const safeSingletonContract = await getSafeContract({
    ethAdapter: ethAdapter,
    safeVersion: await safeSDK.getContractVersion()
  })

  const signedSafeTx = await safeSDK.signTransaction(standardizedSafeTx)

  const encodedTx = safeSingletonContract.encode('execTransaction', [
    signedSafeTx.data.to,
    signedSafeTx.data.value,
    signedSafeTx.data.data,
    signedSafeTx.data.operation,
    signedSafeTx.data.safeTxGas,
    signedSafeTx.data.baseGas,
    signedSafeTx.data.gasPrice,
    signedSafeTx.data.gasToken,
    signedSafeTx.data.refundReceiver,
    signedSafeTx.encodedSignatures()
  ])

  const relayTransaction: RelayTransaction = {
    target: safeAddress,
    encodedTransaction: encodedTx,
    chainId: chainId,
    options
  }

  const response = await relayKit.relayTransaction(relayTransaction)
  console.log(
    `Relay Transaction Task ID: https://relay.gelato.digital/tasks/status/${response.taskId}`
  )
}
relayTransaction()
