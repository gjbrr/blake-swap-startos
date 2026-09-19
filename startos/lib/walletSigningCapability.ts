export type WalletSigningInfo = {
  private_keys_enabled?: unknown
  external_signer?: unknown
}

export type WalletSigningCapability = {
  privateKeysEnabled: boolean | null
  externalSigner: boolean | null
  signingBackendAvailable: boolean | null
}

export function getWalletSigningCapability(
  info: WalletSigningInfo,
): WalletSigningCapability {
  const privateKeysEnabled =
    typeof info.private_keys_enabled === 'boolean'
      ? info.private_keys_enabled
      : null

  const externalSigner =
    typeof info.external_signer === 'boolean' ? info.external_signer : null

  let signingBackendAvailable: boolean | null = null

  if (privateKeysEnabled === true || externalSigner === true) {
    signingBackendAvailable = true
  } else if (privateKeysEnabled === false && externalSigner === false) {
    signingBackendAvailable = false
  }

  return {
    privateKeysEnabled,
    externalSigner,
    signingBackendAvailable,
  }
}
