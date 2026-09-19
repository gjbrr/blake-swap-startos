import * as fs from 'node:fs/promises'
import { sdk } from '../sdk'
import { i18n } from '../i18n'
import { DEFAULT_NOSTR_RELAYS, nostrRelays } from '../file-models/nostrRelays'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  relays: Value.textarea({
    name: i18n('Nostr Relays'),
    description: i18n('Enter one secure Nostr relay URL per line.'),
    required: true,
    default: null,
    minRows: 3,
    maxRows: 10,
    placeholder: 'wss://relay.example\nwss://another.example',
  }),
})

function parseRelays(raw: string): string[] {
  const relays = raw
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)

  const unique = Array.from(new Set(relays))

  if (unique.length < 1) {
    throw new Error(i18n('At least one Nostr relay is required.'))
  }

  if (unique.length > 10) {
    throw new Error(i18n('No more than 10 Nostr relays may be configured.'))
  }

  for (const relay of unique) {
    let url: URL

    try {
      url = new URL(relay)
    } catch {
      throw new Error(i18n('Each Nostr relay must be a valid wss:// URL.'))
    }

    if (
      url.protocol !== 'wss:' ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      throw new Error(i18n('Each Nostr relay must be a valid wss:// URL.'))
    }
  }

  return unique
}

export const configureNostrRelays = sdk.Action.withInput(
  'configure-nostr-relays',

  async () => ({
    name: i18n('Configure Nostr Relays'),
    description: i18n(
      'Choose the external Nostr relays used for BLAKE Swap coordination.',
    ),
    warning: i18n(
      'Relays coordinate public signed swap messages. They are not trusted with chain settlement or funds.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  inputSpec,

  async ({ effects }) => {
    const saved = await nostrRelays.read().const(effects)

    return {
      relays: (saved?.relays ?? Array.from(DEFAULT_NOSTR_RELAYS)).join('\n'),
    }
  },

  async ({ effects, input }) => {
    const relays = parseRelays(input.relays)

    const configDir = sdk.volumes.main.subpath('config')

    const configPath = sdk.volumes.main.subpath('config/nostr-relays.json')

    await fs.mkdir(configDir, {
      recursive: true,
      mode: 0o700,
    })

    await nostrRelays.write(effects, { relays })

    await fs.chmod(configDir, 0o700)
    await fs.chmod(configPath, 0o600)

    return {
      version: '1',
      title: i18n('Nostr Relays'),
      message: i18n('Nostr relay configuration saved successfully.'),
      result: {
        type: 'single',
        name: i18n('Configured Relays'),
        description: null,
        value: relays.join('\n'),
        masked: false,
        copyable: true,
        qr: false,
      },
    }
  },
)
