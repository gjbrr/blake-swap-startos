import { sdk } from '../sdk'
import { i18n } from '../i18n'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  rpcUrl: Value.text({
    name: i18n('BTC RPC URL'),
    description: i18n(
      'HTTPS URL for an ordinary Bitcoin RPC endpoint.',
    ),
    required: true,
    default: null,
    placeholder: 'https://bitcoin-rpc.example:8332/',
    masked: false,
  }),

  rpcUsername: Value.text({
    name: i18n('BTC RPC Username'),
    description: i18n(
      'RPC username for the ordinary Bitcoin node.',
    ),
    required: true,
    default: null,
    masked: false,
  }),

  rpcPassword: Value.text({
    name: i18n('BTC RPC Password'),
    description: i18n(
      'RPC password used only for this connectivity check and not saved by BLAKE Swap.',
    ),
    required: true,
    default: null,
    masked: true,
  }),
})

export const checkBtcRpc = sdk.Action.withInput(
  'check-btc-rpc',

  async () => ({
    name: i18n('Check BTC RPC'),
    description: i18n(
      'Check read-only connectivity to an ordinary Bitcoin node using getblockchaininfo.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  inputSpec,

  async () => ({}),

  async ({ effects, input }) => {
    const rpcUrl = input.rpcUrl.trim()

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
import sys
import urllib.request

rpc_url = sys.argv[1]

credentials_input = json.loads(sys.stdin.read())
rpc_username = credentials_input["username"]
rpc_password = credentials_input["password"]

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

with urllib.request.urlopen(req, timeout=10) as response:
    payload = json.loads(response.read().decode())

if payload.get("error") is not None:
    raise SystemExit("BTC RPC returned an error")

info = payload["result"]

print(json.dumps({
    "chain": info.get("chain"),
    "blocks": info.get("blocks"),
    "headers": info.get("headers"),
    "verificationprogress": info.get("verificationprogress"),
}))
`.trim()

        const execResult = await sub.exec(
          [
            'python3',
            '-c',
            python,
            rpcUrl,
          ],
          {
            input: JSON.stringify({
              username: input.rpcUsername,
              password: input.rpcPassword,
            }),
          },
        )

        if (execResult.exitCode !== 0) {
          throw new Error(i18n('BTC RPC check failed.'))
        }

        return JSON.parse(execResult.stdout.toString())
      },
    )

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
        ],
      },
    }
  },
)
