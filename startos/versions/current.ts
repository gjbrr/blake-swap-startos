import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.0.0:9',
  releaseNotes: {
    en_US: 'Add confirmed funding recovery action for interrupted swaps.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
