# Two nodes, one copy of the pre-fork chain

`scripts/setup-shared-chain` provisions a stock Bitcoin Core node that shares
the pre-fork block files of a synced BLAKE2b Knots node.

The two chains are the same chain up to height 961639. BLAKE2b Knots switches
PoW at 961640, stock Bitcoin Core keeps SHA256d, so both nodes store the same
bytes for the first ~700 GB of history. The script verifies that per file and
links the verified ones instead of copying them.

## Disk budget

| item | shared? | mainnet size |
|---|---|---|
| `blocks/blk*.dat` verified as pre-fork | yes, one copy | ~700–750 GB |
| `blocks/blk*.dat` mixed / post-fork | no (copied or skipped) | a few hundred MB |
| `blocks/rev*.dat` (undo) | no | ~10% of blk, per node |
| `chainstate/` | no | ~13–15 GB per node |
| `blocks/index/` | no | ~10 GB per node |
| `indexes/blockfilter/basic/` | no | ~6–8 GB per node |
| `indexes/txindex/` | no, opt-in | ~45–50 GB per node |

Two full nodes with BIP-157 filters and no txindex land around 0.95–1.05 TB.
Adding `--txindex` to both costs about 90 GB more, and is only needed if
something calls `getrawtransaction` by txid (e.g. a gateway API). Compact
filters do not use the transaction index: they index scripts from block data.

## Verification, not assumptions

File numbering does not follow height: `blk*.dat` rotate at 128 MiB and blocks
are written in arrival order, so a reorg or a different peer set can shift the
fork-point data into a different file. The script therefore reads the preamble
and 80-byte header of every record in every file and checks the header proof of
work as SHA256d:

- **pure** — every block satisfies SHA256d PoW. Pre-fork history. Hardlinked
  (or reflinked) into the Core datadir; one inode, one copy on disk.
- **mixed** — contains BLAKE2b blocks. Divergent data. Copied privately, never
  linked, so nothing Core writes can touch the Knots node's file.
- **post** — no SHA256d block at all. Skipped; Core syncs its own post-fork
  chain anyway.
- the newest `blk*.dat` is always copied, because the Knots node is still
  appending to it.

Each file's block-hash digest and class go into
`<core-datadir>/blocks/.shared-chain-manifest`, so a re-run can tell whether a
source file changed.

The scan reads ~1M headers with `pread`, not the 800 GB of block payloads; a
full mainnet pass takes a few minutes.

## What is not shareable

`blocks/index/` and `chainstate/` are LevelDB and per-chain: they cannot be
hardlinked, and Core rebuilds both from the shared block files during
`-reindex`. `rev*.dat` (undo data) is per-node as well and is rebuilt too.

## The XOR key

Core 28+ XOR-obfuscates every `blk*.dat` with a per-datadir key stored in
`blocks/xor.dat`. The script copies that key into the Core datadir; Core then
reads and writes every `.dat` with it. Without the copied key the shared files
would be unreadable (and `-blocksxor=0` is refused once a random key exists).

`-reindex` is required on first start: it rebuilds Core's block index,
chainstate and filter index from the shared files, then Core syncs 961640.. from
its own peers.

## Usage

```sh
# after the Knots node has passed height 961640
scripts/setup-shared-chain --dry-run          # scan and print the plan
scripts/setup-shared-chain                    # provision ~/.bitcoin-core
bitcoind -datadir=$HOME/.bitcoin-core -reindex -daemon
bitcoin-cli -datadir=$HOME/.bitcoin-core -rpcport=8432 getblockchaininfo
```

Useful options: `--core-datadir`, `--mode hardlink|reflink`, `--rpc-port`,
`--p2p-port`, `--dbcache`, `--txindex`, `--start`.

Requirements: same filesystem for both datadirs, the Knots node running with
RPC access, `python3`, and a `bitcoin-cli` next to the Core binary.

## Watch it

```sh
bitcoin-cli -datadir=$HOME/.bitcoin-core -rpcport=8432 getblockchaininfo
tail -f ~/.bitcoin-core/debug.log
```

## Caveats

- Do not prune either node: pruning deletes files the other node links to.
- A re-run of the script after the Knots node has written more blocks will see
  the newest files changed; start from a fresh Core datadir.
- Once Core has reindexed, its own post-fork files are private to its datadir;
  nothing is shared after the fork point.
