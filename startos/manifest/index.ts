import { setupManifest } from '@start9labs/start-sdk'
import { long, short } from './i18n'

export const manifest = setupManifest({
  id: 'blake-swap',
  title: 'BLAKE Swap',
  license: '', // Upstream license not yet established
  packageRepo: 'https://blake-swap-startos.invalid/', // Private alpha: repository not yet published
  upstreamRepo: 'https://blake-swap-upstream.invalid/', // Private alpha: upstream URL not yet established
  marketingUrl: 'https://blake-swap.invalid/', // Private alpha: project website not yet established
  donationUrl: null,
  description: { short, long },
  // 'example-volume' is an arbitrary id — name volumes whatever suits the
  // service. It must match the volumeId mounted in startos/main.ts and the
  // volume backed up in startos/backups.ts.
  volumes: ['main'],
  images: {
    // 'example-image' is an arbitrary id — it must match the imageId used in
    // startos/main.ts. TODO: replace the hello-world image with your service's
    // image — set dockerTag (or add a Dockerfile) and rename this key.
    'blake-swap': {
      source: { dockerBuild: {} },
      arch: ['x86_64'],
    },
  },
  dependencies: {
    bitcoind: {
      description: 'Provides the BLAKE/RDTS blockchain backend for BLAKE Swap.',
      optional: false,
      s9pk: null,
    },
  },
})
