import { sdk } from '../sdk'
import { i18n } from '../i18n'
import { getNostrRelayEnv } from '../file-models/nostrRelays'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  swapId: Value.text({
    name: i18n('Swap ID'),
    description:
      'Exact 12-character swap ID whose Bitcoin funding message should be imported from Nostr.',
    required: true,
    default: null,
    placeholder: '25f4295f9d86',
    masked: false,
  }),
})

export const receiveBtcFunding = sdk.Action.withInput(
  'receive-btc-funding',

  async () => ({
    name: 'Receive BTC Funding',
    description:
      'Import and validate Bob’s authenticated Bitcoin funding message from Nostr.',
    warning:
      'This action does not fund Bitcoin, claim Bitcoin, or move funds. It only imports already-published coordination data.',
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
      'receive-btc-funding',
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

          'BLAKE_SWAP_BTC_CLI=/opt/blake-swap/adapters/btc-rpc-cli',
          'BLAKE_SWAP_BTC_DATADIR=',
          'BLAKE_SWAP_BTC_PROVIDER_CONFIG=/data/config/btc-provider.json',

          'python3',
          '/opt/blake-swap/src/swap_v2.py',
          'receive-btc-funded',
          swapId,
        ])

        const stdout = result.stdout.toString().trim()

        const stderr = result.stderr.toString().trim()

        if (result.exitCode !== 0) {
          throw new Error(
            stderr || stdout || 'Bitcoin funding message import failed.',
          )
        }

        return stdout || 'Bitcoin funding message imported.'
      },
    )

    return {
      version: '1',
      title: 'BTC Funding Received',
      message: 'Bob’s authenticated Bitcoin funding message was imported.',
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
