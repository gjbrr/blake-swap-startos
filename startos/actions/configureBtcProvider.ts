import * as fs from 'node:fs/promises'
import { sdk } from '../sdk'
import { i18n } from '../i18n'
import { btcProvider } from '../file-models/btcProvider'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  rpcUrl: Value.text({
    name: i18n('BTC RPC URL'),
    description: i18n('HTTPS URL for an ordinary Bitcoin RPC endpoint.'),
    required: true,
    default: null,
    placeholder: 'https://bitcoin-rpc.example:8443/',
    masked: false,
  }),

  rpcUsername: Value.text({
    name: i18n('BTC RPC Username'),
    description: i18n('RPC username for the ordinary Bitcoin node.'),
    required: true,
    default: null,
    masked: false,
  }),

  rpcPassword: Value.text({
    name: i18n('BTC RPC Password'),
    description: i18n(
      'Enter a password to set or replace it. Leave blank to keep the currently saved password.',
    ),
    required: false,
    default: null,
    masked: true,
  }),

  trustedCaPem: Value.textarea({
    name: i18n('Trusted CA Certificate (PEM)'),
    description: i18n(
      'PEM-encoded CA certificate used to verify the Bitcoin RPC HTTPS endpoint.',
    ),
    required: true,
    default: null,
    minRows: 5,
    maxRows: 10,
    placeholder: '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----',
  }),
})

export const configureBtcProvider = sdk.Action.withInput(
  'configure-btc-provider',

  async () => ({
    name: i18n('Configure BTC Provider'),
    description: i18n(
      'Save the external ordinary Bitcoin RPC connection used by BLAKE Swap.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  inputSpec,

  async ({ effects }) => {
    const saved = await btcProvider.read().const(effects)

    return {
      rpcUrl: saved?.rpcUrl,
      rpcUsername: saved?.rpcUsername,

      // Never send a saved RPC password back to the client.
      rpcPassword: null,

      trustedCaPem: saved?.trustedCaPem,
    }
  },

  async ({ effects, input }) => {
    const rpcUrl = input.rpcUrl.trim()
    const rpcUsername = input.rpcUsername.trim()
    const trustedCaPem = input.trustedCaPem.trim()

    if (!rpcUrl.startsWith('https://')) {
      throw new Error(i18n('BTC RPC URL must use HTTPS.'))
    }

    if (!rpcUsername) {
      throw new Error(i18n('BTC RPC username must not be empty.'))
    }

    if (
      !trustedCaPem.includes('-----BEGIN CERTIFICATE-----') ||
      !trustedCaPem.includes('-----END CERTIFICATE-----')
    ) {
      throw new Error(i18n('Trusted CA must be a PEM certificate.'))
    }

    const saved = await btcProvider.read().const(effects)
    const enteredPassword = input.rpcPassword?.trim() ?? ''
    const rpcPassword = enteredPassword || saved?.rpcPassword

    if (!rpcPassword) {
      throw new Error(
        i18n('BTC RPC password is required for initial configuration.'),
      )
    }

    const configDir = sdk.volumes.main.subpath('config')
    const configPath = sdk.volumes.main.subpath('config/btc-provider.json')

    await fs.mkdir(configDir, {
      recursive: true,
      mode: 0o700,
    })

    await btcProvider.write(effects, {
      rpcUrl,
      rpcUsername,
      rpcPassword,
      trustedCaPem: `${trustedCaPem}\n`,
    })

    // Defense in depth: restrict direct filesystem access to the saved
    // provider credential record.
    await fs.chmod(configDir, 0o700)
    await fs.chmod(configPath, 0o600)

    return {
      version: '1',
      title: i18n('BTC Provider'),
      message: i18n('BTC provider configuration saved successfully.'),
      result: {
        type: 'group',
        value: [
          {
            type: 'single',
            name: i18n('BTC RPC URL'),
            description: null,
            value: rpcUrl,
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('BTC RPC Username'),
            description: null,
            value: rpcUsername,
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('BTC RPC Password'),
            description: null,
            value: 'Saved',
            masked: true,
            copyable: false,
            qr: false,
          },
        ],
      },
    }
  },
)
