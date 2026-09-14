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
  'Check Bitcoin RPC': 19,
  'Check read-only connectivity to the Bitcoin service using getblockchaininfo.': 20,
  'Bitcoin RPC is unavailable.': 21,
  'Bitcoin RPC check failed.': 22,
  'Bitcoin RPC': 23,
  'Bitcoin RPC check completed successfully.': 24,
  'Chain': 25,
  'Blocks': 26,
  'Headers': 27,
  'Verification Progress': 28,
} as const

/**
 * Plumbing. DO NOT EDIT.
 */
export type I18nKey = keyof typeof dict
export type LangDict = Record<(typeof dict)[I18nKey], string>
export default dict
