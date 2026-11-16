"""Machine finding wording is derived from the proven mechanism, never a claim."""
from __future__ import annotations

from .store import EngineError

RANKS = ("info", "low", "medium", "high", "critical")
V1_SCOPES = {
    "authorization": ("authorization_boundary", "high"),
    "sql_metadata": ("database_metadata", "high"),
    "error_channel": ("database_metadata_error_channel", "medium"),
    "sql_boolean": ("sql_boolean_difference", "medium"),
    "extraction": ("controlled_extraction", "high"),
    "state_invariant": ("business_state_invariant", "high"),
    "state_transition": ("state_transition", "high"),
}


def machine_claim(*, family, oracle_type, operation_id, input_location=None, input_selector=None, model="v1"):
    if model == "v2":
        from .execution.oracle_profiles import profile
        contract = profile(oracle_type)
        if not contract.get("confirmable"):
            raise EngineError("finding_claim", "This oracle does not provide positive machine proof")
        scope, cap = contract["proof_scope"], contract["severity_cap"]
        limitations = list(contract.get("not_proof") or [])
    else:
        if oracle_type not in V1_SCOPES:
            raise EngineError("finding_claim", "This oracle has no implemented positive finding claim")
        scope, cap = V1_SCOPES[oracle_type]
        limitations = ["Only the selected operation, identity/resource relation and recorded controls were proven.",
                       "Broader privileges, code execution and untested inputs remain unverified."]
    label = str(input_location or "operation") + ":" + str(input_selector or "boundary")
    # Input names are locators, not an impact statement. Bound the machine title
    # independently of arbitrary hypothesis labels and imported scanner text.
    label = label.replace("\r", " ").replace("\n", " ")[:160]
    title = f"{family}: {scope} ({operation_id}; {label})"
    return {"schema": "dsh-purge-native-claim/v2", "category": family,
            "oracle_version": contract["version"] if model == "v2" else "1",
            "operation_id": operation_id, "input_location": input_location,
            "input_selector": input_selector, "proof_scope": scope, "severity_cap": cap,
            "title": title, "impact": f"The recorded controls support {scope} for {operation_id} ({label}).",
            "limitations": limitations}


def capped_severity(proposed, cap):
    if proposed not in RANKS or cap not in RANKS:
        raise EngineError("finding_severity", "Machine findings require a known severity and proof cap")
    return RANKS[min(RANKS.index(proposed), RANKS.index(cap))]


def claim_matches(finding, claim):
    return finding.get("claim_contract") == claim \
        and finding.get("title") == claim["title"] \
        and finding.get("category") == claim["category"] \
        and finding.get("impact") == claim["impact"] \
        and finding.get("proof_scope") == claim["proof_scope"] \
        and finding.get("severity") in RANKS \
        and RANKS.index(finding["severity"]) <= RANKS.index(claim["severity_cap"]) \
        and set(claim["limitations"]).issubset(set(finding.get("limitations") or []))


def finding_proof_state(project, finding, *, model="v1"):
    """A read-only classification shared by native coverage and report output."""
    if finding.get("mode") != "machine":
        return {"proof_state": "reviewed_draft", "machine_proof": False, "proof_pending": True,
                "detection": False, "legacy_review": finding.get("status") == "reviewed_confirmed"}
    try:
        if model == "v2":
            from .integration import _v2_machine
            _v2_machine(project, finding)
        else:
            from .assessment import current_machine_proof, _category_family
            decision, item, operation = current_machine_proof(project, finding["decision_id"], finding["category"])
            claim = machine_claim(family=_category_family(finding["category"]), oracle_type=decision["oracle"]["type"],
                                  operation_id=operation["id"], input_location=item.get("input_location"),
                                  input_selector=item.get("input_selector"))
            if not claim_matches(finding, claim):
                raise EngineError("finding_claim", "Current finding wording or severity lacks a bounded machine claim")
        return {"proof_state": "verified", "machine_proof": True, "proof_pending": False}
    except (EngineError, OSError, ValueError, KeyError, TypeError):
        return {"proof_state": "pending", "machine_proof": False, "proof_pending": True}
