import { sdk } from '../sdk'
import { i18n } from '../i18n'

export const verifyEngine = sdk.Action.withoutInput(
  'verify-engine',

  async () => ({
    name: i18n('Verify Engine'),
    description: i18n(
      'Verify that the packaged BLAKE Swap engine can be imported successfully.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  async ({ effects }) => {
    const mounts = sdk.Mounts.of().mountVolume({
      volumeId: 'main',
      subpath: null,
      mountpoint: '/data',
      readonly: false,
    })

    const stdout = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      mounts,
      'verify-engine',
      async sub => {
        const result = await sub.exec([
          'python3',
          '-c',
          'import swap_v2; print("BLAKE Swap engine import succeeded")',
        ])

        if (result.exitCode !== 0) {
          throw new Error(
            `Engine verification failed: ${result.stderr.toString()}`,
          )
        }

        return result.stdout.toString().trim()
      },
    )

    return {
      version: '1',
      title: i18n('BLAKE Swap Engine'),
      message: i18n('Engine verification completed successfully.'),
      result: {
        type: 'single',
        name: i18n('Result'),
        description: null,
        value: stdout,
        masked: false,
        copyable: false,
        qr: false,
      },
    }
  },
)
