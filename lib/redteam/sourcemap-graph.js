import { posix } from 'node:path'

const UNKNOWN = Symbol('unknown')
const MAX_NODES = 200000, MAX_ROWS = 1000
const HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'])
const canonicalName = name => posix.normalize(name.replaceAll('\\', '/'))
const property = node => node?.computed ? node.property?.value : node?.property?.name

export async function analyzeSourcemapModules(document, { signal } = {}) {
  const result = { modules: [], module_links: [], routes: [], input_sink_links: [], gaps: [],
    declaration_only: true, runtime_verified: false, can_confirm: false }
  let parse
  try { ({ parse } = await import('acorn')) }
  catch { return { ...result, gaps: [{ code: 'parser_unavailable' }] } }
  const modules = [], names = new Map()
  let visited = 0, graphBytes = 0, graphCapped = false
  const tick = depth => {
    signal?.throwIfAborted()
    if (++visited > MAX_NODES || depth > 80) throw new Error('source_graph_budget')
  }
  const add = (kind, row) => {
    const size = Buffer.byteLength(JSON.stringify(row))
    if (result[kind].length >= MAX_ROWS || graphBytes + size > 512 * 1024) { graphCapped = true; return }
    graphBytes += size
    result[kind].push(row)
  }
  for (const [index, name] of document.sources.entries()) {
    signal?.throwIfAborted()
    const source = document.sourcesContent?.[index]
    if (typeof source !== 'string') { add('gaps', { source_index: index, code: 'source_content_missing' }); continue }
    if (!/\.(?:[cm]?js)(?:[?#].*)?$/i.test(name)) { add('gaps', { source_index: index, code: 'source_language_unsupported' }); continue }
    try {
      const ast = parse(source, { sourceType: 'module', ecmaVersion: 'latest', locations: true, allowHashBang: true })
      const module = { index, name: canonicalName(name), ast, root: { parent: null, bindings: new Map() }, exports: new Map(), mutated: new Set() }
      modules.push(module)
      if (!names.has(module.name)) names.set(module.name, [])
      names.get(module.name).push(module)
      add('modules', { source_index: index, parsed: true })
    } catch { add('gaps', { source_index: index, code: 'source_syntax_unsupported' }) }
  }
  function targets(node, values) {
    if (!node) return
    tick(0)
    if (node.type === 'Identifier') values.push(node.name)
    else if (node.type === 'RestElement') targets(node.argument, values)
    else if (node.type === 'AssignmentPattern') targets(node.left, values)
    else if (node.type === 'ArrayPattern') for (const child of node.elements) targets(child, values)
    else if (node.type === 'ObjectPattern') for (const child of node.properties) targets(child.value || child.argument, values)
  }
  function declarations(body, scope, module) {
    for (const original of body || []) {
      const node = original.type === 'ExportNamedDeclaration' ? original.declaration || original : original
      if (node.type === 'VariableDeclaration') for (const entry of node.declarations) {
        const values = []
        targets(entry.id, values)
        for (const name of values) scope.bindings.set(name, node.kind === 'const' && entry.id.type === 'Identifier'
          ? { node: entry.init, scope, module } : { value: UNKNOWN })
        if (scope === module.root && original.type === 'ExportNamedDeclaration' && entry.id.type === 'Identifier') module.exports.set(entry.id.name, entry.id.name)
      }
      if (['FunctionDeclaration', 'ClassDeclaration'].includes(node.type) && node.id) scope.bindings.set(node.id.name, { value: UNKNOWN })
      if (scope === module.root && original.type === 'ExportNamedDeclaration' && !original.source) {
        for (const entry of original.specifiers || []) module.exports.set(entry.exported.name, entry.local.name)
      }
      if (scope === module.root && original.type === 'ExportDefaultDeclaration') module.exports.set('default', { node: original.declaration, scope, module })
    }
  }
  function children(node, callback, depth) {
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'start', 'end'].includes(key)) continue
      if (Array.isArray(value)) {
        for (const child of value) if (child && typeof child.type === 'string') callback(child, depth + 1)
      } else if (value && typeof value.type === 'string') callback(value, depth + 1)
    }
  }
  function hoisted(node, scope, depth = 0) {
    if (!node || typeof node.type !== 'string') return
    tick(depth)
    if (/^(?:Function|ArrowFunction|Class)/.test(node.type)) return
    if (node.type === 'VariableDeclaration' && node.kind === 'var') for (const entry of node.declarations) {
      const values = []
      targets(entry.id, values)
      for (const name of values) scope.bindings.set(name, { value: UNKNOWN })
    }
    children(node, (child, childDepth) => hoisted(child, scope, childDepth), depth)
  }
  function mutations(node, module, depth = 0) {
    tick(depth)
    if (node.type === 'AssignmentExpression' || node.type === 'UpdateExpression') {
      let target = node.left || node.argument
      while (target?.type === 'MemberExpression') target = target.object
      const values = []
      targets(target, values)
      for (const name of values) module.mutated.add(name)
    }
    children(node, (child, childDepth) => mutations(child, module, childDepth), depth)
  }
  function moduleFor(module, reference) {
    if (typeof reference !== 'string' || !reference.startsWith('.')) return null
    const path = canonicalName(posix.join(posix.dirname(module.name), reference))
    const candidates = [path, path + '.js', path + '.mjs', path + '/index.js'].flatMap(value => names.get(value) || [])
    return candidates.length === 1 ? candidates[0] : null
  }
  function lookup(scope, name) {
    return scope?.bindings.has(name) ? scope.bindings.get(name) : scope?.parent ? lookup(scope.parent, name) : null
  }
  function resolve(node, scope, module, depth = 0, seen = new Set()) {
    tick(depth)
    if (!node || depth > 20) return UNKNOWN
    if (node.type === 'Literal') return node.value
    if (node.type === 'Identifier') {
      const binding = lookup(scope, node.name)
      if (!binding || seen.has(binding) || module.mutated.has(node.name)) return UNKNOWN
      if ('value' in binding) return binding.value
      const next = new Set([...seen, binding])
      if (binding.imported) {
        const target = moduleFor(binding.module, binding.reference)
        const exported = target?.exports.get(binding.imported)
        if (!exported) return UNKNOWN
        return typeof exported === 'string' ? resolve({ type: 'Identifier', name: exported }, target.root, target, depth + 1, next)
          : resolve(exported.node, exported.scope, exported.module, depth + 1, next)
      }
      return resolve(binding.node, binding.scope, binding.module, depth + 1, next)
    }
    if (node.type === 'BinaryExpression' && node.operator === '+') {
      const left = resolve(node.left, scope, module, depth + 1, seen), right = resolve(node.right, scope, module, depth + 1, seen)
      if (left?.kind === 'url_input') return left
      if (right?.kind === 'url_input') return right
      return ['string', 'number'].includes(typeof left) && ['string', 'number'].includes(typeof right)
        && String(left).length + String(right).length <= 8192 ? left + right : UNKNOWN
    }
    if (node.type === 'TemplateLiteral') {
      let value = node.quasis[0].value.cooked
      for (const [index, expression] of node.expressions.entries()) {
        const entry = resolve(expression, scope, module, depth + 1, seen)
        if (entry?.kind === 'url_input') return entry
        if (!['string', 'number', 'boolean'].includes(typeof entry)) return UNKNOWN
        value += entry + node.quasis[index + 1].value.cooked
        if (value.length > 8192) return UNKNOWN
      }
      return value
    }
    if (node.type === 'ObjectExpression') {
      const value = Object.create(null)
      for (const entry of node.properties) {
        const key = entry.computed ? entry.key.value : entry.key.name || entry.key.value
        if (entry.type !== 'Property' || typeof key !== 'string') return UNKNOWN
        value[key] = resolve(entry.value, scope, module, depth + 1, seen)
      }
      return value
    }
    if (node.type === 'MemberExpression') {
      if (node.object.type === 'Identifier' && node.object.name === 'location' && !lookup(scope, 'location') && property(node) === 'hash') {
        return { kind: 'url_input', name: 'hash', source_index: module.index, line: node.loc?.start.line }
      }
      const object = resolve(node.object, scope, module, depth + 1, seen), key = property(node)
      return object && typeof object === 'object' && typeof key === 'string' && Object.hasOwn(object, key) ? object[key] : UNKNOWN
    }
    if (node.type === 'NewExpression' && node.callee.name === 'URLSearchParams' && !lookup(scope, 'URLSearchParams')) {
      const argument = node.arguments[0]
      if (argument?.type === 'MemberExpression' && argument.object.name === 'location' && !lookup(scope, 'location') && property(argument) === 'search') return { kind: 'query_params' }
    }
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && property(node.callee) === 'get') {
      const object = resolve(node.callee.object, scope, module, depth + 1, seen), key = resolve(node.arguments[0], scope, module, depth + 1, seen)
      if (object?.kind === 'query_params' && typeof key === 'string' && key.length <= 256) return { kind: 'url_input', name: key, source_index: module.index, line: node.loc?.start.line }
    }
    return UNKNOWN
  }
  function visit(node, scope, module, depth = 0) {
    if (!node || typeof node.type !== 'string') return
    tick(depth)
    if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) {
      scope = { parent: scope, bindings: new Map() }
      const values = []
      for (const parameter of node.params) targets(parameter, values)
      if (node.id) values.push(node.id.name)
      for (const name of values) scope.bindings.set(name, { value: UNKNOWN })
      hoisted(node.body, scope)
    }
    if (['ForStatement', 'ForInStatement', 'ForOfStatement'].includes(node.type)) {
      scope = { parent: scope, bindings: new Map() }
      declarations([node.init || node.left].filter(Boolean), scope, module)
    }
    if (node.type === 'CatchClause' || node.type === 'ClassExpression') {
      scope = { parent: scope, bindings: new Map() }
      const values = []
      targets(node.type === 'CatchClause' ? node.param : node.id, values)
      for (const name of values) scope.bindings.set(name, { value: UNKNOWN })
    }
    if (node.type === 'BlockStatement') {
      scope = { parent: scope, bindings: new Map() }
      declarations(node.body, scope, module)
    }
    if (node.type === 'CallExpression') {
      const callee = node.callee, member = property(callee)
      const fetch = callee.type === 'Identifier' && callee.name === 'fetch' && !lookup(scope, 'fetch')
      const axios = callee.type === 'MemberExpression' && callee.object.name === 'axios' && !lookup(scope, 'axios')
        && ['get', 'head', 'post', 'put', 'patch', 'delete'].includes(member)
      if (fetch || axios) {
        const url = resolve(node.arguments[0], scope, module)
        const options = fetch ? resolve(node.arguments[1], scope, module) : null
        const wantedMethod = axios ? member.toUpperCase() : options === UNKNOWN && node.arguments[1] ? 'unknown' : options?.method || 'GET'
        const method = typeof wantedMethod === 'string' && HTTP_METHODS.has(wantedMethod.toUpperCase()) ? wantedMethod.toUpperCase() : 'unknown'
        if (typeof url === 'string' && url.length <= 8192) add('routes', { source_index: module.index, line: node.loc.start.line, url,
          method,
          basis: 'ast_request_reference' })
        else add('gaps', { source_index: module.index, line: node.loc.start.line, code: 'dynamic_request_unresolved' })
      }
    }
    if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && ['innerHTML', 'outerHTML'].includes(property(node.left))) {
      const input = resolve(node.right, scope, module)
      if (input?.kind === 'url_input') add('input_sink_links', { source_index: module.index, line: node.loc.start.line,
        input_source_index: input.source_index, input_line: input.line, input_name: input.name, sink: property(node.left), basis: 'static_reference' })
    }
    children(node, (child, childDepth) => visit(child, scope, module, childDepth), depth)
  }
  try {
    for (const module of modules) {
      hoisted(module.ast, module.root)
      declarations(module.ast.body, module.root, module)
      mutations(module.ast, module)
      if (module.mutated.size) add('gaps', { source_index: module.index, code: 'mutable_binding_unresolved' })
    }
    for (const module of modules) for (const node of module.ast.body) if (node.type === 'ImportDeclaration') {
      const target = moduleFor(module, node.source.value)
      if (target) add('module_links', { source_index: module.index, imported_source_index: target.index, line: node.loc.start.line })
      else add('gaps', { source_index: module.index, line: node.loc.start.line, code: 'module_reference_unresolved' })
      for (const entry of node.specifiers) module.root.bindings.set(entry.local.name,
        { imported: entry.type === 'ImportDefaultSpecifier' ? 'default' : entry.imported?.name, reference: node.source.value, module })
    }
    for (const module of modules) visit(module.ast, module.root, module)
  } catch (error) {
    signal?.throwIfAborted()
    add('gaps', { code: error.message === 'source_graph_budget' ? 'source_graph_budget' : 'source_graph_unresolved' })
  }
  return { ...result, nodes_examined: visited, budget_reached: visited > MAX_NODES,
    rows_capped: graphCapped, graph_bytes: graphBytes }
}
