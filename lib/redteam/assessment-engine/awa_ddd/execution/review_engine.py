"""Review acceptance, disposition and proof binding for 2.0 findings."""
from __future__ import annotations

from .. import engine
from ..domain import new_finding, new_review_contract, validate_cross_role
from ..domain.common import digest, fail, text
from ..domain.repository import Repository
from ..domain.review import public_view as review_public
from ..domain.test_run import public_view as run_public
from ..domain.hypothesis import transition


def _current_evidence(project, evidence_id):
    try:
        evidence, artifact = engine.verify_current_evidence(project, evidence_id)
    except (engine.EngineError, OSError, ValueError, KeyError) as exc:
        fail("v2_review_material", f"Reviewed evidence is not current: {evidence_id}")
    return evidence, artifact


def accept(project, args):
    repository = Repository(project)
    run_row = repository.get("run", args["run_id"])
    from ..planning.membership import hypothesis as member_hypothesis
    hypothesis = member_hypothesis(project, repository.get("campaign", run_row["campaign_id"]), args["hypothesis_id"])
    if run_row.get("status") not in {"evaluated", "published"}:
        fail("v2_review_run", "Reviewed findings require a completed evaluated run")
    if run_row.get("hypothesis_id") != hypothesis["id"]:
        fail("v2_review_hypothesis", "Run and hypothesis do not match")
    evidence_ids = args.get("evidence_ids") or run_row.get("evidence_ids") or []
    run_evidence = set(run_row.get("evidence_ids") or [])
    if not set(evidence_ids).issubset(run_evidence):
        fail("v2_review_material", "Review may only cite evidence produced by its run")
    material = args.get("material") or {}
    material_ids = material.get("evidence_ids") or evidence_ids
    if not set(material_ids).issubset(run_evidence):
        fail("v2_review_material", "Review material must be a subset of the run evidence")
    digests = {}
    for evidence_id in material_ids:
        evidence, _artifact = _current_evidence(project, evidence_id)
        digests[evidence_id] = evidence.get("sha256")
    supplied = material.get("digests") or {}
    if supplied and supplied != digests:
        fail("v2_review_material", "Review material digest does not match current evidence")
    cited_controls = [control for group in args.get("control_groups") or [] for control in group.get("controls") or []]
    if any(control.get("evidence_id") not in material_ids for control in cited_controls):
        fail("v2_review_material", "Every reviewed control must be included in the exact material list")
    if len({control.get("evidence_id") for control in cited_controls}) != len(cited_controls):
        fail("v2_review_controls", "Independent reviewed controls cannot reuse the same capture")
    mechanism = args.get("mechanism") or {}
    mechanism.setdefault("family", hypothesis["family"])
    mechanism.setdefault("security_property", hypothesis["security_property"])
    mechanism.setdefault("operation_id", hypothesis["operation_id"])
    mechanism.setdefault("input_key", hypothesis["input_key"])
    identity = args.get("identity") or {}
    recipe = repository.get("recipe", run_row["recipe_id"], required=False) if run_row.get("recipe_id") else None
    if recipe:
        binding_session = (recipe.get("bindings") or {}).get("session") or {}
        binding_resource = (recipe.get("bindings") or {}).get("resource") or {}
        if identity.get("actor_id") and binding_session.get("actor_id") \
                and identity.get("actor_id") != binding_session.get("actor_id"):
            fail("v2_review_identity", "Review actor does not match the frozen recipe session")
        if identity.get("resource_id") and binding_resource.get("resource_id") \
                and identity.get("resource_id") != binding_resource.get("resource_id"):
            fail("v2_review_identity", "Review resource does not match the frozen recipe")
        from .test_runner import _control_result, _evidence_value
        frozen_controls = recipe.get("controls") or [control for group in recipe.get("control_groups") or []
                                                     for control in group.get("controls") or []]
        for declared in cited_controls:
            matching = [control for control in frozen_controls if control.get("role") == declared.get("role")]
            if declared.get("id"):
                matching = [control for control in matching if control.get("id") == declared["id"]]
            if len(matching) != 1:
                fail("v2_review_controls", "Review roles must identify one actual frozen control")
            _control_result(project, recipe, matching[0], declared["evidence_id"])
        attacks = [control for control in cited_controls if control.get("role") == "attack"]
        observation = args.get("observation") or {}
        if len(attacks) != 1 or not isinstance(observation.get("selector"), str):
            fail("v2_review_observation", "Review needs one exact attack capture and response selector")
        actual = _evidence_value(project, attacks[0]["evidence_id"], observation["selector"])
        if digest(actual) != digest(observation.get("actual")):
            fail("v2_review_observation", "Declared actual value differs from the complete captured artifact")
    contract = new_review_contract(
        hypothesis=hypothesis, run=run_row, mechanism=mechanism, identity=identity,
        control_groups=args.get("control_groups") or [], observation=args.get("observation") or {},
        consumer_point=args.get("consumer_point") or {}, source_trust=args.get("source_trust") or {},
        reviewer=args.get("reviewer") or {}, proof_scope=args.get("proof_scope") or {},
        material={"evidence_ids": material_ids, "digests": digests},
        verification=args.get("verification") or {})
    validate_cross_role(contract, hypothesis=hypothesis, run=run_row)
    repository.add("review", contract, immutable=True)
    finding = new_finding(
        hypothesis_id=hypothesis["id"], run_id=run_row["id"], review_id=contract["id"],
        mode="reviewed", severity=args.get("severity") or "medium",
        title=args.get("title") or f"Reviewed: {hypothesis['security_property']}",
        category=hypothesis["family"], impact=args.get("impact") or "Reviewed detection accepted under a bounded proof scope.",
        remediation=args.get("remediation") or "Apply the mechanism-specific fix and re-test.",
        evidence_ids=material_ids, proof_scope=contract["proof_scope"]["accepted"][0],
        confidence="analyst_draft",
        limitations=contract["proof_scope"]["not_proven"] or ["Reviewed detection is not machine proof."])
    repository.add("finding", finding, immutable=False)
    hypothesis["finding_ids"] = sorted(set(hypothesis.get("finding_ids", []) + [finding["id"]]))
    repository.save("hypothesis", hypothesis)
    return {"review": review_public(contract), "finding": finding,
            "machine_proof": False, "detection": False, "draft_saved": True,
            "reviewer_independent": False, "requests_sent": 0,
            "notice": "Analyst drafts preserve observations; only a current machine verdict or an authenticated operator path grants a detection or a new SRC stop."}


def disposition(project, args):
    repository = Repository(project)
    from ..planning.membership import view as membership_view, hypothesis as member_hypothesis
    campaigns = [row for row in repository.list("campaign", limit=None)[0] if row.get("state") == "active"
                 and args["hypothesis_id"] in membership_view(project, row)["hypothesis_ids"]]
    if args.get("campaign_id"):
        campaigns = [row for row in campaigns if row["id"] == args["campaign_id"]]
    if len(campaigns) != 1:
        fail("v2_review_disposition", "Disposition requires an exact active campaign; specify campaign_id when this hypothesis is shared")
    campaign = campaigns[0]
    hypothesis = member_hypothesis(project, campaign, args["hypothesis_id"])
    status = args["status"]
    if status not in {"blocked", "not_applicable", "ready"}:
        fail("v2_review_disposition", "status must be blocked, not_applicable or ready")
    if status == "blocked":
        prerequisite = text(args.get("prerequisite"), "prerequisite", maximum=1024)
        missing = args.get("missing_context") or hypothesis.get("missing_context") or []
        if not missing:
            fail("v2_review_disposition", "Blocked disposition requires concrete missing_context")
        hypothesis["missing_context"] = list(missing)
        hypothesis["blocked_prerequisite"] = prerequisite
        transition(hypothesis, "blocked", reason=prerequisite, missing_context=missing)
    elif status == "not_applicable":
        basis = args.get("applicability_basis") or {}
        if not isinstance(basis, dict) or set(basis) != {"business_fact"} or not basis.get("business_fact"):
            fail("v2_review_disposition", "not_applicable requires a business-fact applicability basis")
        evidence_ids = args.get("evidence_ids") or []
        if not isinstance(evidence_ids, list) or not 1 <= len(evidence_ids) <= 32 \
                or any(not isinstance(identity, str) for identity in evidence_ids) or len(set(evidence_ids)) != len(evidence_ids):
            fail("v2_review_disposition", "not_applicable requires 1..32 distinct current same-operation evidence IDs")
        for evidence_id in evidence_ids:
            evidence, unused_artifact = _current_evidence(project, evidence_id)
            if evidence.get("operation_id") != hypothesis["operation_id"]:
                fail("v2_review_disposition", "Applicability material must belong to this exact operation; observed bytes do not prove the business-fact interpretation")
        hypothesis["applicability_basis"] = {"business_fact": text(basis["business_fact"], "business_fact"),
                                             "evidence_ids": evidence_ids,
                                             "declared_by": args.get("reviewer"), "confidence": "inferred",
                                             "verified": False, "can_exclude": False}
        transition(hypothesis, "not_applicable", reason=basis["business_fact"])
    else:
        from .recipe_builder import build, prerequisite_fingerprint
        current = prerequisite_fingerprint(project, hypothesis)
        old = (hypothesis.get("automatic_preparation") or {}).get("prerequisite_fingerprint")
        if hypothesis.get("attempt", {}).get("attempt_count", 0) and (old is None or old == current):
            fail("v2_prerequisite_unchanged", "Administrative readiness cannot erase an attempt; repair the actual task prerequisites first",
                 next_action="test.inspect", automatic_retry_allowed=False)
        universe = repository.get("universe", campaign["universe_id"])
        built = build(project, campaign, universe, hypothesis)
        if built.get("status") != "ready":
            fail("v2_recipe_blocked", built.get("reason", "Actual prerequisites remain missing"), missing=built.get("missing", []))
        transition(hypothesis, "ready", reason="Relevant actual prerequisites compile into a current frozen recipe", missing_context=[])
        hypothesis.pop("blocked_prerequisite", None)
        hypothesis.pop("execution_blocker", None)
    repository.save("hypothesis", hypothesis)
    return {"hypothesis": hypothesis, "status": hypothesis["status"],
            "counts_as_tested": False if status == "not_applicable" else None,
            "can_exclude": False, "denominator_retained": True, "requests_sent": 0}


def bind(project, args):
    """Upgrade a reviewed finding using an existing machine evaluation, preserving history."""
    repository = Repository(project)
    finding = repository.get("finding", args["finding_id"])
    if finding.get("status") not in {"reviewed_confirmed", "reviewed_draft"} or not finding.get("current"):
        fail("v2_review_bind", "Only a current reviewed finding can be bound")
    run_row = repository.get("run", args["run_id"])
    if run_row.get("status") != "evaluated" or run_row.get("hypothesis_id") != finding["hypothesis_id"]:
        fail("v2_review_bind", "Machine proof must be an evaluated run for the same hypothesis")
    evaluation = run_row.get("evaluation") or {}
    if evaluation.get("outcome") != "supported" or not evaluation.get("finding_allowed"):
        fail("v2_review_bind", "Machine run did not produce a confirmable result")
    if not set(finding.get("evidence_ids") or []).issubset(set(run_row.get("evidence_ids") or [])):
        fail("v2_review_bind", "Reviewed evidence is not a subset of the machine run evidence")
    # Select an already generated machine finding, recheck its complete controls,
    # and retain its bounded wording. Analyst text never becomes machine impact.
    from ..integration import _v2_machine
    proven = [row for row in repository.list("finding", limit=None)[0]
              if row.get("run_id") == run_row["id"] and row.get("mode") == "machine"
              and row.get("current") and row.get("status") == "machine_confirmed"]
    if len(proven) != 1:
        fail("v2_review_bind", "Binding needs one existing current machine finding from this exact run")
    _v2_machine(project, proven[0])
    source = proven[0]
    # Its stable ID is the existing machine finding. Do not create a duplicate
    # detection or replace its proof history merely because an analyst binds it.
    machine = source
    finding["current"] = False
    finding["superseded_by"] = machine["id"]
    finding.setdefault("lifecycle", []).append({"status": "superseded", "reviewer": args.get("reviewer"),
                                                "reason": args.get("reason"), "replacement_id": machine["id"],
                                                "at": __import__("datetime").datetime.now(
                                                    __import__("datetime").timezone.utc).isoformat()})
    repository.save("finding", finding)
    return {"finding": machine, "superseded_finding_id": finding["id"], "machine_proof": True}


def evidence_view(project, args):
    repository = Repository(project)
    if args.get("review_id"):
        return {"review": review_public(repository.get("review", args["review_id"]))}
    if args.get("run_id"):
        return {"run": run_public(repository.get("run", args["run_id"]))}
    fail("v2_review_evidence", "review.evidence requires review_id or run_id")
