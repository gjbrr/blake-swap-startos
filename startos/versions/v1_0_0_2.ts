import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const previous2 = VersionInfo.of({
  version: '1.0.0:2',
  releaseNotes: {
    en_US: 'Fix local Bitcoin RPC and provider-aware wallet readiness.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
