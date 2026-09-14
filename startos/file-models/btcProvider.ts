import { FileHelper } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

export type BtcProviderConfig = {
  rpcUrl: string
  rpcUsername: string
  rpcPassword: string
  trustedCaPem: string
}

function validateBtcProvider(value: unknown): BtcProviderConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('BTC provider config must be an object')
  }

  const record = value as Record<string, unknown>

  for (const key of [
    'rpcUrl',
    'rpcUsername',
    'rpcPassword',
    'trustedCaPem',
  ] as const) {
    if (typeof record[key] !== 'string') {
      throw new Error(`BTC provider config field ${key} must be a string`)
    }
  }

  return {
    rpcUrl: record.rpcUrl as string,
    rpcUsername: record.rpcUsername as string,
    rpcPassword: record.rpcPassword as string,
    trustedCaPem: record.trustedCaPem as string,
  }
}

export const btcProvider = FileHelper.raw<BtcProviderConfig>(
  {
    base: sdk.volumes.main,
    subpath: 'config/btc-provider.json',
  },
  data => `${JSON.stringify(data, null, 2)}\n`,
  raw => JSON.parse(raw),
  validateBtcProvider,
)
