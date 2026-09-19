import { sdk } from '../sdk'
import { i18n } from '../i18n'
import { getNostrRelayEnv } from '../file-models/nostrRelays'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  swapId: Value.text({
    name: i18n('Swap ID'),
    description:
      'Exact 12-character swap ID whose already-funded BLAKE HTLC should be announced over Nostr.',
    required: true,
    default: null,
    placeholder: '25f4295f9d86',
    masked: false,
  }),
})

export const publishBlakeFunding = sdk.Action.withInput(
  'publish-blake-funding',

  async () => ({
    name: 'Publish BLAKE Funding',
    description:
      'Publish the already-recorded BLAKE funding outpoint to the authenticated swap counterparty over Nostr.',
    warning:
      'This action does not fund BLAKE and does not move funds. It only publishes funding information already recorded in swap state.',
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  inputSpec,

  async () => null,

  async ({ effects, input }) => {
    const swapId = input.swapId.trim().toLowerCase()

    if (!/^[0-9a-f]{12}$/.test(swapId)) {
      throw new Error('Swap ID must be exactly 12 hexadecimal characters.')
    }

    const mounts = sdk.Mounts.of().mountVolume({
      volumeId: 'main',
      subpath: null,
      mountpoint: '/data',
      readonly: false,
    })

    const outcome = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      mounts,
      'publish-blake-funding',
      async (sub) => {
        const result = await sub.exec([
          '/usr/bin/env',

          'PYTHONPATH=/opt/blake-swap/src',

          'BLAKE_SWAP_ROLE=alice',
          'BLAKE_SWAP_STATE_DIR=/data/swaps',
          'BLAKE_SWAP_MESSAGE_DIR=/data/messages',
          'BLAKE_SWAP_NOSTR_KEY_DIR=/data/nostr',
          'BLAKE_SWAP_PARTICIPANT_KEY_FILE=/data/participant.key',

          'BLAKE_SWAP_TRANSPORT=nostr',
          await getNostrRelayEnv(effects),

          'python3',
          '/opt/blake-swap/src/swap_v2.py',
          'publish-blake-funded',
          swapId,
        ])

        const stdout = result.stdout.toString().trim()

        const stderr = result.stderr.toString().trim()

        if (result.exitCode !== 0) {
          throw new Error(
            stderr || stdout || 'BLAKE funding publication failed.',
          )
        }

        return stdout || 'BLAKE funding information published.'
      },
    )

    return {
      version: '1',
      title: 'BLAKE Funding Published',
      message: 'The already-funded BLAKE HTLC was announced over Nostr.',
      result: {
        type: 'single',
        name: i18n('Result'),
        description: null,
        value: outcome,
        masked: false,
        copyable: false,
        qr: false,
      },
    }
  },
)
