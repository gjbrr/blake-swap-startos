import { sdk } from '../sdk'
import { i18n } from '../i18n'
import { walletMapping } from '../file-models/walletMapping'
import {
  isObservationEconomicallyReady,
  WalletReadinessObservation,
} from '../lib/walletReadinessObservation'
import { observeConfiguredWallet } from '../lib/observeConfiguredWallet'

export const checkWalletReadiness = sdk.Action.withoutInput(
  'check-wallet-readiness',

  async () => ({
    name: i18n('Check Wallet Readiness'),
    description: i18n(
      'Check whether configured chain wallets exist and are loaded without changing wallet state.',
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

    const blake = await observeConfiguredWallet(effects, 'blake', blakeWallet)

    const btc = await observeConfiguredWallet(effects, 'btc', btcWallet)

    function displayCapability(value: boolean | null): string {
      if (value === null) {
        return i18n('Unknown')
      }

      return String(value)
    }

    function fields(label: string, observation: WalletReadinessObservation) {
      return [
        {
          type: 'single' as const,
          name: label,
          description: null,
          value: observation.wallet || '-',
          masked: false,
          copyable: false,
          qr: false,
        },
        {
          type: 'single' as const,
          name: `${label} — ${i18n('Configured')}`,
          description: null,
          value: String(observation.configured),
          masked: false,
          copyable: false,
          qr: false,
        },
        {
          type: 'single' as const,
          name: `${label} — ${i18n('Exists')}`,
          description: null,
          value: String(observation.exists),
          masked: false,
          copyable: false,
          qr: false,
        },
        {
          type: 'single' as const,
          name: `${label} — ${i18n('Loaded')}`,
          description: null,
          value: String(observation.loaded),
          masked: false,
          copyable: false,
          qr: false,
        },
        {
          type: 'single' as const,
          name: `${label} — ${i18n('Private Keys Enabled')}`,
          description: null,
          value: displayCapability(observation.signing.privateKeysEnabled),
          masked: false,
          copyable: false,
          qr: false,
        },
        {
          type: 'single' as const,
          name: `${label} — ${i18n('External Signer')}`,
          description: null,
          value: displayCapability(observation.signing.externalSigner),
          masked: false,
          copyable: false,
          qr: false,
        },
        {
          type: 'single' as const,
          name: `${label} — ${i18n('Signing Backend Available')}`,
          description: null,
          value: displayCapability(observation.signing.signingBackendAvailable),
          masked: false,
          copyable: false,
          qr: false,
        },
        {
          type: 'single' as const,
          name: `${label} — ${i18n('Economic Wallet Readiness')}`,
          description: null,
          value: isObservationEconomicallyReady(observation)
            ? i18n('Ready')
            : i18n('Not Ready'),
          masked: false,
          copyable: false,
          qr: false,
        },
      ]
    }

    return {
      version: '1',
      title: i18n('Wallet Readiness'),
      message: i18n('Wallet readiness check completed successfully.'),
      result: {
        type: 'group',
        value: [
          ...fields(i18n('BLAKE Wallet'), blake),
          ...fields(i18n('Bitcoin Wallet'), btc),
        ],
      },
    }
  },
)
