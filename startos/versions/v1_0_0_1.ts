import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const previous1 = VersionInfo.of({
  version: '1.0.0:1',
  releaseNotes: {
    en_US: 'Fix local BLAKE Companion RPC credential discovery.',
  },
  migrations: {
    // Existing data and configuration remain unchanged.
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
