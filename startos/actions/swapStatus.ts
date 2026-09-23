import { sdk } from '../sdk'
import { walletMapping } from '../file-models/walletMapping'
import { getNostrRelayEnv } from '../file-models/nostrRelays'

const BLAKE_PROVIDER_PACKAGE_ID = 'bitcoind'
const BLAKE_PROVIDER_RPC_HOST_ID = 'rpc'
const BLAKE_PROVIDER_RPC_INTERNAL_PORT = 8332

type DashboardSwap = {
  swap_id?: unknown
  state?: unknown
  protocol_role?: unknown
  decision_class?: unknown
  next_action?: unknown
  reason?: unknown
  status?: unknown
  action?: unknown
  trade?: {
    blake_amount?: unknown
    btc_sats?: unknown
  }
  chains?: {
    blake_status?: unknown
    btc_status?: unknown
  }
  transactions?: {
    blake_funding_txid?: unknown
    btc_funding_txid?: unknown
    btc_claim_txid?: unknown
    blake_claim_txid?: unknown
    btc_refund_txid?: unknown
    blake_refund_txid?: unknown
  }
}

type ArchivedSwap = {
  swap_id?: unknown
  state?: unknown
  blake_amount?: unknown
  btc_sats?: unknown
}

type Dashboard = {
  version: number
  active: DashboardSwap[]
  attention: DashboardSwap[]
  settled: DashboardSwap[]
  archived: ArchivedSwap[]
  summary: {
    active: number
    attention: number
    settled: number
    archived: number
  }
}

function parseDashboard(raw: string): Dashboard {
  const parsed = JSON.parse(raw) as unknown

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('active' in parsed) ||
    !Array.isArray((parsed as { active?: unknown }).active) ||
    !('attention' in parsed) ||
    !Array.isArray((parsed as { attention?: unknown }).attention) ||
    !('settled' in parsed) ||
    !Array.isArray((parsed as { settled?: unknown }).settled) ||
    !('archived' in parsed) ||
    !Array.isArray((parsed as { archived?: unknown }).archived)
  ) {
    throw new Error('Swap dashboard returned an invalid JSON structure.')
  }

  return parsed as Dashboard
}

function text(value: unknown, fallback = '-'): string {
  return typeof value === 'string' && value !== '' ? value : fallback
}

function numberText(value: unknown): string {
  return typeof value === 'number' ? value.toLocaleString('en-US') : '?'
}

function formatTransactions(item: DashboardSwap): string[] {
  const tx = item.transactions ?? {}

  const entries: Array<[string, unknown]> = [
    ['XBT funding', tx.blake_funding_txid],
    ['BTC funding', tx.btc_funding_txid],
    ['BTC claim', tx.btc_claim_txid],
    ['XBT claim', tx.blake_claim_txid],
    ['BTC refund', tx.btc_refund_txid],
    ['XBT refund', tx.blake_refund_txid],
  ]

  return entries
    .filter(([, txid]) => typeof txid === 'string' && txid !== '')
    .map(([label, txid]) => `${label}: ${String(txid)}`)
}

function formatNext(item: DashboardSwap): string {
  switch (item.action) {
    case 'run resume':
      return 'automatic settlement/recovery available'
    case 'run fund':
      return 'explicit XBT funding required'
    case 'wait':
      return 'waiting for counterparty or chain condition'
    case 'inspect':
      return 'manual attention required'
    case '-':
      return 'none'
    default:
      return 'review swap details'
  }
}

function formatSwap(
  item: DashboardSwap,
  includeReason = false,
): string {
  const trade = item.trade ?? {}
  const chains = item.chains ?? {}

  const lines = [
    `Swap ${text(item.swap_id)}`,
    `Status: ${text(item.status, text(item.state))}`,
    `Trade: ${numberText(trade.blake_amount)} XBT / ${numberText(
      trade.btc_sats,
    )} sats`,
    '',
    `XBT HTLC: ${text(chains.blake_status)}`,
    `BTC HTLC: ${text(chains.btc_status)}`,
    `Next: ${formatNext(item)}`,
  ]

  if (
    includeReason &&
    typeof item.reason === 'string' &&
    item.reason !== ''
  ) {
    lines.push(`Reason: ${item.reason}`)
  }

  const transactions = formatTransactions(item)

  if (transactions.length > 0) {
    lines.push('', 'Transactions', ...transactions)
  }

  return lines.join('\n')
}

function formatSwapList(
  items: DashboardSwap[],
  empty: string,
  includeReason = false,
): string {
  return items.length === 0
    ? empty
    : items
        .map((item) => formatSwap(item, includeReason))
        .join('\n\n')
}

function formatArchived(items: ArchivedSwap[]): string {
  if (items.length === 0) {
    return 'No archived swaps.'
  }

  return items
    .map((item) => {
      const swapId = text(item.swap_id)
      const state = text(item.state)
      const xbt = numberText(item.blake_amount)
      const sats = numberText(item.btc_sats)

      return `${swapId} | ${state} | ${xbt} XBT / ${sats} sats`
    })
    .join('\n')
}

export const swapStatus = sdk.Action.withoutInput(
  'swap-status',

  async () => ({
    name: 'Swap Status',
    description:
      'Show reconciled swap progress, pending work, and settlement transaction IDs.',
    warning:
      'Read-only status action. It does not fund, claim, refund, publish, or otherwise advance a swap.',
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  async ({ effects }) => {
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
      throw new Error('XBT RPC is unavailable.')
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

    const dashboard = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      mounts,
      'swap-status',
      async (sub) => {
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
            'dashboard',
            '--json',
          ],
          undefined,
          120_000,
        )

        const stdout = result.stdout.toString().trim()
        const stderr = result.stderr.toString().trim()

        if (result.exitCode !== 0) {
          throw new Error(stderr || stdout || 'Swap status failed.')
        }

        return parseDashboard(stdout)
      },
    )

    return {
      version: '1',
      title: 'Swap Status',
      message: `Active ${dashboard.active.length} | Attention ${dashboard.attention.length} | Settled ${dashboard.settled.length}`,
      result: {
        type: 'group',
        value: [
          {
            type: 'single',
            name: 'Active Swaps',
            description: null,
            value: formatSwapList(dashboard.active, 'No active swaps.'),
            masked: false,
            copyable: true,
            qr: false,
          },
          {
            type: 'single',
            name: 'Needs Attention',
            description: null,
            value: formatSwapList(
              dashboard.attention,
              'No swaps need manual attention.',
              true,
            ),
            masked: false,
            copyable: true,
            qr: false,
          },
          {
            type: 'single',
            name: 'Settled',
            description: null,
            value: formatSwapList(dashboard.settled, 'No settled swaps.'),
            masked: false,
            copyable: true,
            qr: false,
          },
          {
            type: 'single',
            name: 'Archived',
            description: null,
            value: formatArchived(dashboard.archived),
            masked: false,
            copyable: true,
            qr: false,
          },
        ],
      },
    }
  },
)
