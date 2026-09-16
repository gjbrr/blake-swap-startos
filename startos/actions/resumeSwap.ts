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

const { InputSpec, Value } = sdk

const BLAKE_PROVIDER_PACKAGE_ID = 'bitcoind'
const BLAKE_PROVIDER_RPC_HOST_ID = 'rpc'
const BLAKE_PROVIDER_RPC_INTERNAL_PORT = 8332

const inputSpec = InputSpec.of({
  swapId: Value.text({
    name: i18n('Swap ID / Prefix'),
    description: i18n(
      'Optional local swap ID or unique hexadecimal prefix of at least 4 characters. Leave blank only when exactly one live resumable swap exists.',
    ),
    required: false,
    default: null,
    placeholder: '9b9c7536c4c8',
    masked: false,
  }),
})

function lastNonemptyLine(value: string): string | null {
  const lines = value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  return lines.length > 0
    ? lines[lines.length - 1]
    : null
}

function findSwapId(stdout: string): string | null {
  const match = stdout.match(
    /^swap(?: id)?:\s*([0-9a-f]{12})\s*$/im,
  )

  return match?.[1] ?? null
}

function summarizeResult(stdout: string): string {
  const swapId = findSwapId(stdout)

  if (stdout.includes('SWAP ALREADY SETTLED')) {
    return swapId
      ? `swap=${swapId}\nstate=COMPLETE`
      : 'already settled'
  }

  if (stdout.includes('SWAP ALREADY REFUNDED')) {
    return swapId
      ? `swap=${swapId}\nstate=BLAKE_REFUNDED`
      : 'already refunded'
  }

  if (
    stdout.includes(
      'RUN RESULT: waiting for counterparty or chain condition',
    )
  ) {
    return swapId
      ? `swap=${swapId}\nstate=waiting`
      : 'waiting'
  }

  if (
    stdout.includes(
      'RUN RESULT: settled; no action required',
    )
  ) {
    return swapId
      ? `swap=${swapId}\nstate=settled`
      : 'settled'
  }

  if (
    stdout.includes(
      'RUN RESULT: manual attention required',
    )
  ) {
    return swapId
      ? `swap=${swapId}\nstate=manual-attention`
      : 'manual attention required'
  }

  return swapId
    ? `swap=${swapId}\nresume pass completed`
    : 'resume pass completed'
}

export const resumeSwap = sdk.Action.withInput(
  'resume-swap',

  async () => ({
    name: i18n('Resume Swap'),
    description: i18n(
      'Continue settlement or recovery for one existing atomic swap.',
    ),
    warning: i18n(
      'This action can fund Bitcoin, claim, refund, or otherwise advance post-funding settlement. Initial BLAKE funding remains disabled and requires the separate Fund BLAKE action.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  inputSpec,

  async () => null,

  async ({ effects, input }) => {
    const requested =
      input.swapId?.trim().toLowerCase() ?? ''

    if (
      requested !== '' &&
      !/^[0-9a-f]{4,12}$/.test(requested)
    ) {
      throw new Error(
        i18n(
          'Swap ID prefix must contain 4 to 12 hexadecimal characters.',
        ),
      )
    }

    const savedMapping =
      await walletMapping.read().const(effects)

    const blakeWallet =
      savedMapping?.blakeWallet.trim() ?? ''

    const btcWallet =
      savedMapping?.btcWallet.trim() ?? ''

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

    return sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      mounts,
      'resume-swap',
      async sub => {
        async function runJson(
          command: string[],
        ): Promise<unknown> {
          const result = await sub.exec(command)

          if (result.exitCode !== 0) {
            throw new Error(
              lastNonemptyLine(
                result.stderr.toString(),
              ) ?? 'wallet RPC failed',
            )
          }

          return JSON.parse(
            result.stdout.toString(),
          ) as unknown
        }

        /*
         * Resume can execute post-funding economic actions.
         * Require both synchronized chains and both usable
         * signing-capable configured wallets before entering
         * the autonomous settlement/recovery engine.
         */
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
            const command = [
              '/usr/bin/env',

              'PYTHONPATH=/opt/blake-swap/src',

              'BLAKE_SWAP_STATE_DIR=/data/swaps',
              'BLAKE_SWAP_MESSAGE_DIR=/data/messages',
              'BLAKE_SWAP_NOSTR_KEY_DIR=/data/nostr',
              'BLAKE_SWAP_PARTICIPANT_KEY_FILE=/data/participant.key',

              'BLAKE_SWAP_NOSTR_RELAYS=wss://TheForest.nostr1.com,wss://nos.lol',

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

              'python3',
              '/opt/blake-swap/src/swap_v2.py',
              'resume',
            ]

            if (requested !== '') {
              command.push(requested)
            }

            const result = await sub.exec(command)

            const stdout =
              result.stdout.toString().trim()

            const stderr =
              result.stderr.toString().trim()

            if (result.exitCode !== 0) {
              throw new Error(
                lastNonemptyLine(stderr) ??
                  i18n('Swap resume failed.'),
              )
            }

            if (
              stdout.includes(
                'MULTIPLE ACTIVE SWAPS',
              )
            ) {
              return {
                version: '1',
                title: i18n(
                  'Multiple Active Swaps',
                ),
                message: i18n(
                  'More than one swap has a live automatic path. Enter a swap ID prefix to choose explicitly.',
                ),
                result: {
                  type: 'single',
                  name: i18n('Result'),
                  description: null,
                  value: stdout,
                  masked: false,
                  copyable: true,
                  qr: false,
                },
              }
            }

            if (
              stdout.includes(
                'NO RESUMABLE SWAPS',
              )
            ) {
              return {
                version: '1',
                title: i18n(
                  'No Resumable Swaps',
                ),
                message: i18n(
                  'No swap currently has an automatic recovery, settlement, or waiting path.',
                ),
                result: {
                  type: 'single',
                  name: i18n('Result'),
                  description: null,
                  value: 'no resumable swaps',
                  masked: false,
                  copyable: false,
                  qr: false,
                },
              }
            }

            if (
              stdout.includes(
                'MANUAL ATTENTION REQUIRED',
              )
            ) {
              return {
                version: '1',
                title: i18n(
                  'Manual Attention Required',
                ),
                message: i18n(
                  'The selected swap requires manual attention and was not handed to the autonomous runner.',
                ),
                result: {
                  type: 'single',
                  name: i18n('Result'),
                  description: null,
                  value: stdout,
                  masked: false,
                  copyable: true,
                  qr: false,
                },
              }
            }

            return {
              version: '1',
              title: i18n('Swap Resume'),
              message: i18n(
                'The settlement or recovery pass completed. Initial BLAKE funding was not performed.',
              ),
              result: {
                type: 'single',
                name: i18n('Result'),
                description: null,
                value:
                  summarizeResult(stdout),
                masked: false,
                copyable: true,
                qr: false,
              },
            }
          },
        )
      },
    )
  },
)
