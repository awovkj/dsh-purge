import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { create, act } from "react-test-renderer";
import {
  AssessmentTab,
  SrcDiscoveryReport,
  PentestReport,
  assessmentModeLabel,
  assessmentModeOptions,
  assessmentTabsForMode,
  isScopedAssessmentMode,
  FindingSubmission,
  AssessmentDeliveryReport,
} from "../src/community/awa-evidence.js";
import { __dshPurgeDrill } from "../src/vendor/drill.js";

const h = React.createElement;

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function mockApi() {
  const calls = [];
  const api = (request) => {
    const pending = deferred();
    const call = { request: structuredClone(request), ...pending };
    calls.push(call);
    return pending.promise;
  };
  const call = (op, engagement, qualifier, index = 0) => {
    const matching = calls.filter(
      (item) =>
        item.request.op === op &&
        item.request.engagement === engagement &&
        (qualifier === undefined ||
          (item.request.action ||
            (typeof item.request.verify === "boolean"
              ? String(item.request.verify)
              : "")) === qualifier),
    );
    assert(
      matching[index],
      `Expected recorded fixture call ${op}/${engagement}/${qualifier ?? ""}/${index}`,
    );
    return matching[index];
  };
  return { api, calls, call };
}

function status(engagement, ready = false, context = {}) {
  return {
    ok: true,
    engine: { embedded: true, version: "fixture-version" },
    context: {
      ready,
      target: `https://fixture.invalid/${engagement}/`,
      scope: [`https://fixture.invalid/${engagement}/`],
      workspace: `/fixture/${engagement}/assessment`,
      model: "v1",
      ...context,
    },
    assessment_policy: {
      scope: [`https://fixture.invalid/${engagement}/`],
      assessment_mode: "src",
    },
  };
}

async function mount(t, Component, engagement, api) {
  let view;
  await act(async () => {
    view = create(h(Component, { engagement, api }));
  });
  t.after(() => {
    act(() => {
      view.unmount();
    });
  });
  return view;
}

async function update(view, Component, engagement, api) {
  await act(async () => {
    view.update(h(Component, { engagement, api }));
  });
}

async function settle(call, value) {
  await act(async () => {
    call.resolve(value);
  });
}

async function reject(call, error) {
  await act(async () => {
    call.reject(error);
  });
}

function assessmentButton(view, op, action = "", verify = "") {
  return view.root.findByProps({
    "data-assessment-operation": op,
    "data-assessment-action": action,
    "data-assessment-verify": verify,
  });
}

function click(button) {
  assert.equal(Boolean(button.props.disabled), false);
  act(() => {
    button.props.onClick();
  });
}

function deliveryAction(view, action) {
  return view.root.findByProps({ "data-delivery-action": action });
}

test("delivery fallback pages keep score, findings and SRC stops on independent cursors", async (t) => {
  const mock = mockApi();
  const view = await mount(
    t,
    AssessmentDeliveryReport,
    "eng-delivery",
    mock.api,
  );
  click(deliveryAction(view, "read"));
  assert.deepEqual(mock.call("assessmentReport", "eng-delivery").request, {
    op: "assessmentReport",
    engagement: "eng-delivery",
    save: false,
    offset: 0,
    finding_offset: 0,
    stop_offset: 0,
    limit: 50,
  });
  const page = (score, finding, stop) => ({
    ok: true,
    assessment_mode: "src",
    markdown: "bounded fixture delivery",
    score: {
      offset: score,
      next_offset: score < 150 ? 150 : null,
      summary: {},
    },
    findings: {
      offset: finding,
      next_offset: finding < 50 ? 50 : null,
      registered_total: 51,
    },
    src_stops: { offset: stop, next_offset: stop < 9 ? 9 : null, targets: 10 },
    assessment: { state: "unfinished" },
    requests_sent: 0,
  });
  await settle(mock.call("assessmentReport", "eng-delivery"), page(100, 40, 7));
  click(deliveryAction(view, "next-stops"));
  const stops = mock.call("assessmentReport", "eng-delivery", undefined, 1);
  assert.deepEqual(stops.request, {
    op: "assessmentReport",
    engagement: "eng-delivery",
    save: false,
    offset: 100,
    finding_offset: 40,
    stop_offset: 9,
    limit: 50,
  });
  await settle(stops, page(100, 40, 9));
  click(deliveryAction(view, "next-findings"));
  const findings = mock.call("assessmentReport", "eng-delivery", undefined, 2);
  assert.equal(findings.request.finding_offset, 50);
  assert.equal(findings.request.stop_offset, 9);
  assert.equal(findings.request.offset, 100);
  await settle(findings, page(100, 50, 9));
  click(deliveryAction(view, "next-score"));
  const score = mock.call("assessmentReport", "eng-delivery", undefined, 3);
  assert.equal(score.request.offset, 150);
  assert.equal(score.request.finding_offset, 50);
  assert.equal(score.request.stop_offset, 9);
  await settle(score, page(150, 50, 9));
  assert.equal(deliveryAction(view, "next-findings").props.disabled, true);
  assert.equal(deliveryAction(view, "next-stops").props.disabled, true);
  click(deliveryAction(view, "save"));
  const saved = mock.call("assessmentReport", "eng-delivery", undefined, 4);
  assert.deepEqual(saved.request, { ...score.request, save: true });
  await settle(saved, page(150, 50, 9));
});

test("delivery follows signed next arguments without offsets and resets a stop-only page", async (t) => {
  const mock = mockApi();
  const view = await mount(
    t,
    AssessmentDeliveryReport,
    "eng-signed-delivery",
    mock.api,
  );
  click(deliveryAction(view, "read"));
  await settle(mock.call("assessmentReport", "eng-signed-delivery"), {
    ok: true,
    assessment_mode: "src",
    markdown: "first fixture",
    score: { offset: 0 },
    findings: { offset: 0 },
    src_stops: { offset: 0 },
    next: {
      arguments: {
        engagement: "eng-signed-delivery",
        page_token: "signed-fixture-next",
      },
    },
  });
  click(deliveryAction(view, "next"));
  const next = mock.call(
    "assessmentReport",
    "eng-signed-delivery",
    undefined,
    1,
  );
  assert.deepEqual(next.request, {
    op: "assessmentReport",
    engagement: "eng-signed-delivery",
    save: false,
    page_token: "signed-fixture-next",
  });
  await settle(next, {
    ok: true,
    assessment_mode: "src",
    markdown: "stop-only fixture",
    score: { offset: 0, next_offset: null },
    findings: { offset: 0, next_offset: null },
    src_stops: { offset: 12, next_offset: null },
  });
  click(deliveryAction(view, "first"));
  const first = mock.call(
    "assessmentReport",
    "eng-signed-delivery",
    undefined,
    2,
  );
  assert.equal(first.request.offset, 0);
  assert.equal(first.request.finding_offset, 0);
  assert.equal(first.request.stop_offset, 0);
  assert.equal(Object.hasOwn(first.request, "page_token"), false);
  await settle(first, {
    ok: true,
    assessment_mode: "src",
    markdown: "first again",
  });
  await update(view, AssessmentDeliveryReport, "eng-other-delivery", mock.api);
  click(deliveryAction(view, "read"));
  const other = mock.call("assessmentReport", "eng-other-delivery");
  assert.equal(other.request.stop_offset, 0);
  assert.equal(other.request.finding_offset, 0);
  assert.equal(other.request.offset, 0);
  await settle(other, {
    ok: true,
    assessment_mode: "src",
    markdown: "other engagement",
  });
});

function inputValues(view) {
  return view.root
    .findAllByType("input")
    .filter((input) => input.props["data-assessment-cursor"])
    .map((input) => input.props.value);
}

function cursor(view, kind) {
  return view.root.findByProps({ "data-assessment-cursor": kind });
}

function nextPage(view, kind) {
  return view.root.findByProps({ "data-assessment-next": kind });
}

function contextState(view) {
  const node = view.root
    .findAllByType("p")
    .find((item) => item.props["data-assessment-context"]);
  return {
    ready: node?.props["data-assessment-context"] === "ready",
    text: node?.props.children ?? "",
  };
}

function dataLocations(view) {
  return view.root
    .findAllByType("p")
    .filter((item) => item.props.className === "rt-mono")
    .map((item) => item.props.children);
}

function result(view) {
  const outputs = view.root.findAllByType("pre");
  assert(outputs.length <= 1);
  return outputs[0] ? JSON.parse(outputs[0].props.children) : null;
}

function errors(view) {
  return view.root
    .findAllByProps({ className: "rt-err" })
    .map((error) => error.props.children);
}

function report(view) {
  const output = view.root.findAllByType("pre");
  const paths = view.root
    .findAllByType("p")
    .filter((item) => item.props.className === "rt-mono");
  return {
    markdown: output[0]?.props.children ?? null,
    path: paths[0]?.props.children ?? null,
  };
}

const srcSave = (view) => view.root.findByProps({ "data-src-action": "save" });
const pentestAction = (view, action) =>
  view.root.findByProps({ "data-pentest-action": action });
const pentestMarkdown = (view) =>
  view.root.findAllByProps({ "data-pentest-report": "markdown" })[0]?.props
    .children ?? null;
const pentestSnapshot = (view) =>
  view.root.findAllByProps({ "data-pentest-report": "json" })[0]?.props
    .children ?? null;
const pentestPath = (view, kind) =>
  view.root.findAllByProps({ "data-pentest-path": kind })[0]?.props.children ??
  null;

test("pentest mode uses scoped labels and only the asset, assessment, finding, and report tabs", () => {
  assert.equal(isScopedAssessmentMode("pentest"), true);
  assert.equal(isScopedAssessmentMode("src"), true);
  assert.equal(isScopedAssessmentMode("redteam"), false);
  assert.equal(assessmentModeLabel("redteam"), "[红队] ");
  assert.equal(assessmentModeLabel("src"), "[SRC] ");
  assert.equal(assessmentModeLabel("pentest"), "[渗透] ");
  assert.deepEqual(
    assessmentModeOptions.map((item) => item[0]),
    ["src", "pentest", "redteam"],
  );
  const tabs = [
    ["assets", "资产"],
    ["evidence", "内置评估"],
    ["agents", "智能体"],
    ["findings", "发现"],
    ["sessions", "会话隧道"],
    ["scores", "得分目标"],
    ["report", "报告"],
  ];
  assert.deepEqual(
    assessmentTabsForMode("pentest", tabs).map((tab) => tab[0]),
    ["assets", "evidence", "findings", "report"],
  );
  assert.deepEqual(
    assessmentTabsForMode("src", tabs).map((tab) => tab[0]),
    ["assets", "evidence", "agents", "findings", "report"],
  );
  assert.equal(assessmentTabsForMode("redteam", tabs), tabs);
});

test("an old preparation outcome stays with its original engagement and cannot refresh or overwrite the new page", async (t) => {
  const mock = mockApi();
  const view = await mount(t, AssessmentTab, "eng-a", mock.api);
  await settle(mock.call("assessmentStatus", "eng-a"), status("eng-a"));
  click(assessmentButton(view, "assessmentStart"));
  const oldStart = mock.call("assessmentStart", "eng-a");
  assert.deepEqual(oldStart.request, {
    op: "assessmentStart",
    engagement: "eng-a",
    target: "https://fixture.invalid/eng-a/",
    scope: ["https://fixture.invalid/eng-a/"],
    assessmentModel: "v1",
  });
  await update(view, AssessmentTab, "eng-b", mock.api);
  await settle(mock.call("assessmentStatus", "eng-b"), status("eng-b", true));
  await settle(oldStart, {
    ok: true,
    context: { ready: true },
    fixture: "old-prepare-a",
  });
  assert.equal(
    mock.calls.length,
    3,
    "obsolete outcomes do not issue a follow-up status request",
  );
  assert.equal(contextState(view).ready, true);
  assert.deepEqual(dataLocations(view), ["/fixture/eng-b/assessment"]);
  assert.equal(result(view), null);
  assert.deepEqual(errors(view), []);
});

test("an old preparation refresh cannot replace a new context or release the new pending operation", async (t) => {
  const mock = mockApi();
  const view = await mount(t, AssessmentTab, "eng-a", mock.api);
  await settle(mock.call("assessmentStatus", "eng-a"), status("eng-a"));
  click(assessmentButton(view, "assessmentStart"));
  await settle(mock.call("assessmentStart", "eng-a"), {
    ok: true,
    fixture: "old-prepare-a",
  });
  const oldRefresh = mock.call("assessmentStatus", "eng-a", undefined, 1);
  await update(view, AssessmentTab, "eng-b", mock.api);
  assert.equal(
    result(view),
    null,
    "the new engagement does not temporarily show the old result",
  );
  assert.deepEqual(dataLocations(view), []);
  await settle(mock.call("assessmentStatus", "eng-b"), status("eng-b", true));
  click(assessmentButton(view, "assessmentReview", "", "false"));
  const currentReview = mock.call("assessmentReview", "eng-b", "false");
  assert.equal(assessmentButton(view, "assessmentStatus").props.disabled, true);
  await settle(
    oldRefresh,
    status("eng-a", true, { workspace: "/fixture/stale-a" }),
  );
  assert.deepEqual(dataLocations(view), ["/fixture/eng-b/assessment"]);
  assert.equal(result(view), null);
  assert.equal(
    assessmentButton(view, "assessmentStatus").props.disabled,
    true,
    "old finally cannot unlock the new request",
  );
  await settle(currentReview, {
    ok: true,
    fixture: "current-review-b",
    reviews: [],
  });
  assert.equal(result(view).fixture, "current-review-b");
  assert.equal(
    assessmentButton(view, "assessmentStatus").props.disabled,
    false,
  );
});

test("a rejected old status request cannot expose its error on the next engagement", async (t) => {
  const mock = mockApi();
  const view = await mount(t, AssessmentTab, "eng-a", mock.api);
  const old = mock.call("assessmentStatus", "eng-a");
  await update(view, AssessmentTab, "eng-b", mock.api);
  await settle(mock.call("assessmentStatus", "eng-b"), status("eng-b", true));
  await reject(old, new Error("fixture-old-status-error"));
  assert.deepEqual(dataLocations(view), ["/fixture/eng-b/assessment"]);
  assert.deepEqual(errors(view), []);
  assert.equal(mock.calls.length, 2);
});

test("two immediate preparation clicks submit once, then the current internal context is displayed", async (t) => {
  const mock = mockApi();
  const view = await mount(t, AssessmentTab, "eng-a", mock.api);
  await settle(mock.call("assessmentStatus", "eng-a"), status("eng-a"));
  const button = assessmentButton(view, "assessmentStart");
  assert.equal(button.props.disabled, false);
  const onClick = button.props.onClick;
  act(() => {
    onClick();
    onClick();
  });
  assert.equal(
    mock.calls.filter((item) => item.request.op === "assessmentStart").length,
    1,
  );
  assert.equal(assessmentButton(view, "assessmentStart").props.disabled, true);
  await settle(mock.call("assessmentStart", "eng-a"), {
    ok: true,
    fixture: "prepared-current-a",
  });
  assert.equal(
    assessmentButton(view, "assessmentStart").props.disabled,
    true,
    "the follow-up status read is part of the same operation",
  );
  await settle(
    mock.call("assessmentStatus", "eng-a", undefined, 1),
    status("eng-a", true),
  );
  assert.deepEqual(dataLocations(view), ["/fixture/eng-a/assessment"]);
  assert.equal(result(view).fixture, "prepared-current-a");
  assert.equal(
    assessmentButton(view, "assessmentStatus").props.disabled,
    false,
  );
  assert.equal(mock.calls.length, 3);
});

test("a late initial read cannot roll back the context prepared by the deliberate current start", async (t) => {
  const mock = mockApi();
  const view = await mount(t, AssessmentTab, "eng-a", mock.api);
  const initial = mock.call("assessmentStatus", "eng-a");
  const targetInput = view.root
    .findAllByType("input")
    .find((input) => input.props.placeholder === "https://example.test/app");
  assert(targetInput);
  act(() => {
    targetInput.props.onChange({
      target: { value: "https://fixture.invalid/eng-a/new/" },
    });
    view.root.findByType("textarea").props.onChange({
      target: { value: "https://fixture.invalid/eng-a/new/" },
    });
    view.root
      .findByProps({ "data-assessment-model": true })
      .props.onChange({ target: { value: "v2" } });
  });
  click(assessmentButton(view, "assessmentStart"));
  const started = mock.call("assessmentStart", "eng-a");
  assert.deepEqual(started.request, {
    op: "assessmentStart",
    engagement: "eng-a",
    target: "https://fixture.invalid/eng-a/new/",
    scope: ["https://fixture.invalid/eng-a/new/"],
    assessmentModel: "v2",
  });
  await settle(started, { ok: true, fixture: "prepared-current-context" });
  await settle(
    mock.call("assessmentStatus", "eng-a", undefined, 1),
    status("eng-a", true, {
      target: "https://fixture.invalid/eng-a/new/",
      model: "v2",
    }),
  );
  await settle(initial, status("eng-a", false));
  assert.equal(contextState(view).ready, true);
  assert(
    contextState(view).text.includes("https://fixture.invalid/eng-a/new/"),
  );
  assert.deepEqual(dataLocations(view), ["/fixture/eng-a/assessment"]);
  assert.equal(result(view).fixture, "prepared-current-context");
});

test("unmounting during preparation preserves its submitted request without another refresh", async (t) => {
  const mock = mockApi();
  const view = await mount(t, AssessmentTab, "eng-a", mock.api);
  await settle(mock.call("assessmentStatus", "eng-a"), status("eng-a"));
  click(assessmentButton(view, "assessmentStart"));
  const pending = mock.call("assessmentStart", "eng-a");
  act(() => {
    view.unmount();
  });
  await settle(pending, { ok: true, fixture: "prepared-after-unmount" });
  assert.equal(view.toJSON(), null);
  assert.equal(mock.calls.length, 2);
  assert.equal(pending.request.engagement, "eng-a");
});

test("current operation failures release the control without retrying, and a deliberate next operation can succeed", async (t) => {
  const mock = mockApi();
  const view = await mount(t, AssessmentTab, "eng-a", mock.api);
  await settle(mock.call("assessmentStatus", "eng-a"), status("eng-a", true));
  click(assessmentButton(view, "assessmentReview", "", "true"));
  await settle(mock.call("assessmentReview", "eng-a", "true"), {
    ok: false,
    error: "fixture-current-failure",
  });
  assert.deepEqual(errors(view), ["fixture-current-failure"]);
  assert.equal(mock.calls.length, 2, "failure does not automatically resubmit");
  assert.equal(
    assessmentButton(view, "assessmentReview", "", "true").props.disabled,
    false,
  );
  click(assessmentButton(view, "assessmentReview", "", "true"));
  await settle(mock.call("assessmentReview", "eng-a", "true", 1), {
    ok: true,
    fixture: "manual-current-success",
  });
  assert.equal(result(view).fixture, "manual-current-success");
  assert.deepEqual(errors(view), []);
  assert.equal(mock.calls.length, 3);
});

test("old SRC save success and failure cannot replace the current engagement report or error", async (t) => {
  for (const outcome of ["success", "failure"]) {
    const mock = mockApi();
    const view = await mount(t, SrcDiscoveryReport, "eng-a", mock.api);
    await settle(mock.call("srcReport", "eng-a"), {
      ok: true,
      markdown: "fixture-initial-a",
    });
    click(srcSave(view));
    const oldSave = mock.calls.find((item) => item.request.save === true);
    assert.deepEqual(oldSave.request, {
      op: "srcReport",
      engagement: "eng-a",
      save: true,
    });
    await update(view, SrcDiscoveryReport, "eng-b", mock.api);
    assert.deepEqual(
      report(view),
      { markdown: null, path: null },
      "the old report is cleared while the new engagement loads",
    );
    await settle(mock.call("srcReport", "eng-b"), {
      ok: true,
      markdown: "fixture-current-b",
      path: "/fixture/eng-b/report.md",
    });
    click(srcSave(view));
    const currentSave = mock.calls.find(
      (item) =>
        item.request.engagement === "eng-b" && item.request.save === true,
    );
    if (outcome === "success")
      await settle(oldSave, {
        ok: true,
        markdown: "fixture-obsolete-save-a",
        path: "/fixture/eng-a/report.md",
      });
    else await reject(oldSave, new Error("fixture-obsolete-save-error-a"));
    assert.deepEqual(report(view), {
      markdown: "fixture-current-b",
      path: "/fixture/eng-b/report.md",
    });
    assert.deepEqual(errors(view), []);
    assert.equal(
      srcSave(view).props.disabled,
      true,
      "the old save cannot release the new pending save",
    );
    await settle(currentSave, {
      ok: true,
      markdown: "fixture-saved-b",
      path: "/fixture/eng-b/saved.md",
    });
    assert.deepEqual(report(view), {
      markdown: "fixture-saved-b",
      path: "/fixture/eng-b/saved.md",
    });
    assert.equal(mock.calls.length, 4);
    assert.equal(srcSave(view).props.disabled, false);
  }
});

test("immediate SRC save clicks submit once and an earlier initial report read cannot overwrite the saved local path", async (t) => {
  const mock = mockApi();
  const view = await mount(t, SrcDiscoveryReport, "eng-a", mock.api);
  const initial = mock.call("srcReport", "eng-a");
  const button = srcSave(view);
  const onClick = button.props.onClick;
  assert.equal(button.props.disabled, false);
  act(() => {
    onClick();
    onClick();
  });
  const saves = mock.calls.filter((item) => item.request.save === true);
  assert.equal(saves.length, 1);
  assert.deepEqual(saves[0].request, {
    op: "srcReport",
    engagement: "eng-a",
    save: true,
  });
  assert.equal(srcSave(view).props.disabled, true);
  await settle(saves[0], {
    ok: true,
    markdown: "fixture-saved-current",
    path: "/fixture/eng-a/saved-report.md",
  });
  await settle(initial, { ok: true, markdown: "fixture-earlier-read" });
  assert.deepEqual(report(view), {
    markdown: "fixture-saved-current",
    path: "/fixture/eng-a/saved-report.md",
  });
  assert.equal(srcSave(view).props.disabled, false);
  assert.equal(
    mock.calls.length,
    2,
    "saving only calls the provided local API and does not fetch or retry",
  );
});

test("SRC read and save outcomes after unmount cannot recreate the report or trigger another call", async (t) => {
  const mock = mockApi();
  const view = await mount(t, SrcDiscoveryReport, "eng-a", mock.api);
  const initial = mock.call("srcReport", "eng-a");
  click(srcSave(view));
  const save = mock.calls.find((item) => item.request.save === true);
  act(() => {
    view.unmount();
  });
  await settle(initial, { ok: true, markdown: "fixture-read-after-unmount" });
  await settle(save, {
    ok: true,
    markdown: "fixture-save-after-unmount",
    path: "/fixture/eng-a/report.md",
  });
  assert.equal(view.toJSON(), null);
  assert.equal(mock.calls.length, 2);
});

test("returning to the same engagement cannot reactivate old rendered handlers or their submitted outcomes", async (t) => {
  for (const Component of [AssessmentTab, SrcDiscoveryReport]) {
    const assessment = Component === AssessmentTab;
    const mock = mockApi();
    const view = await mount(t, Component, "eng-a", mock.api);
    await settle(
      mock.calls[0],
      assessment ? status("eng-a") : { ok: true, markdown: "fixture-first-a" },
    );
    const oldHandler = (
      assessment ? assessmentButton(view, "assessmentStart") : srcSave(view)
    ).props.onClick;
    act(() => {
      oldHandler();
    });
    const submitted = mock.calls[1];
    assert.equal(submitted.request.engagement, "eng-a");
    await update(view, Component, "eng-b", mock.api);
    await settle(
      mock.calls.at(-1),
      assessment ? status("eng-b", true) : { ok: true, markdown: "fixture-b" },
    );
    await update(view, Component, "eng-a", mock.api);
    const currentRead = mock.calls.at(-1);
    assert.equal(currentRead.request.engagement, "eng-a");
    await settle(
      currentRead,
      assessment
        ? status("eng-a", true)
        : {
            ok: true,
            markdown: "fixture-current-a",
            path: "/fixture/eng-a/current-report.md",
          },
    );
    assert.equal(mock.calls.length, 4);
    act(() => {
      oldHandler();
    });
    assert.equal(
      mock.calls.length,
      4,
      "a stale handler does not borrow the new generation after an A/B/A switch",
    );
    await settle(
      submitted,
      assessment
        ? { ok: true, fixture: "obsolete-first-a" }
        : {
            ok: true,
            markdown: "fixture-obsolete-first-save-a",
            path: "/fixture/eng-a/old-report.md",
          },
    );
    assert.equal(
      mock.calls.length,
      4,
      "the first generation outcome cannot cause a new refresh",
    );
    if (assessment) {
      assert.deepEqual(dataLocations(view), ["/fixture/eng-a/assessment"]);
      assert.equal(result(view), null);
      assert.equal(
        assessmentButton(view, "assessmentStatus").props.disabled,
        false,
      );
    } else {
      assert.deepEqual(report(view), {
        markdown: "fixture-current-a",
        path: "/fixture/eng-a/current-report.md",
      });
      assert.equal(srcSave(view).props.disabled, false);
    }
    assert.deepEqual(errors(view), []);
    act(() => {
      view.unmount();
    });
  }
});

test("pentest report reads and saves one complete Markdown and JSON snapshot without pagination", async (t) => {
  const mock = mockApi();
  const view = await mount(t, PentestReport, "eng-pentest", mock.api);
  const initial = mock.call("pentestReport", "eng-pentest");
  assert.deepEqual(initial.request, {
    op: "pentestReport",
    engagement: "eng-pentest",
    save: false,
  });
  await settle(initial, {
    ok: true,
    assessment_mode: "pentest",
    markdown: "# 渗透测试报告\n\n当前成果",
    report: {
      engagement: { id: "eng-pentest" },
      findings: [{ id: 7, title: "示例发现" }],
      assets: [],
    },
    requests_sent: 0,
  });
  assert.equal(pentestMarkdown(view), "# 渗透测试报告\n\n当前成果");
  assert.deepEqual(JSON.parse(pentestSnapshot(view)).findings, [
    { id: 7, title: "示例发现" },
  ]);
  const saveButton = pentestAction(view, "save");
  const saveOnClick = saveButton.props.onClick;
  act(() => {
    saveOnClick();
    saveOnClick();
  });
  assert.equal(
    mock.calls.filter((call) => call.request.save === true).length,
    1,
  );
  const saved = mock.call("pentestReport", "eng-pentest", undefined, 1);
  assert.deepEqual(saved.request, {
    op: "pentestReport",
    engagement: "eng-pentest",
    save: true,
  });
  await settle(saved, {
    ok: true,
    assessment_mode: "pentest",
    markdown: "# 已保存报告",
    report: { engagement: { id: "eng-pentest" }, findings: [], assets: [] },
    path: "/fixture/eng-pentest/pentest-report.md",
    json_path: "/fixture/eng-pentest/pentest-report.json",
    requests_sent: 0,
  });
  assert.equal(pentestMarkdown(view), "# 已保存报告");
  assert.equal(
    pentestPath(view, "markdown"),
    "Markdown：/fixture/eng-pentest/pentest-report.md",
  );
  assert.equal(
    pentestPath(view, "json"),
    "JSON：/fixture/eng-pentest/pentest-report.json",
  );
  assert.equal(mock.calls.length, 2);
  assert.equal(
    mock.calls.every(
      (call) =>
        !Object.hasOwn(call.request, "offset") &&
        !Object.hasOwn(call.request, "limit") &&
        !Object.hasOwn(call.request, "finding_offset"),
    ),
    true,
  );
});

test("pentest report ignores stale reads, saves, and rendered handlers across engagement and API switches", async (t) => {
  const firstApi = mockApi();
  const view = await mount(t, PentestReport, "eng-a", firstApi.api);
  const oldRead = firstApi.call("pentestReport", "eng-a");
  await update(view, PentestReport, "eng-b", firstApi.api);
  assert.equal(
    pentestMarkdown(view),
    null,
    "the previous report is cleared while the next engagement loads",
  );
  await settle(firstApi.call("pentestReport", "eng-b"), {
    ok: true,
    assessment_mode: "pentest",
    markdown: "fixture-current-b",
    report: { fixture: "current-b" },
    requests_sent: 0,
  });
  await settle(oldRead, {
    ok: true,
    assessment_mode: "pentest",
    markdown: "fixture-obsolete-a",
    report: { fixture: "obsolete-a" },
    requests_sent: 0,
  });
  assert.equal(pentestMarkdown(view), "fixture-current-b");
  click(pentestAction(view, "save"));
  const oldSave = firstApi.call("pentestReport", "eng-b", undefined, 1);
  const staleSaveHandler = pentestAction(view, "save").props.onClick;

  const secondApi = mockApi();
  await update(view, PentestReport, "eng-b", secondApi.api);
  assert.equal(
    pentestMarkdown(view),
    null,
    "changing the API invalidates the prior report",
  );
  await settle(secondApi.call("pentestReport", "eng-b"), {
    ok: true,
    assessment_mode: "pentest",
    markdown: "fixture-current-api",
    report: { fixture: "current-api" },
    path: "/fixture/current-api/report.md",
    json_path: "/fixture/current-api/report.json",
    requests_sent: 0,
  });
  act(() => {
    staleSaveHandler();
  });
  assert.equal(
    secondApi.calls.length,
    1,
    "a stale rendered handler cannot submit into the replacement API generation",
  );
  await settle(oldSave, {
    ok: true,
    assessment_mode: "pentest",
    markdown: "fixture-obsolete-save",
    report: { fixture: "obsolete-save" },
    path: "/fixture/obsolete/report.md",
    requests_sent: 0,
  });
  assert.equal(pentestMarkdown(view), "fixture-current-api");
  assert.equal(
    pentestPath(view, "markdown"),
    "Markdown：/fixture/current-api/report.md",
  );
  assert.equal(pentestAction(view, "save").props.disabled, false);
  assert.deepEqual(errors(view), []);
});

test("pentest report downloads the displayed Markdown and structured JSON snapshot", async (t) => {
  const originalDocument = globalThis.document;
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const blobs = [];
  const links = [];
  globalThis.document = {
    createElement(tagName) {
      const link = {
        tagName,
        click() {
          links.push(link);
        },
      };
      return link;
    },
  };
  URL.createObjectURL = (blob) => {
    blobs.push(blob);
    return `blob:fixture-${blobs.length}`;
  };
  URL.revokeObjectURL = () => {};
  t.after(() => {
    globalThis.document = originalDocument;
    if (originalCreateObjectUrl) URL.createObjectURL = originalCreateObjectUrl;
    else delete URL.createObjectURL;
    if (originalRevokeObjectUrl) URL.revokeObjectURL = originalRevokeObjectUrl;
    else delete URL.revokeObjectURL;
  });

  const mock = mockApi();
  const view = await mount(t, PentestReport, "eng-download", mock.api);
  await settle(mock.call("pentestReport", "eng-download"), {
    ok: true,
    assessment_mode: "pentest",
    markdown: "# Download me",
    report: { assets: [{ host: "fixture.invalid" }], findings: [] },
    requests_sent: 0,
  });
  click(pentestAction(view, "download-markdown"));
  click(pentestAction(view, "download-json"));
  assert.equal(blobs.length, 2);
  assert.equal(blobs[0].type, "text/markdown;charset=utf-8");
  assert.equal(blobs[1].type, "application/json;charset=utf-8");
  assert.equal(await blobs[0].text(), "# Download me");
  assert.deepEqual(JSON.parse(await blobs[1].text()), {
    assets: [{ host: "fixture.invalid" }],
    findings: [],
  });
  assert.deepEqual(
    links.map((link) => link.download),
    ["pentest-report-eng-download.md", "pentest-report-eng-download.json"],
  );
});

test("native assessment uses only the current engagement and provides no external package or project controls", async (t) => {
  const mock = mockApi();
  const view = await mount(t, AssessmentTab, "eng-a", mock.api);
  const value = status("eng-a", true);
  value.config = {
    packagePath: "/fixture/external/awa",
    workspace: "/fixture/external/data",
    pythonExecutable: "external-python",
  };
  value.binding = { project_id: "external-project" };
  await settle(mock.call("assessmentStatus", "eng-a"), value);
  assert.deepEqual(inputValues(view), ["0", "0"]);
  assert.equal(view.root.findAllByType("textarea").length, 0);
  assert.deepEqual(dataLocations(view), ["/fixture/eng-a/assessment"]);
  click(assessmentButton(view, "assessmentImport"));
  const imported = mock.call("assessmentImport", "eng-a");
  assert.deepEqual(imported.request, {
    op: "assessmentImport",
    engagement: "eng-a",
    offset: 0,
    limit: 50,
  });
  await settle(imported, {
    ok: true,
    fixture: "native-import",
    project_id: "internal-private-id",
    packagePath: "/fixture/engine",
  });
  assert.deepEqual(result(view), { ok: true, fixture: "native-import" });
  click(assessmentButton(view, "assessmentRun", "project.status"));
  const inspected = mock.call("assessmentRun", "eng-a", "project.status");
  assert.deepEqual(inspected.request, {
    op: "assessmentRun",
    engagement: "eng-a",
    action: "project.status",
    input: { limit: 3 },
  });
  await settle(inspected, { ok: true, fixture: "native-current-status" });
  click(assessmentButton(view, "assessmentReview", "", "true"));
  assert.deepEqual(mock.call("assessmentReview", "eng-a", "true").request, {
    op: "assessmentReview",
    engagement: "eng-a",
    verify: true,
    offset: 0,
    limit: 50,
  });
  assert.equal(
    mock.calls.every(
      (call) =>
        !Object.keys(call.request).some((key) =>
          ["project_id", "packagePath", "workspace", "config"].includes(key),
        ),
    ),
    true,
  );
});

test("importing the second source page keeps review at zero, and each next-page result advances only its own cursor", async (t) => {
  const mock = mockApi();
  const view = await mount(t, AssessmentTab, "eng-a", mock.api);
  await settle(mock.call("assessmentStatus", "eng-a"), status("eng-a", true));
  click(assessmentButton(view, "assessmentImport"));
  await settle(mock.call("assessmentImport", "eng-a"), {
    ok: true,
    page_kind: "source_candidates",
    next_offset: 50,
  });
  click(nextPage(view, "source_candidates"));
  assert.equal(cursor(view, "source_candidates").props.value, "50");
  assert.equal(cursor(view, "assessment_candidates").props.value, "0");
  click(assessmentButton(view, "assessmentImport"));
  const secondImport = mock.call("assessmentImport", "eng-a", undefined, 1);
  assert.deepEqual(secondImport.request, {
    op: "assessmentImport",
    engagement: "eng-a",
    offset: 50,
    limit: 50,
  });
  await settle(secondImport, {
    ok: true,
    page_kind: "source_candidates",
    next_offset: 100,
  });
  click(assessmentButton(view, "assessmentReview", "", "false"));
  const firstReview = mock.call("assessmentReview", "eng-a", "false");
  assert.deepEqual(firstReview.request, {
    op: "assessmentReview",
    engagement: "eng-a",
    verify: false,
    offset: 0,
    limit: 50,
  });
  await settle(firstReview, {
    ok: true,
    page_kind: "assessment_candidates",
    next_offset: 50,
    reviews: [],
  });
  click(nextPage(view, "assessment_candidates"));
  assert.equal(cursor(view, "source_candidates").props.value, "50");
  assert.equal(cursor(view, "assessment_candidates").props.value, "50");
  click(assessmentButton(view, "assessmentReview", "", "true"));
  assert.deepEqual(mock.call("assessmentReview", "eng-a", "true").request, {
    op: "assessmentReview",
    engagement: "eng-a",
    verify: true,
    offset: 50,
    limit: 50,
  });
  await settle(mock.call("assessmentReview", "eng-a", "true"), {
    ok: true,
    page_kind: "assessment_candidates",
    next_offset: null,
  });
  assert.equal(
    view.root.findAll((node) => node.props["data-assessment-next"]).length,
    0,
  );
});

test("operation-based next-page fallback preserves separate cursors and stale page handlers cannot affect a new engagement", async (t) => {
  const mock = mockApi();
  const view = await mount(t, AssessmentTab, "eng-a", mock.api);
  await settle(mock.call("assessmentStatus", "eng-a"), status("eng-a", true));
  click(assessmentButton(view, "assessmentImport"));
  await settle(mock.call("assessmentImport", "eng-a"), {
    ok: true,
    next_offset: 50,
  });
  const oldSourceNext = nextPage(view, "source_candidates").props.onClick;
  click(nextPage(view, "source_candidates"));
  click(assessmentButton(view, "assessmentReview", "", "false"));
  await settle(mock.call("assessmentReview", "eng-a", "false"), {
    ok: true,
    next_offset: 25,
    reviews: [],
  });
  const oldReviewNext = nextPage(view, "assessment_candidates").props.onClick;
  click(nextPage(view, "assessment_candidates"));
  assert.equal(cursor(view, "source_candidates").props.value, "50");
  assert.equal(cursor(view, "assessment_candidates").props.value, "25");
  await update(view, AssessmentTab, "eng-b", mock.api);
  await settle(mock.call("assessmentStatus", "eng-b"), status("eng-b", true));
  assert.deepEqual(inputValues(view), ["0", "0"]);
  act(() => {
    oldSourceNext();
    oldReviewNext();
  });
  assert.deepEqual(inputValues(view), ["0", "0"]);
  assert.equal(result(view), null);
  assert.equal(mock.calls.length, 4);
});

test("SRC submission drafts survive proof refreshes, save once and cannot update a different engagement", async (t) => {
  const mock = mockApi();
  let view,
    saved = 0;
  const finding = {
    id: 1,
    submission: {},
    submission_state: { disposition: "security_candidate" },
  };
  const render = (engagement, value = finding) =>
    h(FindingSubmission, {
      engagement,
      finding: value,
      api: mock.api,
      onSaved: () => saved++,
    });
  await act(async () => {
    view = create(render("eng-a"));
  });
  t.after(() => act(() => view.unmount()));
  act(() =>
    view.root
      .findByProps({ "data-src-submission-field": "reproduction" })
      .props.onChange({ target: { value: "Actual recorded steps." } }),
  );
  await act(async () =>
    view.update(
      render("eng-a", {
        ...finding,
        current_proofs: [{ observation: "New current proof." }],
      }),
    ),
  );
  assert.equal(
    view.root.findByProps({ "data-src-submission-field": "reproduction" }).props
      .value,
    "Actual recorded steps.",
  );
  const save = view.root.findByProps({ "data-src-submission-action": "save" })
    .props.onClick;
  act(() => {
    save();
    save();
  });
  assert.equal(mock.calls.length, 1);
  assert.deepEqual(mock.call("updateVuln", "eng-a").request.patch, {
    submission: {},
    reproduction: "Actual recorded steps.",
    impact: "",
    remediation: "",
  });
  await act(async () => view.update(render("eng-b")));
  await settle(mock.call("updateVuln", "eng-a"), { ok: true });
  assert.equal(saved, 0);
  assert.equal(
    view.root.findByProps({ "data-src-submission-field": "reproduction" }).props
      .value,
    "",
  );
  assert.equal(errors(view).length, 0);
});

test("finding queries fence A to B to A and unmount instead of showing stale rows or errors", async (t) => {
  const mock = mockApi(),
    Component = __dshPurgeDrill.FindingsTab;
  let view;
  const render = (engagement) =>
    h(Component, { engagement, assessmentMode: "src", api: mock.api });
  await act(async () => {
    view = create(render("eng-a"));
  });
  t.after(() => act(() => view.unmount()));
  await act(async () => view.update(render("eng-b")));
  await act(async () => view.update(render("eng-a")));
  const current = mock.call("vulns", "eng-a", undefined, 1);
  await settle(current, {
    ok: true,
    total: 1,
    items: [
      {
        id: 2,
        title: "Current fixture finding",
        target: "https://fixture.invalid/api/current",
        severity: "low",
        status: "candidate",
      },
    ],
  });
  act(() =>
    view.root
      .findAllByType("button")
      .find((button) => button.props.children === "按目标聚合")
      .props.onClick(),
  );
  await settle(mock.call("vulns", "eng-a"), {
    ok: true,
    total: 1,
    items: [{ id: 1, title: "Stale fixture finding", severity: "high" }],
  });
  await reject(mock.call("vulns", "eng-b"), new Error("Stale query error"));
  const output = JSON.stringify(view.toJSON());
  assert(output.includes("Current fixture finding"));
  assert(
    !output.includes("Stale fixture finding") &&
      !output.includes("Stale query error"),
  );
  await act(async () => view.update(render("eng-c")));
  act(() => view.unmount());
  await reject(mock.call("vulns", "eng-c"), new Error("Unmounted query error"));
  assert.equal(view.toJSON(), null);
});

test("assessment next token is reused directly without mixing legacy offsets", async (t) => {
  const mock = mockApi();
  const view = await mount(t, AssessmentTab, "eng-a", mock.api);
  await settle(mock.call("assessmentStatus", "eng-a"), status("eng-a", true));
  click(assessmentButton(view, "assessmentImport"));
  await settle(mock.call("assessmentImport", "eng-a"), {
    ok: true,
    page_kind: "source_candidates",
    next: {
      tool: "redteam_assessment_import",
      arguments: { engagement: "eng-a", page_token: "synthetic-signed-token" },
    },
  });
  click(nextPage(view, "source_candidates"));
  assert.deepEqual(
    mock.call("assessmentImport", "eng-a", undefined, 1).request,
    {
      op: "assessmentImport",
      engagement: "eng-a",
      page_token: "synthetic-signed-token",
    },
  );
  await settle(mock.call("assessmentImport", "eng-a", undefined, 1), {
    ok: true,
    next: null,
  });
});

test("pentest credential tab shows available test handles while SRC never loads credential collections", async (t) => {
  const mock = mockApi(),
    Component = __dshPurgeDrill.FindingsTab;
  let view;
  await act(async () => {
    view = create(
      h(Component, {
        engagement: "eng-a",
        assessmentMode: "pentest",
        api: mock.api,
      }),
    );
  });
  t.after(() => act(() => view.unmount()));
  await settle(mock.call("vulns", "eng-a"), { ok: true, total: 0, items: [] });
  await settle(mock.call("credentials", "eng-a"), {
    ok: true,
    items: [
      {
        id: 1,
        host: "Fixture test service",
        credential_handle: "cred_fixture",
        secret_available: false,
      },
    ],
  });
  const button = view.root.findByProps({ "aria-label": "测试凭据（1）" });
  assert(button, "pentest credential tab is available");
  act(() => button.props.onClick());
  assert(JSON.stringify(view.toJSON()).includes("cred_fixture"));
  await act(async () =>
    view.update(
      h(Component, {
        engagement: "eng-b",
        assessmentMode: "src",
        api: mock.api,
      }),
    ),
  );
  assert.equal(
    mock.calls.filter(
      (call) =>
        call.request.engagement === "eng-b" &&
        call.request.op === "credentials",
    ).length,
    0,
  );
  assert(!JSON.stringify(view.toJSON()).includes("cred_fixture"));
});
