import {
  requireWalletObservationEconomicReadiness,
  WalletObservationNotEconomicallyReadyError,
} from './requireWalletEconomicReadiness'

const ready = {
  wallet: 'ready-wallet',
  configured: true,
  exists: true,
  loaded: true,
  signing: {
    privateKeysEnabled: true,
    externalSigner: false,
    signingBackendAvailable: true,
  },
}

const cases = [
  {
    name: 'passes explicit ready observation',
    observation: ready,
    shouldThrow: false,
  },
  {
    name: 'rejects unconfigured wallet',
    observation: {
      ...ready,
      configured: false,
    },
    shouldThrow: true,
  },
  {
    name: 'rejects missing wallet',
    observation: {
      ...ready,
      exists: false,
    },
    shouldThrow: true,
  },
  {
    name: 'rejects unloaded wallet',
    observation: {
      ...ready,
      loaded: false,
    },
    shouldThrow: true,
  },
  {
    name: 'rejects unavailable signing backend',
    observation: {
      ...ready,
      signing: {
        ...ready.signing,
        signingBackendAvailable: false,
      },
    },
    shouldThrow: true,
  },
  {
    name: 'rejects unknown signing backend',
    observation: {
      ...ready,
      signing: {
        ...ready.signing,
        signingBackendAvailable: null,
      },
    },
    shouldThrow: true,
  },
]

for (const test of cases) {
  let threw = false

  try {
    requireWalletObservationEconomicReadiness('blake', test.observation)
  } catch (error) {
    threw = true

    if (!(error instanceof WalletObservationNotEconomicallyReadyError)) {
      throw error
    }
  }

  if (threw !== test.shouldThrow) {
    throw new Error(
      `${test.name}: expected shouldThrow=${test.shouldThrow}, got ${threw}`,
    )
  }
}

console.log('PASS wallet economic readiness guard')
