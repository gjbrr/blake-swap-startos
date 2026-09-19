import { sdk } from '../sdk'
import { i18n } from '../i18n'
import { getNostrRelayEnv } from '../file-models/nostrRelays'

type MarketOffer = {
  blake_amount?: unknown
  btc_sats?: unknown
  direction?: unknown
  event_id?: unknown
  expires_at?: unknown
  maker?: unknown
  state?: unknown
}

type MarketState = {
  offers: MarketOffer[]
}

function parseMarketState(raw: string): MarketState {
  const parsed = JSON.parse(raw) as unknown

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('offers' in parsed) ||
    !Array.isArray((parsed as { offers?: unknown }).offers)
  ) {
    throw new Error('Market state did not contain an offers array')
  }

  return parsed as MarketState
}

function formatOpenOffer(offer: MarketOffer): string {
  const eventId =
    typeof offer.event_id === 'string' ? offer.event_id : '<invalid-id>'

  const blake =
    typeof offer.blake_amount === 'number' ? offer.blake_amount : '?'

  const sats =
    typeof offer.btc_sats === 'number'
      ? offer.btc_sats.toLocaleString('en-US')
      : '?'

  const expires =
    typeof offer.expires_at === 'number'
      ? new Date(offer.expires_at * 1000).toISOString()
      : 'unknown'

  let trade: string

  if (offer.direction === 'blake-for-btc') {
    trade = `give ${blake} BLAKE → want ${sats} sats`
  } else if (offer.direction === 'btc-for-blake') {
    trade = `give ${sats} sats → want ${blake} BLAKE`
  } else {
    trade = `unknown direction: ${String(offer.direction)}`
  }

  return [eventId.slice(0, 12), trade, `expires ${expires}`].join(' | ')
}

export const viewMarket = sdk.Action.withoutInput(
  'view-market',

  async () => ({
    name: i18n('View Market'),
    description: i18n('Read canonical BLAKE/BTC market state from Nostr.'),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  async ({ effects }) => {
    /*
     * Economically read-only, but writable because the
     * engine durably caches authenticated Nostr evidence.
     */
    const mounts = sdk.Mounts.of().mountVolume({
      volumeId: 'main',
      subpath: null,
      mountpoint: '/data',
      readonly: false,
    })

    const market = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      mounts,
      'view-market',
      async (sub) => {
        const result = await sub.exec([
          '/usr/bin/env',
          'PYTHONPATH=/opt/blake-swap/src',
          'BLAKE_SWAP_STATE_DIR=/data/swaps',
          'BLAKE_SWAP_MESSAGE_DIR=/data/messages',
          'BLAKE_SWAP_NOSTR_KEY_DIR=/data/nostr',
          'BLAKE_SWAP_PARTICIPANT_KEY_FILE=/data/participant.key',
          await getNostrRelayEnv(effects),
          'python3',
          '/opt/blake-swap/src/swap_v2.py',
          'market-state',
          '--json',
          '--limit',
          '50',
        ])

        if (result.exitCode !== 0) {
          throw new Error(
            result.stderr.toString().trim() || i18n('Market read failed.'),
          )
        }

        return parseMarketState(result.stdout.toString().trim())
      },
    )

    /*
     * State is authoritative from the engine.
     * StartOS only selects records already marked OPEN;
     * it does not re-derive expiry/match/cancel state.
     */
    const openOffers = market.offers.filter((offer) => offer.state === 'OPEN')

    const display =
      openOffers.length === 0
        ? i18n('No open offers.')
        : openOffers.map(formatOpenOffer).join('\n')

    const fullOfferIds =
      openOffers.length === 0
        ? i18n('No open offers.')
        : openOffers
            .map((offer) =>
              typeof offer.event_id === 'string'
                ? offer.event_id
                : '<invalid-id>',
            )
            .join('\n')

    return {
      version: '1',
      title: i18n('BLAKE/BTC Market'),
      message: i18n('Market state loaded successfully.'),
      result: {
        type: 'group',
        value: [
          {
            type: 'single',
            name: i18n('Open Offers'),
            description: null,
            value: display,
            masked: false,
            copyable: true,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('Full Offer IDs'),
            description: null,
            value: fullOfferIds,
            masked: false,
            copyable: true,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('Canonical Record Count'),
            description: null,
            value: String(market.offers.length),
            masked: false,
            copyable: false,
            qr: false,
          },
        ],
      },
    }
  },
)
