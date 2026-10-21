import { sdk } from '../sdk'
import { resolveSwapRpcContext } from '../lib/resolveSwapRpcContext'

const { InputSpec, Value } = sdk
import { i18n } from '../i18n'
import { walletMapping } from '../file-models/walletMapping'
import { getNostrRelayEnv } from '../file-models/nostrRelays'
import { requireBlakeEconomicContextReadiness } from '../lib/requireBlakeEconomicContextReadiness'
import { requireBtcEconomicContextReadiness } from '../lib/requireBtcEconomicContextReadiness'
import { withSwapEconomicContext } from '../lib/withSwapEconomicContext'
import { requireProtocolRole } from '../lib/requireProtocolRole'

const inputSpec = InputSpec.of({
  swapId: Value.text({
    name: i18n('Swap ID'),
    description: i18n(
      'Exact 12-character swap ID of the BLAKE trade you intend to fund.',
    ),
    required: true,
    default: null,
    placeholder: '2876be80e78b',
    masked: false,
  }),
})

export const fundBlake = sdk.Action.withInput(
  'fund-blake',

  async () => ({
    name: i18n('Fund BLAKE'),
    description: i18n(
      'Explicitly fund one BLAKE swap selected by its exact swap ID.',
    ),
    warning: i18n(
      'This action can move BLAKE funds. It will refuse unless both chain and wallet economic contexts are ready.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  inputSpec,

  async () => null,

  async ({ effects, input }) => {
    const swapId = input.swapId.trim().toLowerCase()

    if (!/^[0-9a-f]{12}$/.test(swapId)) {
      throw new Error(
        i18n('Swap ID must be exactly 12 hexadecimal characters.'),
      )
    }

    const savedMapping = await walletMapping.read().const(effects)

    const blakeWallet = savedMapping?.blakeWallet.trim() ?? ''

    const btcWallet = savedMapping?.btcWallet.trim() ?? ''

    if (!blakeWallet || !btcWallet) {
      throw new Error(
        i18n('Both BLAKE and BTC wallets must be explicitly configured.'),
      )
    }

    const rpc = await resolveSwapRpcContext(effects)

    const outcome = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      rpc.mounts,
      'fund-blake',
      async (sub) => {
        async function runJson(command: string[]): Promise<unknown> {
          const result = await sub.exec(command)

          if (result.exitCode !== 0) {
            throw new Error(
              result.stderr.toString().trim() || 'wallet RPC failed',
            )
          }

          return JSON.parse(result.stdout.toString()) as unknown
        }

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
            const engineEnv = [
              '/usr/bin/env',
              'PYTHONPATH=/opt/blake-swap/src',
              'BLAKE_SWAP_ROLE=alice',
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
              ...rpc.engineEnv,
              `BLAKE_SWAP_BLAKE_WALLET=${blakeWallet}`,
              `BLAKE_SWAP_BTC_WALLET=${btcWallet}`,
              'python3',
              '/opt/blake-swap/src/swap_v2.py',
            ]

            const reconcileResult = await sub.exec([
              ...engineEnv,
              'reconcile',
              swapId,
              '--json',
            ])

            if (reconcileResult.exitCode !== 0) {
              throw new Error(
                reconcileResult.stderr.toString().trim() ||
                  'Swap reconciliation failed.',
              )
            }

            const report = JSON.parse(reconcileResult.stdout.toString()) as {
              protocol_role?: string
            }

            requireProtocolRole(
              report.protocol_role,
              'alice',
              'fund BLAKE',
            )

            const acceptResult = await sub.exec([
              ...engineEnv,
              'receive-accept',
              swapId,
            ])

            if (acceptResult.exitCode !== 0) {
              throw new Error(
                acceptResult.stderr.toString().trim() ||
                  'Authenticated Bob acceptance import failed.',
              )
            }

            const result = await sub.exec([...engineEnv, 'fund-blake', swapId])

            const stdout = result.stdout.toString().trim()

            const stderr = result.stderr.toString().trim()

            if (result.exitCode !== 0) {
              throw new Error(stderr || i18n('BLAKE funding command failed.'))
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
      message: i18n('Explicit BLAKE funding operation completed.'),
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
