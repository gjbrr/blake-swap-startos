import { sdk } from '../sdk'
import { resolveSwapRpcContext } from '../lib/resolveSwapRpcContext'

export const resumableBtcScan = sdk.Action.withoutInput(
  'resumable-btc-scan',

  async () => ({
    name: 'Continue BTC Funding Scan',
    description:
      'Read-only historical BTC funding search, up to 100 blocks per run.',
    warning:
      'Diagnostic only. Results must not be used alone to authorize funding, claims, or refunds.',
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  async ({ effects }) => {
    const rpc = await resolveSwapRpcContext(effects)

    const resultText = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      rpc.mounts,
      'resumable-btc-scan',
      async (sub) => {
        const result = await sub.exec([
          '/usr/bin/env',
          'PYTHONPATH=/opt/blake-swap/src',
          'BLAKE_SWAP_STATE_DIR=/data/swaps',
          'BLAKE_SWAP_BTC_CLI=/opt/blake-swap/adapters/btc-rpc-cli',
          'BLAKE_SWAP_BTC_DATADIR=',
          ...rpc.btcEnv,
          'python3',
          '-u',
          '/opt/blake-swap/diagnostics/resumable_btc_scan.py',
        ], undefined, 105_000)

        const stdout = result.stdout.toString().trim()
        const stderr = result.stderr.toString().trim()

        if (result.exitCode !== 0) {
          throw new Error(
            [stdout, stderr].filter(Boolean).join('\n') ||
              'Resumable funding scan failed.',
          )
        }

        return stdout
      },
    )

    return {
      version: '1',
      title: 'BTC Funding Scan Progress',
      message: 'Read-only scan batch completed.',
      result: {
        type: 'single',
        name: 'Progress',
        description: null,
        value: resultText,
        masked: false,
        copyable: true,
        qr: false,
      },
    }
  },
)
