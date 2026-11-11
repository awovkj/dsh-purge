import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { AssessmentTab, SrcDiscoveryReport } from '../src/community/awa-evidence.js';

const h = React.createElement;

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function mockApi() {
  const calls = [];
  const api = request => {
    const pending = deferred();
    const call = { request: structuredClone(request), ...pending };
    calls.push(call);
    return pending.promise;
  };
  const call = (op, engagement, qualifier, index = 0) => {
    const matching = calls.filter(item => item.request.op === op
      && item.request.engagement === engagement
      && (qualifier === undefined || (item.request.action || (typeof item.request.verify === 'boolean' ? String(item.request.verify) : '')) === qualifier));
    assert(matching[index], `Expected recorded fixture call ${op}/${engagement}/${qualifier ?? ''}/${index}`);
    return matching[index];
  };
  return { api, calls, call };
}

function status(engagement, ready = false, context = {}) {
  return { ok: true, engine: { embedded: true, version: 'fixture-version' },
    context: { ready, target: `https://fixture.invalid/${engagement}/`, scope: [`https://fixture.invalid/${engagement}/`],
      workspace: `/fixture/${engagement}/assessment`, model: 'v1', ...context },
    assessment_policy: { scope: [`https://fixture.invalid/${engagement}/`], assessment_mode: 'src' } };
}

async function mount(t, Component, engagement, api) {
  let view;
  await act(async () => { view = create(h(Component, { engagement, api })); });
  t.after(() => { act(() => { view.unmount(); }); });
  return view;
}

async function update(view, Component, engagement, api) {
  await act(async () => { view.update(h(Component, { engagement, api })); });
}

async function settle(call, value) {
  await act(async () => { call.resolve(value); });
}

async function reject(call, error) {
  await act(async () => { call.reject(error); });
}

function assessmentButton(view, op, action = '', verify = '') {
  return view.root.findByProps({ 'data-assessment-operation': op, 'data-assessment-action': action, 'data-assessment-verify': verify });
}

function click(button) {
  assert.equal(Boolean(button.props.disabled), false);
  act(() => { button.props.onClick(); });
}

function inputValues(view) {
  return view.root.findAllByType('input').map(input => input.props.value);
}

function cursor(view, kind) {
  return view.root.findByProps({ 'data-assessment-cursor': kind });
}

function nextPage(view, kind) {
  return view.root.findByProps({ 'data-assessment-next': kind });
}

function contextState(view) {
  const node = view.root.findAllByType('p').find(item => item.props['data-assessment-context']);
  return { ready: node?.props['data-assessment-context'] === 'ready', text: node?.props.children ?? '' };
}

function dataLocations(view) {
  return view.root.findAllByType('p').filter(item => item.props.className === 'rt-mono').map(item => item.props.children);
}

function result(view) {
  const outputs = view.root.findAllByType('pre');
  assert(outputs.length <= 1);
  return outputs[0] ? JSON.parse(outputs[0].props.children) : null;
}

function errors(view) {
  return view.root.findAllByProps({ className: 'rt-err' }).map(error => error.props.children);
}

function report(view) {
  const output = view.root.findAllByType('pre');
  const paths = view.root.findAllByType('p').filter(item => item.props.className === 'rt-mono');
  return { markdown: output[0]?.props.children ?? null, path: paths[0]?.props.children ?? null };
}

const srcSave = view => view.root.findByProps({ 'data-src-action': 'save' });

test('an old preparation outcome stays with its original engagement and cannot refresh or overwrite the new page', async t => {
  const mock = mockApi();
  const view = await mount(t, AssessmentTab, 'eng-a', mock.api);
  await settle(mock.call('assessmentStatus', 'eng-a'), status('eng-a'));
  click(assessmentButton(view, 'assessmentStart'));
  const oldStart = mock.call('assessmentStart', 'eng-a');
  assert.deepEqual(oldStart.request, { op: 'assessmentStart', engagement: 'eng-a', target: 'https://fixture.invalid/eng-a/',
    scope: ['https://fixture.invalid/eng-a/'], assessmentModel: 'v1' });
  await update(view, AssessmentTab, 'eng-b', mock.api);
  await settle(mock.call('assessmentStatus', 'eng-b'), status('eng-b', true));
  await settle(oldStart, { ok: true, context: { ready: true }, fixture: 'old-prepare-a' });
  assert.equal(mock.calls.length, 3, 'obsolete outcomes do not issue a follow-up status request');
  assert.equal(contextState(view).ready, true);
  assert.deepEqual(dataLocations(view), ['/fixture/eng-b/assessment']);
  assert.equal(result(view), null);
  assert.deepEqual(errors(view), []);
});

test('an old preparation refresh cannot replace a new context or release the new pending operation', async t => {
  const mock = mockApi();
  const view = await mount(t, AssessmentTab, 'eng-a', mock.api);
  await settle(mock.call('assessmentStatus', 'eng-a'), status('eng-a'));
  click(assessmentButton(view, 'assessmentStart'));
  await settle(mock.call('assessmentStart', 'eng-a'), { ok: true, fixture: 'old-prepare-a' });
  const oldRefresh = mock.call('assessmentStatus', 'eng-a', undefined, 1);
  await update(view, AssessmentTab, 'eng-b', mock.api);
  assert.equal(result(view), null, 'the new engagement does not temporarily show the old result');
  assert.deepEqual(dataLocations(view), []);
  await settle(mock.call('assessmentStatus', 'eng-b'), status('eng-b', true));
  click(assessmentButton(view, 'assessmentReview', '', 'false'));
  const currentReview = mock.call('assessmentReview', 'eng-b', 'false');
  assert.equal(assessmentButton(view, 'assessmentStatus').props.disabled, true);
  await settle(oldRefresh, status('eng-a', true, { workspace: '/fixture/stale-a' }));
  assert.deepEqual(dataLocations(view), ['/fixture/eng-b/assessment']);
  assert.equal(result(view), null);
  assert.equal(assessmentButton(view, 'assessmentStatus').props.disabled, true, 'old finally cannot unlock the new request');
  await settle(currentReview, { ok: true, fixture: 'current-review-b', reviews: [] });
  assert.equal(result(view).fixture, 'current-review-b');
  assert.equal(assessmentButton(view, 'assessmentStatus').props.disabled, false);
});

test('a rejected old status request cannot expose its error on the next engagement', async t => {
  const mock = mockApi();
  const view = await mount(t, AssessmentTab, 'eng-a', mock.api);
  const old = mock.call('assessmentStatus', 'eng-a');
  await update(view, AssessmentTab, 'eng-b', mock.api);
  await settle(mock.call('assessmentStatus', 'eng-b'), status('eng-b', true));
  await reject(old, new Error('fixture-old-status-error'));
  assert.deepEqual(dataLocations(view), ['/fixture/eng-b/assessment']);
  assert.deepEqual(errors(view), []);
  assert.equal(mock.calls.length, 2);
});

test('two immediate preparation clicks submit once, then the current internal context is displayed', async t => {
  const mock = mockApi();
  const view = await mount(t, AssessmentTab, 'eng-a', mock.api);
  await settle(mock.call('assessmentStatus', 'eng-a'), status('eng-a'));
  const button = assessmentButton(view, 'assessmentStart');
  assert.equal(button.props.disabled, false);
  const onClick = button.props.onClick;
  act(() => { onClick(); onClick(); });
  assert.equal(mock.calls.filter(item => item.request.op === 'assessmentStart').length, 1);
  assert.equal(assessmentButton(view, 'assessmentStart').props.disabled, true);
  await settle(mock.call('assessmentStart', 'eng-a'), { ok: true, fixture: 'prepared-current-a' });
  assert.equal(assessmentButton(view, 'assessmentStart').props.disabled, true, 'the follow-up status read is part of the same operation');
  await settle(mock.call('assessmentStatus', 'eng-a', undefined, 1), status('eng-a', true));
  assert.deepEqual(dataLocations(view), ['/fixture/eng-a/assessment']);
  assert.equal(result(view).fixture, 'prepared-current-a');
  assert.equal(assessmentButton(view, 'assessmentStatus').props.disabled, false);
  assert.equal(mock.calls.length, 3);
});

test('a late initial read cannot roll back the context prepared by the deliberate current start', async t => {
  const mock = mockApi();
  const view = await mount(t, AssessmentTab, 'eng-a', mock.api);
  const initial = mock.call('assessmentStatus', 'eng-a');
  const inputs = view.root.findAllByType('input');
  act(() => {
    inputs[0].props.onChange({ target: { value: 'https://fixture.invalid/eng-a/new/' } });
    view.root.findByType('textarea').props.onChange({ target: { value: 'https://fixture.invalid/eng-a/new/' } });
    view.root.findByProps({ 'data-assessment-model': true }).props.onChange({ target: { value: 'v2' } });
  });
  click(assessmentButton(view, 'assessmentStart'));
  const started = mock.call('assessmentStart', 'eng-a');
  assert.deepEqual(started.request, { op: 'assessmentStart', engagement: 'eng-a', target: 'https://fixture.invalid/eng-a/new/',
    scope: ['https://fixture.invalid/eng-a/new/'], assessmentModel: 'v2' });
  await settle(started, { ok: true, fixture: 'prepared-current-context' });
  await settle(mock.call('assessmentStatus', 'eng-a', undefined, 1), status('eng-a', true,
    { target: 'https://fixture.invalid/eng-a/new/', model: 'v2' }));
  await settle(initial, status('eng-a', false));
  assert.equal(contextState(view).ready, true);
  assert(contextState(view).text.includes('https://fixture.invalid/eng-a/new/'));
  assert.deepEqual(dataLocations(view), ['/fixture/eng-a/assessment']);
  assert.equal(result(view).fixture, 'prepared-current-context');
});

test('unmounting during preparation preserves its submitted request without another refresh', async t => {
  const mock = mockApi();
  const view = await mount(t, AssessmentTab, 'eng-a', mock.api);
  await settle(mock.call('assessmentStatus', 'eng-a'), status('eng-a'));
  click(assessmentButton(view, 'assessmentStart'));
  const pending = mock.call('assessmentStart', 'eng-a');
  act(() => { view.unmount(); });
  await settle(pending, { ok: true, fixture: 'prepared-after-unmount' });
  assert.equal(view.toJSON(), null);
  assert.equal(mock.calls.length, 2);
  assert.equal(pending.request.engagement, 'eng-a');
});

test('current operation failures release the control without retrying, and a deliberate next operation can succeed', async t => {
  const mock = mockApi();
  const view = await mount(t, AssessmentTab, 'eng-a', mock.api);
  await settle(mock.call('assessmentStatus', 'eng-a'), status('eng-a', true));
  click(assessmentButton(view, 'assessmentReview', '', 'true'));
  await settle(mock.call('assessmentReview', 'eng-a', 'true'), { ok: false, error: 'fixture-current-failure' });
  assert.deepEqual(errors(view), ['fixture-current-failure']);
  assert.equal(mock.calls.length, 2, 'failure does not automatically resubmit');
  assert.equal(assessmentButton(view, 'assessmentReview', '', 'true').props.disabled, false);
  click(assessmentButton(view, 'assessmentReview', '', 'true'));
  await settle(mock.call('assessmentReview', 'eng-a', 'true', 1), { ok: true, fixture: 'manual-current-success' });
  assert.equal(result(view).fixture, 'manual-current-success');
  assert.deepEqual(errors(view), []);
  assert.equal(mock.calls.length, 3);
});

test('old SRC save success and failure cannot replace the current engagement report or error', async t => {
  for (const outcome of ['success', 'failure']) {
    const mock = mockApi();
    const view = await mount(t, SrcDiscoveryReport, 'eng-a', mock.api);
    await settle(mock.call('srcReport', 'eng-a'), { ok: true, markdown: 'fixture-initial-a' });
    click(srcSave(view));
    const oldSave = mock.calls.find(item => item.request.save === true);
    assert.deepEqual(oldSave.request, { op: 'srcReport', engagement: 'eng-a', save: true });
    await update(view, SrcDiscoveryReport, 'eng-b', mock.api);
    assert.deepEqual(report(view), { markdown: null, path: null }, 'the old report is cleared while the new engagement loads');
    await settle(mock.call('srcReport', 'eng-b'), { ok: true, markdown: 'fixture-current-b', path: '/fixture/eng-b/report.md' });
    click(srcSave(view));
    const currentSave = mock.calls.find(item => item.request.engagement === 'eng-b' && item.request.save === true);
    if (outcome === 'success') await settle(oldSave, { ok: true, markdown: 'fixture-obsolete-save-a', path: '/fixture/eng-a/report.md' });
    else await reject(oldSave, new Error('fixture-obsolete-save-error-a'));
    assert.deepEqual(report(view), { markdown: 'fixture-current-b', path: '/fixture/eng-b/report.md' });
    assert.deepEqual(errors(view), []);
    assert.equal(srcSave(view).props.disabled, true, 'the old save cannot release the new pending save');
    await settle(currentSave, { ok: true, markdown: 'fixture-saved-b', path: '/fixture/eng-b/saved.md' });
    assert.deepEqual(report(view), { markdown: 'fixture-saved-b', path: '/fixture/eng-b/saved.md' });
    assert.equal(mock.calls.length, 4);
    assert.equal(srcSave(view).props.disabled, false);
  }
});

test('immediate SRC save clicks submit once and an earlier initial report read cannot overwrite the saved local path', async t => {
  const mock = mockApi();
  const view = await mount(t, SrcDiscoveryReport, 'eng-a', mock.api);
  const initial = mock.call('srcReport', 'eng-a');
  const button = srcSave(view);
  const onClick = button.props.onClick;
  assert.equal(button.props.disabled, false);
  act(() => { onClick(); onClick(); });
  const saves = mock.calls.filter(item => item.request.save === true);
  assert.equal(saves.length, 1);
  assert.deepEqual(saves[0].request, { op: 'srcReport', engagement: 'eng-a', save: true });
  assert.equal(srcSave(view).props.disabled, true);
  await settle(saves[0], { ok: true, markdown: 'fixture-saved-current', path: '/fixture/eng-a/saved-report.md' });
  await settle(initial, { ok: true, markdown: 'fixture-earlier-read' });
  assert.deepEqual(report(view), { markdown: 'fixture-saved-current', path: '/fixture/eng-a/saved-report.md' });
  assert.equal(srcSave(view).props.disabled, false);
  assert.equal(mock.calls.length, 2, 'saving only calls the provided local API and does not fetch or retry');
});

test('SRC read and save outcomes after unmount cannot recreate the report or trigger another call', async t => {
  const mock = mockApi();
  const view = await mount(t, SrcDiscoveryReport, 'eng-a', mock.api);
  const initial = mock.call('srcReport', 'eng-a');
  click(srcSave(view));
  const save = mock.calls.find(item => item.request.save === true);
  act(() => { view.unmount(); });
  await settle(initial, { ok: true, markdown: 'fixture-read-after-unmount' });
  await settle(save, { ok: true, markdown: 'fixture-save-after-unmount', path: '/fixture/eng-a/report.md' });
  assert.equal(view.toJSON(), null);
  assert.equal(mock.calls.length, 2);
});

test('returning to the same engagement cannot reactivate old rendered handlers or their submitted outcomes', async t => {
  for (const Component of [AssessmentTab, SrcDiscoveryReport]) {
    const assessment = Component === AssessmentTab;
    const mock = mockApi();
    const view = await mount(t, Component, 'eng-a', mock.api);
    await settle(mock.calls[0], assessment ? status('eng-a') : { ok: true, markdown: 'fixture-first-a' });
    const oldHandler = (assessment ? assessmentButton(view, 'assessmentStart') : srcSave(view)).props.onClick;
    act(() => { oldHandler(); });
    const submitted = mock.calls[1];
    assert.equal(submitted.request.engagement, 'eng-a');
    await update(view, Component, 'eng-b', mock.api);
    await settle(mock.calls.at(-1), assessment ? status('eng-b', true) : { ok: true, markdown: 'fixture-b' });
    await update(view, Component, 'eng-a', mock.api);
    const currentRead = mock.calls.at(-1);
    assert.equal(currentRead.request.engagement, 'eng-a');
    await settle(currentRead, assessment ? status('eng-a', true)
      : { ok: true, markdown: 'fixture-current-a', path: '/fixture/eng-a/current-report.md' });
    assert.equal(mock.calls.length, 4);
    act(() => { oldHandler(); });
    assert.equal(mock.calls.length, 4, 'a stale handler does not borrow the new generation after an A/B/A switch');
    await settle(submitted, assessment ? { ok: true, fixture: 'obsolete-first-a' }
      : { ok: true, markdown: 'fixture-obsolete-first-save-a', path: '/fixture/eng-a/old-report.md' });
    assert.equal(mock.calls.length, 4, 'the first generation outcome cannot cause a new refresh');
    if (assessment) {
      assert.deepEqual(dataLocations(view), ['/fixture/eng-a/assessment']);
      assert.equal(result(view), null);
      assert.equal(assessmentButton(view, 'assessmentStatus').props.disabled, false);
    } else {
      assert.deepEqual(report(view), { markdown: 'fixture-current-a', path: '/fixture/eng-a/current-report.md' });
      assert.equal(srcSave(view).props.disabled, false);
    }
    assert.deepEqual(errors(view), []);
    act(() => { view.unmount(); });
  }
});

test('native assessment uses only the current engagement and provides no external package or project controls', async t => {
  const mock = mockApi();
  const view = await mount(t, AssessmentTab, 'eng-a', mock.api);
  const value = status('eng-a', true);
  value.config = { packagePath: '/fixture/external/awa', workspace: '/fixture/external/data', pythonExecutable: 'external-python' };
  value.binding = { project_id: 'external-project' };
  await settle(mock.call('assessmentStatus', 'eng-a'), value);
  assert.deepEqual(inputValues(view), ['0', '0']);
  assert.equal(view.root.findAllByType('textarea').length, 0);
  assert.deepEqual(dataLocations(view), ['/fixture/eng-a/assessment']);
  click(assessmentButton(view, 'assessmentImport'));
  const imported = mock.call('assessmentImport', 'eng-a');
  assert.deepEqual(imported.request, { op: 'assessmentImport', engagement: 'eng-a', offset: 0, limit: 50 });
  await settle(imported, { ok: true, fixture: 'native-import', project_id: 'internal-private-id', packagePath: '/fixture/engine' });
  assert.deepEqual(result(view), { ok: true, fixture: 'native-import' });
  click(assessmentButton(view, 'assessmentRun', 'project.status'));
  const inspected = mock.call('assessmentRun', 'eng-a', 'project.status');
  assert.deepEqual(inspected.request, { op: 'assessmentRun', engagement: 'eng-a', action: 'project.status', input: { limit: 3 } });
  await settle(inspected, { ok: true, fixture: 'native-current-status' });
  click(assessmentButton(view, 'assessmentReview', '', 'true'));
  assert.deepEqual(mock.call('assessmentReview', 'eng-a', 'true').request,
    { op: 'assessmentReview', engagement: 'eng-a', verify: true, offset: 0, limit: 50 });
  assert.equal(mock.calls.every(call => !Object.keys(call.request).some(key => ['project_id', 'packagePath', 'workspace', 'config'].includes(key))), true);
});

test('importing the second source page keeps review at zero, and each next-page result advances only its own cursor', async t => {
  const mock = mockApi();
  const view = await mount(t, AssessmentTab, 'eng-a', mock.api);
  await settle(mock.call('assessmentStatus', 'eng-a'), status('eng-a', true));
  click(assessmentButton(view, 'assessmentImport'));
  await settle(mock.call('assessmentImport', 'eng-a'), { ok: true, page_kind: 'source_candidates', next_offset: 50 });
  click(nextPage(view, 'source_candidates'));
  assert.equal(cursor(view, 'source_candidates').props.value, '50');
  assert.equal(cursor(view, 'assessment_candidates').props.value, '0');
  click(assessmentButton(view, 'assessmentImport'));
  const secondImport = mock.call('assessmentImport', 'eng-a', undefined, 1);
  assert.deepEqual(secondImport.request, { op: 'assessmentImport', engagement: 'eng-a', offset: 50, limit: 50 });
  await settle(secondImport, { ok: true, page_kind: 'source_candidates', next_offset: 100 });
  click(assessmentButton(view, 'assessmentReview', '', 'false'));
  const firstReview = mock.call('assessmentReview', 'eng-a', 'false');
  assert.deepEqual(firstReview.request, { op: 'assessmentReview', engagement: 'eng-a', verify: false, offset: 0, limit: 50 });
  await settle(firstReview, { ok: true, page_kind: 'assessment_candidates', next_offset: 50, reviews: [] });
  click(nextPage(view, 'assessment_candidates'));
  assert.equal(cursor(view, 'source_candidates').props.value, '50');
  assert.equal(cursor(view, 'assessment_candidates').props.value, '50');
  click(assessmentButton(view, 'assessmentReview', '', 'true'));
  assert.deepEqual(mock.call('assessmentReview', 'eng-a', 'true').request,
    { op: 'assessmentReview', engagement: 'eng-a', verify: true, offset: 50, limit: 50 });
  await settle(mock.call('assessmentReview', 'eng-a', 'true'), { ok: true, page_kind: 'assessment_candidates', next_offset: null });
  assert.equal(view.root.findAll(node => node.props['data-assessment-next']).length, 0);
});

test('operation-based next-page fallback preserves separate cursors and stale page handlers cannot affect a new engagement', async t => {
  const mock = mockApi();
  const view = await mount(t, AssessmentTab, 'eng-a', mock.api);
  await settle(mock.call('assessmentStatus', 'eng-a'), status('eng-a', true));
  click(assessmentButton(view, 'assessmentImport'));
  await settle(mock.call('assessmentImport', 'eng-a'), { ok: true, next_offset: 50 });
  const oldSourceNext = nextPage(view, 'source_candidates').props.onClick;
  click(nextPage(view, 'source_candidates'));
  click(assessmentButton(view, 'assessmentReview', '', 'false'));
  await settle(mock.call('assessmentReview', 'eng-a', 'false'), { ok: true, next_offset: 25, reviews: [] });
  const oldReviewNext = nextPage(view, 'assessment_candidates').props.onClick;
  click(nextPage(view, 'assessment_candidates'));
  assert.equal(cursor(view, 'source_candidates').props.value, '50');
  assert.equal(cursor(view, 'assessment_candidates').props.value, '25');
  await update(view, AssessmentTab, 'eng-b', mock.api);
  await settle(mock.call('assessmentStatus', 'eng-b'), status('eng-b', true));
  assert.deepEqual(inputValues(view), ['0', '0']);
  act(() => { oldSourceNext(); oldReviewNext(); });
  assert.deepEqual(inputValues(view), ['0', '0']);
  assert.equal(result(view), null);
  assert.equal(mock.calls.length, 4);
});
