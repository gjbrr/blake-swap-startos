import { sdk } from '../sdk'
import { i18n } from '../i18n'
import { walletMapping } from '../file-models/walletMapping'

const BLAKE_PROVIDER_PACKAGE_ID = 'bitcoind'
const BLAKE_PROVIDER_RPC_HOST_ID = 'rpc'
const BLAKE_PROVIDER_RPC_INTERNAL_PORT = 8332

function parseAddress(stdout: string, chain: 'BLAKE' | 'BTC'): string {
  const address = stdout.trim()

  if (address === '' || /\s/.test(address)) {
    throw new Error(
      chain === 'BLAKE'
        ? i18n('BLAKE deposit address could not be generated.')
        : i18n('Bitcoin deposit address could not be generated.'),
    )
  }

  return address
}

export const getBlakeDepositAddress = sdk.Action.withoutInput(
  'get-blake-deposit-address',

  async () => ({
    name: i18n('Get BLAKE Deposit Address'),
    description: i18n(
      'Generate a new receiving address from the configured BLAKE wallet.',
    ),
    warning: i18n(
      'This creates a new receiving address in the configured node wallet. It does not move or spend funds.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  async ({ effects }) => {
    const saved = await walletMapping.read().const(effects)

    const wallet = saved?.blakeWallet.trim() ?? ''

    if (!wallet) {
      throw new Error(
        i18n('Configure a BLAKE wallet before requesting a deposit address.'),
      )
    }

    const blakeRpcAddr = await sdk.host
      .getBridgeAddress(effects, {
        packageId: BLAKE_PROVIDER_PACKAGE_ID,
        hostId: BLAKE_PROVIDER_RPC_HOST_ID,
        internalPort: BLAKE_PROVIDER_RPC_INTERNAL_PORT,
        ssl: false,
      })
      .once()

    if (!blakeRpcAddr) {
      throw new Error(i18n('BLAKE RPC is unavailable.'))
    }

    const mounts = sdk.Mounts.of()
      .mountVolume({
        volumeId: 'main',
        subpath: null,
        mountpoint: '/data',
        readonly: true,
      })
      .mountDependency({
        dependencyId: BLAKE_PROVIDER_PACKAGE_ID,
        volumeId: 'main',
        subpath: null,
        mountpoint: '/mnt/bitcoind',
        readonly: true,
      })

    const address = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      mounts,
      'get-blake-deposit-address',
      async (sub) => {
        const result = await sub.exec([
          '/usr/bin/env',
          `BLAKE_SWAP_BLAKE_RPC_URL=http://${blakeRpcAddr}/`,
          'BLAKE_SWAP_BLAKE_COOKIE_PATH=/mnt/bitcoind/.cookie',

          '/opt/blake-swap/adapters/blake-rpc-cli',
          `-rpcwallet=${wallet}`,
          'getnewaddress',
        ])

        if (result.exitCode !== 0) {
          throw new Error(
            result.stderr.toString().trim() ||
              i18n('BLAKE deposit address could not be generated.'),
          )
        }

        const address = parseAddress(result.stdout.toString(), 'BLAKE')

        const verify = await sub.exec([
          '/usr/bin/env',
          `BLAKE_SWAP_BLAKE_RPC_URL=http://${blakeRpcAddr}/`,
          'BLAKE_SWAP_BLAKE_COOKIE_PATH=/mnt/bitcoind/.cookie',

          '/opt/blake-swap/adapters/blake-rpc-cli',
          `-rpcwallet=${wallet}`,
          'getaddressinfo',
          address,
        ])

        if (verify.exitCode !== 0) {
          throw new Error(i18n('BLAKE deposit address could not be generated.'))
        }

        let info: unknown

        try {
          info = JSON.parse(verify.stdout.toString())
        } catch {
          throw new Error(i18n('BLAKE deposit address could not be generated.'))
        }

        if (
          typeof info !== 'object' ||
          info === null ||
          !('ismine' in info) ||
          (info as { ismine: unknown }).ismine !== true
        ) {
          throw new Error(i18n('BLAKE deposit address could not be generated.'))
        }

        return address
      },
    )

    return {
      version: '1',
      title: i18n('BLAKE Deposit Address'),
      message: i18n('Send BLAKE only to this address.'),
      result: {
        type: 'single',
        name: i18n('Address'),
        description: null,
        value: address,
        masked: false,
        copyable: true,
        qr: true,
      },
    }
  },
)

export const getBtcDepositAddress = sdk.Action.withoutInput(
  'get-btc-deposit-address',

  async () => ({
    name: i18n('Get BTC Deposit Address'),
    description: i18n(
      'Generate a new receiving address from the configured Bitcoin wallet.',
    ),
    warning: i18n(
      'This creates a new receiving address in the configured node wallet. It does not move or spend funds.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  async ({ effects }) => {
    const saved = await walletMapping.read().const(effects)

    const wallet = saved?.btcWallet.trim() ?? ''

    if (!wallet) {
      throw new Error(
        i18n('Configure a Bitcoin wallet before requesting a deposit address.'),
      )
    }

    const mounts = sdk.Mounts.of().mountVolume({
      volumeId: 'main',
      subpath: null,
      mountpoint: '/data',
      readonly: true,
    })

    const address = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      mounts,
      'get-btc-deposit-address',
      async (sub) => {
        const result = await sub.exec([
          '/usr/bin/env',
          'BLAKE_SWAP_BTC_PROVIDER_CONFIG=/data/config/btc-provider.json',

          '/opt/blake-swap/adapters/btc-rpc-cli',
          `-rpcwallet=${wallet}`,
          'getnewaddress',
        ])

        if (result.exitCode !== 0) {
          throw new Error(
            result.stderr.toString().trim() ||
              i18n('Bitcoin deposit address could not be generated.'),
          )
        }

        const address = parseAddress(result.stdout.toString(), 'BTC')

        const verify = await sub.exec([
          '/usr/bin/env',
          'BLAKE_SWAP_BTC_PROVIDER_CONFIG=/data/config/btc-provider.json',

          '/opt/blake-swap/adapters/btc-rpc-cli',
          `-rpcwallet=${wallet}`,
          'getaddressinfo',
          address,
        ])

        if (verify.exitCode !== 0) {
          throw new Error(
            i18n('Bitcoin deposit address could not be generated.'),
          )
        }

        let info: unknown

        try {
          info = JSON.parse(verify.stdout.toString())
        } catch {
          throw new Error(
            i18n('Bitcoin deposit address could not be generated.'),
          )
        }

        if (
          typeof info !== 'object' ||
          info === null ||
          !('ismine' in info) ||
          (info as { ismine: unknown }).ismine !== true
        ) {
          throw new Error(
            i18n('Bitcoin deposit address could not be generated.'),
          )
        }

        return address
      },
    )

    return {
      version: '1',
      title: i18n('Bitcoin Deposit Address'),
      message: i18n('Send Bitcoin only to this address.'),
      result: {
        type: 'single',
        name: i18n('Address'),
        description: null,
        value: address,
        masked: false,
        copyable: true,
        qr: true,
      },
    }
  },
)
