import * as fs from 'node:fs/promises'
import { sdk } from '../sdk'
import {
  nodeProviders,
  type BtcProvider,
  type BlakeProvider,
} from '../file-models/nodeProviders'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  btc: Value.select({
    name: 'Bitcoin (BTC) Node',
    description: 'Select the node serving ordinary Bitcoin.',
    default: 'remote-rpc',
    values: {
      'local-bitcoind': 'Local StartOS bitcoind',
      'remote-rpc': 'Remote Bitcoin RPC',
    },
  }),

  blake: Value.select({
    name: 'BLAKE Node',
    description: 'Select the node serving the Blake2b chain.',
    default: 'local-bitcoind',
    values: {
      'local-bitcoind': 'Local StartOS bitcoind',
      'local-knots-blake2b': 'Local StartOS BLAKE Companion',
      'remote-rpc': 'Remote BLAKE RPC',
    },
  }),
})

export const configureNodeProviders = sdk.Action.withInput(
  'configure-node-providers',

  async () => ({
    name: 'Configure Node Providers',
    description:
      'Select which local or remote node serves each blockchain.',
    warning:
      'This action currently saves selections only. It does not change live RPC connections or dependencies.',
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  inputSpec,

  async ({ effects }) => {
    const saved = await nodeProviders.read().const(effects)

    return {
      btc: saved?.btc ?? 'remote-rpc',
      blake: saved?.blake ?? 'local-bitcoind',
    }
  },

  async ({ effects, input }) => {
    const btc: BtcProvider = input.btc
    const blake: BlakeProvider = input.blake

    if (
      btc === 'local-bitcoind' &&
      blake === 'local-bitcoind'
    ) {
      throw new Error(
        'The same StartOS bitcoind service cannot serve both chains.',
      )
    }

    const configDir = sdk.volumes.main.subpath('config')
    const configPath =
      sdk.volumes.main.subpath('config/node-providers.json')

    await fs.mkdir(configDir, {
      recursive: true,
      mode: 0o700,
    })

    await nodeProviders.write(effects, {
      btc,
      blake,
    })

    await fs.chmod(configDir, 0o700)
    await fs.chmod(configPath, 0o600)

    return {
      version: '1',
      title: 'Node Providers',
      message:
        'Provider preferences saved. Live connections have not changed.',
      result: {
        type: 'group',
        value: [
          {
            type: 'single',
            name: 'BTC Provider',
            description: null,
            value: btc,
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: 'BLAKE Provider',
            description: null,
            value: blake,
            masked: false,
            copyable: false,
            qr: false,
          },
        ],
      },
    }
  },
)
