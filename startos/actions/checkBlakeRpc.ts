import { sdk } from '../sdk'
import { i18n } from '../i18n'

const BLAKE_PROVIDER_PACKAGE_ID = 'bitcoind'
const BLAKE_PROVIDER_RPC_HOST_ID = 'rpc'
const BLAKE_PROVIDER_RPC_INTERNAL_PORT = 8332

export const checkBlakeRpc = sdk.Action.withoutInput(
  'check-blake-rpc',

  async () => ({
    name: i18n('Check BLAKE RPC'),
    description: i18n(
      'Check read-only connectivity to the BLAKE/RDTS service using getblockchaininfo.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
    access: 'user',
  }),

  async ({ effects }) => {
    const rpcAddr = await sdk.host
      .getBridgeAddress(effects, {
        packageId: BLAKE_PROVIDER_PACKAGE_ID,
        hostId: BLAKE_PROVIDER_RPC_HOST_ID,
        internalPort: BLAKE_PROVIDER_RPC_INTERNAL_PORT,
        ssl: false,
      })
      .once()

    if (!rpcAddr) {
      throw new Error(i18n('BLAKE RPC is unavailable.'))
    }

    const mounts = sdk.Mounts.of().mountDependency({
      dependencyId: BLAKE_PROVIDER_PACKAGE_ID,
      volumeId: 'main',
      subpath: null,
      mountpoint: '/mnt/bitcoind',
      readonly: true,
    })

    const result = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'blake-swap' },
      mounts,
      'check-blake-rpc',
      async sub => {
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
    "id": "blake-swap-startos-check",
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

with urllib.request.urlopen(req, timeout=10) as response:
    payload = json.loads(response.read().decode())

if payload.get("error") is not None:
    raise SystemExit("BLAKE RPC returned an error")

info = payload["result"]

print(json.dumps({
    "chain": info.get("chain"),
    "blocks": info.get("blocks"),
    "headers": info.get("headers"),
    "verificationprogress": info.get("verificationprogress"),
}))
`.trim()

        const execResult = await sub.exec([
          'python3',
          '-c',
          python,
          rpcAddr,
        ])

        if (execResult.exitCode !== 0) {
          throw new Error(i18n('BLAKE RPC check failed.'))
        }

        return JSON.parse(execResult.stdout.toString())
      },
    )

    return {
      version: '1',
      title: i18n('BLAKE RPC'),
      message: i18n('BLAKE RPC check completed successfully.'),
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
