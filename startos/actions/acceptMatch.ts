import { sdk } from '../sdk'
import { resolveSwapRpcContext } from '../lib/resolveSwapRpcContext'
import { i18n } from '../i18n'
import { getNostrRelayEnv } from '../file-models/nostrRelays'
import { walletMapping } from '../file-models/walletMapping'
import { requireBlakeEconomicContextReadiness } from '../lib/requireBlakeEconomicContextReadiness'
import { requireBtcEconomicContextReadiness } from '../lib/requireBtcEconomicContextReadiness'
import { withSwapEconomicContext } from '../lib/withSwapEconomicContext'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  matchId: Value.text({
    name: i18n('Match ID / Prefix'),
    description: i18n(
      'Optional market match event ID or unique hexadecimal prefix of at least 8 characters. Leave blank only when exactly one pending match exists.',
    ),
    required: false,
    default: null,
    placeholder: 'efce5294b50f',
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

function matchResultValue(stdout: string): string {
  const match = stdout.match(/^match(?: id)?:\s*([0-9a-f]{64})\s*$/im)

  const swap = stdout.match(/^swap(?: id)?:\s*([0-9a-f]{12})\s*$/im)

  const values: string[] = []

  if (match) {
    values.push(`match=${match[1]}`)
  }

  if (swap) {
    values.push(`swap=${swap[1]}`)
  }

  return values.join('\n') || 'accepted'
}

function pendingMatchesValue(stdout: string): string {
  const values = [
    ...stdout.matchAll(
      /^\d+\.\s+match=([0-9a-f]+)\s+swap=([0-9a-f]+|-)\s*$/gim,
    ),
  ].map((item) => `match=${item[1]} swap=${item[2]}`)

  return values.join('\n') || 'multiple pending matches'
}

export const acceptMatch = sdk.Action.withInput(
  'accept-match',

  async () => ({
    name: i18n('Accept Match'),
    description: i18n(
      'Import a pending authenticated market match and bind it to local atomic-swap state.',
    ),
    warning: i18n(
      'This requires both chains and both configured wallets to be economically ready. Accepting a match does not itself move funds.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  inputSpec,

  async () => null,

  async ({ effects, input }) => {
    const requested = input.matchId?.trim().toLowerCase() ?? ''

    if (requested !== '' && !/^[0-9a-f]{8,64}$/.test(requested)) {
      throw new Error(
        i18n('Match ID prefix must contain 8 to 64 hexadecimal characters.'),
      )
    }

    const savedMapping = await walletMapping.read().const(effects)

    const blakeWallet = savedMapping?.blakeWallet.trim() ?? ''

    const btcWallet = savedMapping?.btcWallet.trim() ?? ''

    const rpc = await resolveSwapRpcContext(effects)

    return sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      rpc.mounts,
      'accept-match',
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

        /*
         * This gate runs BEFORE the engine command.
         *
         * Accept Match needs trustworthy live heights on both
         * chains and usable signing-capable settlement wallets,
         * even though accepting the match itself does not spend.
         */
        return withSwapEconomicContext(
          () =>
            requireBlakeEconomicContextReadiness(effects, runJson, {
              cli: '/opt/blake-swap/adapters/blake-rpc-cli',
              wallet: blakeWallet,
              env: rpc.blakeEnv,
            }),

          () =>
            requireBtcEconomicContextReadiness(effects, runJson, {
              cli: '/opt/blake-swap/adapters/btc-rpc-cli',
              wallet: btcWallet,
              env: rpc.btcEnv,
            }),

          async () => {
            const command = [
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

              ...rpc.blakeEnv,

              ...rpc.btcEnv,

              `BLAKE_SWAP_BLAKE_WALLET=${blakeWallet}`,
              `BLAKE_SWAP_BTC_WALLET=${btcWallet}`,

              'python3',
              '/opt/blake-swap/src/swap_v2.py',
              'accept-match',
            ]

            if (requested !== '') {
              command.push(requested)
            }

            const result = await sub.exec(command)

            const stdout = result.stdout.toString().trim()

            const stderr = result.stderr.toString().trim()

            if (result.exitCode !== 0) {
              throw new Error(
                lastNonemptyLine(stderr) ?? i18n('Match acceptance failed.'),
              )
            }

            if (stdout.includes('NO PENDING MATCH')) {
              return {
                version: '1',
                title: i18n('No Pending Match'),
                message: i18n(
                  'No unimported valid market match was found for this participant.',
                ),
                result: {
                  type: 'single',
                  name: i18n('Result'),
                  description: null,
                  value: 'no pending match',
                  masked: false,
                  copyable: false,
                  qr: false,
                },
              }
            }

            if (stdout.includes('MULTIPLE PENDING MATCHES')) {
              return {
                version: '1',
                title: i18n('Multiple Pending Matches'),
                message: i18n(
                  'More than one valid pending match exists. Enter a match ID prefix to choose explicitly.',
                ),
                result: {
                  type: 'single',
                  name: i18n('Result'),
                  description: null,
                  value: pendingMatchesValue(stdout),
                  masked: false,
                  copyable: true,
                  qr: false,
                },
              }
            }

            const imported =
              stdout.includes('MARKET MATCH IMPORTED') ||
              stdout.includes('REVERSE MARKET MATCH IMPORTED') ||
              stdout.includes('MARKET MATCH ALREADY IMPORTED') ||
              stdout.includes('REVERSE MARKET MATCH ALREADY IMPORTED')

            if (!imported) {
              throw new Error(i18n('Match acceptance failed.'))
            }

            return {
              version: '1',
              title: i18n('Market Match Accepted'),
              message: i18n(
                'The authenticated market match was imported successfully. No funds moved.',
              ),
              result: {
                type: 'single',
                name: i18n('Result'),
                description: null,
                value: matchResultValue(stdout),
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
