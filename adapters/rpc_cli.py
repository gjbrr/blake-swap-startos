#!/usr/bin/env python3

import base64
import json
import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


class AdapterError(RuntimeError):
    pass


def parse_cli(argv):
    wallet = None
    positional = []

    for arg in argv:
        if arg.startswith("-rpcwallet="):
            if wallet is not None:
                raise AdapterError("duplicate -rpcwallet option")
            wallet = arg.split("=", 1)[1]
            if not wallet:
                raise AdapterError("empty -rpcwallet value")
            continue

        if arg.startswith("-"):
            raise AdapterError(
                f"unsupported bitcoin-cli option: {arg}"
            )

        positional.append(arg)

    if not positional:
        raise AdapterError("missing RPC method")

    method = positional[0]
    params = [
        convert_cli_arg(arg)
        for arg in positional[1:]
    ]

    return wallet, method, params


def convert_cli_arg(value):
    """
    Preserve the subset of bitcoin-cli argument conversion used by
    swap_v2.py:

      true/false/null       -> JSON scalars
      numbers               -> JSON numbers
      {...} / [...]         -> JSON objects/arrays
      everything else      -> strings

    Empty strings intentionally remain strings.
    """
    if value == "":
        return value

    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return value

    if isinstance(
        parsed,
        (bool, int, float, dict, list)
    ) or parsed is None:
        return parsed

    # JSON quoted strings should not change normal bitcoin-cli-like
    # positional string behavior for this adapter.
    return value


def wallet_rpc_url(base_url, wallet):
    if not wallet:
        return base_url

    parsed = urllib.parse.urlsplit(base_url)

    path = parsed.path.rstrip("/")
    path += "/wallet/" + urllib.parse.quote(
        wallet,
        safe="",
    )

    return urllib.parse.urlunsplit(
        (
            parsed.scheme,
            parsed.netloc,
            path,
            parsed.query,
            parsed.fragment,
        )
    )


def rpc_request(
    *,
    url,
    username,
    password,
    method,
    params,
    ssl_context=None,
):
    body = json.dumps({
        "jsonrpc": "1.0",
        "id": "blake-swap-rpc-adapter",
        "method": method,
        "params": params,
    }).encode()

    credentials = (
        username + ":" + password
    ).encode()

    req = urllib.request.Request(
        url,
        data=body,
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

    try:
        with urllib.request.urlopen(
            req,
            context=ssl_context,
            timeout=30,
        ) as response:
            payload = json.loads(
                response.read().decode()
            )

    except urllib.error.HTTPError as exc:
        # Bitcoin-family RPC servers often return useful JSON-RPC
        # error bodies with HTTP 500. Preserve only the RPC message;
        # never echo credentials.
        try:
            payload = json.loads(
                exc.read().decode()
            )
        except Exception:
            raise AdapterError(
                f"RPC HTTP failure: {exc.code}"
            ) from None

    except Exception as exc:
        raise AdapterError(
            f"RPC transport failure: {exc}"
        ) from None

    error = payload.get("error")

    if error is not None:
        if isinstance(error, dict):
            message = error.get(
                "message",
                "RPC returned an error",
            )
        else:
            message = "RPC returned an error"

        raise AdapterError(str(message))

    if "result" not in payload:
        raise AdapterError(
            "RPC response has no result"
        )

    return payload["result"]


def blake_request(wallet, method, params):
    base_url = os.environ.get(
        "BLAKE_SWAP_BLAKE_RPC_URL",
        "",
    ).strip()

    cookie_path = Path(
        os.environ.get(
            "BLAKE_SWAP_BLAKE_COOKIE_PATH",
            "/mnt/bitcoind/.cookie",
        )
    )

    if not base_url.startswith("http://"):
        raise AdapterError(
            "BLAKE RPC URL must use internal HTTP"
        )

    if not cookie_path.is_file():
        raise AdapterError(
            "BLAKE RPC cookie is unavailable"
        )

    cookie = cookie_path.read_text().strip()

    if ":" not in cookie:
        raise AdapterError(
            "BLAKE RPC cookie is malformed"
        )

    username, password = cookie.split(
        ":",
        1,
    )

    return rpc_request(
        url=wallet_rpc_url(
            base_url,
            wallet,
        ),
        username=username,
        password=password,
        method=method,
        params=params,
    )


def btc_request(wallet, method, params):
    config_path = Path(
        os.environ.get(
            "BLAKE_SWAP_BTC_PROVIDER_CONFIG",
            "/data/config/btc-provider.json",
        )
    )

    if not config_path.is_file():
        raise AdapterError(
            "BTC provider is not configured"
        )

    try:
        config = json.loads(
            config_path.read_text()
        )
    except Exception:
        raise AdapterError(
            "BTC provider configuration is invalid"
        ) from None

    try:
        rpc_url = config["rpcUrl"].strip()
        username = config["rpcUsername"]
        password = config["rpcPassword"]
        trusted_ca_pem = config[
            "trustedCaPem"
        ]
    except (KeyError, AttributeError):
        raise AdapterError(
            "BTC provider configuration is incomplete"
        ) from None

    if not rpc_url.startswith("https://"):
        raise AdapterError(
            "BTC RPC URL must use HTTPS"
        )

    context = ssl.create_default_context()

    try:
        context.load_verify_locations(
            cadata=trusted_ca_pem
        )
    except Exception:
        raise AdapterError(
            "BTC trusted CA is invalid"
        ) from None

    return rpc_request(
        url=wallet_rpc_url(
            rpc_url,
            wallet,
        ),
        username=username,
        password=password,
        method=method,
        params=params,
        ssl_context=context,
    )


def main():
    kind = os.environ.get(
        "BLAKE_SWAP_RPC_ADAPTER_KIND",
        "",
    )

    try:
        wallet, method, params = parse_cli(
            sys.argv[1:]
        )

        if kind == "blake":
            result = blake_request(
                wallet,
                method,
                params,
            )
        elif kind == "btc":
            result = btc_request(
                wallet,
                method,
                params,
            )
        else:
            raise AdapterError(
                "RPC adapter kind is invalid"
            )

        if isinstance(result, str):
            print(result)
        else:
            print(
                json.dumps(
                    result,
                    separators=(",", ":"),
                )
            )

    except AdapterError as exc:
        print(
            str(exc),
            file=sys.stderr,
        )
        raise SystemExit(1)


if __name__ == "__main__":
    main()
