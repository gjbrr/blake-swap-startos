import * as fs from 'node:fs/promises'
import { sdk } from '../sdk'
import { blakeProvider } from '../file-models/blakeProvider'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  rpcUrl: Value.text({
    name: 'BLAKE RPC URL',
    description:
      'HTTPS URL for a remote Blake2b-compatible node.',
    required: true,
    default: null,
    placeholder: 'https://blake-rpc.example:8443/',
    masked: false,
  }),

  rpcUsername: Value.text({
    name: 'BLAKE RPC Username',
    description:
      'RPC username for the remote BLAKE node.',
    required: true,
    default: null,
    masked: false,
  }),

  rpcPassword: Value.text({
    name: 'BLAKE RPC Password',
    description:
      'Enter a password to set or replace it. Leave blank to keep the currently saved password.',
    required: false,
    default: null,
    masked: true,
  }),

  trustedCaPem: Value.textarea({
    name: 'Trusted CA Certificate (PEM)',
    description:
      'PEM-encoded CA certificate used to verify the remote BLAKE RPC HTTPS endpoint.',
    required: true,
    default: null,
    minRows: 5,
    maxRows: 10,
    placeholder:
      '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----',
  }),
})

export const configureBlakeProvider = sdk.Action.withInput(
  'configure-blake-provider',

  async () => ({
    name: 'Configure Remote BLAKE Provider',
    description:
      'Save the remote Blake2b RPC connection used when BLAKE is configured as remote.',
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  inputSpec,

  async ({ effects }) => {
    const saved = await blakeProvider.read().const(effects)

    return {
      rpcUrl: saved?.rpcUrl,
      rpcUsername: saved?.rpcUsername,

      // Never send the saved RPC password back to the client.
      rpcPassword: null,

      trustedCaPem: saved?.trustedCaPem,
    }
  },

  async ({ effects, input }) => {
    const rpcUrl = input.rpcUrl.trim()
    const rpcUsername = input.rpcUsername.trim()
    const trustedCaPem = input.trustedCaPem.trim()

    if (!rpcUrl.startsWith('https://')) {
      throw new Error(
        'Remote BLAKE RPC URL must use HTTPS.',
      )
    }

    if (!rpcUsername) {
      throw new Error(
        'BLAKE RPC username must not be empty.',
      )
    }

    if (
      !trustedCaPem.includes(
        '-----BEGIN CERTIFICATE-----',
      ) ||
      !trustedCaPem.includes(
        '-----END CERTIFICATE-----',
      )
    ) {
      throw new Error(
        'Trusted CA must be a PEM certificate.',
      )
    }

    const saved =
      await blakeProvider.read().const(effects)

    const enteredPassword =
      input.rpcPassword?.trim() ?? ''

    const rpcPassword =
      enteredPassword || saved?.rpcPassword

    if (!rpcPassword) {
      throw new Error(
        'BLAKE RPC password is required for initial configuration.',
      )
    }

    const configDir =
      sdk.volumes.main.subpath('config')

    const configPath =
      sdk.volumes.main.subpath(
        'config/blake-provider.json',
      )

    await fs.mkdir(configDir, {
      recursive: true,
      mode: 0o700,
    })

    await blakeProvider.write(effects, {
      rpcUrl,
      rpcUsername,
      rpcPassword,
      trustedCaPem: `${trustedCaPem}\n`,
    })

    await fs.chmod(configDir, 0o700)
    await fs.chmod(configPath, 0o600)

    return {
      version: '1',
      title: 'BLAKE Provider',
      message:
        'Remote BLAKE provider configuration saved successfully.',
      result: {
        type: 'group',
        value: [
          {
            type: 'single',
            name: 'BLAKE RPC URL',
            description: null,
            value: rpcUrl,
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: 'BLAKE RPC Username',
            description: null,
            value: rpcUsername,
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: 'BLAKE RPC Password',
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
