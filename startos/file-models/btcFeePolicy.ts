import { FileHelper } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

export type BtcFeePolicy = {
  feeRateSatVb: string | null
}

function validateBtcFeePolicy(value: unknown): BtcFeePolicy {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('BTC fee policy must be an object')
  }

  const record = value as Record<string, unknown>
  const feeRateSatVb = record.feeRateSatVb

  if (feeRateSatVb !== null && typeof feeRateSatVb !== 'string') {
    throw new Error(
      'BTC fee policy field feeRateSatVb must be a string or null',
    )
  }

  return {
    feeRateSatVb,
  }
}

export const btcFeePolicy = FileHelper.raw<BtcFeePolicy>(
  {
    base: sdk.volumes.main,
    subpath: 'config/btc-fee-policy.json',
  },
  (data) => `${JSON.stringify(data, null, 2)}\n`,
  (raw) => JSON.parse(raw),
  validateBtcFeePolicy,
)

export async function getBtcFeePolicyEnv(
  effects: Parameters<typeof sdk.SubContainer.withTemp>[0],
): Promise<string[]> {
  const saved = await btcFeePolicy.read().const(effects)

  const rate = saved?.feeRateSatVb?.trim() ?? ''

  if (!rate) {
    return []
  }

  return [`BLAKE_SWAP_BTC_SPEND_FEE_RATE_SAT_VB=${rate}`]
}
