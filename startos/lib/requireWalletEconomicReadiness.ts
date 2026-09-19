import {
  WalletReadinessObservation,
  isObservationEconomicallyReady,
} from './walletReadinessObservation'

export class WalletObservationNotEconomicallyReadyError extends Error {
  constructor(
    readonly chain: 'blake' | 'btc',
    readonly observation: WalletReadinessObservation,
  ) {
    super(`${chain.toUpperCase()} wallet is not economically ready`)
  }
}

export function requireWalletObservationEconomicReadiness(
  chain: 'blake' | 'btc',
  observation: WalletReadinessObservation,
): WalletReadinessObservation {
  if (!isObservationEconomicallyReady(observation)) {
    throw new WalletObservationNotEconomicallyReadyError(chain, observation)
  }

  return observation
}
