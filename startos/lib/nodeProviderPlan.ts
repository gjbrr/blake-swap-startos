import type {
  NodeProviders,
} from '../file-models/nodeProviders'

export type ProviderEndpoint =
  | {
      mode: 'local'
      packageId: 'bitcoind' | 'knots-blake2b'
    }
  | {
      mode: 'remote'
    }

export type NodeProviderPlan = {
  btc: ProviderEndpoint
  blake: ProviderEndpoint
}

export function planNodeProviders(
  selection: NodeProviders,
): NodeProviderPlan {
  if (
    selection.btc === 'local-bitcoind' &&
    selection.blake === 'local-bitcoind'
  ) {
    throw new Error(
      'The same local bitcoind instance cannot serve both chains.',
    )
  }

  const btc: ProviderEndpoint =
    selection.btc === 'local-bitcoind'
      ? { mode: 'local', packageId: 'bitcoind' }
      : { mode: 'remote' }

  let blake: ProviderEndpoint

  switch (selection.blake) {
    case 'local-bitcoind':
      blake = {
        mode: 'local',
        packageId: 'bitcoind',
      }
      break

    case 'local-knots-blake2b':
      blake = {
        mode: 'local',
        packageId: 'knots-blake2b',
      }
      break

    case 'remote-rpc':
      blake = { mode: 'remote' }
      break

    default:
      throw new Error('Unsupported BLAKE provider')
  }

  return { btc, blake }
}
