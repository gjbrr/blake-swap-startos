# TODO — bring BLAKE Swap from template to release-ready

## Alpha implementation plan

Assessment date: 2026-09-13. [DESIGN.md](DESIGN.md) reflects the user's
corrections: operator-driven CLI, existing dedicated wallets on same-server
chain backends (possibly within one Knots/BIP110 package), external configurable
Nostr relays, and package-owned existing
swap/Nostr state. No local relay dependency, wallet creation, automatic runner,
custom restore gate, or new encryption/secret format. Runtime remains unchanged.

### Provider discovery checkpoint — corrected installed-provider model

Operator reports Bitcoin Knots with BIP110 support is installed, with NO separate
BLAKE node package. Investigate one package potentially serving both backends.
Do not search for a separate BLAKE provider unless evidence establishes the need.
See [corrected provider hypothesis](DESIGN.md#corrected-provider-hypothesis-installed-knotsbip110).

- [ ] Obtain the installed Knots/BIP110 package ID/flavor/version and source
      revision or local manifest. No server access or secret material needed.
- [ ] Inspect that exact source for Bitcoin/BLAKE binary and network support.
      The previously inspected Knots source is pre-RDTS, not the confirmed
      installed BIP110 flavor. Do not attribute its capabilities to this box.
- [ ] Establish whether both backends can operate simultaneously: daemon
      definitions, commands, network flags, datadirs/configs and mounts.
      A proxy port is not proof of a second chain.
- [ ] Map each backend to its wallet namespace and RPC endpoint/auth contract.
      Resolve host IDs/ports and any proxy routing from source. Confirm private
      dependent-service access and effective credential scope for each backend.
- [ ] Verify supported isolated regtest operation and per-backend backup coverage.
      Do not change the running network or provider configuration.
- [ ] Confirm the wallet-name compatibility condition: upstream uses one
      `LOCAL_WALLET` for both chain clients. Separate names are needed only if
      the actual backend wallets require them; do not fix this speculatively.
- [ ] If source shows only one backend or mutually exclusive modes, report the
      exact deployment gap before proposing a second instance/package.
- [ ] Include aliased `cli("listwallets")` and `cli("getbalances", ...)` in the
      later RPC audit; direct-call searches alone are incomplete.

No runtime integration, credentials, wallet operations, server access or upstream
changes are authorized in this discovery phase.

### Node upgrade — outside this workstream

The operator is handling Knots 29.4.1 independently. Do not prepare an upgrade
or treat it as a prerequisite for swap-package source/SDK discovery. Existing
release-note findings remain in DESIGN.md for context only.

### Operator-command audit checkpoint

- Source review confirms two logical regtest backends in upstream's reproduction
  guide; it does not prove two StartOS packages are needed.
- `status` reads chain heights; `show` prints secret_hex; `swaps` routes to
  dashboard/reconciliation, not a simple local listing. See DESIGN.md's command
  table before selecting any action or health probe.
- SDK withTemp cleanup and exec timeout behavior were inspected: default 30 s
  ends with SIGKILL. Review command-specific timeout/cancellation before any
  economic action; never automatically retry an uncertain broadcast.
- [ ] Verify action-oriented StartOS lifecycle, action/backup serialization and
      platform action limits before implementing the explicit command surface.
- No runtime code changed and no upstream commands were executed.

### Verified runtime facts

- Inspected upstream read-only at `/home/gary/blake-swap`, HEAD
  `bd4c3a3e8300855e0426c82f8e124e027bf90470`; tracked working-tree diff was empty.
  The README identifies an older reproduction baseline; select the source pin
  explicitly before building. No upstream code or participant profiles were run.
- `requirements.txt` pins `coincurve==21.0.0` and `websockets==17.1`.
  Runtime uses Python 3, Bash, and separate Bitcoin/BLAKE CLI executables.
  No Dockerfile or license file appeared in the tracked file inventory.
  Published image availability, licensing, Python version, and architecture
  compatibility remain unverified.
- `src/swap_v2.py:26-98` reads state/message paths, CLI paths, RPC arguments,
  datadirs, participant role, and chain wallet from environment variables.
  Importing the module creates directories, so even CLI help is not a safe
  read-only inspection method with the user's existing environment.
- `blake_cli` forces `-regtest`; `btc_cli` does not. Bitcoin must be explicitly
  constrained and verified as regtest in the eventual package configuration.
  Both invoke external CLI programs, optionally with a selected RPC wallet.
  The host-specific default binary/datadir paths cannot work in a container.
- `scripts/blake run [seconds]` is the existing foreground loop: `next`, then
  `resume-all`, then sleep (default 15 seconds). It continues after command
  errors; process liveness alone therefore does not establish engine health.
  `scripts/blake-service` adds host-style PID/log/profile management.
- `src/swap_v2.py:16312` permits automatic Bitcoin funding, claims, and refunds
  in its run policy. Initial BLAKE funding is explicit. The foreground loop is
  not a passive monitor and must not be started before wallet-access approval.
- The engine has participant identity/key-file settings and defaults Nostr
  keys beneath the state directory. `scripts/swap` requires a participant profile
  and an existing key file. Persistent state includes recovery information;
  full path/secret/cache and concurrency audits remain to be completed.

### Ordered work after approval

1. Resolve identity metadata, upstream/package URLs, redistribution license,
   and real icon before claiming release readiness. The fake donation URL is now
   null; required marketing/repository URL and license placeholders remain.
2. Select a reproducible upstream revision and image source. If no published
   image is verified, use a pinned submodule plus package Dockerfile, per
   `project-structure.md`; never copy the local working repository or backups.
   Include Python dependencies and verified chain CLI binaries only, with no
   node daemons. Verify binary provenance and each supported architecture.
3. Identify the exact installed Knots/BIP110 source and determine whether one
   package can provide both chain backends. Verify regtest, private bridge RPC,
   wallet capability, authentication actions,
   access scope and required transaction history. No server/provider changes.
4. Map the operator's existing dedicated node wallets to upstream's single
   `BLAKE_SWAP_CHAIN_WALLET` setting. Both chains currently use the same name.
   Flag differently named wallets; do not create/rename them or patch upstream.
5. Preserve configurable external Nostr WebSocket relays via upstream settings.
   Use normal StartOS outbound networking. No relay package dependency.
6. Verify the action-oriented lifecycle: `SubContainer.withTemp` for explicit
   existing commands, duration/cancellation limits, and action serialization.
   Do not automatically launch `scripts/blake run`, `next`, or `resume-all`.
   Do not substitute an idle dummy daemon. Keep upstream economic semantics.
7. Before implementing credentials or secret persistence, present the verified
   provider-specific proposal for approval. Preserve the existing Nostr key
   and swap JSON formats; wallet seeds stay on the nodes. No credential-generation
   scheme, automatic wallet unlock, or application-level encryption is selected.
8. Map all existing swap/Nostr state into one backed-up package volume. Verify
   action/snapshot serialization and provider wallet/chain backup coverage.
   Restore files without automatic spending or a custom restore approval gate;
   document operator-driven recovery using matching wallets/chains.
9. Add typed explicit command actions and bounded observational diagnostics only
   after command/output review. `print_swap` prints the preimage: do not expose
   raw stdout or JSON through StartOS. Verify regtest before economic commands.
10. Update implemented README/instructions, version notes and UPDATING pins;
    type-check, bundle, build image and pack. A separately authorized install
    must test explicit swaps, failures, cancellation, persistence and manual
    restore/recovery. No mainnet, publishing, upstream edits or server changes.

### Deferred features (not first-alpha prerequisites)

- Local relay deployment/support.
- Wallet creation, seed import/export or unlock actions.
- Always-running settlement supervision and any associated restore interlock.
- Remote node connections, new secret formats or application-level encryption.

### First-pass validation

- `npm run check`: PASS (existing installed dependencies).
- `npm run build`: PASS; ncc produced `javascript/index.js` (2585 kB).
- Removing both URL fields failed type/bundle checks: this SDK requires the
  fields and a string marketing URL. Retained the marketing placeholder and
  used null only for donationUrl; final checks were rerun after correction.
- These validate the scaffold, not the BLAKE runtime. No `.s9pk` pack, container
  build, upstream execution, node RPC, install, server change, or backup test ran.
- Required guide fast-forward succeeded; checkout was already up to date.
- All scaffold files were already untracked; no commit or staging was performed.

The original scaffold checklist remains below as the detailed implementation
worklist. Its unchecked items are still open.

This package was scaffolded as a barebones clone — one daemon running the hello-world
image with a port-listening health check, no interface yet, no dependencies. The arbitrary ids are named
`example-*` (e.g. `example-volume`, `example-image`, `example-daemon`) to signal that you
rename them freely; they are not required namings. Work the list top to bottom; it takes
you from the clone to a release-ready package. Consult the packaging guide as you go
(`start-technologies/projects/start-sdk/docs/src/recipes.md` is the intent index). Remove items as you finish
them, and add items when you defer work.

## Identity & metadata

- [ ] `startos/manifest/index.ts`: fill in `packageRepo`, `upstreamRepo`, and
      `marketingUrl` / `donationUrl` (or remove the latter two). Confirm the `license`.
- [ ] Replace the placeholder `LICENSE` file with your package's license, matching the
      `license` field in `startos/manifest/index.ts`.
- [ ] `startos/manifest/i18n.ts`: write the short and long descriptions, then translate
      them into the other locales.
- [ ] Replace `icon.svg` with a real BLAKE Swap icon (≤ 40 KiB).

## The service

- [ ] Rename the `example-*` placeholder ids to fit your service. Keep them consistent
      across `startos/manifest/index.ts` (the `example-image` key and `example-volume` entry),
      `startos/main.ts` (`imageId`, `volumeId`, the daemon and subcontainer ids), and
      `startos/backups.ts` (the backed-up volume).
- [ ] Replace the hello-world image with your service's image: set `images.*.source.dockerTag`
      (or add a `Dockerfile`) in `startos/manifest/index.ts`, and update the `exec.command` in
      `startos/main.ts`. (`UPDATING.md` should document how you track the version.)
- [ ] `startos/main.ts`: define the daemon(s) and any oneshots. The example daemon ships a
      `checkPortListening` health check on `uiPort` (`startos/utils.ts`) — point `uiPort` at the
      port your service listens on, or swap in another check. Keep only the i18n keys in
      `startos/i18n/dictionaries` that you actually reference.
- [ ] Interfaces: `startos/interfaces.ts` ships wired into `startos/init/index.ts` but
      returns an empty list. If the service exposes a network interface, bind a port and
      export the interface there (see `start-technologies/projects/start-sdk/docs/src/interfaces.md`).
- [ ] `startos/backups.ts`: choose what to back up.
- [ ] `startos/dependencies.ts`: declare any dependencies (or confirm none).
- [ ] `startos/actions/`: add user-facing actions / config as needed.
- [ ] `startos/init/`: add install / restore setup if the service needs it.
- [ ] `startos/versions/`: set the initial version string and release notes.

## Docs

- [ ] Write `README.md` (per `start-technologies/projects/start-sdk/docs/src/writing-readmes.md`).
- [ ] Write `instructions.md` (per `start-technologies/projects/start-sdk/docs/src/writing-instructions.md`).
- [ ] Fill in `UPDATING.md` (upstream-version tracking).

## Build, test, ship

- [ ] First test build: `make` (or `start-cli s9pk pack`); fix any `tsc` / pack errors.
- [ ] Install on a StartOS box and verify the service runs (and is reachable, once it
      exposes an interface).
- [ ] Backup / restore sanity check.
- [ ] Review the README and instructions one more time against actual behavior.

## CI configuration

- [ ] Set `vars.REFERENCE_REGISTRY`, `vars.RELEASE_REGISTRY` and
      `vars.S3_S9PKS_BASE_URL`, plus `secrets.DEV_KEY`, `secrets.S3_ACCESS_KEY`
      and `secrets.S3_SECRET_KEY`, then the Tag and Release workflow runs again.
      Until then it is skipped: with those values empty it failed every push in
      ten seconds inside `start-cli` (exit 38) over a release pipeline that was
      never set up, which is a red check that says nothing about the package.
- [ ] Add a build check that runs on pushes to `master` once the package builds
      (`make` / `start-cli s9pk pack`); the Build workflow currently runs only
      for pull requests and manual dispatch.

