import { BlakeEconomicContextReadiness } from './requireBlakeEconomicContextReadiness'
import { BtcEconomicContextReadiness } from './requireBtcEconomicContextReadiness'
import { withRequiredEconomicContext } from './withRequiredEconomicContext'

export type SwapEconomicContext = {
  blake: BlakeEconomicContextReadiness
  btc: BtcEconomicContextReadiness
}

export async function withSwapEconomicContext<Result>(
  requireBlake: () => Promise<BlakeEconomicContextReadiness>,
  requireBtc: () => Promise<BtcEconomicContextReadiness>,
  execute: (context: SwapEconomicContext) => Promise<Result>,
): Promise<Result> {
  return withRequiredEconomicContext(async () => {
    const blake = await requireBlake()
    const btc = await requireBtc()

    return {
      blake,
      btc,
    }
  }, execute)
}
