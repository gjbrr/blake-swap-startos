import { sdk } from '../sdk'
import { i18n } from '../i18n'
import { walletMapping } from '../file-models/walletMapping'
import {
  requireBlakeEconomicContextReadiness,
} from '../lib/requireBlakeEconomicContextReadiness'
import {
  requireBtcEconomicContextReadiness,
} from '../lib/requireBtcEconomicContextReadiness'
import {
  withSwapEconomicContext,
} from '../lib/withSwapEconomicContext'

const BLAKE_PROVIDER_PACKAGE_ID = 'bitcoind'
const BLAKE_PROVIDER_RPC_HOST_ID = 'rpc'
const BLAKE_PROVIDER_RPC_INTERNAL_PORT = 8332

export const fundBlake = sdk.Action.withoutInput(
  'fund-blake',

  async () => ({
    name: i18n('Fund BLAKE'),
    description: i18n(
      'Explicitly fund the only unambiguous funding-ready BLAKE swap.',
    ),
    warning: i18n(
      'This action can move BLAKE funds. It will refuse unless both chain and wallet economic contexts are ready.',
    ),
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

    if (!blakeWallet || !btcWallet) {
      throw new Error(
        i18n(
          'Both BLAKE and BTC wallets must be explicitly configured.',
        ),
      )
    }

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
        readonly: false,
      })
      .mountDependency({
        dependencyId: BLAKE_PROVIDER_PACKAGE_ID,
        volumeId: 'main',
        subpath: null,
        mountpoint: '/mnt/bitcoind',
        readonly: true,
      })

    const outcome = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      mounts,
      'fund-blake',
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

        return withSwapEconomicContext(
          () =>
            requireBlakeEconomicContextReadiness(
              effects,
              runJson,
              {
                cli:
                  '/opt/blake-swap/adapters/blake-rpc-cli',
                wallet: blakeWallet,
                env: [
                  `BLAKE_SWAP_BLAKE_RPC_URL=http://${blakeRpcAddr}/`,
                  'BLAKE_SWAP_BLAKE_COOKIE_PATH=/mnt/bitcoind/.cookie',
                ],
              },
            ),

          () =>
            requireBtcEconomicContextReadiness(
              effects,
              runJson,
              {
                cli:
                  '/opt/blake-swap/adapters/btc-rpc-cli',
                wallet: btcWallet,
                env: [
                  'BLAKE_SWAP_BTC_PROVIDER_CONFIG=/data/config/btc-provider.json',
                ],
              },
            ),

          async () => {
            const result = await sub.exec([
              '/usr/bin/env',
              'PYTHONPATH=/opt/blake-swap/src',
              'BLAKE_SWAP_ROLE=alice',
              'BLAKE_SWAP_STATE_DIR=/data/swaps',
              'BLAKE_SWAP_MESSAGE_DIR=/data/messages',
              'BLAKE_SWAP_NOSTR_KEY_DIR=/data/nostr',
              'BLAKE_SWAP_PARTICIPANT_KEY_FILE=/data/participant.key',
              'BLAKE_SWAP_BLAKE_CLI=/opt/blake-swap/adapters/blake-rpc-cli',
              'BLAKE_SWAP_BTC_CLI=/opt/blake-swap/adapters/btc-rpc-cli',
              'BLAKE_SWAP_BLAKE_DATADIR=',
              'BLAKE_SWAP_BTC_DATADIR=',
              'BLAKE_SWAP_AUTO_MINE=0',
              'BLAKE_SWAP_BLAKE_NETWORK=main',
              `BLAKE_SWAP_BLAKE_RPC_URL=http://${blakeRpcAddr}/`,
              'BLAKE_SWAP_BLAKE_COOKIE_PATH=/mnt/bitcoind/.cookie',
              'BLAKE_SWAP_BTC_PROVIDER_CONFIG=/data/config/btc-provider.json',
              `BLAKE_SWAP_BLAKE_WALLET=${blakeWallet}`,
              `BLAKE_SWAP_BTC_WALLET=${btcWallet}`,
              '/opt/blake-swap/scripts/blake',
              'fund',
            ])

            const stdout =
              result.stdout.toString().trim()

            const stderr =
              result.stderr.toString().trim()

            if (result.exitCode !== 0) {
              throw new Error(
                stderr ||
                  i18n('BLAKE funding command failed.'),
              )
            }

            if (
              stdout.includes(
                'NO FUNDING-READY SWAP',
              )
            ) {
              throw new Error(
                i18n(
                  'No unambiguous funding-ready BLAKE swap is available.',
                ),
              )
            }

            if (
              stdout.includes(
                'MULTIPLE FUNDING-READY SWAPS',
              )
            ) {
              throw new Error(
                i18n(
                  'Multiple BLAKE swaps are funding-ready; refusing to choose which trade receives funds.',
                ),
              )
            }

            return i18n(
              'BLAKE funding command completed. Inspect swap state for broadcast and confirmation progress.',
            )
          },
        )
      },
    )

    return {
      version: '1',
      title: i18n('BLAKE Funding'),
      message: i18n(
        'Explicit BLAKE funding operation completed.',
      ),
      result: {
        type: 'single',
        name: i18n('Result'),
        description: null,
        value: outcome,
        masked: false,
        copyable: false,
        qr: false,
      },
    }
  },
)
