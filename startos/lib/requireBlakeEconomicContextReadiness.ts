import {
  BlakeBlockchainInfoResult,
} from './blakeBlockchainInfo'
import {
  requireBlakeEconomicReadiness,
} from './requireBlakeEconomicReadiness'
import {
  requireObservedWalletEconomicReadiness,
} from './requireObservedWalletEconomicReadiness'
import {
  WalletObserverInput,
} from './observeWalletReadiness'
import {
  WalletReadinessObservation,
} from './walletReadinessObservation'

type RunJson = (
  command: string[],
) => Promise<unknown>

export type BlakeEconomicContextReadiness = {
  blockchain: BlakeBlockchainInfoResult
  wallet: WalletReadinessObservation
}

export async function requireBlakeEconomicContextReadiness(
  effects: Parameters<typeof requireBlakeEconomicReadiness>[0],
  runJson: RunJson,
  walletInput: WalletObserverInput,
): Promise<BlakeEconomicContextReadiness> {
  const blockchain =
    await requireBlakeEconomicReadiness(effects)

  const wallet =
    await requireObservedWalletEconomicReadiness(
      runJson,
      'blake',
      walletInput,
    )

  return {
    blockchain,
    wallet,
  }
}
