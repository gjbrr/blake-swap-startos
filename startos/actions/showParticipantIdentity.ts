import { sdk } from '../sdk'
import { i18n } from '../i18n'

export const showParticipantIdentity =
  sdk.Action.withoutInput(
    'show-participant-identity',

    async () => ({
      name: i18n('Show Participant Identity'),
      description: i18n(
        'Show this BLAKE Swap installation’s public Nostr participant identity.',
      ),
      warning: i18n(
        'Only public identity information is displayed. The private participant key is never returned.',
      ),
      allowedStatuses: 'any',
      group: null,
      visibility: 'enabled',
      access: 'user',
    }),

    async ({ effects }) => {
      const mounts = sdk.Mounts.of().mountVolume({
        volumeId: 'main',
        subpath: null,
        mountpoint: '/data',
        readonly: true,
      })

      const identity =
        await sdk.SubContainer.withTemp(
          effects,
          { imageId: 'blake-swap' },
          mounts,
          'show-participant-identity',
          async sub => {
            const script = String.raw`
import json
from pathlib import Path
from coincurve import PrivateKey

CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"

def polymod(values):
    generators = [
        0x3b6a57b2,
        0x26508e6d,
        0x1ea119fa,
        0x3d4233dd,
        0x2a1462b3,
    ]
    chk = 1
    for value in values:
        top = chk >> 25
        chk = ((chk & 0x1ffffff) << 5) ^ value
        for i, generator in enumerate(generators):
            if (top >> i) & 1:
                chk ^= generator
    return chk

def hrp_expand(hrp):
    return (
        [ord(x) >> 5 for x in hrp]
        + [0]
        + [ord(x) & 31 for x in hrp]
    )

def checksum(hrp, data):
    values = hrp_expand(hrp) + data
    polymod_value = polymod(values + [0] * 6) ^ 1
    return [
        (polymod_value >> (5 * (5 - i))) & 31
        for i in range(6)
    ]

def convertbits(data, frombits, tobits, pad=True):
    acc = 0
    bits = 0
    result = []
    maxv = (1 << tobits) - 1
    max_acc = (1 << (frombits + tobits - 1)) - 1

    for value in data:
        if value < 0 or (value >> frombits):
            raise ValueError("invalid convertbits input")

        acc = ((acc << frombits) | value) & max_acc
        bits += frombits

        while bits >= tobits:
            bits -= tobits
            result.append((acc >> bits) & maxv)

    if pad:
        if bits:
            result.append((acc << (tobits - bits)) & maxv)
    elif bits >= frombits or ((acc << (tobits - bits)) & maxv):
        raise ValueError("invalid incomplete group")

    return result

def bech32_encode(hrp, payload):
    data = convertbits(payload, 8, 5, True)
    combined = data + checksum(hrp, data)
    return hrp + "1" + "".join(CHARSET[d] for d in combined)

path = Path("/data/participant.key")

if not path.exists():
    raise SystemExit(
        "Persistent participant identity is not initialized"
    )

raw = path.read_text().strip()

try:
    private_key = PrivateKey(bytes.fromhex(raw))
except Exception as exc:
    raise SystemExit(
        "Persistent participant identity is invalid"
    ) from exc

compressed = private_key.public_key.format(
    compressed=True
)

xonly = compressed[1:]

print(json.dumps({
    "hex": xonly.hex(),
    "npub": bech32_encode("npub", xonly),
}))
`

            const result = await sub.exec([
              'python3',
              '-c',
              script,
            ])

            if (result.exitCode !== 0) {
              const stderr =
                result.stderr.toString().trim()

              throw new Error(
                stderr ||
                  i18n(
                    'Participant identity could not be derived.',
                  ),
              )
            }

            let parsed: unknown

            try {
              parsed = JSON.parse(
                result.stdout.toString(),
              )
            } catch {
              throw new Error(
                i18n(
                  'Participant identity could not be derived.',
                ),
              )
            }

            if (
              typeof parsed !== 'object' ||
              parsed === null ||
              !('hex' in parsed) ||
              !('npub' in parsed)
            ) {
              throw new Error(
                i18n(
                  'Participant identity could not be derived.',
                ),
              )
            }

            const hex =
              (parsed as { hex: unknown }).hex

            const npub =
              (parsed as { npub: unknown }).npub

            if (
              typeof hex !== 'string' ||
              !/^[0-9a-f]{64}$/.test(hex) ||
              typeof npub !== 'string' ||
              !/^npub1[023456789acdefghjklmnpqrstuvwxyz]+$/.test(
                npub,
              )
            ) {
              throw new Error(
                i18n(
                  'Participant identity could not be derived.',
                ),
              )
            }

            return {
              hex,
              npub,
            }
          },
        )

      return {
        version: '1',
        title: i18n('Participant Identity'),
        message: i18n(
          'This public identity is persistent for this BLAKE Swap installation.',
        ),
        result: {
          type: 'group',
          value: [
            {
              type: 'single',
              name: i18n('Nostr Public Key (hex)'),
              description: null,
              value: identity.hex,
              masked: false,
              copyable: true,
              qr: false,
            },
            {
              type: 'single',
              name: i18n('Nostr Public Key (npub)'),
              description: null,
              value: identity.npub,
              masked: false,
              copyable: true,
              qr: true,
            },
          ],
        },
      }
    },
  )
