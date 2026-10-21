import { setupManifest } from '@start9labs/start-sdk'
import { long, short } from './i18n'

export const manifest = setupManifest({
  id: 'blake-swap',
  title: 'XBT/BTC Atomic Swap',
  license: '', // Upstream license not yet established
  packageRepo: 'https://github.com/gjbrr/blake-swap-startos', // Private alpha
  upstreamRepo: 'https://github.com/gjbrr/blake-swap', // Private alpha
  marketingUrl: 'https://github.com/gjbrr/blake-swap-startos', // Temporary project page
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
      description:
        'Local Bitcoin node; chain assignment requires verification.',
      optional: true,
      s9pk: null,
    },
    'knots-blake2b': {
      description: 'Local Bitcoin Knots Blake2b Companion for the BLAKE chain.',
      optional: true,
      s9pk: null,
    },
  },
})
