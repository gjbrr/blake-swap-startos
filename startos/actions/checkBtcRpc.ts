import { sdk } from '../sdk'
import { i18n } from '../i18n'
import {
  BtcBlockchainInfoError,
  getBtcBlockchainInfo,
} from '../lib/btcBlockchainInfo'
import { isBtcEconomicallyReady } from '../lib/btcReadiness'

export const checkBtcRpc = sdk.Action.withoutInput(
  'check-btc-rpc',

  async () => ({
    name: i18n('Check BTC RPC'),
    description: i18n(
      'Check read-only connectivity to the saved ordinary Bitcoin node using getblockchaininfo.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  async ({ effects }) => {
    let result

    try {
      result = await getBtcBlockchainInfo(effects)
    } catch (error) {
      if (error instanceof BtcBlockchainInfoError) {
        if (error.code === 'provider-not-configured') {
          throw new Error(
            i18n('Configure the BTC provider before checking BTC RPC.'),
          )
        }

        if (error.code === 'insecure-url') {
          throw new Error(i18n('BTC RPC URL must use HTTPS.'))
        }
      }

      throw new Error(i18n('BTC RPC check failed.'))
    }

    const economicallyReady = isBtcEconomicallyReady(result)

    return {
      version: '1',
      title: i18n('BTC RPC'),
      message: i18n('BTC RPC check completed successfully.'),
      result: {
        type: 'group',
        value: [
          {
            type: 'single',
            name: i18n('Chain'),
            description: null,
            value: String(result.chain),
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('Blocks'),
            description: null,
            value: String(result.blocks),
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('Headers'),
            description: null,
            value: String(result.headers),
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('Verification Progress'),
            description: null,
            value: String(result.verificationprogress),
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('Initial Block Download'),
            description: null,
            value: String(result.initialblockdownload),
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('Economic Readiness'),
            description: null,
            value: economicallyReady ? i18n('Ready') : i18n('Not Ready'),
            masked: false,
            copyable: false,
            qr: false,
          },
        ],
      },
    }
  },
)
