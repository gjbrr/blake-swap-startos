import { sdk } from '../sdk'
import { i18n } from '../i18n'
import {
  BlakeBlockchainInfoError,
  getBlakeBlockchainInfo,
} from '../lib/blakeBlockchainInfo'

export const checkBlakeRpc = sdk.Action.withoutInput(
  'check-blake-rpc',

  async () => ({
    name: i18n('Check BLAKE RPC'),
    description: i18n(
      'Check read-only connectivity to the BLAKE/RDTS service using getblockchaininfo.',
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
      result = await getBlakeBlockchainInfo(effects)
    } catch (error) {
      if (
        error instanceof BlakeBlockchainInfoError &&
        error.code === 'rpc-unavailable'
      ) {
        throw new Error(i18n('BLAKE RPC is unavailable.'))
      }

      throw new Error(i18n('BLAKE RPC check failed.'))
    }

    return {
      version: '1',
      title: i18n('BLAKE RPC'),
      message: i18n('BLAKE RPC check completed successfully.'),
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
        ],
      },
    }
  },
)
