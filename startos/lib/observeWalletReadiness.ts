import {
  getWalletSigningCapability,
  WalletSigningCapability,
} from './walletSigningCapability'
import {
  emptyWalletReadinessObservation,
  WalletReadinessObservation,
} from './walletReadinessObservation'

type RunJson = (command: string[]) => Promise<unknown>

export type WalletObserverInput = {
  cli: string
  wallet: string
  env: string[]
}

export async function observeWalletReadiness(
  runJson: RunJson,
  input: WalletObserverInput,
): Promise<WalletReadinessObservation> {
  const wallet = input.wallet.trim()

  if (!wallet) {
    return emptyWalletReadinessObservation()
  }

  const walletDir = (await runJson([
    'env',
    ...input.env,
    input.cli,
    'listwalletdir',
  ])) as {
    wallets?: Array<{ name?: string }>
  }

  const loadedWallets = (await runJson([
    'env',
    ...input.env,
    input.cli,
    'listwallets',
  ])) as unknown[]

  const exists =
    Array.isArray(walletDir.wallets) &&
    walletDir.wallets.some((item) => item?.name === wallet)

  const loaded = Array.isArray(loadedWallets) && loadedWallets.includes(wallet)

  let signing: WalletSigningCapability = {
    privateKeysEnabled: null,
    externalSigner: null,
    signingBackendAvailable: null,
  }

  if (loaded) {
    const walletInfo = (await runJson([
      'env',
      ...input.env,
      input.cli,
      `-rpcwallet=${wallet}`,
      'getwalletinfo',
    ])) as Record<string, unknown>

    signing = getWalletSigningCapability(walletInfo)
  }

  return {
    wallet,
    configured: true,
    exists,
    loaded,
    signing,
  }
}
