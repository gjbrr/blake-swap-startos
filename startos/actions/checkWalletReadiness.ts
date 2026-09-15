import { sdk } from '../sdk'
import { i18n } from '../i18n'
import { walletMapping } from '../file-models/walletMapping'
import { btcProvider } from '../file-models/btcProvider'
import {
  isObservationEconomicallyReady,
  WalletReadinessObservation,
} from '../lib/walletReadinessObservation'
import { observeWalletReadiness } from '../lib/observeWalletReadiness'

const BLAKE_PROVIDER_PACKAGE_ID = 'bitcoind'
const BLAKE_PROVIDER_RPC_HOST_ID = 'rpc'
const BLAKE_PROVIDER_RPC_INTERNAL_PORT = 8332

export const checkWalletReadiness = sdk.Action.withoutInput(
  'check-wallet-readiness',

  async () => ({
    name: i18n('Check Wallet Readiness'),
    description: i18n(
      'Check whether configured chain wallets exist and are loaded without changing wallet state.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  async ({ effects }) => {
    const savedMapping = await walletMapping.read().const(effects)

    const blakeWallet =
      savedMapping?.blakeWallet.trim() ?? ''

    const btcWallet =
      savedMapping?.btcWallet.trim() ?? ''

    let blakeRpcAddr: string | null = null

    if (blakeWallet) {
      blakeRpcAddr = await sdk.host
        .getBridgeAddress(effects, {
          packageId: BLAKE_PROVIDER_PACKAGE_ID,
          hostId: BLAKE_PROVIDER_RPC_HOST_ID,
          internalPort: BLAKE_PROVIDER_RPC_INTERNAL_PORT,
          ssl: false,
        })
        .once()

      if (!blakeRpcAddr) {
        throw new Error(i18n('BLAKE RPC is unavailable.'))
      }
    }

    if (btcWallet) {
      const savedBtcProvider =
        await btcProvider.read().const(effects)

      if (!savedBtcProvider) {
        throw new Error(
          i18n('Configure the BTC provider before checking BTC RPC.'),
        )
      }
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

    const observations = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      mounts,
      'check-wallet-readiness',
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
            env: blakeRpcAddr
              ? [
                  `BLAKE_SWAP_BLAKE_RPC_URL=http://${blakeRpcAddr}/`,
                  'BLAKE_SWAP_BLAKE_COOKIE_PATH=/mnt/bitcoind/.cookie',
                ]
              : [],
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

    function displayCapability(
      value: boolean | null,
    ): string {
      if (value === null) {
        return i18n('Unknown')
      }

      return String(value)
    }

    function fields(
      label: string,
      observation: WalletReadinessObservation,
    ) {
      return [
        {
          type: 'single' as const,
          name: label,
          description: null,
          value: observation.wallet || '-',
          masked: false,
          copyable: false,
          qr: false,
        },
        {
          type: 'single' as const,
          name: `${label} — ${i18n('Configured')}`,
          description: null,
          value: String(observation.configured),
          masked: false,
          copyable: false,
          qr: false,
        },
        {
          type: 'single' as const,
          name: `${label} — ${i18n('Exists')}`,
          description: null,
          value: String(observation.exists),
          masked: false,
          copyable: false,
          qr: false,
        },
        {
          type: 'single' as const,
          name: `${label} — ${i18n('Loaded')}`,
          description: null,
          value: String(observation.loaded),
          masked: false,
          copyable: false,
          qr: false,
        },
        {
          type: 'single' as const,
          name: `${label} — ${i18n('Private Keys Enabled')}`,
          description: null,
          value: displayCapability(
            observation.signing.privateKeysEnabled,
          ),
          masked: false,
          copyable: false,
          qr: false,
        },
        {
          type: 'single' as const,
          name: `${label} — ${i18n('External Signer')}`,
          description: null,
          value: displayCapability(
            observation.signing.externalSigner,
          ),
          masked: false,
          copyable: false,
          qr: false,
        },
        {
          type: 'single' as const,
          name: `${label} — ${i18n('Signing Backend Available')}`,
          description: null,
          value: displayCapability(
            observation.signing.signingBackendAvailable,
          ),
          masked: false,
          copyable: false,
          qr: false,
        },
        {
          type: 'single' as const,
          name: `${label} — ${i18n('Economic Wallet Readiness')}`,
          description: null,
          value: isObservationEconomicallyReady(observation)
            ? i18n('Ready')
            : i18n('Not Ready'),
          masked: false,
          copyable: false,
          qr: false,
        },
      ]
    }

    return {
      version: '1',
      title: i18n('Wallet Readiness'),
      message: i18n(
        'Wallet readiness check completed successfully.',
      ),
      result: {
        type: 'group',
        value: [
          ...fields(
            i18n('BLAKE Wallet'),
            observations.blake,
          ),
          ...fields(
            i18n('Bitcoin Wallet'),
            observations.btc,
          ),
        ],
      },
    }
  },
)
