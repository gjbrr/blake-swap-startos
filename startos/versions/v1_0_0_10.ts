import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const previous10 = VersionInfo.of({
  version: '1.0.0:10',
  releaseNotes: {
    en_US: 'Avoid unnecessary historical BLAKE spender scans during refund recovery.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
