import { sdk } from '../sdk'
import { i18n } from '../i18n'

const MARKER = 'blake-swap-alpha1-persistence-v1'

export const verifyPersistenceMarker = sdk.Action.withoutInput(
  'verify-persistence-marker',

  async () => ({
    name: i18n('Verify Persistence Marker'),
    description: i18n(
      'Confirm that the BLAKE Swap persistence test marker still exists.',
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
      readonly: true,
    })

    const value = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      mounts,
      'verify-persistence-marker',
      async sub => {
        const result = await sub.exec([
          'python3',
          '-c',
          [
            'from pathlib import Path',
            'p = Path("/data/persistence-marker.txt")',
            `expected = "${MARKER}"`,
            'actual = p.read_text().strip() if p.exists() else ""',
            'raise SystemExit(0 if actual == expected else 1)',
          ].join('; '),
        ])

        if (result.exitCode !== 0) {
          throw new Error(
            i18n('Persistence marker is missing or invalid.'),
          )
        }

        return MARKER
      },
    )

    return {
      version: '1',
      title: i18n('BLAKE Swap Storage'),
      message: i18n('Persistence marker verified successfully.'),
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
