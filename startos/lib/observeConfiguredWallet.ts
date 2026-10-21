import { sdk } from '../sdk'
import { nodeProviders } from '../file-models/nodeProviders'
import { planNodeConnections } from './nodeConnectionPlan'
import { observeWalletReadiness } from './observeWalletReadiness'
import type { WalletReadinessObservation } from './walletReadinessObservation'

type Chain = 'btc' | 'blake'

function defaultSelection() {
  return {
    btc: 'remote-rpc' as const,
    blake: 'local-knots-blake2b' as const,
  }
}

export async function observeConfiguredWallet(
  effects: Parameters<typeof sdk.SubContainer.withTemp>[0],
  chain: Chain,
  wallet: string,
): Promise<WalletReadinessObservation> {
  const saved = await nodeProviders.read().const(effects)

  const connections = planNodeConnections(saved ?? defaultSelection())

  const connection = connections[chain]

  let mounts
  let env: string[]

  if (connection.mode === 'remote') {
    mounts = sdk.Mounts.of().mountVolume({
      volumeId: 'main',
      subpath: null,
      mountpoint: '/data',
      readonly: true,
    })

    env =
      chain === 'btc'
        ? ['BLAKE_SWAP_BTC_PROVIDER_CONFIG=/data/config/btc-provider.json']
        : ['BLAKE_SWAP_BLAKE_PROVIDER_CONFIG=/data/config/blake-provider.json']
  } else {
    const rpcAddr = await sdk.host
      .getBridgeAddress(effects, {
        packageId: connection.packageId,
        hostId: connection.hostId,
        internalPort: connection.internalPort,
        ssl: false,
      })
      .once()

    if (!rpcAddr) {
      throw new Error(`${chain.toUpperCase()} RPC is unavailable`)
    }

    if (!connection.cookieRelativePath) {
      throw new Error(`${chain.toUpperCase()} RPC credentials are unavailable`)
    }

    mounts = sdk.Mounts.of().mountDependency({
      dependencyId: connection.packageId,
      volumeId: 'main',
      subpath: null,
      mountpoint: connection.dependencyMountpoint,
      readonly: true,
    })

    const cookiePath = `${connection.dependencyMountpoint}/${connection.cookieRelativePath}`

    env =
      chain === 'btc'
        ? [
            `BLAKE_SWAP_BTC_RPC_URL=http://${rpcAddr}/`,
            `BLAKE_SWAP_BTC_COOKIE_PATH=${cookiePath}`,
          ]
        : [
            `BLAKE_SWAP_BLAKE_RPC_URL=http://${rpcAddr}/`,
            `BLAKE_SWAP_BLAKE_COOKIE_PATH=${cookiePath}`,
          ]
  }

  const cli =
    chain === 'btc'
      ? '/opt/blake-swap/adapters/btc-rpc-cli'
      : '/opt/blake-swap/adapters/blake-rpc-cli'

  return sdk.SubContainer.withTemp(
    effects,
    { imageId: 'blake-swap' },
    mounts,
    `${chain}-wallet-readiness`,
    async (sub) => {
      async function runJson(command: string[]): Promise<unknown> {
        const result = await sub.exec(command)

        if (result.exitCode !== 0) {
          throw new Error(
            result.stderr.toString().trim() || `${chain} wallet RPC failed`,
          )
        }

        return JSON.parse(result.stdout.toString()) as unknown
      }

      return observeWalletReadiness(runJson, {
        cli,
        wallet,
        env,
      })
    },
  )
}
