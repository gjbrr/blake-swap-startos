import { sdk } from '../sdk'
import { i18n } from '../i18n'
import { btcProvider } from '../file-models/btcProvider'

export const checkBtcRpc = sdk.Action.withoutInput(
  'check-btc-rpc',

  async () => ({
    name: i18n('Check BTC RPC'),
    description: i18n(
      'Check read-only connectivity to the saved ordinary Bitcoin node using getblockchaininfo.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  async ({ effects }) => {
    const saved = await btcProvider.read().const(effects)

    if (!saved) {
      throw new Error(
        i18n('Configure the BTC provider before checking BTC RPC.'),
      )
    }

    const rpcUrl = saved.rpcUrl.trim()

    if (!rpcUrl.startsWith('https://')) {
      throw new Error(i18n('BTC RPC URL must use HTTPS.'))
    }

    const result = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      sdk.Mounts.of(),
      'check-btc-rpc',
      async sub => {
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
    "id": "blake-swap-startos-btc-check",
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

        const execResult = await sub.exec(
          ['python3', '-c', python, rpcUrl],
          {
            input: JSON.stringify({
              username: saved.rpcUsername,
              password: saved.rpcPassword,
              trustedCaPem: saved.trustedCaPem,
            }),
          },
        )

        if (execResult.exitCode !== 0) {
          throw new Error(i18n('BTC RPC check failed.'))
        }

        return JSON.parse(execResult.stdout.toString())
      },
    )

    const economicallyReady =
      result.chain === 'main' &&
      result.initialblockdownload === false

    return {
      version: '1',
      title: i18n('BTC RPC'),
      message: i18n('BTC RPC check completed successfully.'),
      result: {
        type: 'group',
        value: [
          {
            type: 'single',
            name: i18n('Chain'),
            description: null,
            value: String(result.chain),
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('Blocks'),
            description: null,
            value: String(result.blocks),
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('Headers'),
            description: null,
            value: String(result.headers),
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('Verification Progress'),
            description: null,
            value: String(result.verificationprogress),
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('Initial Block Download'),
            description: null,
            value: String(result.initialblockdownload),
            masked: false,
            copyable: false,
            qr: false,
          },
          {
            type: 'single',
            name: i18n('Economic Readiness'),
            description: null,
            value: economicallyReady
              ? i18n('Ready')
              : i18n('Not Ready'),
            masked: false,
            copyable: false,
            qr: false,
          },
        ],
      },
    }
  },
)
