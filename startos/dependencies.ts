import { sdk } from './sdk'

export const setDependencies = sdk.setupDependencies(
  async () => ({
    bitcoind: {
      kind: 'running',
      versionRange: '*',
      healthChecks: [],
    },
  }),
)
