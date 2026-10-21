import { sdk } from '../sdk'

type Effects = Parameters<typeof sdk.SubContainer.withTemp>[0]

export type SwapSnapshot = {
  swap_id: string
  state: string
  blake_amount: string | number | null
  btc_sats: number | null
  transactions: Record<string, string | null>
}

export type SwapSnapshotResult = {
  swaps: SwapSnapshot[]
  warnings: string[]
}

export async function readSwapSnapshot(
  effects: Effects,
): Promise<SwapSnapshotResult> {
  const mounts = sdk.Mounts.of().mountVolume({
    volumeId: 'main',
    subpath: null,
    mountpoint: '/data',
    readonly: true,
  })

  return sdk.SubContainer.withTemp(
    effects,
    { imageId: 'blake-swap' },
    mounts,
    'swap-snapshot',
    async (sub) => {
      const python = `
import json
from pathlib import Path

root = Path("/data/swaps")
records = []
warnings = []

tx_fields = (
    "blake_funding_txid",
    "btc_funding_txid",
    "btc_claim_txid",
    "blake_claim_txid",
    "btc_refund_txid",
    "blake_refund_txid",
)


def display_blake_amount(data):
    from decimal import Decimal

    units = data.get("blake_amount_base_units")

    if isinstance(units, int) and not isinstance(units, bool):
        amount = Decimal(units) / Decimal(100_000_000)
        return format(amount, "f")

    legacy = data.get("blake_amount")
    if isinstance(legacy, (int, float)) and not isinstance(legacy, bool):
        return legacy

    return None

if not root.is_dir():
    warnings.append("Swap state directory is missing")
else:
    for path in sorted(root.glob("*.json")):
        if len(path.stem) != 12 or any(
            c not in "0123456789abcdef" for c in path.stem
        ):
            continue

        try:
            data = json.loads(path.read_text())

            if not isinstance(data, dict):
                raise ValueError("record is not a JSON object")

            swap_id = data.get("swap_id")
            if swap_id != path.stem:
                raise ValueError("swap ID does not match filename")

            state = data.get("state")
            if not isinstance(state, str) or not state:
                raise ValueError("missing or invalid checkpoint state")

            records.append({
                "swap_id": swap_id,
                "state": state,
                "blake_amount": display_blake_amount(data),
                "btc_sats": data.get("btc_sats")
                    if isinstance(data.get("btc_sats"), int)
                    else None,
                "transactions": {
                    field: data.get(field)
                    if isinstance(data.get(field), str)
                    else None
                    for field in tx_fields
                },
            })
        except (OSError, ValueError, TypeError) as e:
            warnings.append(f"{path.name}: {type(e).__name__}: {e}")

print(json.dumps({"swaps": records, "warnings": warnings}))
`

      const result = await sub.exec(['python3', '-c', python])

      if (result.exitCode !== 0) {
        throw new Error(
          result.stderr.toString().trim() ||
            'Unable to read saved swap checkpoints.',
        )
      }

      const parsed: unknown = JSON.parse(result.stdout.toString())

      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('swaps' in parsed) ||
        !Array.isArray(parsed.swaps) ||
        !('warnings' in parsed) ||
        !Array.isArray(parsed.warnings)
      ) {
        throw new Error('Invalid swap snapshot response.')
      }

      return parsed as SwapSnapshotResult
    },
  )
}
