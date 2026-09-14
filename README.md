<p align="center">
  <img src="icon.svg" alt="BLAKE Swap Logo" width="21%">
</p>

# BLAKE Swap on StartOS

This is an unfinished hello-world scaffold, not a functioning swap package.
The image, daemon, port-80 readiness check, and backed-up `example-volume`
mounted at `/data` are still template settings. There are no dependency
declarations, actions, file models, or exposed interfaces for the swap engine.
The remaining sections below are unfilled template documentation.

The first-pass runtime assessment and ordered implementation plan are in
[TODO.md](TODO.md#alpha-implementation-plan). Wallet access, networking, and
persistent secret storage await approval; no upstream runtime has been wired in.
The concrete same-server regtest proposal is in [DESIGN.md](DESIGN.md), including
provider-contract gaps, existing node wallets, external relays, secret ownership
and operator-driven recovery.
Local TypeScript and JavaScript bundle checks pass for this scaffold only.
No `.s9pk` or running-service verification has been completed.

<!--
TODO: fill in the sections below, then delete these comments.

Read Writing Service READMEs first — it is the authority on who reads this file,
why the heading set is fixed and ordered, and what belongs in each section:

  ../src/writing-readmes.md
  https://docs.start9.com/packaging/writing-readmes.html
-->

## Table of Contents

<!-- TODO: link every section present below -->

## Image and Container Runtime

<!-- TODO: image source, architectures, entrypoint, and the subcontainers this package runs -->

## Volume and Data Layout

<!-- TODO -->

## File Models

<!-- TODO: each config file the package owns — format, how it's seeded, what rewrites it, and whether a hand edit survives -->

## Dependencies

<!-- TODO: list each dependency, or "None." -->

## Network Access and Interfaces

<!-- TODO -->

## Installation and First-Run Flow

<!-- TODO: what setup differs from upstream, and any ordering the user must respect -->

## Actions

<!-- TODO: each user-facing action — when to run it, what it changes, cost, repeat safety. Or "None." -->

## Tasks

<!-- TODO: each task — what raises it, severity, what clears it. Or "None." -->

## Health Checks

<!-- TODO: what each check probes, and what a failure means -->

## Backups and Restore

<!-- TODO -->

## Limitations and Differences

<!-- TODO -->

---

## Quick Reference for AI Consumers

```yaml
package_id: 'blake-swap'
image:
architectures: []
subcontainers: []
volumes: {}
file_models: []
startos_managed_env_vars: []
dependencies: []
interfaces: {}
actions: []
tasks: []
health_checks: []
```
