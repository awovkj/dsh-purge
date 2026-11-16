/** Runtime requirements are visible without importing optional SQLite/assessment code. */
export function nodeRequirement(minimum, version = process.versions.node) {
  const actual = String(version).split('.').map(Number), wanted = minimum.split('.').map(Number)
  let supported = true
  for (let index = 0; index < 3; index++) {
    if ((actual[index] || 0) === (wanted[index] || 0)) continue
    supported = (actual[index] || 0) > (wanted[index] || 0); break
  }
  return { version, minimum, supported }
}

export function runtimeRequirements(version = process.versions.node) {
  return { purge: nodeRequirement('18.0.0', version), redteam: nodeRequirement('22.5.0', version),
    assessment: nodeRequirement('22.19.0', version), python: { minimum: '3.10', independently_required: true },
    browser: { independently_required: true, installation_implied: false } }
}

export function requireRedteamRuntime() {
  const requirement = runtimeRequirements().redteam
  if (!requirement.supported) throw Object.assign(new Error(`Redteam tools require Node >=${requirement.minimum}; current Node is ${requirement.version}. Purge base requirements are separate.`),
    { code: 'REDTEAM_NODE_UNSUPPORTED', requirement })
}

export function requireAssessmentRuntime() {
  const requirement = runtimeRequirements().assessment
  if (!requirement.supported) throw Object.assign(new Error(`Built-in assessment requires Node >=${requirement.minimum}; current Node is ${requirement.version}. Redteam and Purge base requirements are separate.`),
    { code: 'ASSESSMENT_NODE_UNSUPPORTED', requirement })
}
