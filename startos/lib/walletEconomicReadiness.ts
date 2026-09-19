export type WalletEconomicReadinessInput = {
  configured: boolean
  exists: boolean
  loaded: boolean
  signingBackendAvailable: boolean | null
}

export function isWalletEconomicallyReady(
  wallet: WalletEconomicReadinessInput,
): boolean {
  return (
    wallet.configured === true &&
    wallet.exists === true &&
    wallet.loaded === true &&
    wallet.signingBackendAvailable === true
  )
}

export class WalletNotEconomicallyReadyError extends Error {
  constructor(readonly wallet: WalletEconomicReadinessInput) {
    super('Wallet is not economically ready')
  }
}

export function requireWalletEconomicReadiness(
  wallet: WalletEconomicReadinessInput,
): WalletEconomicReadinessInput {
  if (!isWalletEconomicallyReady(wallet)) {
    throw new WalletNotEconomicallyReadyError(wallet)
  }

  return wallet
}
