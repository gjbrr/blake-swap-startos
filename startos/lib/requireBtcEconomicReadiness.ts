import {
  BtcBlockchainInfoResult,
  getBtcBlockchainInfo,
} from './btcBlockchainInfo'
import { isBtcEconomicallyReady } from './btcReadiness'

export class BtcNotEconomicallyReadyError extends Error {
  constructor(readonly info: BtcBlockchainInfoResult) {
    super('BTC provider is not economically ready')
  }
}

export async function requireBtcEconomicReadiness(
  effects: Parameters<typeof getBtcBlockchainInfo>[0],
): Promise<BtcBlockchainInfoResult> {
  const info = await getBtcBlockchainInfo(effects)

  if (!isBtcEconomicallyReady(info)) {
    throw new BtcNotEconomicallyReadyError(info)
  }

  return info
}
