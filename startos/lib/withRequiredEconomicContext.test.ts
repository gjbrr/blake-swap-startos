import {
  withRequiredEconomicContext,
} from './withRequiredEconomicContext'

async function testExecutesAfterReadiness() {
  let executed = false

  const result = await withRequiredEconomicContext(
    async () => ({ ready: true }),
    async context => {
      executed = true

      if (context.ready !== true) {
        throw new Error('readiness context was lost')
      }

      return 'ok'
    },
  )

  if (!executed) {
    throw new Error('economic callback did not execute')
  }

  if (result !== 'ok') {
    throw new Error('economic callback result was lost')
  }
}

async function testFailureBlocksExecution() {
  let executed = false

  let caught: unknown = null

  try {
    await withRequiredEconomicContext(
      async () => {
        throw new Error('not ready')
      },
      async () => {
        executed = true
        return 'must-not-run'
      },
    )
  } catch (error) {
    caught = error
  }

  if (!(caught instanceof Error)) {
    throw new Error('readiness failure was not propagated')
  }

  if (caught.message !== 'not ready') {
    throw new Error('readiness failure was altered')
  }

  if (executed) {
    throw new Error(
      'economic callback ran despite readiness failure',
    )
  }
}

async function main() {
  await testExecutesAfterReadiness()
  await testFailureBlocksExecution()

  console.log(
    'PASS required economic context execution gate',
  )
}

void main()
