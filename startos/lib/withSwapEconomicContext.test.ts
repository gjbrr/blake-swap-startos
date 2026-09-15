import {
  withSwapEconomicContext,
} from './withSwapEconomicContext'

async function testBothContextsRequired() {
  let executed = false
  let blakeChecked = false
  let btcChecked = false
  let caught: unknown = null

  try {
    await withSwapEconomicContext(
      async () => {
        blakeChecked = true
        return {} as never
      },
      async () => {
        btcChecked = true
        throw new Error('BTC not ready')
      },
      async () => {
        executed = true
        return 'must-not-run'
      },
    )
  } catch (error) {
    caught = error
  }

  if (!blakeChecked) {
    throw new Error('BLAKE readiness was not checked')
  }

  if (!btcChecked) {
    throw new Error('BTC readiness was not checked')
  }

  if (executed) {
    throw new Error(
      'economic callback ran without both contexts',
    )
  }

  if (
    !(caught instanceof Error) ||
    caught.message !== 'BTC not ready'
  ) {
    throw new Error(
      'BTC readiness failure was not propagated',
    )
  }
}

async function main() {
  await testBothContextsRequired()

  console.log(
    'PASS combined swap economic context gate',
  )
}

void main()
