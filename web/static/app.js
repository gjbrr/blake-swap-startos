const message = document.querySelector('#message')
const swaps = document.querySelector('#swaps')
const refresh = document.querySelector('#refresh')

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function valueOrDash(value) {
  return value === null ||
    value === undefined ||
    value === ''
    ? '—'
    : escapeHtml(value)
}

function contextualAction(item) {
  const action = item.next_action

  if (action === 'fund-blake') {
    return `
      <button disabled
        title="Not enabled in this read-only GUI yet">
        Fund BLAKE
      </button>
    `
  }

  const resumable = new Set([
    'fund-btc',
    'claim-btc',
    'claim-blake',
    'refund-btc',
    'refund-blake',
    'sync-funding',
    'sync-settlement',
    'complete',
  ])

  if (resumable.has(action)) {
    return `
      <button disabled
        title="Not enabled in this read-only GUI yet">
        Continue
      </button>
    `
  }

  if (action === 'wait') {
    return `
      <button disabled>
        Waiting
      </button>
    `
  }

  if (
    item.decision_class === 'manual-attention' ||
    action === 'manual-attention'
  ) {
    return `
      <button disabled>
        Needs Attention
      </button>
    `
  }

  return ''
}

function renderTransactions(item) {
  const tx = item.transactions || {}

  const entries = [
    ['XBT funding', tx.blake_funding_txid],
    ['BTC funding', tx.btc_funding_txid],
    ['BTC claim', tx.btc_claim_txid],
    ['XBT claim', tx.blake_claim_txid],
    ['BTC refund', tx.btc_refund_txid],
    ['XBT refund', tx.blake_refund_txid],
  ].filter(([, id]) => id)

  if (entries.length === 0) {
    return ''
  }

  return `
    <details>
      <summary>Transactions</summary>
      ${entries
        .map(
          ([name, id]) =>
            `<p class="detail"><strong>${escapeHtml(name)}:</strong> ${escapeHtml(id)}</p>`,
        )
        .join('')}
    </details>
  `
}

function renderSwap(item) {
  const trade = item.trade || {}
  const chains = item.chains || {}

  return `
    <article class="swap">
      <div class="swap-heading">
        <h3>Swap ${valueOrDash(item.swap_id)}</h3>
        <div class="swap-action">
          ${contextualAction(item)}
        </div>
      </div>

      <p>
        <strong>Status:</strong>
        ${valueOrDash(item.status)}
      </p>

      <p class="trade">
        ${valueOrDash(trade.blake_amount)} XBT
        ↔
        ${valueOrDash(trade.btc_sats)} sats
      </p>

      <p>
        XBT HTLC:
        <strong>${valueOrDash(chains.blake_status)}</strong>
      </p>

      <p>
        BTC HTLC:
        <strong>${valueOrDash(chains.btc_status)}</strong>
      </p>

      ${item.reason
        ? `<p><strong>Attention:</strong> ${valueOrDash(item.reason)}</p>`
        : ''}

      ${renderTransactions(item)}
    </article>
  `
}

async function loadStatus() {
  refresh.disabled = true
  message.textContent = 'Loading status…'

  try {
    const response = await fetch(
      '/api/status',
      { cache: 'no-store' },
    )

    const data = await response.json()

    if (!response.ok || data.ok !== true) {
      throw new Error(
        data.error || 'Status request failed',
      )
    }

    const dashboard = data.dashboard

    const all = [
      ...(dashboard.active || []),
      ...(dashboard.attention || []),
      ...(dashboard.settled || []),
    ]

    swaps.innerHTML = all.map(renderSwap).join('')

    message.textContent =
      all.length === 0
        ? 'No swaps yet.'
        : `${dashboard.active.length} active · ` +
          `${dashboard.attention.length} attention · ` +
          `${dashboard.settled.length} settled`
  } catch (error) {
    swaps.innerHTML = ''
    message.textContent =
      `Status unavailable: ${error.message}`
  } finally {
    refresh.disabled = false
  }
}

refresh.addEventListener('click', loadStatus)

loadStatus()
