import { sdk } from '../sdk'
import { readSwapSnapshot } from '../lib/swapSnapshot'
import type { SwapSnapshot } from '../lib/swapSnapshot'

function formatSwap(swap: SwapSnapshot): string {
  const lines = [
    `Swap: ${swap.swap_id}`,
    `Saved checkpoint: ${swap.state}`,
    `Trade: ${swap.blake_amount ?? '?'} XBT / ${swap.btc_sats ?? '?'} sats`,
  ]

  const labels: Record<string, string> = {
    blake_funding_txid: 'XBT funding',
    btc_funding_txid: 'BTC funding',
    btc_claim_txid: 'BTC claim',
    blake_claim_txid: 'XBT claim',
    btc_refund_txid: 'BTC refund',
    blake_refund_txid: 'XBT refund',
  }

  for (const [field, label] of Object.entries(labels)) {
    const txid = swap.transactions[field]
    if (txid) {
      lines.push(`${label}: ${txid}`)
    }
  }

  return lines.join('\n')
}

export const swapStatus = sdk.Action.withoutInput(
  'swap-status',

  async () => ({
    name: 'Swap Status',
    description:
      'Read saved swap checkpoints without blockchain or network queries.',
    warning:
      'Saved state only. Not live verified. Do not use this display alone to decide whether to fund, claim, or refund.',
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  async ({ effects }) => {
    const snapshot = await readSwapSnapshot(effects)
    const swaps = snapshot.swaps

    return {
      version: '1',
      title: 'Saved Swap Checkpoints',
      message:
        `${swaps.length} saved swap checkpoint(s). ` +
        'NOT LIVE VERIFIED — use reconciliation before economic decisions.',
      result: {
        type: 'group',
        value: [
          {
            type: 'single',
            name: 'Saved Swaps — Unverified',
            description:
              'Checkpoint states and transaction IDs are local records, not live blockchain observations.',
            value: swaps.length
              ? swaps.map(formatSwap).join('\n\n')
              : 'No saved swap records found.',
            masked: false,
            copyable: true,
            qr: false,
          },
          {
            type: 'single',
            name: 'Record Warnings',
            description: 'Canonical swap records that could not be read.',
            value: snapshot.warnings.length
              ? snapshot.warnings.join('\n')
              : 'No unreadable canonical swap records detected.',
            masked: false,
            copyable: true,
            qr: false,
          },
          {
            type: 'single',
            name: 'Safety Notice',
            description: null,
            value:
              'Chain verification: NOT PERFORMED. ' +
              'HTLC solvability: NOT CHECKED. ' +
              'Do not fund, claim, or refund based solely on this snapshot.',
            masked: false,
            copyable: false,
            qr: false,
          },
        ],
      },
    }
  },
)
