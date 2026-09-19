import { BtcBlockchainInfoResult } from './btcBlockchainInfo'
import { requireBtcEconomicReadiness } from './requireBtcEconomicReadiness'
import { requireObservedWalletEconomicReadiness } from './requireObservedWalletEconomicReadiness'
import { WalletObserverInput } from './observeWalletReadiness'
import { WalletReadinessObservation } from './walletReadinessObservation'

type RunJson = (command: string[]) => Promise<unknown>

export type BtcEconomicContextReadiness = {
  blockchain: BtcBlockchainInfoResult
  wallet: WalletReadinessObservation
}

export async function requireBtcEconomicContextReadiness(
  effects: Parameters<typeof requireBtcEconomicReadiness>[0],
  runJson: RunJson,
  walletInput: WalletObserverInput,
): Promise<BtcEconomicContextReadiness> {
  // Chain truth must be economically usable before we consider
  // permitting any BTC wallet operation.
  const blockchain = await requireBtcEconomicReadiness(effects)

  const wallet = await requireObservedWalletEconomicReadiness(
    runJson,
    'btc',
    walletInput,
  )

  return {
    blockchain,
    wallet,
  }
}
