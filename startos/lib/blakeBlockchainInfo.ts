import { sdk } from '../sdk'

const BLAKE_PROVIDER_PACKAGE_ID = 'bitcoind'
const BLAKE_PROVIDER_RPC_HOST_ID = 'rpc'
const BLAKE_PROVIDER_RPC_INTERNAL_PORT = 8332

export type BlakeBlockchainInfoResult = {
  chain: unknown
  blocks: unknown
  headers: unknown
  verificationprogress: unknown
  initialblockdownload: unknown
}

export class BlakeBlockchainInfoError extends Error {
  constructor(readonly code: 'rpc-unavailable' | 'rpc-failed') {
    super(code)
  }
}

export async function getBlakeBlockchainInfo(
  effects: Parameters<typeof sdk.SubContainer.withTemp>[0],
): Promise<BlakeBlockchainInfoResult> {
  const rpcAddr = await sdk.host
    .getBridgeAddress(effects, {
      packageId: BLAKE_PROVIDER_PACKAGE_ID,
      hostId: BLAKE_PROVIDER_RPC_HOST_ID,
      internalPort: BLAKE_PROVIDER_RPC_INTERNAL_PORT,
      ssl: false,
    })
    .once()

  if (!rpcAddr) {
    throw new BlakeBlockchainInfoError('rpc-unavailable')
  }

  const mounts = sdk.Mounts.of().mountDependency({
    dependencyId: BLAKE_PROVIDER_PACKAGE_ID,
    volumeId: 'main',
    subpath: null,
    mountpoint: '/mnt/bitcoind',
    readonly: true,
  })

  try {
    return await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      mounts,
      'blake-getblockchaininfo',
      async (sub) => {
        const python = `
import base64
import json
import sys
import urllib.request
from pathlib import Path

rpc_addr = sys.argv[1]
cookie_path = Path("/mnt/bitcoind/.cookie")

if not cookie_path.is_file():
    raise SystemExit("BLAKE RPC cookie is unavailable")

cookie = cookie_path.read_text().strip()

request_body = json.dumps({
    "jsonrpc": "1.0",
    "id": "blake-swap-startos-blake-blockchain-info",
    "method": "getblockchaininfo",
    "params": [],
}).encode()

req = urllib.request.Request(
    "http://" + rpc_addr + "/",
    data=request_body,
    headers={
        "Content-Type": "application/json",
        "Authorization": "Basic " + base64.b64encode(cookie.encode()).decode(),
    },
    method="POST",
)

with urllib.request.urlopen(
    req,
    timeout=10,
) as response:
    payload = json.loads(response.read().decode())

if payload.get("error") is not None:
    raise SystemExit("BLAKE RPC returned an error")

info = payload["result"]

print(json.dumps({
    "chain": info.get("chain"),
    "blocks": info.get("blocks"),
    "headers": info.get("headers"),
    "verificationprogress": info.get("verificationprogress"),
    "initialblockdownload": info.get("initialblockdownload"),
}))
`.trim()

        const execResult = await sub.exec(['python3', '-c', python, rpcAddr])

        if (execResult.exitCode !== 0) {
          throw new Error('RPC failed')
        }

        return JSON.parse(
          execResult.stdout.toString(),
        ) as BlakeBlockchainInfoResult
      },
    )
  } catch {
    throw new BlakeBlockchainInfoError('rpc-failed')
  }
}
