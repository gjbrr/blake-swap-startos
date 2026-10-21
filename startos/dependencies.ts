import { sdk } from './sdk'
import { nodeProviders } from './file-models/nodeProviders'
import { planNodeDependencies } from './lib/nodeDependencyPlan'

export const setDependencies = sdk.setupDependencies(async ({ effects }) => {
  const saved = await nodeProviders.read().const(effects)

  /*
   * Preserve the package's historical defaults when no explicit
   * provider selection has been saved yet:
   *
   *   BTC   -> remote RPC
   *   BLAKE -> local StartOS bitcoind
   */
  const selection = saved ?? {
    btc: 'remote-rpc' as const,
    blake: 'local-knots-blake2b' as const,
  }

  const required = planNodeDependencies(selection)

  const dependencies: {
    bitcoind?: {
      kind: 'exists'
      versionRange: string
    }
    'knots-blake2b'?: {
      kind: 'exists'
      versionRange: string
    }
  } = {}

  if (required.includes('bitcoind')) {
    dependencies.bitcoind = {
      kind: 'exists',
      versionRange: '>=0.0.0',
    }
  }

  if (required.includes('knots-blake2b')) {
    dependencies['knots-blake2b'] = {
      kind: 'exists',
      versionRange: '>=0.0.0',
    }
  }

  return dependencies
})
