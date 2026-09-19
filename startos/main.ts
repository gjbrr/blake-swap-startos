import { sdk } from './sdk'
import { walletMapping } from './file-models/walletMapping'
import { btcFeePolicy } from './file-models/btcFeePolicy'

export const main = sdk.setupMain(async ({ effects }) => {
  console.info('Starting BLAKE Swap alpha service')

  const savedWalletMapping = await walletMapping.read().const(effects)

  const blakeWallet = savedWalletMapping?.blakeWallet.trim() ?? ''

  const btcWallet = savedWalletMapping?.btcWallet.trim() ?? ''

  const savedBtcFeePolicy = await btcFeePolicy.read().const(effects)

  const btcFeeRateSatVb = savedBtcFeePolicy?.feeRateSatVb?.trim() ?? ''

  if (!blakeWallet || !btcWallet) {
    throw new Error(
      'Both BLAKE and BTC wallets must be explicitly configured before the BLAKE Swap runtime can start',
    )
  }

  const blakeRpcAddr = await sdk.host
    .getBridgeAddress(effects, {
      packageId: 'bitcoind',
      hostId: 'rpc',
      internalPort: 8332,
      ssl: false,
    })
    .once()

  if (!blakeRpcAddr) {
    throw new Error('BLAKE RPC bridge is unavailable')
  }

  const mounts = sdk.Mounts.of()
    .mountVolume({
      volumeId: 'main',
      subpath: null,
      mountpoint: '/data',
      readonly: false,
    })
    .mountDependency({
      dependencyId: 'bitcoind',
      volumeId: 'main',
      subpath: null,
      mountpoint: '/mnt/bitcoind',
      readonly: true,
    })

  const swapSubcontainer = sdk.SubContainer.of(
    effects,
    { imageId: 'blake-swap' },
    mounts,
    'blake-swap-subcontainer',
  )

  const identityResult = await swapSubcontainer.exec([
    'python3',
    '-c',
    `
import os
from pathlib import Path
from coincurve import PrivateKey

path = Path("/data/participant.key")

try:
    fd = os.open(
        path,
        os.O_WRONLY | os.O_CREAT | os.O_EXCL,
        0o600,
    )
except FileExistsError:
    pass
else:
    try:
        key = PrivateKey().secret.hex() + "\\n"
        os.write(fd, key.encode())
        os.fsync(fd)
    finally:
        os.close(fd)

os.chmod(path, 0o600)

raw = path.read_text().strip()

try:
    key_bytes = bytes.fromhex(raw)
    PrivateKey(key_bytes)
except Exception as exc:
    raise RuntimeError(
        "Persistent participant identity key is invalid"
    ) from exc
`,
  ])

  if (identityResult.exitCode !== 0) {
    throw new Error(
      `Could not initialize persistent participant identity: ${identityResult.stderr.toString()}`,
    )
  }
  return sdk.Daemons.of(effects).addDaemon('blake-swap', {
    subcontainer: swapSubcontainer,

    // Intentionally inert.
    //
    // Alpha-0 proves that the real swap engine can be installed and kept
    // available inside StartOS.  It does NOT run next, run, fund, resume,
    // wallet RPC, blockchain RPC, or Nostr coordination automatically.
    exec: {
      command: ['python3', '-c', 'import time; time.sleep(1000000000)'],
      env: {
        PYTHONPATH: '/opt/blake-swap/src',
        BLAKE_SWAP_STATE_DIR: '/data/swaps',
        BLAKE_SWAP_MESSAGE_DIR: '/data/messages',
        BLAKE_SWAP_NOSTR_KEY_DIR: '/data/nostr',
        BLAKE_SWAP_PARTICIPANT_KEY_FILE: '/data/participant.key',

        // Private RPC adapters used only by the packaged swap engine.
        BLAKE_SWAP_BLAKE_CLI: '/opt/blake-swap/adapters/blake-rpc-cli',
        BLAKE_SWAP_BTC_CLI: '/opt/blake-swap/adapters/btc-rpc-cli',

        // The adapters provide transport configuration, so the engine
        // must not add host filesystem datadir arguments.
        BLAKE_SWAP_BLAKE_DATADIR: '',
        BLAKE_SWAP_BTC_DATADIR: '',

        // Production integrations never synthesize confirmations.
        BLAKE_SWAP_AUTO_MINE: '0',
        BLAKE_SWAP_BLAKE_NETWORK: 'main',

        // BLAKE uses StartOS's dynamic internal bridge + dependency
        // cookie. BTC credentials remain solely in /data/config.
        BLAKE_SWAP_BLAKE_RPC_URL: `http://${blakeRpcAddr}/`,
        BLAKE_SWAP_BLAKE_COOKIE_PATH: '/mnt/bitcoind/.cookie',
        BLAKE_SWAP_BTC_PROVIDER_CONFIG: '/data/config/btc-provider.json',

        // Never permit the packaged engine to fall back to its legacy
        // participant-role wallet defaults in production.
        BLAKE_SWAP_BLAKE_WALLET: blakeWallet,
        BLAKE_SWAP_BTC_WALLET: btcWallet,
        ...(btcFeeRateSatVb
          ? {
              BLAKE_SWAP_BTC_SPEND_FEE_RATE_SAT_VB: btcFeeRateSatVb,
            }
          : {}),
      },
    },

    ready: {
      display: null,
      fn: async () => {
        const result = await swapSubcontainer.exec([
          'python3',
          '-c',
          'import swap_v2; print("BLAKE Swap engine import OK")',
        ])

        if (result.exitCode !== 0) {
          return {
            result: 'failure',
            message: `BLAKE Swap engine import failed: ${result.stderr.toString()}`,
          }
        }

        return {
          result: 'success',
          message: 'BLAKE Swap engine is installed',
        }
      },
    },

    requires: [],
  })
})
