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
