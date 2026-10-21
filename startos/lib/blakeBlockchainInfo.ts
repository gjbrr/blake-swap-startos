import { sdk } from '../sdk'
import { blakeProvider } from '../file-models/blakeProvider'
import { nodeProviders } from '../file-models/nodeProviders'
import { planNodeConnections } from './nodeConnectionPlan'

export type BlakeBlockchainInfoResult = {
  chain: unknown
  blocks: unknown
  headers: unknown
  verificationprogress: unknown
  initialblockdownload: unknown
}

export class BlakeBlockchainInfoError extends Error {
  constructor(
    readonly code:
      | 'provider-not-configured'
      | 'insecure-url'
      | 'rpc-unavailable'
      | 'rpc-failed',
  ) {
    super(code)
  }
}

async function getRemoteBlakeBlockchainInfo(
  effects: Parameters<typeof sdk.SubContainer.withTemp>[0],
): Promise<BlakeBlockchainInfoResult> {
  const saved = await blakeProvider.read().const(effects)

  if (!saved) {
    throw new BlakeBlockchainInfoError('provider-not-configured')
  }

  const rpcUrl = saved.rpcUrl.trim()

  if (!rpcUrl.startsWith('https://')) {
    throw new BlakeBlockchainInfoError('insecure-url')
  }

  try {
    return await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      sdk.Mounts.of(),
      'blake-getblockchaininfo-remote',
      async (sub) => {
        const python = `
import base64
import json
import ssl
import sys
import urllib.request

rpc_url = sys.argv[1]

connection = json.loads(sys.stdin.read())
username = connection["username"]
password = connection["password"]
trusted_ca_pem = connection["trustedCaPem"]

ssl_context = ssl.create_default_context()
ssl_context.load_verify_locations(
    cadata=trusted_ca_pem
)

request_body = json.dumps({
    "jsonrpc": "1.0",
    "id": "blake-swap-startos-blake-remote",
    "method": "getblockchaininfo",
    "params": [],
}).encode()

credentials = (
    username + ":" + password
).encode()

req = urllib.request.Request(
    rpc_url,
    data=request_body,
    headers={
        "Content-Type": "application/json",
        "Authorization": (
            "Basic "
            + base64.b64encode(
                credentials
            ).decode()
        ),
    },
    method="POST",
)

with urllib.request.urlopen(
    req,
    context=ssl_context,
    timeout=10,
) as response:
    payload = json.loads(
        response.read().decode()
    )

if payload.get("error") is not None:
    raise SystemExit(
        "BLAKE RPC returned an error"
    )

info = payload["result"]

print(json.dumps({
    "chain": info.get("chain"),
    "blocks": info.get("blocks"),
    "headers": info.get("headers"),
    "verificationprogress":
        info.get("verificationprogress"),
    "initialblockdownload":
        info.get("initialblockdownload"),
}))
`.trim()

        const execResult = await sub.exec(['python3', '-c', python, rpcUrl], {
          input: JSON.stringify({
            username: saved.rpcUsername,
            password: saved.rpcPassword,
            trustedCaPem: saved.trustedCaPem,
          }),
        })

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

async function getLocalBlakeBlockchainInfo(
  effects: Parameters<typeof sdk.SubContainer.withTemp>[0],
  connection: Extract<
    ReturnType<typeof planNodeConnections>['blake'],
    { mode: 'local' }
  >,
): Promise<BlakeBlockchainInfoResult> {
  const rpcAddr = await sdk.host
    .getBridgeAddress(effects, {
      packageId: connection.packageId,
      hostId: connection.hostId,
      internalPort: connection.internalPort,
      ssl: false,
    })
    .once()

  if (!rpcAddr) {
    throw new BlakeBlockchainInfoError('rpc-unavailable')
  }

  /*
   * Do not guess the Companion cookie location.
   * localNodeEndpoints.ts deliberately leaves it null
   * until verified against the running package.
   */
  if (!connection.cookieRelativePath) {
    throw new BlakeBlockchainInfoError('rpc-unavailable')
  }

  const mountpoint = connection.dependencyMountpoint

  const mounts = sdk.Mounts.of().mountDependency({
    dependencyId: connection.packageId,
    volumeId: 'main',
    subpath: null,
    mountpoint,
    readonly: true,
  })

  try {
    return await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      mounts,
      'blake-getblockchaininfo-local',
      async (sub) => {
        const python = `
import base64
import json
import sys
import urllib.request
from pathlib import Path

rpc_addr = sys.argv[1]
cookie_path = Path(sys.argv[2])

if not cookie_path.is_file():
    raise SystemExit(
        "BLAKE RPC cookie is unavailable"
    )

cookie = cookie_path.read_text().strip()

request_body = json.dumps({
    "jsonrpc": "1.0",
    "id": "blake-swap-startos-blake-local",
    "method": "getblockchaininfo",
    "params": [],
}).encode()

req = urllib.request.Request(
    "http://" + rpc_addr + "/",
    data=request_body,
    headers={
        "Content-Type": "application/json",
        "Authorization": (
            "Basic "
            + base64.b64encode(
                cookie.encode()
            ).decode()
        ),
    },
    method="POST",
)

with urllib.request.urlopen(
    req,
    timeout=10,
) as response:
    payload = json.loads(
        response.read().decode()
    )

if payload.get("error") is not None:
    raise SystemExit(
        "BLAKE RPC returned an error"
    )

info = payload["result"]

print(json.dumps({
    "chain": info.get("chain"),
    "blocks": info.get("blocks"),
    "headers": info.get("headers"),
    "verificationprogress":
        info.get("verificationprogress"),
    "initialblockdownload":
        info.get("initialblockdownload"),
}))
`.trim()

        const cookiePath = `${mountpoint}/${connection.cookieRelativePath}`

        const execResult = await sub.exec([
          'python3',
          '-c',
          python,
          rpcAddr,
          cookiePath,
        ])

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

export async function getBlakeBlockchainInfo(
  effects: Parameters<typeof sdk.SubContainer.withTemp>[0],
): Promise<BlakeBlockchainInfoResult> {
  const saved = await nodeProviders.read().const(effects)

  const selection = saved ?? {
    btc: 'remote-rpc' as const,
    blake: 'local-knots-blake2b' as const,
  }

  const connection = planNodeConnections(selection).blake

  if (connection.mode === 'remote') {
    return getRemoteBlakeBlockchainInfo(effects)
  }

  return getLocalBlakeBlockchainInfo(effects, connection)
}
