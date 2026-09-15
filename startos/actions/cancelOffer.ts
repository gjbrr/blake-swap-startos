import { sdk } from '../sdk'
import { i18n } from '../i18n'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  offerId: Value.text({
    name: i18n('Offer ID'),
    description: i18n(
      'Full 64-character Nostr event ID of one of your market offers.',
    ),
    required: true,
    default: null,
    placeholder:
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    masked: false,
  }),
})

function extractCancelId(stdout: string): string {
  const match = stdout.match(
    /^cancel id:\s*([0-9a-f]{64})\s*$/im,
  )

  if (!match) {
    throw new Error(
      'Offer cancellation succeeded but no valid cancellation ID was returned',
    )
  }

  return match[1]
}

export const cancelOffer = sdk.Action.withInput(
  'cancel-offer',

  async () => ({
    name: i18n('Cancel Offer'),
    description: i18n(
      'Publish a signed cancellation for one of your public market offers.',
    ),
    warning: i18n(
      'This publishes a public signed cancellation event. It does not move BLAKE or Bitcoin.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  inputSpec,

  async () => null,

  async ({ effects, input }) => {
    const offerId = input.offerId.trim().toLowerCase()

    if (!/^[0-9a-f]{64}$/.test(offerId)) {
      throw new Error(
        i18n(
          'Offer ID must be exactly 64 hexadecimal characters.',
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
        'cancel-offer',
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
            'cancel-market-offer',
            offerId,
          ]),
      )

    const stdout =
      result.stdout.toString().trim()

    const stderr =
      result.stderr.toString().trim()

    if (result.exitCode !== 0) {
      throw new Error(
        stderr ||
          i18n('Offer cancellation failed.'),
      )
    }

    if (
      !stdout.includes(
        'MARKET OFFER CANCELLED',
      )
    ) {
      throw new Error(
        i18n(
          'Offer command completed without confirming cancellation.',
        ),
      )
    }

    const cancelId =
      extractCancelId(stdout)

    return {
      version: '1',
      title: i18n('Market Offer Cancelled'),
      message: i18n(
        'Your signed market offer cancellation was published successfully.',
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
            name: i18n('Cancellation ID'),
            description: null,
            value: cancelId,
            masked: false,
            copyable: true,
            qr: false,
          },
        ],
      },
    }
  },
)
