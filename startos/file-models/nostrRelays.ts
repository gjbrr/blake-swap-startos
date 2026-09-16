import { FileHelper } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

export const DEFAULT_NOSTR_RELAYS = [
  'wss://TheForest.nostr1.com',
  'wss://nos.lol',
] as const

export type NostrRelayConfig = {
  relays: string[]
}

function validateNostrRelayConfig(
  value: unknown,
): NostrRelayConfig {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      'Nostr relay config must be an object',
    )
  }

  const record = value as Record<string, unknown>

  if (!Array.isArray(record.relays)) {
    throw new Error(
      'Nostr relay config field relays must be an array',
    )
  }

  if (
    record.relays.length < 1 ||
    !record.relays.every(
      relay => typeof relay === 'string',
    )
  ) {
    throw new Error(
      'Nostr relay config must contain relay URLs',
    )
  }

  return {
    relays: record.relays as string[],
  }
}

export const nostrRelays =
  FileHelper.raw<NostrRelayConfig>(
    {
      base: sdk.volumes.main,
      subpath: 'config/nostr-relays.json',
    },
    data => `${JSON.stringify(data, null, 2)}\n`,
    raw => JSON.parse(raw),
    validateNostrRelayConfig,
  )

export async function getNostrRelayEnv(
  effects: Parameters<
    typeof sdk.SubContainer.withTemp
  >[0],
): Promise<string> {
  const saved =
    await nostrRelays.read().const(effects)

  const relays =
    saved?.relays ??
    Array.from(DEFAULT_NOSTR_RELAYS)

  return `BLAKE_SWAP_NOSTR_RELAYS=${relays.join(',')}`
}
