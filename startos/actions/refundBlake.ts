import { sdk } from '../sdk'
import { resolveSwapRpcContext } from '../lib/resolveSwapRpcContext'
import { walletMapping } from '../file-models/walletMapping'
import { getNostrRelayEnv } from '../file-models/nostrRelays'
import { getBtcFeePolicyEnv } from '../file-models/btcFeePolicy'
import { requireBlakeEconomicContextReadiness } from '../lib/requireBlakeEconomicContextReadiness'
import { requireBtcEconomicContextReadiness } from '../lib/requireBtcEconomicContextReadiness'
import { withSwapEconomicContext } from '../lib/withSwapEconomicContext'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  swapId: Value.text({
    name: 'Exact Swap ID',
    description: 'Enter the full 12-character hexadecimal swap ID.',
    required: true,
    default: null,
    placeholder: 'a7e0cfd40bda',
    masked: false,
  }),
})

export const refundBlake = sdk.Action.withInput(
  'refund-blake',

  async () => ({
    name: 'Refund BLAKE',
    description:
      'Run the existing BLAKE refund engine directly, without autonomous reconciliation.',
    warning:
      'MAINNET TRANSACTION: This action can sign and broadcast a BLAKE refund. The engine independently verifies Bitcoin funding absence, the BLAKE HTLC, and refund maturity. A timeout does NOT prove that no transaction was broadcast.',
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
        'Swap ID must contain exactly 12 hexadecimal characters.',
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
      'refund-blake',
      async (sub) => {
        async function runJson(command: string[]): Promise<unknown> {
          const result = await sub.exec(command)

          if (result.exitCode !== 0) {
            throw new Error(
              result.stderr.toString().trim() ||
              'Wallet RPC readiness check failed.',
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

              'BLAKE_SWAP_BTC_BATCH_SCAN=1',
              ...(await getBtcFeePolicyEnv(effects)),

              `BLAKE_SWAP_BLAKE_WALLET=${blakeWallet}`,
              `BLAKE_SWAP_BTC_WALLET=${btcWallet}`,

              'python3',
              '/opt/blake-swap/src/swap_v2.py',
              'refund-blake',
              swapId,
            ]

            const started = Date.now()
            const result = await sub.exec(command, undefined, 120_000)
            const elapsed = ((Date.now() - started) / 1000).toFixed(1)

            const stdout = result.stdout.toString().trim()
            const stderr = result.stderr.toString().trim()

            if (result.exitCode !== 0) {
              throw new Error(
                `BLAKE refund did not finish normally (${elapsed}s).\n` +
                `A transaction MAY have been broadcast. Verify swap state ` +
                `and the BLAKE chain before retrying.\n\n` +
                `STDOUT:\n${stdout || '(empty)'}\n\n` +
                `STDERR:\n${stderr || '(empty)'}`,
              )
            }

            return {
              version: '1',
              title: 'BLAKE Refund Result',
              message:
                'Refund command completed. Inspect the result for broadcast or confirmation status.',
              result: {
                type: 'single',
                name: 'Refund Engine Output',
                description: null,
                value: stdout || 'Refund command returned no output.',
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
