import {
  observeWalletReadiness,
  WalletObserverInput,
} from './observeWalletReadiness'
import { requireWalletObservationEconomicReadiness } from './requireWalletEconomicReadiness'
import { WalletReadinessObservation } from './walletReadinessObservation'

type RunJson = (command: string[]) => Promise<unknown>

export async function requireObservedWalletEconomicReadiness(
  runJson: RunJson,
  chain: 'blake' | 'btc',
  input: WalletObserverInput,
): Promise<WalletReadinessObservation> {
  const observation = await observeWalletReadiness(runJson, input)

  return requireWalletObservationEconomicReadiness(chain, observation)
}
