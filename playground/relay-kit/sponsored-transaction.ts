import {
  EthersAdapter,
  getSafeContract,
  getProxyFactoryContract,
  encodeSetupCallData,
  PredictedSafeProps,
  predictSafeAddress
} from '@safe-global/protocol-kit'
import AccountAbstraction, {
  AccountAbstractionConfig
} from '@safe-global/account-abstraction-kit-poc'
import { GelatoRelayPack } from '@safe-global/relay-kit'
import { MetaTransactionOptions, OperationType } from '@safe-global/safe-core-sdk-types'
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
  TX_SERVICE_URL: string
  RELAY_API_KEY: string
}

const config: Config = {
  RPC_URL: String(process.env.ALCHEMY_API_KEY),
  TX_SERVICE_URL: 'https://safe-transaction-goerli.safe.global/', // Check https://docs.safe.global/safe-core-api/available-services
  RELAY_API_KEY: String(process.env.GELATO_RELAY_API_KEY)
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

  const getEstimateFee = await relayPack.getEstimateFee(5, '10000000')

  console.log('getEstimateFee: ', getEstimateFee)

  // Create EthAdapter instance
  const ethAdapter = new EthersAdapter({
    ethers,
    signerOrProvider: signer
  })

  const safeVersionDeployed = '1.3.0'
  const safeSingletonContract = await getSafeContract({
    ethAdapter,
    safeVersion: safeVersionDeployed,
    isL1SafeMasterCopy: true
  })

  console.log('safeSingletonContract: ', safeSingletonContract)
  const saltNonce = '2' // uuidv4()
  const signerAddress = await signer.getAddress()

  const predictedSafe: PredictedSafeProps = {
    safeAccountConfig: {
      owners: [signerAddress],
      threshold: 1
    },
    safeDeploymentConfig: {
      safeVersion: safeVersionDeployed,
      saltNonce
    }
  }

  console.log('predictedSafe: ', predictedSafe)
  const predictedSafeAddress = await predictSafeAddress({
    ethAdapter,
    safeAccountConfig: predictedSafe.safeAccountConfig,
    safeDeploymentConfig: predictedSafe.safeDeploymentConfig,
    isL1SafeMasterCopy: true
  })
  console.log('predictedSafeAddress: ', predictedSafeAddress)

  const isSafeDeployed = await safeAccountAbstraction.isSafeDeployed()
  console.log({ isSafeDeployed })

  // we use the SafeProxyFactory.sol contract, see: https://github.com/safe-global/safe-contracts/blob/main/contracts/proxies/SafeProxyFactory.sol
  const safeProxyFactoryContract = await getProxyFactoryContract({
    ethAdapter,
    safeVersion: safeVersionDeployed
  })

  console.log('safeProxyFactoryContract: ', safeProxyFactoryContract)

  // this is the call to the setup method that sets the threshold & owners of the new Safe, see: https://github.com/safe-global/safe-contracts/blob/main/contracts/Safe.sol#L95
  const initializer = await encodeSetupCallData({
    ethAdapter,
    safeContract: safeSingletonContract,
    safeAccountConfig: predictedSafe.safeAccountConfig
  })

  console.log('initializer: ', initializer)

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
      ]),
      operation: OperationType.DelegateCall,
      nonce: 2
    }
  ]

  console.log('safeDeployTransactionData: ', safeDeployTransactionData)

  const options: MetaTransactionOptions = {
    isSponsored: true
  }

  const response = await safeAccountAbstraction.relayTransaction(safeDeployTransactionData, options)
  console.log({ GelatoTaskId: response })
}

main()
