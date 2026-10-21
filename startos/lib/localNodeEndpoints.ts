export type LocalNodeEndpoint = {
  packageId: 'bitcoind' | 'knots-blake2b'
  hostId: 'rpc'
  internalPort: number
  dependencyMountpoint: string
  cookieRelativePath: string | null
}

export const LOCAL_NODE_ENDPOINTS = {
  bitcoind: {
    packageId: 'bitcoind',
    hostId: 'rpc',
    internalPort: 8332,
    dependencyMountpoint: '/mnt/bitcoind',
    cookieRelativePath: '.cookie',
  },

  'knots-blake2b': {
    packageId: 'knots-blake2b',
    hostId: 'rpc',
    internalPort: 18443,
    dependencyMountpoint: '/mnt/knots-blake2b',

    // The package config declares rpccookiefile=.cookie, but the
    // runtime datadir still needs to be verified while the service
    // is running before we make this path authoritative.
    cookieRelativePath: '.cookie',
  },
} as const satisfies Record<
  'bitcoind' | 'knots-blake2b',
  LocalNodeEndpoint
>
