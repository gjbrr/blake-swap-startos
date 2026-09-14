import { sdk } from './sdk'

export const main = sdk.setupMain(async ({ effects }) => {
  console.info('Starting BLAKE Swap alpha service')

  const swapSubcontainer = sdk.SubContainer.of(
    effects,
    { imageId: 'blake-swap' },
    sdk.Mounts.of().mountVolume({
      volumeId: 'main',
      subpath: null,
      mountpoint: '/data',
      readonly: false,
    }),
    'blake-swap-subcontainer',
  )

  return sdk.Daemons.of(effects).addDaemon('blake-swap', {
    subcontainer: swapSubcontainer,

    // Intentionally inert.
    //
    // Alpha-0 proves that the real swap engine can be installed and kept
    // available inside StartOS.  It does NOT run next, run, fund, resume,
    // wallet RPC, blockchain RPC, or Nostr coordination automatically.
    exec: {
      command: [
        'python3',
        '-c',
        'import time; time.sleep(1000000000)',
      ],
      env: {
        PYTHONPATH: '/opt/blake-swap/src',
        BLAKE_SWAP_STATE_DIR: '/data/swaps',
        BLAKE_SWAP_MESSAGE_DIR: '/data/messages',
        BLAKE_SWAP_NOSTR_KEY_DIR: '/data/nostr',
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
            message: `BLAKE Swap engine import failed: ${result.stderr}`,
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
