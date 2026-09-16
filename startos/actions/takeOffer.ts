import { sdk } from '../sdk'
import { i18n } from '../i18n'
import { getNostrRelayEnv } from '../file-models/nostrRelays'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  offerId: Value.text({
    name: i18n('Offer ID'),
    description: i18n(
      'Full 64-character Nostr event ID of the open market offer you want to take.',
    ),
    required: true,
    default: null,
    placeholder:
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    masked: false,
  }),
})

function extractTakeId(stdout: string): string {
  const match = stdout.match(
    /^take id:\s*([0-9a-f]{64})\s*$/im,
  )

  if (!match) {
    throw new Error(
      'Take command succeeded but no valid take ID was returned',
    )
  }

  return match[1]
}

export const takeOffer = sdk.Action.withInput(
  'take-offer',

  async () => ({
    name: i18n('Take Offer'),
    description: i18n(
      'Publish a signed request to take an open BLAKE/BTC market offer.',
    ),
    warning: i18n(
      'This publishes a public signed take request. It does not fund an HTLC or move BLAKE or Bitcoin.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  inputSpec,

  async () => null,

  async ({ effects, input }) => {
    const offerId =
      input.offerId.trim().toLowerCase()

    if (!/^[0-9a-f]{64}$/.test(offerId)) {
      throw new Error(
        i18n(
          'Offer ID must be exactly 64 hexadecimal characters.',
        ),
      )
    }

    /*
     * Coordination-only, but writable because signed/authenticated
     * Nostr evidence is durably cached under /data.
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
        'take-offer',
        async sub =>
          sub.exec([
            '/usr/bin/env',
            'PYTHONPATH=/opt/blake-swap/src',
            'BLAKE_SWAP_STATE_DIR=/data/swaps',
            'BLAKE_SWAP_MESSAGE_DIR=/data/messages',
            'BLAKE_SWAP_NOSTR_KEY_DIR=/data/nostr',
            'BLAKE_SWAP_PARTICIPANT_KEY_FILE=/data/participant.key',
            await getNostrRelayEnv(effects),
            'python3',
            '/opt/blake-swap/src/swap_v2.py',
            'take-market-offer',
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
          i18n('Offer take failed.'),
      )
    }

    const newlyTaken = stdout.includes(
      'MARKET OFFER TAKEN',
    )

    const alreadyTaken = stdout.includes(
      'MARKET OFFER ALREADY TAKEN',
    )

    if (!newlyTaken && !alreadyTaken) {
      throw new Error(
        i18n(
          'Take command completed without confirming a signed take.',
        ),
      )
    }

    const takeId = extractTakeId(stdout)

    return {
      version: '1',
      title: newlyTaken
        ? i18n('Market Offer Taken')
        : i18n('Existing Market Take Reused'),
      message: newlyTaken
        ? i18n(
            'Your signed take request was published successfully.',
          )
        : i18n(
            'Your existing signed take request was reused without creating a duplicate.',
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
            name: i18n('Take ID'),
            description: null,
            value: takeId,
            masked: false,
            copyable: true,
            qr: false,
          },
        ],
      },
    }
  },
)
