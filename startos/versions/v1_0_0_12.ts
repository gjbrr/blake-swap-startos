import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const previous12 = VersionInfo.of({
  version: '1.0.0:12',
  releaseNotes: {
    en_US: 'Add direct BLAKE refund action using the existing validated engine and safety checks.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
