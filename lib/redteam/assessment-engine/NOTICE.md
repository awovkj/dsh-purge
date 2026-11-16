# Internal assessment component

Production assessment code is derived from awa-ddd 2.2.0 (MIT).
Copyright (c) 2026 awa-ddd contributors. The complete license is in LICENSE.

This directory is dsh-purge source and is shipped in the dsh-purge package.
It contains the Python assessment engine, action catalog, bounded process
runtime, AST helper and private dsh-purge owner context adapter. That adapter
only merges authorized scope/exclude rules atomically; it never sends target
requests or changes mode, target or mutation policy. It is not public AWA API.
The component does not contain the standalone AWA plugin, host
SDKs, command-line installer, node_modules, tests, user data or credentials.
provenance.json records upstream and bundled SHA-256 values and adaptations.

dsh-purge 1.10.0 additionally owns the structured request and bounded machine
claim helpers. Local identity, oracle, failure recovery and report adaptations
are retained only against the recorded upstream file hashes. Changed upstream
bytes require explicit contract review, including with --force. The upstream
version and original MIT attribution remain awa-ddd 2.2.0.

The 1.10.0 source-stop adaptation reads the trusted facade's fixed workspace
snapshot before sending HTTP, identity, indirect recipe and browser requests.
Browser routing refreshes it for each subrequest; invalid or stopped snapshots
fail before sending. Offline verification and report access remain available.

The local browser adaptation selects an existing Playwright package through
operator environment and the actual DSH_HOME, while keeping browser caches
separate from module discovery. It does not install dependencies, send target
requests during discovery, or change the browser scope and write guards.

Provenance covers the original per-file bytes, with Git preserving reviewed
LF/CRLF source and explicit LF for the generated browser adaptation.

Isolated 1.10.0 checks are recorded in docs/MODE-UPGRADE-1.10.0.md. Source hashes
describe the bundled bytes and do not claim runtime or assessment success.
