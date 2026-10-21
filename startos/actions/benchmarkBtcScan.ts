import { sdk } from '../sdk'
import { resolveSwapRpcContext } from '../lib/resolveSwapRpcContext'

export const benchmarkBtcScan = sdk.Action.withoutInput(
  'benchmark-btc-scan',

  async () => ({
    name: 'Benchmark BTC Funding Scan',
    description:
      'Read-only performance test of historical Bitcoin funding discovery over 20 blocks.',
    warning:
      'Diagnostic only. Does not modify swaps, fund transactions, claim, refund, or broadcast.',
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  async ({ effects }) => {
    const rpc = await resolveSwapRpcContext(effects)

    const script = `
import sys
import time
from decimal import Decimal

sys.path.insert(0, "/opt/blake-swap/src")

from swap_v2 import (
    load_swap,
    get_btc_contract_descriptor,
    derive_btc_contract_address,
    btc_cli,
)

swap_id = "2876be80e78b"
start = 967582
end = 967601

swap = load_swap(swap_id, role="alice")

address = derive_btc_contract_address(
    get_btc_contract_descriptor(swap)
)

amount = format(
    Decimal(swap.btc_sats) / Decimal(100_000_000),
    "f",
)

print("BTC FUNDING SCAN BENCHMARK", flush=True)
print("==========================", flush=True)
print("Swap:", swap_id, flush=True)
print("Blocks:", start, "through", end, flush=True)
print("Block count:", end - start + 1, flush=True)
print("Method: batched scan-funding-range", flush=True)

started = time.monotonic()

try:
    matches = btc_cli(
        "scan-funding-range",
        start,
        end,
        address,
        amount,
    )

    elapsed = time.monotonic() - started

    if not isinstance(matches, list):
        raise RuntimeError("Scanner returned a non-list response")

    print("Elapsed seconds:", round(elapsed, 3), flush=True)
    print("Matching outputs:", len(matches), flush=True)
    print("Blocks per second:", round(20 / elapsed, 2), flush=True)
    print("PASS: Diagnostic completed", flush=True)

except Exception as exc:
    elapsed = time.monotonic() - started
    print("Elapsed seconds:", round(elapsed, 3), flush=True)
    print("ERROR:", type(exc).__name__, str(exc), flush=True)
    raise
`

    const report = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      rpc.mounts,
      'benchmark-btc-scan',
      async (sub) => {
        const result = await sub.exec(
          [
            '/usr/bin/env',

            'PYTHONPATH=/opt/blake-swap/src',
            'BLAKE_SWAP_STATE_DIR=/data/swaps',
            'BLAKE_SWAP_BTC_CLI=/opt/blake-swap/adapters/btc-rpc-cli',
            'BLAKE_SWAP_BTC_DATADIR=',

            ...rpc.btcEnv,

            'python3',
            '-u',
            '-c',
            script,
          ],
          undefined,
          75_000,
        )

        const stdout = result.stdout.toString().trim()
        const stderr = result.stderr.toString().trim()

        if (result.exitCode !== 0) {
          throw new Error(
            [stdout, stderr].filter(Boolean).join('\n') ||
              'BTC scan benchmark failed.',
          )
        }

        return stdout
      },
    )

    return {
      version: '1',
      title: 'BTC Funding Scan Benchmark',
      message: 'Read-only historical scan benchmark completed.',
      result: {
        type: 'single',
        name: 'Benchmark Results',
        description: null,
        value: report,
        masked: false,
        copyable: true,
        qr: false,
      },
    }
  },
)
