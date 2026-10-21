import { sdk } from '../sdk'
import { resolveSwapRpcContext } from '../lib/resolveSwapRpcContext'
import { i18n } from '../i18n'
import { walletMapping } from '../file-models/walletMapping'
import { getNostrRelayEnv } from '../file-models/nostrRelays'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  swapId: Value.text({
    name: i18n('Swap ID'),
    description:
      'Exact 12-character swap ID to inspect with the engine reconciler.',
    required: true,
    default: null,
    placeholder: '25f4295f9d86',
    masked: false,
  }),
})

export const reconcileSwap = sdk.Action.withInput(
  'reconcile-swap',

  async () => ({
    name: 'Reconcile Swap',
    description:
      'Run the engine reconciler and show the full read-only safety report for one swap.',
    warning:
      'Read-only diagnostic action. It does not fund, claim, refund, or publish anything.',
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
      throw new Error('Swap ID must be exactly 12 hexadecimal characters.')
    }

    const savedMapping = await walletMapping.read().const(effects)

    const blakeWallet = savedMapping?.blakeWallet.trim() ?? ''

    const btcWallet = savedMapping?.btcWallet.trim() ?? ''

    const rpc = await resolveSwapRpcContext(effects)

    const outcome = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      rpc.mounts,
      'reconcile-swap',
      async (sub) => {
        // Run the engine underneath a tiny capture wrapper which itself
        // exits successfully. Some StartOS exec paths can discard child
        // stdout/stderr when the directly executed process exits nonzero.
        // Returning structured output lets this action preserve the real
        // engine traceback without changing engine semantics.
        const captureScript = [
          'import json, subprocess, sys',
          'p = subprocess.run(sys.argv[1:], text=True, capture_output=True)',
          'print(json.dumps({"exitCode": p.returncode, "stdout": p.stdout, "stderr": p.stderr}))',
        ].join('; ')

        const result = await sub.exec([
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
          '-c',
          captureScript,

          'python3',
          '/opt/blake-swap/src/swap_v2.py',
          'reconcile',
          swapId,
        ], undefined, 120_000)

        const wrapperStdout = result.stdout.toString().trim()
        const wrapperStderr = result.stderr.toString().trim()

        if (result.exitCode !== 0) {
          throw new Error(
            wrapperStderr ||
              wrapperStdout ||
              'Reconcile diagnostic wrapper failed.',
          )
        }

        let captured: {
          exitCode: number
          stdout: string
          stderr: string
        }

        try {
          captured = JSON.parse(wrapperStdout)
        } catch {
          throw new Error(
            wrapperStdout ||
              wrapperStderr ||
              'Reconcile diagnostic wrapper returned invalid output.',
          )
        }

        const stdout = captured.stdout.trim()
        const stderr = captured.stderr.trim()

        if (captured.exitCode !== 0) {
          throw new Error(
            stderr ||
              stdout ||
              `Swap reconciliation failed with exit code ${captured.exitCode}.`,
          )
        }

        return stdout || 'No reconcile output.'
      },
    )

    return {
      version: '1',
      title: 'Swap Reconciliation',
      message: 'Read-only reconciliation report completed.',
      result: {
        type: 'single',
        name: 'Report',
        description: null,
        value: outcome,
        masked: false,
        copyable: true,
        qr: false,
      },
    }
  },
)
