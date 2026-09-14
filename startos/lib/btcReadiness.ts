export type BtcBlockchainInfo = {
  chain: unknown
  initialblockdownload: unknown
}

export function isBtcEconomicallyReady(
  info: BtcBlockchainInfo,
): boolean {
  return (
    info.chain === 'main' &&
    info.initialblockdownload === false
  )
}
