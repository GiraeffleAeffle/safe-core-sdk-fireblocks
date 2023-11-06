import SafeApiKit from '@safe-global/api-kit'
import Safe, { EthersAdapter } from '@safe-global/protocol-kit'
import { SafeTransactionDataPartial } from '@safe-global/safe-core-sdk-types'
import { ethers } from 'ethers'
import { abi } from './abi'
import { FireblocksWeb3Provider, ChainId, ApiBaseUrl } from '@fireblocks/fireblocks-web3-provider'
import { configDotenv } from 'dotenv'
configDotenv()

// This file can be used to play around with the Safe Core SDK

interface Config {
  RPC_URL: string
  SIGNER_ADDRESS_PRIVATE_KEY: string
  SAFE_ADDRESS: string
  TX_SERVICE_URL: string
}

const config: Config = {
  RPC_URL: 'https://eth-goerli.g.alchemy.com/v2/njApFwEyNNu1yPzKLGPgrNxpE_T8TJVv',
  SIGNER_ADDRESS_PRIVATE_KEY: '',
  SAFE_ADDRESS: '0x386e3Bf19B4eB191f954f6BBc4E388395a8E75A3',
  TX_SERVICE_URL: 'https://safe-transaction-goerli.safe.global/' // Check https://docs.safe.global/safe-core-api/available-services
}

const eip1193Provider = new FireblocksWeb3Provider({
  privateKey: String(process.env.FIREBLOCKS_API_PRIVATE_KEY_PATH),
  apiKey: String(process.env.FIREBLOCKS_API_KEY),
  vaultAccountIds: 0,
  chainId: ChainId.GOERLI,
  apiBaseUrl: ApiBaseUrl.Sandbox,
  logTransactionStatusChanges: true
})

async function main() {
  const provider = new ethers.providers.Web3Provider(eip1193Provider)
  const signer = provider.getSigner()

  const ethAdapter = new EthersAdapter({
    ethers,
    signerOrProvider: signer
  })

  // Create Safe instance
  const safe = await Safe.create({
    ethAdapter,
    safeAddress: config.SAFE_ADDRESS
  })

  // Create Safe API Kit instance
  const service = new SafeApiKit({
    txServiceUrl: config.TX_SERVICE_URL,
    ethAdapter
  })

  const nonce = await service.getNextNonce(config.SAFE_ADDRESS)
  const myToken = '0xd6981777F89aCD65bcD4deEE1EF78f40331AF80c'
  const amount = 1994468510808833
  const contract = new ethers.Contract(myToken, abi, signer)

  // Create transaction
  const safeTransactionData: SafeTransactionDataPartial = {
    to: contract.address,
    data: contract.interface.encodeFunctionData('mint', [config.SAFE_ADDRESS, amount]),
    value: '0',
    nonce
  }
  const safeTransaction = await safe.createTransaction({ safeTransactionData })

  const senderAddress = await signer.getAddress()
  const safeTxHash = await safe.getTransactionHash(safeTransaction)
  const signature = await safe.signTransactionHash(safeTxHash)

  // Propose transaction to the service
  await service.proposeTransaction({
    safeAddress: config.SAFE_ADDRESS,
    safeTransactionData: safeTransaction.data,
    safeTxHash,
    senderAddress,
    senderSignature: signature.data
  })

  console.log('Proposed a transaction with Safe:', config.SAFE_ADDRESS)
  console.log('- safeTxHash:', safeTxHash)
  console.log('- Sender:', senderAddress)
  console.log('- Sender signature:', signature.data)
}

main()
