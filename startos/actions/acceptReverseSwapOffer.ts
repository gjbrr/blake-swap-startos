import { sdk } from '../sdk'
import { i18n } from '../i18n'
import { getNostrRelayEnv } from '../file-models/nostrRelays'
import { walletMapping } from '../file-models/walletMapping'
import { requireBlakeEconomicContextReadiness } from '../lib/requireBlakeEconomicContextReadiness'
import { requireBtcEconomicContextReadiness } from '../lib/requireBtcEconomicContextReadiness'
import { withSwapEconomicContext } from '../lib/withSwapEconomicContext'

const { InputSpec, Value } = sdk

const BLAKE_PROVIDER_PACKAGE_ID = 'bitcoind'
const BLAKE_PROVIDER_RPC_HOST_ID = 'rpc'
const BLAKE_PROVIDER_RPC_INTERNAL_PORT = 8332

const inputSpec = InputSpec.of({
  matchId: Value.text({
    name: 'Market Match ID',
    description:
      'Full 64-character reverse-direction market match ID. Use this when this participant created a BTC-for-BLAKE offer and is protocol Bob.',
    required: true,
    default: null,
    placeholder:
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    masked: false,
  }),
})

function lastNonemptyLine(value: string): string | null {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.length > 0 ? lines[lines.length - 1] : null
}

function resultValue(stdout: string): string {
  const swap = stdout.match(/^swap(?: id)?:\s*([0-9a-f]{12})\s*$/im)

  const lines: string[] = []

  if (swap) {
    lines.push(`swap=${swap[1]}`)
  }

  if (stdout.includes('REVERSE BOB HANDSHAKE RECOVERED')) {
    lines.push('state=handshake-recovered')
  } else if (stdout.includes('REVERSE SWAP OFFER ALREADY IMPORTED')) {
    lines.push('state=already-imported')
  } else {
    lines.push('state=imported')
  }

  return lines.join('\n')
}

export const acceptReverseSwapOffer = sdk.Action.withInput(
  'accept-reverse-swap-offer',

  async () => ({
    name: 'Accept Reverse Swap Offer',
    description:
      'Import protocol Alice’s signed swap offer after a BTC-for-BLAKE market match.',
    warning:
      'This creates or recovers protocol Bob’s local swap state and settlement keys. It does not fund either chain or move funds.',
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  inputSpec,

  async () => null,

  async ({ effects, input }) => {
    const matchId = input.matchId.trim().toLowerCase()

    if (!/^[0-9a-f]{64}$/.test(matchId)) {
      throw new Error(
        'Market match ID must be exactly 64 hexadecimal characters.',
      )
    }

    const savedMapping = await walletMapping.read().const(effects)

    const blakeWallet = savedMapping?.blakeWallet.trim() ?? ''
    const btcWallet = savedMapping?.btcWallet.trim() ?? ''

    const blakeRpcAddr = await sdk.host
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
      'accept-reverse-swap-offer',
      async (sub) => {
        async function runJson(command: string[]): Promise<unknown> {
          const result = await sub.exec(command)

          if (result.exitCode !== 0) {
            throw new Error(
              lastNonemptyLine(result.stderr.toString()) ?? 'wallet RPC failed',
            )
          }

          return JSON.parse(result.stdout.toString()) as unknown
        }

        return withSwapEconomicContext(
          () =>
            requireBlakeEconomicContextReadiness(effects, runJson, {
              cli: '/opt/blake-swap/adapters/blake-rpc-cli',
              wallet: blakeWallet,
              env: [
                `BLAKE_SWAP_BLAKE_RPC_URL=http://${blakeRpcAddr}/`,
                'BLAKE_SWAP_BLAKE_COOKIE_PATH=/mnt/bitcoind/.cookie',
              ],
            }),

          () =>
            requireBtcEconomicContextReadiness(effects, runJson, {
              cli: '/opt/blake-swap/adapters/btc-rpc-cli',
              wallet: btcWallet,
              env: [
                'BLAKE_SWAP_BTC_PROVIDER_CONFIG=/data/config/btc-provider.json',
              ],
            }),

          async () => {
            const result = await sub.exec(
              [
                '/usr/bin/env',

                'PYTHONPATH=/opt/blake-swap/src',

                'BLAKE_SWAP_STATE_DIR=/data/swaps',
                'BLAKE_SWAP_MESSAGE_DIR=/data/messages',
                'BLAKE_SWAP_NOSTR_KEY_DIR=/data/nostr',
                'BLAKE_SWAP_PARTICIPANT_KEY_FILE=/data/participant.key',
                'BLAKE_SWAP_TRANSPORT=nostr',

                await getNostrRelayEnv(effects),

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
                'accept-reverse-swap-offer',
                matchId,
              ],
              undefined,
              120_000,
            )

            const stdout = result.stdout.toString().trim()
            const stderr = result.stderr.toString().trim()

            if (result.exitCode !== 0) {
              throw new Error(
                stderr ||
                  stdout ||
                  'Reverse swap offer import failed.',
              )
            }

            const accepted =
              stdout.includes('REVERSE SWAP OFFER') ||
              stdout.includes('REVERSE BOB HANDSHAKE RECOVERED')

            if (!accepted) {
              throw new Error(
                'Reverse swap offer command completed without confirming import.',
              )
            }

            return {
              version: '1',
              title: 'Reverse Swap Offer Accepted',
              message:
                'Protocol Bob imported the authenticated reverse-direction swap offer. No funds moved.',
              result: {
                type: 'single',
                name: i18n('Result'),
                description: null,
                value: resultValue(stdout),
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
