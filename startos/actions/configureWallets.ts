import * as fs from 'node:fs/promises'
import { sdk } from '../sdk'
import { i18n } from '../i18n'
import { walletMapping } from '../file-models/walletMapping'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  blakeWallet: Value.text({
    name: i18n('BLAKE Wallet'),
    description: i18n(
      'Wallet name on the configured BLAKE/Knots node. This selects an existing wallet; it does not create or load one.',
    ),
    required: false,
    default: null,
    placeholder: 'cormorant',
    masked: false,
  }),

  btcWallet: Value.text({
    name: i18n('Bitcoin Wallet'),
    description: i18n(
      'Wallet name on the configured ordinary Bitcoin Core node. This selects an existing wallet; it does not create or load one.',
    ),
    required: false,
    default: null,
    placeholder: 'blake-swap',
    masked: false,
  }),
})

export const configureWallets = sdk.Action.withInput(
  'configure-wallets',

  async () => ({
    name: i18n('Configure Chain Wallets'),
    description: i18n(
      'Select the existing BLAKE and Bitcoin wallets that BLAKE Swap will use.',
    ),
    warning: i18n(
      'This action only records wallet names. It does not create, load, unlock, sign with, or spend from either wallet.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  inputSpec,

  async ({ effects }) => {
    const saved = await walletMapping.read().const(effects)

    return {
      blakeWallet: saved?.blakeWallet ?? null,
      btcWallet: saved?.btcWallet ?? null,
    }
  },

  async ({ effects, input }) => {
    const blakeWallet = input.blakeWallet?.trim() ?? ''
    const btcWallet = input.btcWallet?.trim() ?? ''

    const configDir = sdk.volumes.main.subpath('config')
    const configPath = sdk.volumes.main.subpath('config/wallets.json')

    await fs.mkdir(configDir, {
      recursive: true,
      mode: 0o700,
    })

    await walletMapping.write(effects, {
      blakeWallet,
      btcWallet,
    })

    await fs.chmod(configDir, 0o700)
    await fs.chmod(configPath, 0o600)

    return {
      version: '1',
      title: i18n('Chain Wallets'),
      message: i18n('Wallet mapping saved successfully.'),
      result: {
        type: 'group',
        value: [
          {
            type: 'single',
            name: i18n('BLAKE Wallet'),
            description: null,
            value: blakeWallet || 'Not configured',
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('Bitcoin Wallet'),
            description: null,
            value: btcWallet || 'Not configured',
            masked: false,
            copyable: false,
            qr: false,
          },
        ],
      },
    }
  },
)
