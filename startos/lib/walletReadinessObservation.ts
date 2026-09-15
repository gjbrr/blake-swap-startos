import { WalletSigningCapability } from './walletSigningCapability'
import { isWalletEconomicallyReady } from './walletEconomicReadiness'

export type WalletReadinessObservation = {
  wallet: string
  configured: boolean
  exists: boolean
  loaded: boolean
  signing: WalletSigningCapability
}

export function emptyWalletReadinessObservation():
  WalletReadinessObservation {
  return {
    wallet: '',
    configured: false,
    exists: false,
    loaded: false,
    signing: {
      privateKeysEnabled: null,
      externalSigner: null,
      signingBackendAvailable: null,
    },
  }
}

export function isObservationEconomicallyReady(
  observation: WalletReadinessObservation,
): boolean {
  return isWalletEconomicallyReady({
    configured: observation.configured,
    exists: observation.exists,
    loaded: observation.loaded,
    signingBackendAvailable:
      observation.signing.signingBackendAvailable,
  })
}
