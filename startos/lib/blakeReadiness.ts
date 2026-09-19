export type BlakeBlockchainInfo = {
  chain: unknown
  initialblockdownload: unknown
}

export function isBlakeEconomicallyReady(info: BlakeBlockchainInfo): boolean {
  return info.chain === 'main' && info.initialblockdownload === false
}
