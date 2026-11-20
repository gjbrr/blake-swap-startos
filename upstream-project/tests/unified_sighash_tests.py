#!/usr/bin/env python3

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import swap_v2


def der_record(hash_type):
    # A syntactically shaped DER ECDSA record: 0x30, length, R, S, then the
    # signature-hash byte. The helper does not need a real curve signature to
    # read the type.
    return bytes([0x30, 0x44]) + b"\x02\x20" + b"\x11" * 32 + b"\x02\x20" + b"\x22" * 32 + bytes([hash_type])


def p2wpkh_tx(hash_type):
    return {"vin": [{"txinwitness": [der_record(hash_type).hex(), "02" + "33" * 32]}]}


def p2wsh_tx(hash_type):
    return {
        "vin": [{
            "txinwitness": [
                "44" * 32,
                der_record(hash_type).hex(),
                "01",
                "5152",
            ],
        }],
    }


class UnifiedSighashTests(unittest.TestCase):
    def test_blake_requires_unified(self):
        swap_v2.require_funding_signature_type(p2wpkh_tx(0x21), unified=True)

        with self.assertRaises(RuntimeError):
            swap_v2.require_funding_signature_type(p2wpkh_tx(0x01), unified=True)

    def test_btc_rejects_unified(self):
        swap_v2.require_funding_signature_type(p2wpkh_tx(0x01), unified=False)

        with self.assertRaises(RuntimeError):
            swap_v2.require_funding_signature_type(p2wpkh_tx(0x21), unified=False)

    def test_p2wsh_witness(self):
        swap_v2.require_funding_signature_type(p2wsh_tx(0x21), unified=True)

    def test_no_witness_is_refused(self):
        with self.assertRaises(RuntimeError):
            swap_v2.require_funding_signature_type({"vin": [{}]}, unified=True)

    def test_walletoldsigs_is_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            conf = Path(directory) / "bitcoin.conf"
            conf.write_text("server=1\nwalletoldsigs=1\n")

            with mock.patch.object(swap_v2, "BLAKE_DATADIR", directory):
                with self.assertRaises(RuntimeError):
                    swap_v2.assert_no_walletoldsigs()

            conf.write_text("server=1\n")
            with mock.patch.object(swap_v2, "BLAKE_DATADIR", directory):
                swap_v2.assert_no_walletoldsigs()

    def test_regtest_bypass(self):
        with mock.patch.dict(os.environ, {"BLAKE_SWAP_REGTEST": "1"}):
            self.assertFalse(swap_v2.unified_sighash_required())

        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("BLAKE_SWAP_REGTEST", None)
            with mock.patch.object(swap_v2, "blake_cli", return_value={"chain": "regtest"}):
                self.assertFalse(swap_v2.unified_sighash_required())
            with mock.patch.object(swap_v2, "blake_cli", return_value={"chain": "main"}):
                self.assertTrue(swap_v2.unified_sighash_required())
            with mock.patch.object(swap_v2, "blake_cli", side_effect=RuntimeError("down")):
                self.assertTrue(swap_v2.unified_sighash_required())


if __name__ == "__main__":
    unittest.main()
