# dsh-purge internal assessment engine

This directory is production source shipped inside dsh-purge. Its assessment
logic derives from the locally reviewed awa-ddd 2.2.0 source,
with explicit dsh-purge adaptations recorded in provenance.json. Runtime
never selects or imports a separate awa-ddd checkout or plugin installation.

The component contains Python production source, including private owner,
structured-request, bounded-claim, membership, access-control, batch and
tool-routing helpers, and three JavaScript runtime
files: the bounded process bridge, public
action catalog and inert-source AST helper. Python 3.10+ and Node 22.19+ are
runtime requirements. acorn@8.19.0 is installed through the dsh-purge root
package dependencies; host SDKs and standalone AWA UI/plugin code are not
part of this component. The original MIT license is retained in LICENSE.

The dsh-purge native assessment facade owns initialization, workspace and
project identity. Each engagement uses its own assessment/ state directory
and the internal project ID assessment. Both assessment and SRC retain the
persisted project mode. SRC is discovery-only, rejects prohibited writes
and execution adapters, and stops the operation once direct proof exists.
Imported scanner confirmations remain unverified claims until independent
current machine evidence supports the matching operation and exact input.

The dsh-purge pentest preset uses the ordinary assessment engine mode within
its own fixed engagement. It does not connect to an external AWA installation.
Full penetration reports are generated through this component's report.build;
source labels, baseline observations and report snapshots do not grant proof
or finalization authority.

The local dsh-purge adaptation version is 1.12.0; the upstream version remains
awa-ddd 2.2.0. Current native proofs bind operation/input, identity, complete
artifacts and oracle-generated claim scope, limitations and severity cap.
Historical machine labels without the current contract remain pending.
Automatic builders provide actual-baseline double Boolean SQL controls,
explicit non-calculator template controls, verified-principal GET access
boundaries, native reflected HTML XSS controls and bounded generic tests.
Missing providers remain blocked. Model reviews and N/A applicability drafts
cannot grant a finding, a new SRC stop or a smaller coverage denominator.
Campaign members and verdicts are projected independently while actual
attempts, cooldown, uncertainty and stops remain engagement-wide.
Failed runs preserve attempts, evidence, cooldown and unknown writes.
Offline verification neither replays requests nor reconciles unknown effects.

tool.route reads actual existing IDs and saved, profile-bound runtime receipts
without probing or target traffic. Existing scripts/maps use offline discovery;
DOM needs select Playwright, public GET replay requires Yak fuzzer/TLS controls,
and existing scanner results reuse the exact TscanPlus namespace. WSL remains
operator-selected. Requests without anonymous cookie_evidence_ids use one
fixed batch worker; anonymous Cookie chains retain per-item facade handling.
Each dispatch rechecks live scope, identity, Cookie and SRC restrictions.
Execution receipts count actual sends/receives/bytes/time; reuse is zero new
requests and unmeasured costs remain null.

SRC reads the facade-owned dsh-source-stops.json snapshot from its fixed
workspace before HTTP, preflight, identity, indirect recipe and browser
requests. Browser routing refreshes that snapshot for every subrequest.
Stopped resources and invalid snapshots fail before sending. Offline evidence
inspection, verification and reports remain available. Models cannot select
the snapshot path or supply its contents.

The local browser adaptation reuses an existing playwright or playwright-core
package selected by operator PURGE_PLAYWRIGHT_ROOT, the actual DSH_HOME, or the
legacy default module location. Chromium caches are discovered separately on
Windows/macOS/Linux. A cache is not a Node module, and file discovery is not a
successful launch. No package or browser is installed automatically. The
adaptation template is maintained in scripts/assessment-browser-adaptation.mjs;
explicit imports retain the recorded local adaptation only against its exact
reviewed upstream hash, with provenance recorded in provenance.json.

The private dsh.context.configure action is available only to the trusted
dsh-purge owner facade; public AWA action catalogs and help do not list it.
It requires project_id:assessment, assessment_mode, a nonempty scope array
and an exclude array (which may be empty), plus optional
required_assessment_mode. URL rules are
normalized HTTP(S) values, limited to 8192 UTF-8 bytes per rule and 256 rules
per array, including the merged total. It only appends new scope/exclude
rules, preserves target, mode, mutation policy and unrelated configuration,
and atomically records an event only when something changes. It sends no
target requests and rejects unknown configuration fields.

Maintainers run node scripts/sync-assessment-engine.mjs --check from the
dsh-purge root for a fully offline integrity check. An explicit --source
PATH imports a reviewed upstream checkout; --check --source PATH also
compares its snapshot. Native helpers and reviewed local adaptations
are retained against their exact upstream hashes; changed upstream bytes
require explicit contract review before any import, including --force.
Modified managed source is preserved unless --force explicitly authorizes
resynchronization. --record-local records only allowlisted reviewed local
changes and retains upstream attribution; it does not verify source origin
or runtime correctness. Production never runs these maintainer commands.

Provenance covers exact source bytes. Git retains the managed component's
reviewed LF/CRLF bytes; browser.py is generated with explicit LF line endings.

Upgrade checks are recorded in docs/MODE-UPGRADE-1.12.0.md. Generating the
provenance manifest is not an integrity check, runtime probe or assessment.
It did not install dependencies, package, deploy, patch or restart the host.
