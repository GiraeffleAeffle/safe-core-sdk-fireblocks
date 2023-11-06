import SafeApiKit from '@safe-global/api-kit'
import Safe, { EthersAdapter } from '@safe-global/protocol-kit'
import { ethers } from 'ethers'
import { FireblocksWeb3Provider, ChainId, ApiBaseUrl } from '@fireblocks/fireblocks-web3-provider'
import { configDotenv } from 'dotenv'
configDotenv()

// This file can be used to play around with the Safe Core SDK

interface Config {
  RPC_URL: string
  SIGNER_ADDRESS_PRIVATE_KEY: string
  SAFE_ADDRESS: string
  TX_SERVICE_URL: string
  SAFE_TX_HASH: string
}

const config: Config = {
  RPC_URL: String(process.env.ALCHEMY_API_KEY),
  SIGNER_ADDRESS_PRIVATE_KEY: '',
  SAFE_ADDRESS: '0x386e3Bf19B4eB191f954f6BBc4E388395a8E75A3',
  TX_SERVICE_URL: 'https://safe-transaction-goerli.safe.global/', // Check https://docs.safe.global/safe-core-api/available-services
  SAFE_TX_HASH: '0xf4a5b97af6d3f5d257288de73d6425a7438d13b96f4cde526de43c3fda0cd299'
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

  // Get the transaction
  const transaction = await service.getTransaction(config.SAFE_TX_HASH)
  // const transactions = await service.getPendingTransactions()
  // const transactions = await service.getIncomingTransactions()
  // const transactions = await service.getMultisigTransactions()
  // const transactions = await service.getModuleTransactions()
  // const transactions = await service.getAllTransactions()

  const safeTxHash = transaction.safeTxHash
  const signature = await safe.signTransactionHash(safeTxHash)

  // Confirm the Safe transaction
  const signatureResponse = await service.confirmTransaction(safeTxHash, signature.data)

  const signerAddress = await signer.getAddress()
  console.log('Added a new signature to transaction with safeTxHash:', config.SAFE_TX_HASH)
  console.log('- Signer:', signerAddress)
  console.log('- Signer signature:', signatureResponse.signature)
}

main()
