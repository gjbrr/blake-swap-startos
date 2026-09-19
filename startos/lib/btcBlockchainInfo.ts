import { sdk } from '../sdk'
import { btcProvider } from '../file-models/btcProvider'

export type BtcBlockchainInfoResult = {
  chain: unknown
  blocks: unknown
  headers: unknown
  verificationprogress: unknown
  initialblockdownload: unknown
}

export class BtcBlockchainInfoError extends Error {
  constructor(
    readonly code: 'provider-not-configured' | 'insecure-url' | 'rpc-failed',
  ) {
    super(code)
  }
}

export async function getBtcBlockchainInfo(
  effects: Parameters<typeof sdk.SubContainer.withTemp>[0],
): Promise<BtcBlockchainInfoResult> {
  const saved = await btcProvider.read().const(effects)

  if (!saved) {
    throw new BtcBlockchainInfoError('provider-not-configured')
  }

  const rpcUrl = saved.rpcUrl.trim()

  if (!rpcUrl.startsWith('https://')) {
    throw new BtcBlockchainInfoError('insecure-url')
  }

  try {
    return await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      sdk.Mounts.of(),
      'btc-getblockchaininfo',
      async (sub) => {
        const python = `
import base64
import json
import ssl
import sys
import urllib.request

rpc_url = sys.argv[1]

connection_input = json.loads(sys.stdin.read())
rpc_username = connection_input["username"]
rpc_password = connection_input["password"]
trusted_ca_pem = connection_input["trustedCaPem"]

ssl_context = ssl.create_default_context()
ssl_context.load_verify_locations(cadata=trusted_ca_pem)

request_body = json.dumps({
    "jsonrpc": "1.0",
    "id": "blake-swap-startos-btc-blockchain-info",
    "method": "getblockchaininfo",
    "params": [],
}).encode()

credentials = (rpc_username + ":" + rpc_password).encode()

req = urllib.request.Request(
    rpc_url,
    data=request_body,
    headers={
        "Content-Type": "application/json",
        "Authorization": "Basic " + base64.b64encode(credentials).decode(),
    },
    method="POST",
)

with urllib.request.urlopen(
    req,
    context=ssl_context,
    timeout=10,
) as response:
    payload = json.loads(response.read().decode())

if payload.get("error") is not None:
    raise SystemExit("BTC RPC returned an error")

info = payload["result"]

print(json.dumps({
    "chain": info.get("chain"),
    "blocks": info.get("blocks"),
    "headers": info.get("headers"),
    "verificationprogress": info.get("verificationprogress"),
    "initialblockdownload": info.get("initialblockdownload"),
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
        ) as BtcBlockchainInfoResult
      },
    )
  } catch {
    throw new BtcBlockchainInfoError('rpc-failed')
  }
}
