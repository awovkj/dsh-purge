import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolvePage, nextPage } from '../lib/redteam/page-token.js'

const fixture = (mode = 'src') => ({ assessmentPolicy: () => ({ assessment_mode: mode }) })

test('legacy delivery offsets select three independent streams and validate the stop cursor', () => {
  const store = fixture()
  assert.deepEqual(resolvePage(store, 'fixture', 'delivery', { offset: 3, finding_offset: 7, stop_offset: 19, limit: 5 }),
    { offset: 3, finding_offset: 7, stop_offset: 19, limit: 5 })
  assert.equal(resolvePage(store, 'fixture', 'delivery', { finding_offset: 7 }).stop_offset, 0)
  for (const stop_offset of [-1, 1.5, '1', NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => resolvePage(store, 'fixture', 'delivery', { stop_offset }), error => error.code === 'ASSESSMENT_PAGE_TOKEN')
  }
})

test('signed delivery continuation preserves independent cursors including exhausted streams', () => {
  const store = fixture(), first = resolvePage(store, 'fixture', 'delivery', { offset: 3, finding_offset: 7, stop_offset: 19, limit: 5 })
  const next = nextPage(store, 'fixture', 'delivery', first,
    { offset: 8, finding_offset: null, stop_offset: 24 }, 'redteam_delivery_report')
  const page = resolvePage(store, 'fixture', 'delivery', next.arguments)
  assert.equal(page.offset, 8)
  assert.equal(page.finding_offset, 7)
  assert.equal(page.stop_offset, 24)
  for (const name of ['offset', 'finding_offset', 'stop_offset']) {
    assert.throws(() => resolvePage(store, 'fixture', 'delivery', { ...next.arguments, [name]: 0 }), /cannot be mixed/)
  }
  assert.throws(() => resolvePage(fixture(), 'fixture', 'delivery', next.arguments), /signature or service lifetime/)
  assert.throws(() => resolvePage(store, 'other', 'delivery', next.arguments), /engagement/)
  assert.throws(() => resolvePage(store, 'fixture', 'source_candidates', next.arguments), /stream mismatch/)
  assert.throws(() => resolvePage(store, 'fixture', 'delivery', { ...next.arguments, limit: 6 }), /limit conflict/)
})
