import { GelatoRelay, SponsoredCallRequest } from '@gelatonetwork/relay-sdk'
import { SafeTransactionDataPartial } from '@safe-global/safe-core-sdk-types'
import { FireblocksWeb3Provider, ChainId, ApiBaseUrl } from '@fireblocks/fireblocks-web3-provider'
import { ethers } from 'ethers'
import { configDotenv } from 'dotenv'
import { abi } from '../api-kit/abi'
configDotenv()

// Fund the 1Balance account that will sponsor the transaction and get the API key:
// https://relay.gelato.network/

// Check the status of a transaction after it is relayed:
// https://relay.gelato.digital/tasks/status/<TASK_ID>

// Check the status of a transaction after it is executed:
// https://goerli.etherscan.io/tx/<TRANSACTION_HASH>

const eip1193Provider = new FireblocksWeb3Provider({
  privateKey: String(process.env.FIREBLOCKS_API_PRIVATE_KEY_PATH),
  apiKey: String(process.env.FIREBLOCKS_API_KEY),
  vaultAccountIds: 0,
  chainId: ChainId.GOERLI,
  apiBaseUrl: ApiBaseUrl.Sandbox,
  logTransactionStatusChanges: true
})

async function main() {
  console.log('Execute meta-transaction via Gelato Relay paid by 1Balance')

  // SDK Initialization

  const provider = new ethers.providers.Web3Provider(eip1193Provider)
  const signer = provider.getSigner()

  const myToken = '0x42441776d0e60fd8258e587B04738BD095569B1C'
  const amount = BigInt(0xde0b6b3a7640000) // 1000000000000000000 wei
  const contract = new ethers.Contract(myToken, abi, signer)

  // Create transaction
  const safeTransactionData: SafeTransactionDataPartial = {
    to: contract.address,
    data: contract.interface.encodeFunctionData('mint', [
      '0x013f3BA9a4D4744A72CD33d1c1F8107D236c6bcb',
      amount
    ]),
    value: '0'
  }

  const chainId = BigInt((await provider.getNetwork()).chainId)

  // Setup relay & request

  const relay = new GelatoRelay()
  const request: SponsoredCallRequest = {
    chainId,
    target: contract.address,
    data: safeTransactionData.data as string
  }

  console.log('request: ', request)

  // Without a specific API key, the relay request will fail!
  // Go to https://relay.gelato.network to get a testnet API key with 1Balance.
  // Send a relay request using Gelato Relay!
  const response = await relay.sponsoredCall(request, process.env.GELATO_RELAY_API_KEY as string)

  console.log(`https://relay.gelato.digital/tasks/status/${response.taskId}`)
}

main()
