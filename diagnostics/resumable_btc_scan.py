#!/usr/bin/env python3
"""Read-only, resumable BTC funding discovery diagnostic.

Never modifies swap records and never authorizes economic actions.
"""
import fcntl
import json
import os
import re
import sys
import time
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, "/opt/blake-swap/src")

from swap_v2 import (
    btc_cli,
    load_swap,
    get_btc_contract_descriptor,
    derive_btc_contract_address,
)

SWAP_ID = os.environ.get("BLAKE_SWAP_DIAGNOSTIC_SWAP_ID", "").strip().lower()

if not re.fullmatch(r"[0-9a-f]{12}", SWAP_ID):
    raise RuntimeError(
        "BLAKE_SWAP_DIAGNOSTIC_SWAP_ID must be a 12-character hexadecimal swap ID"
    )
BATCH_SIZE = 10

root = Path("/data/diagnostics")
progress_path = root / f"btc-funding-{SWAP_ID}.json"
lock_path = root / f"btc-funding-{SWAP_ID}.lock"


def rpc(method, *args):
    return btc_cli(method, *args)


def persist(data):
    temporary = progress_path.with_suffix(".json.tmp")
    with temporary.open("w") as stream:
        json.dump(data, stream, indent=2, sort_keys=True)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, progress_path)


def check_match(item, start, end, address, sats):
    if not isinstance(item, dict):
        raise RuntimeError("Invalid funding match object")

    if item.get("address") != address:
        raise RuntimeError("Funding address mismatch")

    height = item.get("height")
    vout = item.get("vout")

    if type(height) is not int or not start <= height <= end:
        raise RuntimeError("Funding match height invalid")

    if type(vout) is not int or vout < 0:
        raise RuntimeError("Funding output index invalid")

    for field in ("txid", "blockhash"):
        value = item.get(field)
        if not isinstance(value, str) or not re.fullmatch(
            r"[a-fA-F0-9]{64}", value
        ):
            raise RuntimeError(f"Invalid funding {field}")

    value = Decimal(str(item["value"])) * Decimal(100_000_000)

    if value != Decimal(sats):
        raise RuntimeError("Funding amount mismatch")

    return {
        "txid": item["txid"],
        "vout": vout,
        "blockhash": item["blockhash"],
        "height": height,
    }


def run():
    root.mkdir(parents=True, exist_ok=True)

    with lock_path.open("a+") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)

        swap = load_swap(SWAP_ID, role="alice")

        anchor = swap.btc_scan_start_height
        if type(anchor) is not int or anchor < 0:
            raise RuntimeError("Invalid or missing BTC scan anchor")

        address = derive_btc_contract_address(
            get_btc_contract_descriptor(swap)
        )
        sats = int(swap.btc_sats)
        amount = format(
            Decimal(sats) / Decimal(100_000_000), "f"
        )

        tip = int(rpc("getblockcount"))
        genesis_hash = rpc("getblockhash", 0)
        anchor_hash = rpc("getblockhash", anchor)

        if progress_path.exists():
            progress = json.loads(progress_path.read_text())

            expected = {
                "swap_id": SWAP_ID,
                "anchor": anchor,
                "anchor_hash": anchor_hash,
                "genesis_hash": genesis_hash,
                "address": address,
                "sats": sats,
            }

            for key, value in expected.items():
                if progress.get(key) != value:
                    raise RuntimeError(
                        f"Progress context changed: {key}. "
                        "Refusing to reuse historical results."
                    )

            target = progress["target"]
            next_height = progress["next_height"]

            if type(target) is not int or type(next_height) is not int:
                raise RuntimeError("Invalid progress heights")

            if not anchor <= next_height <= target + 1:
                raise RuntimeError("Progress height out of range")

            if tip < target:
                raise RuntimeError("Node tip moved behind scan target")

            if rpc("getblockhash", target) != progress["target_hash"]:
                raise RuntimeError(
                    "Target block hash changed; possible reorganization. "
                    "Previous scan cannot be trusted."
                )

            if next_height > anchor:
                previous = next_height - 1
                if rpc("getblockhash", previous) != progress["last_hash"]:
                    raise RuntimeError(
                        "Scan checkpoint hash changed. "
                        "Possible reorganization; refusing to continue."
                    )
        else:
            target = tip

            progress = {
                "version": 1,
                "swap_id": SWAP_ID,
                "anchor": anchor,
                "anchor_hash": anchor_hash,
                "genesis_hash": genesis_hash,
                "address": address,
                "sats": sats,
                "target": target,
                "target_hash": rpc("getblockhash", target),
                "next_height": anchor,
                "last_hash": None,
                "matches": [],
            }
            next_height = anchor

        print("RESUMABLE BTC FUNDING SCAN")
        print("==========================")
        print("Swap:", SWAP_ID)
        print("Original anchor:", anchor)
        print("Fixed scan target:", target)
        print("Current node tip:", tip)
        print("Previously completed blocks:", next_height - anchor)

        if next_height <= target:
            end = min(next_height + BATCH_SIZE - 1, target)

            print("Scanning:", next_height, "through", end)
            started = time.monotonic()

            results = rpc(
                "scan-funding-range",
                next_height,
                end,
                address,
                amount,
            )

            if not isinstance(results, list):
                raise RuntimeError("Invalid batch response")

            verified = [
                check_match(item, next_height, end, address, sats)
                for item in results
            ]

            # Cross-check the block identities supplied by the adapter.
            for item in verified:
                if rpc("getblockhash", item["height"]) != item["blockhash"]:
                    raise RuntimeError("Funding match block hash mismatch")

            final_hash = rpc("getblockhash", end)

            seen = {
                (item["txid"], item["vout"])
                for item in progress["matches"]
            }

            for item in verified:
                key = (item["txid"], item["vout"])
                if key in seen:
                    raise RuntimeError("Duplicate funding outpoint")
                seen.add(key)

            # Persist only after the entire batch succeeds.
            progress["matches"].extend(verified)
            progress["next_height"] = end + 1
            progress["last_hash"] = final_hash
            persist(progress)

            print("Batch elapsed seconds:", round(
                time.monotonic() - started, 3
            ))

        completed = progress["next_height"] > target
        count = len(progress["matches"])

        print("Blocks verified:", progress["next_height"] - anchor)
        print("Total blocks in target:", target - anchor + 1)
        print("Funding matches accumulated:", count)
        print("Historical scan complete:", completed)

        if completed:
            print("COMPLETE THROUGH FIXED TARGET:", target)
            if count == 0:
                print("No matching confirmed funding in scanned range.")
            elif count == 1:
                print("One candidate funding output discovered.")
                print("TXID:", progress["matches"][0]["txid"])
            else:
                print("WARNING: Ambiguous funding outputs:", count)
        else:
            print("INCOMPLETE: No funding-absence conclusion permitted.")

        print()
        print("READ-ONLY DIAGNOSTIC: swap state unchanged.")
        print("NO FUNDING, CLAIM, OR REFUND AUTHORIZED.")


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:
        print(f"DIAGNOSTIC ERROR: {type(exc).__name__}: {exc}")
        sys.exit(1)
