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
  offerId: Value.text({
    name: i18n('Offer ID / Prefix'),
    description: i18n(
      'Normal path: enter your market offer ID or unique hexadecimal prefix of at least 8 characters. If exactly one valid take exists, it will be selected automatically.',
    ),
    required: false,
    default: null,
    placeholder: '0123456789ab',
    masked: false,
  }),

  takeId: Value.text({
    name: i18n('Exact Take ID (Recovery / Advanced)'),
    description: i18n(
      'Optional full 64-character take ID. Use this to retry or recover an already-selected negotiation directly.',
    ),
    required: false,
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

function extractMatchId(stdout: string): string | null {
  const match = stdout.match(
    /^(?:market match|match id):\s*([0-9a-f]{64})\s*$/im,
  )

  return match?.[1] ?? null
}

function extractSwapId(stdout: string): string | null {
  const match = stdout.match(/^(?:atomic swap|swap id):\s*([0-9a-f]{12})\s*$/im)

  return match?.[1] ?? null
}

export const acceptTake = sdk.Action.withInput(
  'accept-take',

  async () => ({
    name: i18n('Accept Market Take'),
    description: i18n(
      'Accept an authenticated signed take for one of your market offers and create the atomic-swap negotiation.',
    ),
    warning: i18n(
      'This selects a counterparty, creates durable swap state, and publishes authenticated coordination messages. It does not fund an HTLC or move BLAKE or Bitcoin.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  inputSpec,

  async () => null,

  async ({ effects, input }) => {
    const requestedOffer = input.offerId?.trim().toLowerCase() ?? ''
    const requestedTake = input.takeId?.trim().toLowerCase() ?? ''

    if (requestedOffer === '' && requestedTake === '') {
      throw new Error(
        i18n('Enter an Offer ID / Prefix or an exact Take ID.'),
      )
    }

    if (requestedOffer !== '' && !/^[0-9a-f]{8,64}$/.test(requestedOffer)) {
      throw new Error(
        i18n('Offer ID prefix must contain 8 to 64 hexadecimal characters.'),
      )
    }

    if (requestedTake !== '' && !/^[0-9a-f]{64}$/.test(requestedTake)) {
      throw new Error(
        i18n('Exact Take ID must be exactly 64 hexadecimal characters.'),
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
      'accept-take',
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
            const engineEnv = [
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
            ]

            let takeId = requestedTake

            if (takeId === '') {
              const discoveryResult = await sub.exec([
                ...engineEnv,
                'market-takes',
                requestedOffer,
                '--json',
                '--limit',
                '200',
              ])

              const discoveryStdout = discoveryResult.stdout.toString().trim()
              const discoveryStderr = discoveryResult.stderr.toString().trim()

              if (discoveryResult.exitCode !== 0) {
                throw new Error(
                  lastNonemptyLine(discoveryStderr) ??
                    i18n('Market take discovery failed.'),
                )
              }

              let discovered: unknown

              try {
                discovered = JSON.parse(discoveryStdout) as unknown
              } catch {
                throw new Error(
                  i18n('Market take discovery returned invalid JSON.'),
                )
              }

              if (
                typeof discovered !== 'object' ||
                discovered === null ||
                !('takes' in discovered) ||
                !Array.isArray(
                  (discovered as { takes?: unknown }).takes,
                )
              ) {
                throw new Error(
                  i18n('Market take discovery did not return a takes array.'),
                )
              }

              const takes = (
                discovered as {
                  takes: Array<{ event_id?: unknown; taker?: unknown }>
                }
              ).takes

              if (takes.length === 0) {
                return {
                  version: '1',
                  title: i18n('No Valid Takes'),
                  message: i18n(
                    'No valid signed take currently exists for this offer.',
                  ),
                  result: {
                    type: 'single',
                    name: i18n('Result'),
                    description: null,
                    value: 'no valid takes',
                    masked: false,
                    copyable: false,
                    qr: false,
                  },
                }
              }

              if (takes.length > 1) {
                const candidates = takes
                  .map((item) => {
                    const eventId =
                      typeof item.event_id === 'string'
                        ? item.event_id
                        : '<invalid-id>'

                    const taker =
                      typeof item.taker === 'string'
                        ? item.taker
                        : '<unknown>'

                    return `take=${eventId} taker=${taker}`
                  })
                  .join('\n')

                return {
                  version: '1',
                  title: i18n('Multiple Valid Takes'),
                  message: i18n(
                    'More than one valid counterparty take exists. No take was selected automatically. Re-run this action with the exact Take ID you want.',
                  ),
                  result: {
                    type: 'single',
                    name: i18n('Candidates'),
                    description: null,
                    value: candidates,
                    masked: false,
                    copyable: true,
                    qr: false,
                  },
                }
              }

              const onlyTake = takes[0]?.event_id

              if (
                typeof onlyTake !== 'string' ||
                !/^[0-9a-f]{64}$/.test(onlyTake)
              ) {
                throw new Error(
                  i18n(
                    'Market take discovery returned an invalid take ID.',
                  ),
                )
              }

              takeId = onlyTake
            }

            const acceptResult = await sub.exec([
              ...engineEnv,
              'accept-market-take',
              takeId,
            ])

            const acceptStdout = acceptResult.stdout.toString().trim()

            const acceptStderr = acceptResult.stderr.toString().trim()

            if (acceptResult.exitCode !== 0) {
              throw new Error(
                lastNonemptyLine(acceptStderr) ??
                  i18n('Market take acceptance failed.'),
              )
            }

            let matchId = extractMatchId(acceptStdout)

            let swapId = extractSwapId(acceptStdout)

            /*
             * Fresh acceptance normally publishes the
             * market match itself.
             *
             * If the engine reports that this take was
             * already accepted, inspect the durable
             * selection record.  Reuse an already-recorded
             * match rather than publishing a duplicate.
             */
            if (
              !matchId &&
              acceptStdout.includes('MARKET TAKE ALREADY ACCEPTED')
            ) {
              const inspectResult = await sub.exec([
                'python3',
                '-c',
                [
                  'import json,sys',
                  'p="/data/swaps/market-selections/"+sys.argv[1]+".json"',
                  'd=json.load(open(p))',
                  'print(d.get("swap_id",""))',
                  'print(d.get("market_match_id",""))',
                ].join(';'),
                takeId,
              ])

              if (inspectResult.exitCode !== 0) {
                throw new Error(
                  i18n('Existing market selection could not be inspected.'),
                )
              }

              const lines = inspectResult.stdout
                .toString()
                .split('\n')
                .map((line) => line.trim())

              if (!swapId && /^[0-9a-f]{12}$/.test(lines[0] ?? '')) {
                swapId = lines[0]
              }

              if (/^[0-9a-f]{64}$/.test(lines[1] ?? '')) {
                matchId = lines[1]
              }
            }

            /*
             * A crash may have happened after durable
             * take selection but before market-match
             * publication.  Only in that recovery case
             * publish the missing match now.
             */
            if (!matchId) {
              const publishResult = await sub.exec([
                ...engineEnv,
                'publish-market-match',
                takeId,
              ])

              const publishStdout = publishResult.stdout.toString().trim()

              const publishStderr = publishResult.stderr.toString().trim()

              if (publishResult.exitCode !== 0) {
                throw new Error(
                  lastNonemptyLine(publishStderr) ??
                    i18n('Market match publication failed.'),
                )
              }

              matchId = extractMatchId(publishStdout)

              swapId = swapId ?? extractSwapId(publishStdout)
            }

            if (!matchId) {
              throw new Error(
                i18n('Take was accepted but no market match ID was returned.'),
              )
            }

            if (!swapId) {
              throw new Error(
                i18n('Take was accepted but no atomic swap ID was returned.'),
              )
            }

            return {
              version: '1',
              title: i18n('Market Take Accepted'),
              message: i18n(
                'The signed take was accepted and the authenticated market match is available. No funds moved.',
              ),
              result: {
                type: 'group',
                value: [
                  {
                    type: 'single',
                    name: i18n('Take ID'),
                    description: null,
                    value: takeId,
                    masked: false,
                    copyable: true,
                    qr: false,
                  },
                  {
                    type: 'single',
                    name: i18n('Match ID'),
                    description: null,
                    value: matchId,
                    masked: false,
                    copyable: true,
                    qr: false,
                  },
                  {
                    type: 'single',
                    name: i18n('Swap ID'),
                    description: null,
                    value: swapId,
                    masked: false,
                    copyable: true,
                    qr: false,
                  },
                ],
              },
            }
          },
        )
      },
    )
  },
)
