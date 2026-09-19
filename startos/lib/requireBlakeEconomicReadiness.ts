import {
  BlakeBlockchainInfoResult,
  getBlakeBlockchainInfo,
} from './blakeBlockchainInfo'
import { isBlakeEconomicallyReady } from './blakeReadiness'

export class BlakeNotEconomicallyReadyError extends Error {
  constructor(readonly info: BlakeBlockchainInfoResult) {
    super('BLAKE provider is not economically ready')
  }
}

export async function requireBlakeEconomicReadiness(
  effects: Parameters<typeof getBlakeBlockchainInfo>[0],
): Promise<BlakeBlockchainInfoResult> {
  const info = await getBlakeBlockchainInfo(effects)

  if (!isBlakeEconomicallyReady(info)) {
    throw new BlakeNotEconomicallyReadyError(info)
  }

  return info
}
