export const DEFAULT_LANG = 'en_US'

const dict = {
  // main.ts
  'Starting BLAKE Swap!': 0,
  'Web Interface': 1,
  'The web interface is ready': 2,
  'The web interface is not ready': 3,

  // actions/verifyEngine.ts
  'Verify Engine': 4,
  'Verify that the packaged BLAKE Swap engine can be imported successfully.': 5,
  'BLAKE Swap Engine': 6,
  'Engine verification completed successfully.': 7,
  'Result': 8,

  // actions/persistence
  'Create Persistence Marker': 9,
  'Write a harmless test marker to the persistent BLAKE Swap data volume.': 10,
  'Verify Persistence Marker': 11,
  'Confirm that the BLAKE Swap persistence test marker still exists.': 12,
  'BLAKE Swap Storage': 13,
  'Persistence marker written successfully.': 14,
  'Persistence marker verified successfully.': 15,
  'Marker': 16,
  'Persistence marker operation failed.': 17,
  'Persistence marker is missing or invalid.': 18,

  // actions/checkBitcoinRpc.ts
  'Check BLAKE RPC': 19,
  'Check read-only connectivity to the BLAKE/RDTS service using getblockchaininfo.': 20,
  'BLAKE RPC is unavailable.': 21,
  'BLAKE RPC check failed.': 22,
  'BLAKE RPC': 23,
  'BLAKE RPC check completed successfully.': 24,
  'Chain': 25,
  'Blocks': 26,
  'Headers': 27,
  'Verification Progress': 28,
  'BTC RPC URL': 29,
  'HTTPS URL for an ordinary Bitcoin RPC endpoint.': 30,
  'BTC RPC Username': 31,
  'RPC username for the ordinary Bitcoin node.': 32,
  'BTC RPC Password': 33,
  'RPC password used only for this connectivity check and not saved by BLAKE Swap.': 34,
  'Check BTC RPC': 35,
  'Check read-only connectivity to an ordinary Bitcoin node using getblockchaininfo.': 36,
  'BTC RPC URL must use HTTPS.': 37,
  'BTC RPC check failed.': 38,
  'BTC RPC': 39,
  'BTC RPC check completed successfully.': 40,
} as const

/**
 * Plumbing. DO NOT EDIT.
 */
export type I18nKey = keyof typeof dict
export type LangDict = Record<(typeof dict)[I18nKey], string>
export default dict
