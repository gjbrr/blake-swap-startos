import {
  requireObservedWalletEconomicReadiness,
} from './requireObservedWalletEconomicReadiness'
import {
  WalletObservationNotEconomicallyReadyError,
} from './requireWalletEconomicReadiness'

async function testReadyWallet() {
  const responses: unknown[] = [
    {
      wallets: [
        { name: 'economic-wallet' },
      ],
    },
    ['economic-wallet'],
    {
      private_keys_enabled: true,
      external_signer: false,
    },
  ]

  const runJson = async (): Promise<unknown> => {
    const next = responses.shift()

    if (next === undefined) {
      throw new Error('unexpected extra RPC')
    }

    return next
  }

  const observation =
    await requireObservedWalletEconomicReadiness(
      runJson,
      'blake',
      {
        cli: '/fake/blake-cli',
        wallet: 'economic-wallet',
        env: [],
      },
    )

  if (observation.wallet !== 'economic-wallet') {
    throw new Error('ready wallet was not returned')
  }

  if (
    observation.signing.signingBackendAvailable !== true
  ) {
    throw new Error(
      'ready wallet did not report signing backend',
    )
  }
}

async function testNonSigningWalletFailsClosed() {
  const responses: unknown[] = [
    {
      wallets: [
        { name: 'watch-wallet' },
      ],
    },
    ['watch-wallet'],
    {
      private_keys_enabled: false,
      external_signer: false,
    },
  ]

  const runJson = async (): Promise<unknown> => {
    const next = responses.shift()

    if (next === undefined) {
      throw new Error('unexpected extra RPC')
    }

    return next
  }

  let caught: unknown = null

  try {
    await requireObservedWalletEconomicReadiness(
      runJson,
      'blake',
      {
        cli: '/fake/blake-cli',
        wallet: 'watch-wallet',
        env: [],
      },
    )
  } catch (error) {
    caught = error
  }

  if (
    !(caught instanceof
      WalletObservationNotEconomicallyReadyError)
  ) {
    throw new Error(
      'non-signing wallet did not fail closed',
    )
  }

  if (caught.chain !== 'blake') {
    throw new Error(
      'economic readiness error lost chain identity',
    )
  }

  if (
    caught.observation.signing
      .signingBackendAvailable !== false
  ) {
    throw new Error(
      'economic readiness error lost wallet observation',
    )
  }
}

async function testBlankWalletFailsWithoutRpc() {
  let rpcCalls = 0

  const runJson = async (): Promise<unknown> => {
    rpcCalls += 1
    throw new Error('RPC must not be called')
  }

  let caught: unknown = null

  try {
    await requireObservedWalletEconomicReadiness(
      runJson,
      'btc',
      {
        cli: '/fake/btc-cli',
        wallet: '',
        env: [],
      },
    )
  } catch (error) {
    caught = error
  }

  if (
    !(caught instanceof
      WalletObservationNotEconomicallyReadyError)
  ) {
    throw new Error(
      'blank wallet did not fail closed',
    )
  }

  if (rpcCalls !== 0) {
    throw new Error(
      'blank wallet unexpectedly performed RPC',
    )
  }
}

async function main() {
  await testReadyWallet()
  await testNonSigningWalletFailsClosed()
  await testBlankWalletFailsWithoutRpc()

  console.log(
    'PASS observed wallet economic readiness guard',
  )
}

void main()
