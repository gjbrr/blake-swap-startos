import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.0.0:13',
  releaseNotes: {
    en_US: 'Add direct settlement synchronization from confirmed blockchain spends.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
