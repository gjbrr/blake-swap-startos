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

        # swap_v2.py intentionally speaks a bitcoin-cli-compatible
        # command-line contract. Inside StartOS, chain selection and
        # connection details come from the package RPC configuration,
        # so these bitcoin-cli transport options are compatibility
        # no-ops rather than RPC parameters.
        if arg == "-regtest":
            continue

        if arg.startswith("-datadir="):
            if not arg.split("=", 1)[1]:
                raise AdapterError("empty -datadir value")
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


def rpc_batch_request(
    *,
    url,
    username,
    password,
    calls,
    ssl_context=None,
):
    """
    Execute multiple JSON-RPC calls in one HTTP request.

    calls is a sequence of:
        (method, params)

    Results are returned in the same order as calls.
    """
    if not calls:
        return []

    request_body = []

    for index, (method, params) in enumerate(calls):
        request_body.append({
            "jsonrpc": "1.0",
            "id": f"blake-swap-batch-{index}",
            "method": method,
            "params": params,
        })

    body = json.dumps(
        request_body
    ).encode()

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

    if not isinstance(payload, list):
        raise AdapterError(
            "RPC batch response is not a list"
        )

    by_id = {}

    for item in payload:
        if not isinstance(item, dict):
            raise AdapterError(
                "RPC batch response item is invalid"
            )

        response_id = item.get("id")

        if response_id is None:
            raise AdapterError(
                "RPC batch response has no id"
            )

        by_id[str(response_id)] = item

    results = []

    for index in range(len(calls)):
        response_id = f"blake-swap-batch-{index}"

        if response_id not in by_id:
            raise AdapterError(
                "RPC batch response is incomplete"
            )

        item = by_id[response_id]
        error = item.get("error")

        if error is not None:
            if isinstance(error, dict):
                message = error.get(
                    "message",
                    "RPC returned an error",
                )
            else:
                message = "RPC returned an error"

            raise AdapterError(str(message))

        if "result" not in item:
            raise AdapterError(
                "RPC batch response has no result"
            )

        results.append(item["result"])

    return results


def btc_connection():
    """
    Load the configured external Bitcoin RPC connection once.

    Returns:
        (rpc_url, username, password, ssl_context)
    """
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

    return (
        rpc_url,
        username,
        password,
        context,
    )


def btc_scan_funding_range(
    wallet,
    start_height,
    end_height,
    expected_address,
    expected_amount,
):
    """
    Search a small, bounded block-height range for outputs paying exactly
    expected_amount BTC to expected_address.

    This deliberately performs the entire forensic search inside one
    adapter process. Block hashes are fetched in one batch and decoded
    blocks are fetched in small batches so memory remains bounded.
    """
    try:
        start_height = int(start_height)
        end_height = int(end_height)

        from decimal import Decimal

        expected_sats = int(
            Decimal(str(expected_amount))
            * Decimal(100_000_000)
        )
    except (TypeError, ValueError):
        raise AdapterError(
            "invalid funding scan arguments"
        ) from None

    if start_height < 0:
        raise AdapterError(
            "funding scan start height is invalid"
        )

    if end_height < start_height:
        return []

    # This command is intentionally for small protocol windows, not
    # arbitrary historical rescans.
    block_count = end_height - start_height + 1

    if block_count > 256:
        raise AdapterError(
            "funding scan range exceeds 256 blocks"
        )

    (
        rpc_url,
        username,
        password,
        context,
    ) = btc_connection()

    url = wallet_rpc_url(
        rpc_url,
        wallet,
    )

    heights = list(
        range(
            start_height,
            end_height + 1,
        )
    )

    blockhashes = rpc_batch_request(
        url=url,
        username=username,
        password=password,
        ssl_context=context,
        calls=[
            (
                "getblockhash",
                [height],
            )
            for height in heights
        ],
    )

    matches = []

    # Four decoded blocks per HTTPS request keeps the number of round
    # trips low without constructing one enormous 22-block JSON object.
    batch_size = 4

    for offset in range(
        0,
        len(blockhashes),
        batch_size,
    ):
        hash_batch = blockhashes[
            offset:offset + batch_size
        ]

        block_batch = rpc_batch_request(
            url=url,
            username=username,
            password=password,
            ssl_context=context,
            calls=[
                (
                    "getblock",
                    [blockhash, 2],
                )
                for blockhash in hash_batch
            ],
        )

        for relative_index, block in enumerate(
            block_batch
        ):
            height = heights[
                offset + relative_index
            ]

            blockhash = hash_batch[
                relative_index
            ]

            if not isinstance(block, dict):
                raise AdapterError(
                    "decoded block response is invalid"
                )

            for tx in block.get("tx", []):
                if not isinstance(tx, dict):
                    continue

                txid = tx.get("txid")

                if not isinstance(txid, str):
                    continue

                for output in tx.get("vout", []):
                    if not isinstance(output, dict):
                        continue

                    value = output.get("value")

                    try:
                        actual_sats = int(
                            Decimal(str(value))
                            * Decimal(100_000_000)
                        )
                    except (TypeError, ValueError):
                        continue

                    if actual_sats != expected_sats:
                        continue

                    script = output.get(
                        "scriptPubKey",
                        {},
                    )

                    if not isinstance(script, dict):
                        continue

                    addresses = []

                    address = script.get("address")

                    if isinstance(address, str):
                        addresses.append(address)

                    old_addresses = script.get(
                        "addresses"
                    )

                    if isinstance(
                        old_addresses,
                        list,
                    ):
                        addresses.extend(
                            item
                            for item
                            in old_addresses
                            if isinstance(
                                item,
                                str,
                            )
                        )

                    if expected_address not in addresses:
                        continue

                    matches.append({
                        "txid": txid,
                        "vout": output.get("n"),
                        "blockhash": blockhash,
                        "height": height,
                        "value": value,
                        "address": expected_address,
                    })

    return matches



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
    (
        rpc_url,
        username,
        password,
        context,
    ) = btc_connection()

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
            if method == "scan-funding-range":
                if len(params) != 4:
                    raise AdapterError(
                        "scan-funding-range requires "
                        "START END ADDRESS AMOUNT"
                    )

                result = btc_scan_funding_range(
                    wallet,
                    params[0],
                    params[1],
                    params[2],
                    params[3],
                )
            else:
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
