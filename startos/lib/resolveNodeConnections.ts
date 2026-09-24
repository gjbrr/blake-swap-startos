import { nodeProviders } from '../file-models/nodeProviders'
import {
  planNodeConnections,
  type NodeConnectionPlan,
} from './nodeConnectionPlan'
import { sdk } from '../sdk'

export class NodeConnectionResolutionError extends Error {
  constructor(readonly code:
    | 'providers-not-configured'
    | 'local-auth-unresolved'
  ) {
    super(code)
  }
}

export async function resolveNodeConnections(
  effects: Parameters<typeof sdk.SubContainer.withTemp>[0],
): Promise<NodeConnectionPlan> {
  const saved = await nodeProviders.read().const(effects)

  if (!saved) {
    throw new NodeConnectionResolutionError(
      'providers-not-configured',
    )
  }

  const plan = planNodeConnections(saved)

  for (const connection of [
    plan.btc,
    plan.blake,
  ]) {
    if (
      connection.mode === 'local' &&
      connection.cookieRelativePath === null
    ) {
      throw new NodeConnectionResolutionError(
        'local-auth-unresolved',
      )
    }
  }

  return plan
}
