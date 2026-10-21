import { sdk } from '../sdk'
import { i18n } from '../i18n'
import { walletMapping } from '../file-models/walletMapping'
import { getBlakeBlockchainInfo } from '../lib/blakeBlockchainInfo'
import { getBtcBlockchainInfo } from '../lib/btcBlockchainInfo'
import { isBlakeEconomicallyReady } from '../lib/blakeReadiness'
import { isBtcEconomicallyReady } from '../lib/btcReadiness'
import { observeConfiguredWallet } from '../lib/observeConfiguredWallet'
import { isObservationEconomicallyReady } from '../lib/walletReadinessObservation'

export const checkEconomicReadiness = sdk.Action.withoutInput(
  'check-economic-readiness',

  async () => ({
    name: i18n('Check Economic Readiness'),
    description: i18n(
      'Check read-only chain and wallet readiness for both sides before economic use.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  async ({ effects }) => {
    const savedMapping = await walletMapping.read().const(effects)

    const blakeWallet = savedMapping?.blakeWallet.trim() ?? ''

    const btcWallet = savedMapping?.btcWallet.trim() ?? ''

    const blakeBlockchain = await getBlakeBlockchainInfo(effects)

    const btcBlockchain = await getBtcBlockchainInfo(effects)

    const blake = await observeConfiguredWallet(effects, 'blake', blakeWallet)

    const btc = await observeConfiguredWallet(effects, 'btc', btcWallet)

    const blakeChainReady = isBlakeEconomicallyReady(blakeBlockchain)

    const btcChainReady = isBtcEconomicallyReady(btcBlockchain)

    const blakeWalletReady = isObservationEconomicallyReady(blake)

    const btcWalletReady = isObservationEconomicallyReady(btc)

    const readinessValue = (ready: boolean) =>
      ready ? i18n('Ready') : i18n('Not Ready')

    return {
      version: '1',
      title: i18n('Economic Preflight'),
      message: i18n('Economic readiness check completed successfully.'),
      result: {
        type: 'group',
        value: [
          {
            type: 'single',
            name: i18n('BLAKE Chain Readiness'),
            description: null,
            value: readinessValue(blakeChainReady),
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('BLAKE Wallet Readiness'),
            description: null,
            value: readinessValue(blakeWalletReady),
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('BLAKE Economic Context'),
            description: null,
            value: readinessValue(blakeChainReady && blakeWalletReady),
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('BTC Chain Readiness'),
            description: null,
            value: readinessValue(btcChainReady),
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('BTC Wallet Readiness'),
            description: null,
            value: readinessValue(btcWalletReady),
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('BTC Economic Context'),
            description: null,
            value: readinessValue(btcChainReady && btcWalletReady),
            masked: false,
            copyable: false,
            qr: false,
          },
        ],
      },
    }
  },
)
