import * as fs from 'node:fs/promises'
import { sdk } from '../sdk'
import { i18n } from '../i18n'
import { btcFeePolicy } from '../file-models/btcFeePolicy'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  feeRateSatVb: Value.text({
    name: i18n('BTC Settlement Fee Rate Override'),
    description: i18n(
      'Optional sat/vB override for Bitcoin claim and refund transactions. Leave blank to use automatic Bitcoin node fee estimation.',
    ),
    required: false,
    default: null,
    placeholder: 'Automatic',
    masked: false,
  }),
})

export const configureBtcFeePolicy = sdk.Action.withInput(
  'configure-btc-fee-policy',

  async () => ({
    name: i18n('Configure BTC Settlement Fees'),
    description: i18n(
      'Choose automatic Bitcoin settlement fees or set an explicit sat/vB override.',
    ),
    warning: i18n(
      'An explicit override can overpay or delay settlement if it does not match current Bitcoin fee conditions.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  inputSpec,

  async ({ effects }) => {
    const saved = await btcFeePolicy.read().const(effects)

    return {
      feeRateSatVb: saved?.feeRateSatVb ?? null,
    }
  },

  async ({ effects, input }) => {
    const raw = input.feeRateSatVb?.trim() ?? ''

    let feeRateSatVb: string | null = null

    if (raw !== '') {
      if (!/^(?:\d+\.?\d*|\.\d+)$/.test(raw)) {
        throw new Error(
          i18n(
            'BTC settlement fee rate must be a positive decimal number in sat/vB.',
          ),
        )
      }

      const numeric = Number(raw)

      if (!Number.isFinite(numeric) || numeric <= 0) {
        throw new Error(
          i18n('BTC settlement fee rate must be greater than zero.'),
        )
      }

      feeRateSatVb = raw
    }

    const configDir = sdk.volumes.main.subpath('config')

    const configPath = sdk.volumes.main.subpath('config/btc-fee-policy.json')

    await fs.mkdir(configDir, {
      recursive: true,
      mode: 0o700,
    })

    await btcFeePolicy.write(effects, { feeRateSatVb })

    await fs.chmod(configDir, 0o700)
    await fs.chmod(configPath, 0o600)

    return {
      version: '1',
      title: i18n('BTC Settlement Fees'),
      message: i18n('BTC settlement fee policy saved successfully.'),
      result: {
        type: 'single',
        name: i18n('Settlement Fee Policy'),
        description: null,
        value: feeRateSatVb === null ? 'Automatic' : `${feeRateSatVb} sat/vB`,
        masked: false,
        copyable: false,
        qr: false,
      },
    }
  },
)
