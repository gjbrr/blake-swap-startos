import { sdk } from '../sdk'
import { resolveNodeConnections } from './resolveNodeConnections'
import type { NodeConnection } from './nodeConnectionPlan'

type Effects = Parameters<typeof sdk.SubContainer.withTemp>[0]
type Chain = 'btc' | 'blake'

async function resolveChain(
  effects: Effects,
  chain: Chain,
  connection: NodeConnection,
): Promise<{
  env: string[]
  local: Extract<NodeConnection, { mode: 'local' }> | null
}> {
  const prefix = chain === 'btc'
    ? 'BLAKE_SWAP_BTC'
    : 'BLAKE_SWAP_BLAKE'

  if (connection.mode === 'remote') {
    return {
      env: [
        `${prefix}_PROVIDER_CONFIG=/data/config/${chain}-provider.json`,
      ],
      local: null,
    }
  }

  if (!connection.cookieRelativePath) {
    throw new Error(`${chain.toUpperCase()} RPC credentials unavailable`)
  }

  const address = await sdk.host.getBridgeAddress(effects, {
    packageId: connection.packageId,
    hostId: connection.hostId,
    internalPort: connection.internalPort,
    ssl: false,
  }).once()

  if (!address) {
    throw new Error(`${chain.toUpperCase()} RPC unavailable`)
  }

  return {
    env: [
      `${prefix}_RPC_URL=http://${address}/`,
      `${prefix}_COOKIE_PATH=${connection.dependencyMountpoint}/${connection.cookieRelativePath}`,
    ],
    local: connection,
  }
}

export async function resolveSwapRpcContext(effects: Effects) {
  const connections = await resolveNodeConnections(effects)

  const btc = await resolveChain(effects, 'btc', connections.btc)
  const blake = await resolveChain(effects, 'blake', connections.blake)

  let mounts = sdk.Mounts.of().mountVolume({
    volumeId: 'main',
    subpath: null,
    mountpoint: '/data',
    readonly: false,
  })

  const mounted = new Set<string>()

  for (const connection of [btc.local, blake.local]) {
    if (!connection || mounted.has(connection.packageId)) {
      continue
    }

    mounts = mounts.mountDependency({
      dependencyId: connection.packageId,
      volumeId: 'main',
      subpath: null,
      mountpoint: connection.dependencyMountpoint,
      readonly: true,
    })

    mounted.add(connection.packageId)
  }

  return {
    mounts,
    btcEnv: btc.env,
    blakeEnv: blake.env,
    engineEnv: [...blake.env, ...btc.env],
  }
}
