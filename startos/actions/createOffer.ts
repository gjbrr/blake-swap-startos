import { sdk } from '../sdk'
import { i18n } from '../i18n'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  direction: Value.select({
    name: i18n('Offer Direction'),
    description: i18n(
      'Choose which asset you are offering to give.',
    ),
    default: 'blake-for-btc',
    values: {
      'blake-for-btc': 'Give BLAKE → Receive BTC',
      'btc-for-blake': 'Give BTC → Receive BLAKE',
    },
  }),

  blakeAmount: Value.number({
    name: i18n('BLAKE Amount'),
    description: i18n(
      'Amount of BLAKE in the advertised trade.',
    ),
    required: true,
    default: null,
    min: 0,
    step: 0.00000001,
    integer: false,
    units: 'BLAKE',
  }),

  btcSats: Value.number({
    name: i18n('BTC Amount'),
    description: i18n(
      'Bitcoin amount in satoshis in the advertised trade.',
    ),
    required: true,
    default: null,
    min: 1,
    step: 1,
    integer: true,
    units: 'sats',
  }),

  lifetimeMinutes: Value.number({
    name: i18n('Offer Lifetime'),
    description: i18n(
      'How long the offer remains open before expiring.',
    ),
    required: true,
    default: 60,
    min: 1,
    step: 1,
    integer: true,
    units: 'minutes',
  }),
})

function extractOfferId(stdout: string): string {
  const match = stdout.match(
    /^offer id:\s*([0-9a-f]{64})\s*$/im,
  )

  if (!match) {
    throw new Error(
      'Offer publish succeeded but no valid offer ID was returned',
    )
  }

  return match[1]
}

export const createOffer = sdk.Action.withInput(
  'create-offer',

  async () => ({
    name: i18n('Create Offer'),
    description: i18n(
      'Publish a signed BLAKE/BTC market offer to Nostr.',
    ),
    warning: i18n(
      'This publishes a public signed advertisement. It does not fund an HTLC or move BLAKE or Bitcoin.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  inputSpec,

  async () => null,

  async ({ effects, input }) => {
    if (input.blakeAmount <= 0) {
      throw new Error(
        i18n('BLAKE amount must be positive.'),
      )
    }

    if (
      !Number.isInteger(input.btcSats) ||
      input.btcSats <= 0
    ) {
      throw new Error(
        i18n(
          'BTC amount must be a positive whole number of satoshis.',
        ),
      )
    }

    if (
      !Number.isInteger(input.lifetimeMinutes) ||
      input.lifetimeMinutes <= 0
    ) {
      throw new Error(
        i18n(
          'Offer lifetime must be a positive whole number of minutes.',
        ),
      )
    }

    /*
     * Economically read-only, but writable because authenticated
     * Nostr evidence may be cached durably under /data.
     */
    const mounts = sdk.Mounts.of().mountVolume({
      volumeId: 'main',
      subpath: null,
      mountpoint: '/data',
      readonly: false,
    })

    const result =
      await sdk.SubContainer.withTemp(
        effects,
        { imageId: 'blake-swap' },
        mounts,
        'create-offer',
        async sub =>
          sub.exec([
            '/usr/bin/env',
            'PYTHONPATH=/opt/blake-swap/src',
            'BLAKE_SWAP_STATE_DIR=/data/swaps',
            'BLAKE_SWAP_MESSAGE_DIR=/data/messages',
            'BLAKE_SWAP_NOSTR_KEY_DIR=/data/nostr',
            'BLAKE_SWAP_PARTICIPANT_KEY_FILE=/data/participant.key',
            'BLAKE_SWAP_NOSTR_RELAYS=wss://TheForest.nostr1.com,wss://nos.lol',
            'python3',
            '/opt/blake-swap/src/swap_v2.py',
            'publish-market-offer',
            '--direction',
            input.direction,
            '--blake',
            String(input.blakeAmount),
            '--sats',
            String(input.btcSats),
            '--minutes',
            String(input.lifetimeMinutes),
          ]),
      )

    const stdout =
      result.stdout.toString().trim()

    const stderr =
      result.stderr.toString().trim()

    if (result.exitCode !== 0) {
      throw new Error(
        stderr ||
          i18n('Offer publication failed.'),
      )
    }

    if (
      !stdout.includes(
        'MARKET OFFER PUBLISHED',
      )
    ) {
      throw new Error(
        i18n(
          'Offer command completed without confirming publication.',
        ),
      )
    }

    const offerId =
      extractOfferId(stdout)

    const giving =
      input.direction === 'blake-for-btc'
        ? `${input.blakeAmount} BLAKE`
        : `${input.btcSats.toLocaleString(
            'en-US',
          )} sats`

    const wanting =
      input.direction === 'blake-for-btc'
        ? `${input.btcSats.toLocaleString(
            'en-US',
          )} sats`
        : `${input.blakeAmount} BLAKE`

    return {
      version: '1',
      title: i18n('Market Offer Published'),
      message: i18n(
        'Your signed market offer was published successfully.',
      ),
      result: {
        type: 'group',
        value: [
          {
            type: 'single',
            name: i18n('Offer ID'),
            description: null,
            value: offerId,
            masked: false,
            copyable: true,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('Giving'),
            description: null,
            value: giving,
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('Wanting'),
            description: null,
            value: wanting,
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('Lifetime'),
            description: null,
            value: `${input.lifetimeMinutes} minutes`,
            masked: false,
            copyable: false,
            qr: false,
          },
        ],
      },
    }
  },
)
