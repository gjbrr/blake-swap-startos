import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const previous11 = VersionInfo.of({
  version: '1.0.0:11',
  releaseNotes: {
    en_US: 'Add configurable, checkpointed BTC funding scan diagnostic.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
