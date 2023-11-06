import {
  EthersAdapter,
  getSafeContract,
  getProxyFactoryContract,
  encodeSetupCallData,
  PredictedSafeProps
} from '@safe-global/protocol-kit'
import AccountAbstraction, {
  AccountAbstractionConfig
} from '@safe-global/account-abstraction-kit-poc'
import { GelatoRelayPack } from '@safe-global/relay-kit'
import { MetaTransactionOptions } from '@safe-global/safe-core-sdk-types'
import { FireblocksWeb3Provider, ChainId, ApiBaseUrl } from '@fireblocks/fireblocks-web3-provider'
import { ethers } from 'ethers'
import { configDotenv } from 'dotenv'
configDotenv()
// Fund the 1Balance account that will sponsor the transaction and get the API key:
// https://relay.gelato.network/

// Check the status of a transaction after it is relayed:
// https://relay.gelato.digital/tasks/status/<TASK_ID>

// Check the status of a transaction after it is executed:
// https://goerli.etherscan.io/tx/<TRANSACTION_HASH>

interface Config {
  RPC_URL: string
  SAFE_ADDRESS: string
  TX_SERVICE_URL: string
  RELAY_API_KEY: string
}

const config: Config = {
  RPC_URL: 'https://eth-goerli.g.alchemy.com/v2/njApFwEyNNu1yPzKLGPgrNxpE_T8TJVv',
  SAFE_ADDRESS: '0x386e3Bf19B4eB191f954f6BBc4E388395a8E75A3',
  TX_SERVICE_URL: 'https://safe-transaction-goerli.safe.global/', // Check https://docs.safe.global/safe-core-api/available-services
  RELAY_API_KEY: ''
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
  console.log('Execute meta-transaction via Gelato Relay paid by 1Balance')

  // SDK Initialization

  const provider = new ethers.providers.Web3Provider(eip1193Provider)
  const signer = provider.getSigner()

  const relayPack = new GelatoRelayPack(config.RELAY_API_KEY)

  const safeAccountAbstraction = new AccountAbstraction(signer)
  const sdkConfig: AccountAbstractionConfig = {
    relayPack
  }
  await safeAccountAbstraction.init(sdkConfig)

  // const contractManager = await new ContractManager().init(safeConfig)

  // Calculate Safe address

  // const predictedSafeAddress = safeAccountAbstraction.getSafeAddress()
  // console.log({ predictedSafeAddress })

  // const isSafeDeployed = await safeAccountAbstraction.isSafeDeployed()
  // console.log({ isSafeDeployed })

  // Create EthAdapter instance
  const ethAdapter = new EthersAdapter({
    ethers,
    signerOrProvider: signer
  })

  const safeVersionDeployed = '1.4.1'
  const safeSingletonContract = await getSafeContract({
    ethAdapter,
    safeVersion: safeVersionDeployed,
    isL1SafeMasterCopy: true
  })

console.log("safeSingletonContract: ", safeSingletonContract)

  const predictedSafe: PredictedSafeProps = {
    safeAccountConfig: {
      owners: [await signer.getAddress()],
      threshold: 1
    },
    safeDeploymentConfig: {
      safeVersion: safeVersionDeployed
    }
  }

  // we use the SafeProxyFactory.sol contract, see: https://github.com/safe-global/safe-contracts/blob/main/contracts/proxies/SafeProxyFactory.sol
  const safeProxyFactoryContract = await getProxyFactoryContract({
    ethAdapter,
    safeVersion: safeVersionDeployed
  })

  // this is the call to the setup method that sets the threshold & owners of the new Safe, see: https://github.com/safe-global/safe-contracts/blob/main/contracts/Safe.sol#L95
  const initializer = await encodeSetupCallData({
    ethAdapter,
    safeContract: safeSingletonContract,
    safeAccountConfig: predictedSafe.safeAccountConfig,
    customContracts:
  })

  const saltNonce = '1'

  const safeDeployTransactionData = [
    {
      // ...transactionOptions, // optional transaction options like from, gasLimit, gasPrice...
      to: safeProxyFactoryContract.getAddress(),
      value: '0',
      // we use the createProxyWithNonce method to create the Safe in a deterministic address, see: https://github.com/safe-global/safe-contracts/blob/main/contracts/proxies/SafeProxyFactory.sol#L52
      data: safeProxyFactoryContract.encode('createProxyWithNonce', [
        safeSingletonContract.getAddress(),
        initializer, // call to the setup method to set the threshold & owners of the new Safe
        saltNonce
      ])
    }
  ]

  // Fake on-ramp to fund the Safe

  // const safeBalance = await provider.getBalance(predictedSafeAddress)
  // console.log({ safeBalance: ethers.utils.formatEther(safeBalance.toString()) })
  // if (safeBalance.lt(txConfig.VALUE)) {
  //   const fakeOnRampSigner = new ethers.Wallet(mockOnRampConfig.PRIVATE_KEY, provider)
  //   const onRampResponse = await fakeOnRampSigner.sendTransaction({
  //     to: predictedSafeAddress,
  //     value: txConfig.VALUE
  //   })
  //   console.log(`Funding the Safe with ${ethers.utils.formatEther(txConfig.VALUE.toString())} ETH`)
  //   await onRampResponse.wait()

  //   const safeBalanceAfter = await provider.getBalance(predictedSafeAddress)
  //   console.log({ safeBalance: ethers.utils.formatEther(safeBalanceAfter.toString()) })
  // }

  // Relay the transaction

  // const safeTransactions: MetaTransactionData[] = [
  //   {
  //     to: txConfig.TO,
  //     data: txConfig.DATA,
  //     value: txConfig.VALUE,
  //     operation: OperationType.Call
  //   }
  // ]
  const options: MetaTransactionOptions = {
    isSponsored: true
  }

  const response = await safeAccountAbstraction.relayTransaction(safeDeployTransactionData, options)
  console.log({ GelatoTaskId: response })
}

main()
