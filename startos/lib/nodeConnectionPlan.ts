import type {
  NodeProviders,
} from '../file-models/nodeProviders'

import {
  planNodeProviders,
} from './nodeProviderPlan'

import {
  LOCAL_NODE_ENDPOINTS,
} from './localNodeEndpoints'

export type LocalConnection = {
  mode: 'local'
  packageId: 'bitcoind' | 'knots-blake2b'
  hostId: 'rpc'
  internalPort: number
  dependencyMountpoint: string
  cookieRelativePath: string | null
}

export type RemoteConnection = {
  mode: 'remote'
}

export type NodeConnection =
  | LocalConnection
  | RemoteConnection

export type NodeConnectionPlan = {
  btc: NodeConnection
  blake: NodeConnection
}

export function planNodeConnections(
  selection: NodeProviders,
): NodeConnectionPlan {
  const providers = planNodeProviders(selection)

  function resolve(
    provider: typeof providers.btc,
  ): NodeConnection {
    if (provider.mode === 'remote') {
      return {
        mode: 'remote',
      }
    }

    const endpoint =
      LOCAL_NODE_ENDPOINTS[provider.packageId]

    return {
      mode: 'local',
      packageId: endpoint.packageId,
      hostId: endpoint.hostId,
      internalPort: endpoint.internalPort,
      dependencyMountpoint:
        endpoint.dependencyMountpoint,
      cookieRelativePath:
        endpoint.cookieRelativePath,
    }
  }

  return {
    btc: resolve(providers.btc),
    blake: resolve(providers.blake),
  }
}
