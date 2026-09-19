import { sdk } from '../sdk'
import { i18n } from '../i18n'

const MARKER = 'blake-swap-alpha1-persistence-v1'

export const createPersistenceMarker = sdk.Action.withoutInput(
  'create-persistence-marker',

  async () => ({
    name: i18n('Create Persistence Marker'),
    description: i18n(
      'Write a harmless test marker to the persistent BLAKE Swap data volume.',
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

    const value = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      mounts,
      'create-persistence-marker',
      async (sub) => {
        const result = await sub.exec([
          'python3',
          '-c',
          [
            'from pathlib import Path',
            'p = Path("/data/persistence-marker.txt")',
            `p.write_text("${MARKER}\\n")`,
            'print(p.read_text().strip())',
          ].join('; '),
        ])

        if (result.exitCode !== 0) {
          throw new Error(i18n('Persistence marker operation failed.'))
        }

        return result.stdout.toString().trim()
      },
    )

    return {
      version: '1',
      title: i18n('BLAKE Swap Storage'),
      message: i18n('Persistence marker written successfully.'),
      result: {
        type: 'single',
        name: i18n('Marker'),
        description: null,
        value,
        masked: false,
        copyable: false,
        qr: false,
      },
    }
  },
)
