import {
  BtcEconomicContextReadiness,
  requireBtcEconomicContextReadiness,
} from './requireBtcEconomicContextReadiness'
import {
  BlakeEconomicContextReadiness,
  requireBlakeEconomicContextReadiness,
} from './requireBlakeEconomicContextReadiness'
import { WalletObserverInput } from './observeWalletReadiness'
import { withRequiredEconomicContext } from './withRequiredEconomicContext'

type RunJson = (command: string[]) => Promise<unknown>

export async function withBtcEconomicContext<Result>(
  effects: Parameters<typeof requireBtcEconomicContextReadiness>[0],
  runJson: RunJson,
  walletInput: WalletObserverInput,
  execute: (context: BtcEconomicContextReadiness) => Promise<Result>,
): Promise<Result> {
  return withRequiredEconomicContext(
    () => requireBtcEconomicContextReadiness(effects, runJson, walletInput),
    execute,
  )
}

export async function withBlakeEconomicContext<Result>(
  effects: Parameters<typeof requireBlakeEconomicContextReadiness>[0],
  runJson: RunJson,
  walletInput: WalletObserverInput,
  execute: (context: BlakeEconomicContextReadiness) => Promise<Result>,
): Promise<Result> {
  return withRequiredEconomicContext(
    () => requireBlakeEconomicContextReadiness(effects, runJson, walletInput),
    execute,
  )
}
