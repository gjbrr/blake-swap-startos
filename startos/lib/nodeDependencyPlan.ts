import type {
  NodeProviders,
} from '../file-models/nodeProviders'
import {
  planNodeProviders,
} from './nodeProviderPlan'

export type LocalNodePackage =
  | 'bitcoind'
  | 'knots-blake2b'

export function planNodeDependencies(
  selection: NodeProviders,
): LocalNodePackage[] {
  const plan = planNodeProviders(selection)
  const required = new Set<LocalNodePackage>()

  if (plan.btc.mode === 'local') {
    required.add(plan.btc.packageId)
  }

  if (plan.blake.mode === 'local') {
    required.add(plan.blake.packageId)
  }

  return [...required].sort()
}
