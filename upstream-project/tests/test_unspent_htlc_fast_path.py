#!/usr/bin/env python3
"""Isolated regression tests for confirmed HTLC spender discovery."""

import importlib.util
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


SRC = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(SRC))

spec = importlib.util.spec_from_file_location(
    "swap_v2_fast_path_regression",
    SRC / "swap_v2.py",
)
assert spec and spec.loader

engine = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = engine
spec.loader.exec_module(engine)


class UnspentHtlcFastPathTests(unittest.TestCase):
    def setUp(self):
        self.funding_txid = "11" * 32
        self.calls = []

        self.swap = SimpleNamespace(
            blake_funding_txid=self.funding_txid,
            blake_funding_vout=1,
            blake_funding_blockhash=None,
            blake_scan_start_height=100,
            blake_claim_txid=None,
            blake_claim_blockhash=None,
            blake_refund_txid=None,
            blake_refund_blockhash=None,
            secret_hash="22" * 32,
        )

    def test_unspent_output_skips_historical_blocks(self):
        def rpc(method, *args, **kwargs):
            self.calls.append(method)
            if method == "getblockcount":
                return 120
            if method == "gettxout":
                self.assertEqual(args, (self.funding_txid, 1, True))
                return {"value": 0.01}
            raise AssertionError(f"Unexpected RPC: {method}")

        with patch.object(engine, "blake_cli", rpc):
            result = engine.find_confirmed_htlc_spend(
                self.swap, "blake"
            )

        self.assertIsNone(result)
        self.assertNotIn("getblockhash", self.calls)
        self.assertNotIn("getblock", self.calls)

    def test_rpc_failure_does_not_authorize_fast_path(self):
        def rpc(method, *args, **kwargs):
            self.calls.append(method)
            if method == "getblockcount":
                return 120
            if method == "gettxout":
                raise RuntimeError("BLAKE RPC unavailable")
            raise AssertionError(f"Unexpected RPC: {method}")

        with patch.object(engine, "blake_cli", rpc):
            with self.assertRaisesRegex(
                RuntimeError, "BLAKE RPC unavailable"
            ):
                engine.find_confirmed_htlc_spend(self.swap, "blake")

        self.assertNotIn("getblockhash", self.calls)

    def test_spent_output_preserves_historical_scan(self):
        blockhash = "33" * 32

        def rpc(method, *args, **kwargs):
            self.calls.append(method)
            if method == "getblockcount":
                return 100
            if method == "gettxout":
                return None
            if method == "getblockhash":
                self.assertEqual(args, (100,))
                return blockhash
            if method == "getblock":
                self.assertEqual(args, (blockhash, 2))
                return {"tx": []}
            raise AssertionError(f"Unexpected RPC: {method}")

        with patch.object(engine, "blake_cli", rpc):
            with self.assertRaisesRegex(
                RuntimeError, "outpoint is unavailable"
            ):
                engine.find_confirmed_htlc_spend(self.swap, "blake")

        self.assertIn("getblockhash", self.calls)
        self.assertIn("getblock", self.calls)

    def test_invalid_rpc_response_fails_closed(self):
        def rpc(method, *args, **kwargs):
            if method == "getblockcount":
                return 120
            if method == "gettxout":
                return "unexpected response"
            raise AssertionError(f"Unexpected RPC: {method}")

        with patch.object(engine, "blake_cli", rpc):
            with self.assertRaisesRegex(
                RuntimeError, "invalid HTLC gettxout response"
            ):
                engine.find_confirmed_htlc_spend(self.swap, "blake")


if __name__ == "__main__":
    unittest.main(verbosity=2)
