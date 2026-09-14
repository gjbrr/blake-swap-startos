# BLAKE Swap regtest alpha design

Revised 2026-09-13 to follow the operator-driven upstream CLI. Design only:
no runtime, wallet, credential, node configuration or secret-storage changes.
This replaces the earlier local-relay and automatic-runner proposal.

## Architecture

```text
BLAKE Swap: existing CLI/engine, invoked by the operator
  +-- installed Knots/BIP110 package (operator-reported; contract unverified)
  |     +-- Bitcoin backend? -> configured node wallet
  |     +-- BLAKE backend?   -> configured node wallet
  |     process/datadir/RPC separation to be established
  +-- configured external Nostr relays   -> outbound WebSocket connections
  +-- package-owned persistent swap state and Nostr identity
```

Package Python, its existing dependencies, Bash wrappers, and the verified
Bitcoin/BLAKE CLI clients. Do not bundle node daemons, create a wallet subsystem,
require a local relay, add a web UI, or change swap protocol semantics.
The dependency count is not established: one Knots/BIP110 package may provide
both chain backends. Do not declare a second package without evidence. An optional same-server
relay is deferred; external relay URLs are ordinary upstream configuration.

The operator supplies dedicated wallet selections for the verified chain
backends and relay settings; do not assume either backend is already configured.
No wallet creation, seed generation, wallet import, unlock service, or wallet
rotation action belongs in this alpha. Node services retain wallet ownership.

## Operator-driven process model

Install/start/restart/restore must not execute `next`, `run`, `resume-all`,
funding, claims or refunds automatically. Use explicit operator invocations of
existing commands. Preserve their existing safety decisions and transaction
behavior; do not add a new settlement scheduler.

Source nuance: upstream DOES contain `scripts/blake run [seconds]`, a foreground
loop calling `next` and `resume-all`, and `command_run` can fund Bitcoin and
execute claims/refunds. Those remain operator-selected capabilities, not proof
that a StartOS installation should enable them at boot. Any future explicit
runner action needs a reviewed lifecycle; no always-running economic daemon is
selected for this first alpha.

Proposed StartOS execution mechanism: typed actions invoking existing commands
in `SubContainer.withTemp`, mounting the package data volume. The guide supports
this for one-off action commands. Verify action duration limits, cancellation,
serialization, and an action-oriented service's lifecycle against the installed
SDK before implementation. Do not introduce an idle placeholder process merely
to satisfy the scaffold. Preserve direct CLI usability if needed, but do not
invent an unattended process model to resolve a packaging limitation.

Status and diagnostics must use genuinely observational operations. `next`,
`resume`, and funding commands are not health probes. Commands may themselves
advance multiple steps after an explicit invocation: operator-driven does not
mean every internal transaction gets a new confirmation. Do not change that
upstream behavior.

## Node networking and provider contracts

Connect to the verified same-server chain RPC endpoints using bridge addresses resolved
by `sdk.host.getBridgeAddress`, with provider-exported host/port constants.
Use `.once()` in an action and `.const()` for a reactive main/init context.
No guessed assigned ports, cross-container IPs, `.startos` DNS, remote node
mode or localhost fallback. Never mount node datadirs or admin RPC cookies by
assumption. Keep RPC off public access; do not modify provider networking now.

The Bitcoin reference package inspected at commit
`015a342a608e26ef5d1300107d1dfcee96ed2c17` has ID `bitcoind`, exports `rpcHostId`
and `rpcPort`, and exports an RPC interface. An exported interface is not proof
of public internet exposure: the user's bindings determine reachability.
Equally, dialing its bridge address does not make other bindings private.
Verify the actual provider's exposure controls. An unexported binding is the
local guide's bridge-only pattern; require separate approval if meeting the
no-public-RPC constraint needs provider changes. Do not mandate a provider
rewrite merely because an exported interface exists.

Open questions that block runtime integration:

| Provider question | Current evidence / work needed |
| --- | --- |
| Which package provides the chain backends? | Operator reports installed Knots with BIP110 support and no separate BLAKE package. Exact source/version and dual-backend capability unverified. |
| Can both backends run regtest through the installed package contract? | Not established. Previously inspected package sources are not the confirmed installed BIP110 flavor. Never convert a valuable-funds node as a workaround. |
| How does a dependent obtain wallet RPC credentials? | Bitcoin has `generate-rpc-dependent`; it rejects existing usernames, so it is not an idempotent rotation API. BLAKE contract unknown. No action invoked. |
| What access can those credentials restrict? | Verify method restrictions, wallet access, credential delivery and revocation. Dedicated username does not itself provide a wallet ACL. |
| Are the existing dedicated wallets compatible and loaded? | Verify signing/descriptor support and wallet selection with the existing engine. No wallet creation or unlocking by this package. |
| Does the provider offer the required transaction/block history? | Audit RPC calls, pruning/index requirements and regtest chain persistence; do not require txindex or another setting by guesswork. |
| Can RPC remain private while used over the bridge? | Inspect actual bindings and supported provider controls; no server inspection/change has been performed. |

Least privilege is a requirement to investigate within each provider's model,
not a reason to build a new RPC proxy or impose a new wallet architecture.
If available credentials are broader than intended, explain their scope and
request acceptance before use. Do not silently use admin credentials, unload
other wallets, or reconfigure RPC allowlists.

## Existing wallet and relay configuration

Upstream currently reads ONE `BLAKE_SWAP_CHAIN_WALLET` value for both chains.
Thus two independent wallets on the node services must currently share the
configured name. The package should expose that one value honestly, not offer
two fields that the engine cannot honor. If the operator's existing dedicated
wallets have different names, flag the compatibility gap; do not create or rename
wallets, or patch upstream without approval. No particular name is forced.

Retain `BLAKE_SWAP_NOSTR_RELAYS` (comma-separated), singular fallback
`BLAKE_SWAP_NOSTR_RELAY`, and existing relay behavior. Source defaults to
`wss://nos.lol`; this is an observed default, not an endorsement or connectivity
claim. The operator can configure the relays already used with the protocol.
No relay software or StartOS relay dependency is required. StartOS outbound
connections work by default per `outbound-networking.md`; use normal container
DNS and the existing WebSocket client. Do not expose an inbound interface.

Map existing state/key paths to a package-owned persistent volume and replace
host-specific CLI/datadir defaults with verified container paths. Preserve
upstream fee, timeout, role, Nostr message and recovery semantics. Do not load
host profile scripts wholesale or inspect their secret contents.

Regtest only: both clients must select regtest explicitly; verify node chain
identity before economic invocations. BLAKE's helper forces `-regtest`, whereas
Bitcoin's helper relies on supplied arguments/config. Client flags alone do not
prove the server is regtest. This package must not offer mainnet enablement.

## Secret ownership: existing implementation

These are observed upstream formats and ownership boundaries, not a new vault
or encryption design. Static inspection covered the main engine and wrappers;
complete action/output auditing remains a prerequisite to exposure.

| Material | Existing owner and representation | Packaging treatment |
| --- | --- | --- |
| Nostr private identity key | Engine reads a 32-byte hex key from `BLAKE_SWAP_PARTICIPANT_KEY_FILE`; legacy key paths also exist. The reader requires an existing file. | Persist the existing format on the package volume. Decide provisioning/import separately before implementation; do not generate or replace it implicitly. |
| Swap hashlock preimage | Engine generates 32 random bytes in `make_swap`, saves `secret_hex` in swap JSON; recovered preimages use `revealed_secret_hex`. | Preserve upstream JSON and recovery behavior; include in backup. The hash itself is not a private key. |
| Signed refund transactions | Engine stores `<swap-id>.blake-refund.hex` and the BTC counterpart under its state directory. | Preserve as sensitive recovery artifacts, not wallet seeds; include in backup. |
| Funding intents, selections, archive, messages, Nostr cache | Engine-owned state beneath its participant state directory; not all fields are secrets. | Preserve the whole tree rather than guessing which cache is disposable. |
| Bitcoin/BLAKE wallet keys and seeds | Owned by the respective node wallets; engine asks wallet RPC to sign. | Remain in node storage and node backups. No copying/export into the swap package. |
| RPC authentication material | Provider-owned authorization; engine invokes chain CLIs with configured RPC arguments/datadirs. | Exact supported provisioning/delivery/storage contract remains unresolved. Do not invent a credential format or generation scheme. |
| Wallet unlock passwords | Node-wallet concern; no package unlock mechanism selected. | Do not collect, persist, or generate them in this alpha. |

Use ordinary restrictive file permissions and redact secrets in StartOS outputs;
no application-level encryption, extra master key, new secret format or custody
abstraction. `print_swap` currently prints `secret_hex`: blindly forwarding CLI
stdout to logs or action results would leak preimages. Audit and suppress or
redact such output in packaging, without changing the underlying protocol.

## Persistence, backup and restore

Propose one package-owned data volume containing the existing swap state tree,
Nostr key and necessary package connection settings. Final paths and RPC-secret
delivery remain subject to concrete implementation review. Do not let file-model
defaults silently regenerate missing identities or overwrite engine-owned JSON.

What StartOS already supplies: the guide's `Backups.ofVolumes` copies declared
volumes with the service stopped, then restarts it if previously running. This
protects only data actually on included volumes. The current scaffold backs up
`example-volume`, which is not yet wired to any swap state: there is no working
swap backup today. Do not claim a tested encryption or recovery guarantee from
this source review.

The intended package backup includes the existing Nostr identity, swap secrets,
refund artifacts and complete state/cache tree. If RPC credentials are later
persisted there, they are also sensitive backup contents; specify this once the
provider integration is chosen. Node wallets and regtest chain data remain the
responsibility of their respective services' backups. The inspected Bitcoin
backup uses volume snapshots with exclusions; actual wallet/regtest paths and
exclusions need verification before documenting provider recovery guarantees.

Restore should restore those files, re-resolve dependency addresses, and leave
economic operations awaiting an explicit operator command, exactly as a fresh
start does. No custom critical restore gate, restore approval state machine,
automatic reconciliation, auto-resume, wallet recreation or key regeneration.
Normal missing/invalid configuration errors still apply. Document that the
operator must use the matching node wallets and chain history and avoid running
two instances on the same identity/state. A stale snapshot cannot be described
as lossless. No new distributed duplicate-prevention mechanism is proposed.

Before implementing backup, verify commands have completed and no action writes
during a snapshot. Stopping a service alone may not serialize temporary action
containers; use supported SDK/platform behavior and verify it. Test manual
recovery with existing upstream commands after restoring consistent test data.

## Diagnostics and acceptance

Report configuration completeness, node RPC reachability, regtest identity,
configured wallet availability, and relay connection failures. Use bounded
observational probes and distinguish connectivity from settlement success.
No HTTP-port health check and no autonomous-runner heartbeat are appropriate.
Do not make public relay availability a blanket prerequisite for an operator's
chain-only recovery command when upstream does not require it.

Implementation verification, once authorized: type/bundle, reproducible image,
s9pk pack, then separately authorized regtest installation. Exercise explicit
swap commands in both directions, wrong-chain rejection, RPC failures, relay
outage behavior, redacted outputs, cancellation/concurrent action handling,
persistence and backup/manual recovery. No test should implicitly enable the
foreground runner at service startup.

## Decisions and approvals still needed

The architecture corrections are user instructions, not new approval questions.
Read-only provider-contract investigation may continue within the authorized
scope. The useful next input is the exact installed Knots/BIP110 package
version and source revision or manifest, not a separate BLAKE package.

After those facts are available, present the smallest concrete implementation
for approval covering RPC credential acquisition/access scope and any necessary
secret provisioning/persistence. Any actual node configuration changes, wallet
creation, upstream edits, server installation or publishing remain separately
unapproved. Wallet creation and local-relay support are deferred, not blockers
to package implementation if compatible existing wallets/providers are supplied.
No runtime changes are authorized by this document revision.

## Operator version clarification and proposed upgrade target

The operator reports Knots 29.3.1 with `RDTS` configured as a consensus rule.
The proposed upstream upgrade is `v29.4.1.knots20260508`, identified by these
[release notes](https://github.com/bitcoinknots/bitcoin/blob/v29.4.1.knots20260508/doc/release-notes.md).
This is an upstream software tag, not a confirmed available StartOS package.

The notes describe a backward-incompatible BLAKE2b proof-of-work change,
changes to BIP110 activation/expiry, and removal of the RDTS consent requirement.
They also flag third-party compatibility changes. Therefore this target must
not be treated as merely updating the existing node while keeping its chain
behavior unchanged. The notes' political characterization of the competing
chains is not used as a technical classification here.

This supplies evidence that the proposed release implements BLAKE2b consensus;
it does not establish concurrent BTC/BLAKE operation, regtest behavior, or
StartOS daemon/datadir/RPC topology. Those still require the exact target
package source and, where needed, the tagged node source. Existing RDTS settings
must be checked against that target rather than blindly copied.

No upgrade, binary replacement, node configuration or server access occurred.
Confirm a matching StartOS package and its migration/chain behavior before
presenting a concrete upgrade for approval. Keep this distinct from implementing
the swap package or changing its protocol.

## Provider discovery results (2026-09-13)

This section refines the open questions above with source evidence. It does not
identify installed services: no StartOS server, node RPC, credentials file or
participant profile was queried. Provider checkouts are reference sources in
`/tmp`, not installed-provider inventories.

### Providers located and target uncertainty

A bounded filesystem search for packaging markers under `/home/gary` (through
five directory levels, excluding build/dependency/cache/state directories) found
only `start9-workspace/blake-swap-startos`. No BLAKE provider package was found in
that search. The local node source/build trees and regtest datadirs do not
establish a StartOS package contract and were not treated as one. This is not a
claim about other locations. The operator subsequently confirmed that no
separate BLAKE package is installed; further searches for one are suspended.

The public Bitcoin reference repositories were fetched/refreshed:

| Source candidate | Inspected revision | Identity |
| --- | --- | --- |
| `Start9Labs/bitcoin-core-startos`, default checkout `31.x` | `015a342a608e26ef5d1300107d1dfcee96ed2c17`, package version `31.1:16` | Service ID `bitcoind` |
| `Start9Labs/bitcoin-knots-startos`, `master` | `026b5f0d53cce99858a515ee8e8639c94460ecd4`, package version `#knotsprerdts:29.3:27` | Service ID `bitcoind`; manifest identifies the pre-RDTS flavor and points to `Start9-Community/bitcoin-knots-prerdts-startos` |

The first repository advertises `28.x`, `29.x`, `30.x`, `31.x` and matching
`next/*` branches, plus legacy `0.3.5-*` branches. Only the pinned default
checkout was inspected in depth; branch presence is not proof of a published
registry release. The second repository's naming/manifest distinction is a
reason to confirm the intended flavor/version, not silently choose one.
Both reference sources share the Bitcoin service ID. They do not establish
the identity or topology of the installed Knots/BIP110 package. In particular,
the inspected Knots manifest identifies **pre-RDTS**, not the operator-reported
BIP110 flavor; its contract must not be attributed to the installed service.

### Bitcoin: verified contract

- **RPC discovery:** both inspected packages bind internal port 8332 on host
  `rpc`, exporting constants `rpcHostId` and `rpcPort`. `interfaces.ts` binds
  protocol `http` and exports an API interface. Per the SDK guide this yields
  bridge access; resolve it with `getBridgeAddress`, not a guessed host-side
  port. There is no dedicated unexported RPC binding in these files. Neither
  source inspection nor the interface label establishes the server's actual
  LAN/public bindings. Private consumption is supported; exclusive private
  exposure still requires confirmation of the deployment's provider controls.
- **Authentication:** both expose hidden `generate-rpc-dependent` through their
  actions list. It accepts a dependent-supplied username/password, runs the
  provider's rpcauth helper and stores a salted hash in provider bitcoin.conf.
  It does not hand the dependent a node cookie. The dependent needs a valid
  client password (or an already-provisioned provider-supported credential).
  Username allows alphanumerics/underscore; password allows alphanumerics,
  underscore/hyphen with minimum length 20. Existing username produces an error.
  No credentials were supplied, generated or read during discovery.
- **Privilege:** the dependent action adds rpcauth only; it does not configure
  wallet ACLs or RPC method restrictions. No typed `rpcwhitelist` contract was
  found in either inspected package. Do not present these accounts as
  least-privilege wallet-scoped credentials without further verification.
- **Pruning:** unpruned RPC reaches bitcoind on 8332. When pruning is enabled,
  bitcoind moves to loopback 58332 and `btc-rpc-proxy` serves 8332, with node
  cookie and rpcauth passthrough sources. Wallet URL forwarding and effective
  authorization across this proxy need verification for a pruned target; node
  whitelist behavior alone cannot establish proxy restrictions.
- **Wallet selection:** RPC callers select a loaded wallet through
  `-rpcwallet=<name>` (the CLI maps this to `/wallet/<URL-encoded-name>`).
  The Core-based package has an operator wallet-enable setting but no named
  wallet selector/create/load action in its inspected action list. The
  alternative has `select-wallet`, storing `selectedWallet` (default `coin`)
  and attempting `loadwallet` for its own UI actions. Its helper passes that
  name as `-rpcwallet`; this does not change the wallet requested by independent
  RPC clients. Do not call that action as a discovery operation: it mutates state.
- **Regtest:** neither inspected package exposes a regtest/testnet/signet
  setting or startup switch through its typed service/dependency contract.
  `autoconfig` permits only blockfilters, blocknotify, coinstatsindex,
  peerbloomfilters, prune, txindex and zmqEnabled. Wallet selection, network mode
  and RPC allowlists are outside it. This is a missing supported integration
  contract, not a claim that the node executable cannot run regtest.
  The Core config model is a `z.object` without a loose/catchall extension and
  reads through `shape.parse`; unknown network keys are not represented by its
  typed model. The alternative uses `.loose()`, so raw-key handling differs,
  but preserved arbitrary keys do not prove a working regtest package (ports,
  paths, health, proxy and backup behavior also matter). No hand-edit workaround
  was attempted or recommended.
- **Node backup:** both call `Backups.ofVolumes('main', 'i2pd')`; `main` mounts
  at `/root/.bitcoin`. Wallet storage and bitcoin.conf/rpcauth are in that
  volume; no wallet-directory exclusion is listed. Exclusions include blocks,
  chainstate, indexes, `.cookie`, and journal files, plus I2P caches. This is
  the ordinary node backup contract, not a verified regtest-chain backup or
  restore test. Check exclusion matching against the actual regtest layout
  before promising recovery. The alternative also has an explicit wallet
  backup action; none was executed. No wallet seeds belong in the swap backup.

### Corrected provider hypothesis: installed Knots/BIP110

Operator-established facts: the box runs Bitcoin Knots with BIP110 support;
there is no separate installed BLAKE node package. These facts supersede the
previous two-package assumption. A single package serving both logical chain
backends is now the hypothesis to investigate, not a verified capability.
No separate BLAKE-package discovery will continue unless source evidence shows
one is needed.

What the available source establishes: the previously fetched **pre-RDTS**
reference declares one blockchain daemon `bitcoind`, one node datadir mounted
at `/root/.bitcoin`, an optional I2P router and a conditional RPC proxy. The
proxy forwards to that same node; two RPC ports in this code are NOT evidence
of two chains. The manifest's node build version and image list do not establish
a BLAKE-capable binary. This reference is not a match for the operator's BIP110
service, so neither its one-node topology nor its missing regtest controls can
be treated as a finding about the installed package.

The name “Knots/BIP110” alone is insufficient evidence that the service supplies
BLAKE RPC, Bitcoin RPC, or both simultaneously. Do not equate BIP110 support with
BLAKE support, infer a second backend from wallet names, or assume that selecting
a different wallet changes which blockchain a node serves.

| Question | Exact source evidence needed | Current conclusion |
| --- | --- | --- |
| Does one package support both chains? | Installed package ID/flavor/version and repository revision; manifest image pins; Dockerfile/binary source and supported network options; package documentation tying those options to Bitcoin and BLAKE. | Unknown. Package name alone does not establish this. |
| Are both available simultaneously? | `startos/main.ts` or equivalent entrypoint showing process commands, flags, mounted datadirs/configs and conditional daemon logic; whether one mode replaces another or two nodes run concurrently. | Unknown. One package can contain multiple processes, but that has not been shown here. |
| How are wallets selected per chain? | Per-backend CLI/RPC routing, wallet namespace/datadir, configured wallet names and any provider wallet-selection action. | Unknown. Separate datadirs may permit the same name; no different-name requirement is established. |
| How do dependent services reach each RPC? | Interfaces/bindings, host IDs/internal ports, exported constants, any RPC proxy dispatch rules, authentication actions and scope for each backend. | Unknown for the installed flavor. A second port might be a proxy to the same chain rather than another backend. |
| Is regtest supported without changing the live network? | Supported package settings and binary flags for isolated test instances, including data paths, RPC routing, health checks and backup behavior. | Unknown. No configuration changes are authorized. |
| What does the package back up? | Actual volume declarations and backup exclusions mapped to both backend wallets/datadirs, if present. | Unknown; earlier reference exclusions are not an installed-service guarantee. |

The smallest operator input is the exact package title/flavor and version plus
its repository URL/revision (or a locally available manifest/package-source
path). Then inspect the corresponding source files above. No server credentials,
wallet seeds, RPC passwords or cookies are needed. If source proves capabilities
but not active configuration, explicitly leave deployment state unverified;
server access remains prohibited until separately authorized.

Possible evidence-driven outcomes, none selected yet:

- One package exposes two independent backends: declare one dependency and
  resolve the two verified RPC contracts; map wallets accordingly.
- One package supports either backend but only one at a time: simultaneous
  backend availability is a provider/deployment gap, not solved by changing
  the swap engine's wallet variable.
- The package supports only one of the required backends: document precisely
  which one and why. Only then consider whether another instance/package is
  needed, with operator approval before expanding deployment scope.

### Shared wallet name: confirmed limitation, conditional blocker

`swap_v2.py:93` defines `LOCAL_WALLET` from `BLAKE_SWAP_CHAIN_WALLET` (defaulting
to the participant's legacy Alice/Bob name). Both chain helpers append
`-rpcwallet` from callers; wallet-dependent funding, signing, key lookup and
readiness paths use this same variable. Readiness also calls `listwallets` and
`getbalances` through a chain-selected `cli` alias: those calls were missed by
an earlier direct-call-only RPC inventory and must be included in any access
scope audit.

Two separately owned node wallets may legitimately have the same name. Nothing
in the verified Bitcoin provider contract requires a unique name across chains.
The installed package's backend topology and wallet namespaces are unknown,
so no engine patch is currently proven necessary.
If the actual dedicated wallets have different names that must be retained,
chain-specific settings with backward-compatible fallback would be a small
upstream configuration-boundary change requiring separate approval. Changing
only RPC argument strings would be an unreliable workaround: upstream appends
its wallet argument afterwards and its readiness checks still use LOCAL_WALLET.
No such fix was made.

The helpers also append `-rpcwallet` only for a truthy name: an empty/default
wallet is another compatibility case to verify, not an appropriate assumed
configuration for an explicitly named dedicated wallet.

### Smallest evidence-supported integration

Keep the current operator-driven design. First establish whether the installed
Knots/BIP110 package supplies both required regtest backends. If it does, use
one dependency with its verified per-backend bridge RPC and supported credentials
to verified CLI clients, configure the existing common wallet name, retain
external Nostr settings, and mount/back up existing swap state plus identity.
Use explicit commands only. No local relay, proxy of our own, node/wallet
provisioning, mainnet mode, scheduler or special restore state machine.

Today the supported regtest provider contract is the blocking issue. Do not
start runtime glue against the inspected production-oriented packages merely
because RPC exists. Identify the installed Knots/BIP110 source first; if
regtest needs provider work, present that separately. Provider gaps do not
justify changing the swap protocol. The only identified conditional upstream
configuration change is separate wallet names if actual provider wallets require
it; no upstream edit is currently established as mandatory.

### Discovery validation and next input

Guide and Bitcoin reference checkout fast-forwards succeeded; alternative
provider was freshly cloned. Static source/contract review and documentation
checks only. No provider tests, package builds, installed-server inspection,
node RPC, wallet/credential operations or upstream execution occurred.

Needed next: the installed Knots/BIP110 package ID/flavor/version and source
revision or locally available manifest. This identifies the contract to inspect;
it is not permission to connect to or change the running server.

## Operator-command packaging audit

The operator is handling the Knots upgrade independently. It is not an active
swap-package work item or prerequisite for local preparation. The original
no-server-access and no-runtime-implementation boundaries remain in effect.

The local upstream reproduction guide (`docs/REGTEST_TWO_HOST.md`) explicitly
lists independent Bitcoin and BLAKE regtest nodes. This confirms two logical
chain backends for reproduction, not two required StartOS package IDs. Whether
one installed package can provide both remains a separate source question.

Static command mapping, using `scripts/blake` and `src/swap_v2.py`:

| Operator command | Verified routing / behavior | Alpha packaging consequence |
| --- | --- | --- |
| `status` | `command_status` calls getblockcount on both chain clients and prints heights. | Suitable bounded connectivity diagnostic after configuration; heights alone do not prove regtest or chain identity. |
| engine `list` | Prints swap ID/state from local JSON. | Small local status surface; currently traverses the same participant directory for Alice and Bob, potentially duplicating entries. Do not fix upstream in this pass. |
| `show` | Loads swap and calls `print_swap`, which prints secret_hex. | Do not expose raw stdout as a StartOS diagnostic. |
| `swaps` / `my-swaps` | Routes to dashboard, not list; dashboard derives identity and invokes reconciliation reports. | More dependencies and possible transitive side effects than a local file listing. Complete call-path audit before treating as read-only. |
| `offer` / `take` / accept commands | Routes to existing market coordination commands. | Explicit operator actions; writes/publications require output, argument and concurrency review. |
| `fund` | Routes to the existing funding commitment command. | Explicit economic action; preserve upstream selection/refusal behavior. Never auto-retry after timeout. |
| `resume` | Routes to upstream settlement/recovery command. | Explicit economic action; do not invoke at boot or restore. |
| `run` | Foreground loop invokes next and resume-all. | Not selected as a boot daemon or unbounded first-alpha action. |
| `engine` passthrough | Exposes arbitrary upstream subcommands through shell wrapper. | Not an unrestricted StartOS action; typed command mapping is required. |

No upstream Python was imported/executed. Importing it creates state directories;
source inspection avoids touching existing participant state or credentials.

SDK 2.0.9 evidence, inspected in the installed package:

- `main.md` documents `SubContainer.withTemp` for one-off action commands.
  `lib/util/SubContainer.js` implements callback execution with destruction in
  `finally`. This is a supported container-lifecycle primitive, not proof of
  economic-operation cancellation safety.
- `exec` defaults to 30000 ms and schedules SIGKILL; `null` disables this SDK
  timeout. The declaration also accepts an AbortController. A generic default
  can kill a command after broadcasting but before recording its outcome.
  Define per-command lifecycle explicitly before implementation; do not simply
  disable every timeout or equate an aborted action with an unbroadcast swap.
- `Daemons.of` constructs an empty entry list and `build` iterates entries.
  This supports investigating a daemon-free command package; installed StartOS
  readiness/UI behavior still requires testing. No dummy daemon is justified
  merely by the hello-world scaffold.
- The inspected primitives do not establish action/action or action/backup
  serialization, platform action limits, or safe termination of all descendants.
  Those remain lifecycle checks before enabling mutating actions.

Next bounded work, once the exact installed provider source is supplied, is to
map two backend RPC contracts and a reviewed command lifecycle. There is no
reason to upgrade the live node, introduce a scheduler, or change protocol
semantics to complete this audit.

## Evidence

- Local guide under `../start-technologies/projects/start-sdk/docs/src/`:
  `recipes.md`, `service-to-service.md`, `outbound-networking.md`, `main.md`,
  `recipe-dependency.md`, `recipe-config-actions.md`, `recipe-backups.md`.
- Read-only `/home/gary/blake-swap/src/swap_v2.py`: `Swap`, `make_swap`,
  `print_swap`, `btc_cli`, `blake_cli`, `nostr_private_key_hex`, refund commands,
  `save_swap`, relay environment settings and `command_run`; `scripts/blake`.
  Assessed upstream HEAD: `bd4c3a3e8300855e0426c82f8e124e027bf90470`.
- Previously fetched Bitcoin package reference:
  [pinned source](https://github.com/Start9Labs/bitcoin-core-startos/tree/015a342a608e26ef5d1300107d1dfcee96ed2c17/startos),
  `interfaces.ts`, `utils.ts`, `actions/generateRpcUserDependent.ts`,
  `fileModels/bitcoin.conf.ts`, `main.ts`, and `backups.ts`. These source findings
  do not establish the installed server's configuration.
