import { FileHelper } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

export type BtcProvider =
  | 'local-bitcoind'
  | 'remote-rpc'

export type BlakeProvider =
  | 'local-bitcoind'
  | 'local-knots-blake2b'
  | 'remote-rpc'

export type NodeProviders = {
  btc: BtcProvider
  blake: BlakeProvider
}

function validateBtcProvider(value: unknown): BtcProvider {
  if (
    value === 'local-bitcoind' ||
    value === 'remote-rpc'
  ) {
    return value
  }

  throw new Error('Invalid BTC provider')
}

function validateBlakeProvider(value: unknown): BlakeProvider {
  if (
    value === 'local-bitcoind' ||
    value === 'local-knots-blake2b' ||
    value === 'remote-rpc'
  ) {
    return value
  }

  throw new Error('Invalid BLAKE provider')
}

function validateNodeProviders(value: unknown): NodeProviders {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error('Node providers must be an object')
  }

  const record = value as Record<string, unknown>

  return {
    btc: validateBtcProvider(record.btc),
    blake: validateBlakeProvider(record.blake),
  }
}

export const nodeProviders = FileHelper.raw<NodeProviders>(
  {
    base: sdk.volumes.main,
    subpath: 'config/node-providers.json',
  },
  (data) => `${JSON.stringify(data, null, 2)}\n`,
  (raw) => JSON.parse(raw),
  validateNodeProviders,
)
