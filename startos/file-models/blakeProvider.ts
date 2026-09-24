import { FileHelper } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

export type BlakeProviderConfig = {
  rpcUrl: string
  rpcUsername: string
  rpcPassword: string
  trustedCaPem: string
}

function validateBlakeProvider(
  value: unknown,
): BlakeProviderConfig {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      'BLAKE provider config must be an object',
    )
  }

  const record = value as Record<string, unknown>

  for (const key of [
    'rpcUrl',
    'rpcUsername',
    'rpcPassword',
    'trustedCaPem',
  ] as const) {
    if (typeof record[key] !== 'string') {
      throw new Error(
        `BLAKE provider config field ${key} must be a string`,
      )
    }
  }

  return {
    rpcUrl: record.rpcUrl as string,
    rpcUsername: record.rpcUsername as string,
    rpcPassword: record.rpcPassword as string,
    trustedCaPem: record.trustedCaPem as string,
  }
}

export const blakeProvider =
  FileHelper.raw<BlakeProviderConfig>(
    {
      base: sdk.volumes.main,
      subpath: 'config/blake-provider.json',
    },
    (data) => `${JSON.stringify(data, null, 2)}\n`,
    (raw) => JSON.parse(raw),
    validateBlakeProvider,
  )
