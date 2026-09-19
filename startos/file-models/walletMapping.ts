import { FileHelper } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

export type WalletMapping = {
  blakeWallet: string
  btcWallet: string
}

function validateWalletMapping(value: unknown): WalletMapping {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Wallet mapping must be an object')
  }

  const record = value as Record<string, unknown>

  if (typeof record.blakeWallet !== 'string') {
    throw new Error('Wallet mapping field blakeWallet must be a string')
  }

  if (typeof record.btcWallet !== 'string') {
    throw new Error('Wallet mapping field btcWallet must be a string')
  }

  return {
    blakeWallet: record.blakeWallet,
    btcWallet: record.btcWallet,
  }
}

export const walletMapping = FileHelper.raw<WalletMapping>(
  {
    base: sdk.volumes.main,
    subpath: 'config/wallets.json',
  },
  (data) => `${JSON.stringify(data, null, 2)}\n`,
  (raw) => JSON.parse(raw),
  validateWalletMapping,
)
