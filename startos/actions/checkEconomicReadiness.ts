import { sdk } from '../sdk'
import { i18n } from '../i18n'
import { walletMapping } from '../file-models/walletMapping'
import {
  getBlakeBlockchainInfo,
} from '../lib/blakeBlockchainInfo'
import {
  getBtcBlockchainInfo,
} from '../lib/btcBlockchainInfo'
import {
  isBlakeEconomicallyReady,
} from '../lib/blakeReadiness'
import {
  isBtcEconomicallyReady,
} from '../lib/btcReadiness'
import {
  observeWalletReadiness,
} from '../lib/observeWalletReadiness'
import {
  isObservationEconomicallyReady,
} from '../lib/walletReadinessObservation'

const BLAKE_PROVIDER_PACKAGE_ID = 'bitcoind'
const BLAKE_PROVIDER_RPC_HOST_ID = 'rpc'
const BLAKE_PROVIDER_RPC_INTERNAL_PORT = 8332

export const checkEconomicReadiness = sdk.Action.withoutInput(
  'check-economic-readiness',

  async () => ({
    name: i18n('Check Economic Readiness'),
    description: i18n(
      'Check read-only chain and wallet readiness for both sides before economic use.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  async ({ effects }) => {
    const savedMapping =
      await walletMapping.read().const(effects)

    const blakeWallet =
      savedMapping?.blakeWallet.trim() ?? ''

    const btcWallet =
      savedMapping?.btcWallet.trim() ?? ''

    const blakeBlockchain =
      await getBlakeBlockchainInfo(effects)

    const btcBlockchain =
      await getBtcBlockchainInfo(effects)

    const blakeRpcAddr = await sdk.host
      .getBridgeAddress(effects, {
        packageId: BLAKE_PROVIDER_PACKAGE_ID,
        hostId: BLAKE_PROVIDER_RPC_HOST_ID,
        internalPort: BLAKE_PROVIDER_RPC_INTERNAL_PORT,
        ssl: false,
      })
      .once()

    if (!blakeRpcAddr) {
      throw new Error(
        i18n('BLAKE RPC is unavailable.'),
      )
    }

    const mounts = sdk.Mounts.of()
      .mountVolume({
        volumeId: 'main',
        subpath: null,
        mountpoint: '/data',
        readonly: true,
      })
      .mountDependency({
        dependencyId: BLAKE_PROVIDER_PACKAGE_ID,
        volumeId: 'main',
        subpath: null,
        mountpoint: '/mnt/bitcoind',
        readonly: true,
      })

    const wallets = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      mounts,
      'check-economic-readiness',
      async sub => {
        async function runJson(
          command: string[],
        ): Promise<unknown> {
          const result = await sub.exec(command)

          if (result.exitCode !== 0) {
            throw new Error(
              result.stderr.toString().trim() ||
                'wallet RPC failed',
            )
          }

          return JSON.parse(
            result.stdout.toString(),
          ) as unknown
        }

        const blake = await observeWalletReadiness(
          runJson,
          {
            cli: '/opt/blake-swap/adapters/blake-rpc-cli',
            wallet: blakeWallet,
            env: [
              `BLAKE_SWAP_BLAKE_RPC_URL=http://${blakeRpcAddr}/`,
              'BLAKE_SWAP_BLAKE_COOKIE_PATH=/mnt/bitcoind/.cookie',
            ],
          },
        )

        const btc = await observeWalletReadiness(
          runJson,
          {
            cli: '/opt/blake-swap/adapters/btc-rpc-cli',
            wallet: btcWallet,
            env: [
              'BLAKE_SWAP_BTC_PROVIDER_CONFIG=/data/config/btc-provider.json',
            ],
          },
        )

        return {
          blake,
          btc,
        }
      },
    )

    const blakeChainReady =
      isBlakeEconomicallyReady(blakeBlockchain)

    const btcChainReady =
      isBtcEconomicallyReady(btcBlockchain)

    const blakeWalletReady =
      isObservationEconomicallyReady(wallets.blake)

    const btcWalletReady =
      isObservationEconomicallyReady(wallets.btc)

    const readinessValue = (ready: boolean) =>
      ready ? i18n('Ready') : i18n('Not Ready')

    return {
      version: '1',
      title: i18n('Economic Preflight'),
      message: i18n(
        'Economic readiness check completed successfully.',
      ),
      result: {
        type: 'group',
        value: [
          {
            type: 'single',
            name: i18n('BLAKE Chain Readiness'),
            description: null,
            value: readinessValue(blakeChainReady),
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('BLAKE Wallet Readiness'),
            description: null,
            value: readinessValue(blakeWalletReady),
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('BLAKE Economic Context'),
            description: null,
            value: readinessValue(
              blakeChainReady && blakeWalletReady,
            ),
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('BTC Chain Readiness'),
            description: null,
            value: readinessValue(btcChainReady),
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('BTC Wallet Readiness'),
            description: null,
            value: readinessValue(btcWalletReady),
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('BTC Economic Context'),
            description: null,
            value: readinessValue(
              btcChainReady && btcWalletReady,
            ),
            masked: false,
            copyable: false,
            qr: false,
          },
        ],
      },
    }
  },
)
