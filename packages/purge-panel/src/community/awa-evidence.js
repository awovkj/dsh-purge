import React from "react";

const h = React.createElement;
const rules = (value) =>
  String(value || "")
    .split(/[\r\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
export const isScopedAssessmentMode = (mode) =>
  mode === "src" || mode === "pentest";
export const assessmentModeLabel = (mode) =>
  mode === "src" ? "[SRC] " : mode === "pentest" ? "[渗透] " : "[红队] ";
export const assessmentModeOptions = [
  ["src", "SRC 漏洞发现模式"],
  ["pentest", "渗透模式"],
  ["redteam", "红队模式"],
];
export const assessmentTabsForMode = (mode, tabs) => {
  const allowed =
    mode === "src"
      ? ["assets", "evidence", "agents", "findings", "report"]
      : mode === "pentest"
        ? ["assets", "evidence", "findings", "report"]
        : null;
  return allowed ? tabs.filter((item) => allowed.includes(item[0])) : tabs;
};
const field = (label, value, set, placeholder, props = {}) =>
  h(
    "label",
    { style: { display: "grid", gap: 4, marginBottom: 8 } },
    label,
    h("input", {
      className: "rt-input",
      value,
      placeholder,
      ...props,
      onChange: (event) => set(event.target.value),
    }),
  );

// Identity, rather than an engagement ID alone, also fences A -> B -> A and
// unmount/remount. Layout cleanup invalidates callbacks before the next paint.
export function useRequestGeneration(engagement, api) {
  const owner = React.useRef(null);
  const generation = React.useRef(0);
  const captured = React.useMemo(
    () => ({ engagement, api, active: false, generation: 0, readSequence: 0 }),
    [engagement, api],
  );
  React.useLayoutEffect(() => {
    captured.generation = ++generation.current;
    captured.readSequence = 0;
    captured.active = true;
    owner.current = captured;
    return () => {
      captured.active = false;
    };
  }, [captured]);
  return { owner, captured };
}

export const isCurrent = (owner, captured, generation = captured?.generation) =>
  captured?.active === true &&
  owner.current === captured &&
  captured.generation === generation;
const failureText = (failure) =>
  String(failure?.message || failure || "操作未完成");
const emptyRuntime = () => ({
  pythonExecutable: "",
  executionBackend: "native",
  wslDistribution: "kali-linux",
  wslPythonExecutable: "python3",
  timeoutMs: 120000,
});
const defaultPreferences = () => ({
  continuationGuard: true,
  requireAssessmentForHighValueScore: true,
});
const runtimeLabel = {
  located: "已定位，尚未探测",
  not_found: "未找到",
  not_checked: "尚未探测",
  ready: "可用",
  unavailable: "不可用",
  unsupported_or_unknown: "版本不足或未知",
  module_located: "包已定位，尚未探测",
  cache_located: "缓存已定位，尚未探测",
  probe_failed: "探测未完成",
  registered_receipt: "最近注册成功回执",
  pending_or_failed: "等待注册或注册失败",
  not_recorded: "没有注册回执",
  unknown: "未知",
  unreadable: "回执不可读取",
};
const coverageLabel = {
  completed_registered_scope: "已登记任务已结项",
  unfinished: "有未完成项",
  blocked: "当前受阻",
  inactive_unfinished: "已暂停或部分交付",
  not_initialized: "尚未准备内部上下文",
  unavailable: "覆盖暂不可读取",
};
const checkbox = (label, checked, set) =>
  h(
    "label",
    {
      style: { display: "flex", gap: 8, alignItems: "center", marginBottom: 8 },
    },
    h("input", {
      type: "checkbox",
      checked,
      onChange: (event) => set(event.target.checked),
    }),
    label,
  );

export function AssessmentTab({ engagement, api }) {
  const [status, setStatus] = React.useState(null);
  const [target, setTarget] = React.useState("");
  const [scope, setScope] = React.useState("");
  const [model, setModel] = React.useState("v1");
  const [sourceOffset, setSourceOffset] = React.useState(0);
  const [reviewOffset, setReviewOffset] = React.useState(0);
  const [result, setResult] = React.useState(null);
  const [resultOperation, setResultOperation] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [runtimeConfig, setRuntimeConfig] = React.useState(emptyRuntime);
  const [preferences, setPreferences] = React.useState(defaultPreferences);
  const runtimeDirty = React.useRef(false);
  const preferencesDirty = React.useRef(false);
  const contextDirty = React.useRef(false);
  const { owner, captured } = useRequestGeneration(engagement, api);
  const flight = React.useRef(null);
  React.useLayoutEffect(() => {
    flight.current = null;
    setStatus(null);
    setTarget("");
    setScope("");
    setModel("v1");
    setRuntimeConfig(emptyRuntime());
    setPreferences(defaultPreferences());
    runtimeDirty.current = false;
    preferencesDirty.current = false;
    contextDirty.current = false;
    setSourceOffset(0);
    setReviewOffset(0);
    setResult(null);
    setResultOperation("");
    setError("");
    setBusy(false);
  }, [captured]);

  const acceptStatus = (value) => {
    setStatus(value);
    const urls = (
      value.context?.scope ||
      value.assessment_policy?.scope ||
      []
    ).filter((rule) => /^https?:\/\//i.test(rule));
    if (!contextDirty.current) {
      setTarget(value.context?.target || urls[0] || "");
      setScope(urls.join("\n"));
      setModel(
        value.context?.model || value.operator_config?.assessmentModel || "v1",
      );
    }
    if (value.operator_config && !runtimeDirty.current)
      setRuntimeConfig({ ...emptyRuntime(), ...value.operator_config });
    if (value.preferences && !preferencesDirty.current)
      setPreferences(value.preferences);
    if (value?.ok === false) setError(failureText(value.error));
  };

  const refresh = async (captured, generation = captured.generation) => {
    if (!isCurrent(owner, captured, generation)) return;
    const sequence = ++captured.readSequence;
    try {
      const value = await captured.api({
        op: "assessmentStatus",
        ...(captured.engagement ? { engagement: captured.engagement } : {}),
      });
      if (
        !isCurrent(owner, captured, generation) ||
        sequence !== captured.readSequence
      )
        return value;
      acceptStatus(value);
      return value;
    } catch (failure) {
      if (
        isCurrent(owner, captured, generation) &&
        sequence === captured.readSequence
      )
        throw failure;
    }
  };
  React.useEffect(() => {
    const generation = captured.generation;
    refresh(captured, generation).catch((failure) => {
      if (isCurrent(owner, captured, generation))
        setError(failureText(failure));
    });
  }, [captured]);

  const run = async (request) => {
    if (!isCurrent(owner, captured) || flight.current) return;
    const generation = captured.generation;
    const requestFlight = { captured };
    flight.current = requestFlight;
    const statusSequence = [
      "assessmentStatus",
      "awaConfigSave",
      "assessmentPreferencesSave",
      "assessmentRuntimeProbe",
    ].includes(request.op)
      ? ++captured.readSequence
      : null;
    setBusy(true);
    setError("");
    try {
      const value = await captured.api({
        ...request,
        ...(captured.engagement ? { engagement: captured.engagement } : {}),
      });
      if (!isCurrent(owner, captured, generation)) return value;
      setResult(value);
      setResultOperation(request.op);
      // Runtime gaps are useful results. Keep their metadata visible even
      // when Python could not start, instead of losing it in the error path.
      if (request.op === "assessmentRuntimeProbe" && value.runtime) {
        setStatus((previous) => ({ ...previous, runtime: value.runtime }));
        if (value.ok === false)
          setError("本地评估运行条件尚不足，请查看 Node、解释器状态与原因。");
      } else if (value?.ok === false) throw new Error(failureText(value.error));
      if (
        request.op === "assessmentStatus" &&
        statusSequence === captured.readSequence
      )
        acceptStatus(value);
      if (request.op === "awaConfigSave") {
        runtimeDirty.current = false;
        if (value.config)
          setRuntimeConfig({ ...emptyRuntime(), ...value.config });
      }
      if (request.op === "assessmentPreferencesSave") {
        preferencesDirty.current = false;
        if (value.preferences) setPreferences(value.preferences);
      }
      if (request.op === "assessmentStart") contextDirty.current = false;
      if (
        [
          "assessmentStart",
          "awaConfigSave",
          "assessmentPreferencesSave",
          "assessmentRuntimeProbe",
        ].includes(request.op)
      ) {
        await refresh(captured, generation);
      }
      return value;
    } catch (failure) {
      if (isCurrent(owner, captured, generation))
        setError(failureText(failure));
    } finally {
      if (flight.current === requestFlight) {
        flight.current = null;
        if (isCurrent(owner, captured, generation)) setBusy(false);
      }
    }
  };
  const button = (label, request, disabled = false) =>
    h(
      "button",
      {
        className: "rt-btn",
        disabled: busy || disabled,
        "data-assessment-operation": request.op,
        "data-assessment-action": request.action || "",
        "data-assessment-verify":
          typeof request.verify === "boolean" ? String(request.verify) : "",
        onClick: () => run(request),
      },
      label,
    );
  const ready = status?.context?.ready === true;
  const runtime = status?.runtime;
  const guard = status?.continuation_guard;
  const runtimeChange = (key) => (value) => {
    runtimeDirty.current = true;
    setRuntimeConfig((previous) => ({ ...previous, [key]: value }));
  };
  const preferenceChange = (key) => (value) => {
    preferencesDirty.current = true;
    setPreferences((previous) => ({ ...previous, [key]: value }));
  };
  const contextChange = (set) => (value) => {
    contextDirty.current = true;
    set(value);
  };
  const resultText = result
    ? JSON.stringify(
        result,
        (key, value) =>
          ["project_id", "packagePath"].includes(key) ? undefined : value,
        2,
      )
    : "";
  const resultPageKind =
    result?.page_kind ||
    (resultOperation === "assessmentImport"
      ? "source_candidates"
      : resultOperation === "assessmentReview"
        ? "assessment_candidates"
        : "");
  const canPageResult =
    ["source_candidates", "assessment_candidates"].includes(resultPageKind) &&
    (Boolean(result?.next?.arguments) || result?.next_offset != null);
  const nextResultPage = () => {
    if (!isCurrent(owner, captured) || !canPageResult) return;
    if (result.next?.arguments) {
      return run({
        ...result.next.arguments,
        op:
          resultPageKind === "source_candidates"
            ? "assessmentImport"
            : "assessmentReview",
      });
    }
    if (resultPageKind === "source_candidates")
      setSourceOffset(result.next_offset);
    else setReviewOffset(result.next_offset);
  };
  return h(
    "div",
    { className: "rt-pane" },
    h(
      "div",
      { className: "rt-card" },
      h("h4", null, "评估运行环境"),
      h(
        "p",
        null,
        "本地状态区分文件定位与实际探测。浏览器运行时缺失时，相关评估项保留受阻原因。",
      ),
      runtime
        ? h(
            React.Fragment,
            null,
            h(
              "div",
              { "data-runtime-kind": "node" },
              `Node ${runtime.node?.version || "未知"} · ${runtime.node?.supported ? "满足评估核心要求" : "需要 Node 22.19 或更高版本"}`,
            ),
            h(
              "p",
              null,
              "运行要求：Purge 基础 Node ≥18；红队工具 Node ≥22.5；内置评估 Node ≥22.19、Python ≥3.10；浏览器单独判断。",
            ),
            h(
              "div",
              {
                "data-runtime-kind": "python",
                "data-runtime-state": runtime.python?.state || "unknown",
              },
              `Python：${runtimeLabel[runtime.python?.state] || runtime.python?.state || "未知"}${runtime.python?.version ? " · " + runtime.python.version : ""}`,
            ),
            h(
              "p",
              { className: "rt-mono", style: { overflowWrap: "anywhere" } },
              runtime.python?.path ||
                runtime.python?.executable ||
                "未定位解释器",
            ),
            runtime.python?.reason
              ? h("p", null, "解释器原因：" + runtime.python.reason)
              : null,
            h(
              "div",
              {
                "data-runtime-kind": "browser",
                "data-runtime-state": runtime.browser?.state || "unknown",
              },
              `浏览器：${runtimeLabel[runtime.browser?.state] || runtime.browser?.state || "未知"}${runtime.browser?.version ? " · " + runtime.browser.version : ""}`,
            ),
            runtime.browser?.reason
              ? h("p", null, "浏览器原因：" + runtime.browser.reason)
              : null,
            ...(status?.assessment_policy?.assessment_mode === "pentest"
              ? [["渗透", runtime.pentest_preset]]
              : [["SRC", runtime.src_preset]]
            ).flatMap(([label, receipt]) => [
              h(
                "p",
                { key: label + "-preset" },
                `${label}预设：${runtimeLabel[receipt?.state] || "未知"}${receipt?.phase ? " · " + receipt.phase : ""}`,
              ),
              receipt?.at
                ? h(
                    "p",
                    { key: label + "-receipt" },
                    "回执时间：" +
                      receipt.at +
                      "；该回执不代表当前界面已重新加载。",
                  )
                : null,
            ]),
            status?.assessment_policy?.assessment_mode !== "pentest"
              ? h(
                  "p",
                  null,
                  "SRC 指引：" +
                    (runtime.src_skill?.installed
                      ? "随包技能已同步"
                      : "同步副本尚未定位") +
                    "；可用 redteam_src_runbook 读取当前安装的正文。",
                )
              : null,
            h(
              "p",
              null,
              guard?.registered
                ? `续跑钩子已登记 · ${guard.active_agents || 0} 个活动会话`
                : "宿主续跑接口尚不可用；评估工具仍会提供下一步。",
            ),
            guard?.reason
              ? h(
                  "details",
                  null,
                  h("summary", null, "续跑状态"),
                  h("p", { className: "rt-mono" }, guard.reason),
                )
              : null,
            guard?.metrics
              ? h(
                  "p",
                  null,
                  `本进程有效进展：实际材料 ${guard.metrics.material_captures || 0}；身份核实 ${guard.metrics.identity_verifications || 0}；安全控制 ${guard.metrics.security_control_runs || 0}；重复任务受阻 ${guard.metrics.repeated_task_failures || 0}。`,
                )
              : null,
            runtime.checked_at
              ? h("p", null, "最近本地探测：" + runtime.checked_at)
              : null,
          )
        : h("p", null, "正在读取本地环境信息。"),
      button("探测本地运行环境", {
        op: "assessmentRuntimeProbe",
        browser: true,
      }),
      h(
        "details",
        { style: { marginTop: 12 } },
        h("summary", null, "解释器与执行后端设置"),
        h(
          "p",
          null,
          "设置由操作者保存。已有评估上下文的后端保持固定，切换默认后端不会迁移已有台账。",
        ),
        status?.context?.initialized
          ? h(
              "p",
              null,
              `当前任务后端：${status.context.executionBackend}${status.context.wslDistribution ? " · " + status.context.wslDistribution : ""}`,
            )
          : null,
        field(
          "本机 Python 路径或名称",
          runtimeConfig.pythonExecutable,
          runtimeChange("pythonExecutable"),
          "python 或绝对路径",
        ),
        h(
          "label",
          { style: { display: "grid", gap: 4, marginBottom: 8 } },
          "执行后端",
          h(
            "select",
            {
              className: "rt-input",
              value: runtimeConfig.executionBackend,
              onChange: (event) =>
                runtimeChange("executionBackend")(event.target.value),
            },
            h("option", { value: "native" }, "本机"),
            h("option", { value: "wsl" }, "WSL（Windows）"),
          ),
        ),
        runtimeConfig.executionBackend === "wsl"
          ? h(
              React.Fragment,
              null,
              field(
                "WSL 发行版",
                runtimeConfig.wslDistribution,
                runtimeChange("wslDistribution"),
                "kali-linux",
              ),
              field(
                "WSL Python 路径或名称",
                runtimeConfig.wslPythonExecutable,
                runtimeChange("wslPythonExecutable"),
                "python3",
              ),
            )
          : null,
        field(
          "单次调用超时（毫秒）",
          String(runtimeConfig.timeoutMs),
          runtimeChange("timeoutMs"),
          "120000",
          { type: "number", min: 1000, max: 600000, step: 1000 },
        ),
        button(
          "保存环境设置",
          {
            op: "awaConfigSave",
            config: {
              pythonExecutable: runtimeConfig.pythonExecutable.trim(),
              executionBackend: runtimeConfig.executionBackend,
              wslDistribution: runtimeConfig.wslDistribution.trim(),
              wslPythonExecutable: runtimeConfig.wslPythonExecutable.trim(),
              timeoutMs: Number(runtimeConfig.timeoutMs),
            },
          },
          !status?.operator_config || !runtimeConfig.pythonExecutable.trim(),
        ),
      ),
      h(
        "details",
        { style: { marginTop: 12 } },
        h("summary", null, "续跑与记分偏好"),
        h(
          "p",
          null,
          "续跑只推进已有获准任务；取消、新输入、SRC 停止和缺失前提优先。无进展时保留未完成记录。",
        ),
        checkbox(
          "启用评估续跑提醒",
          preferences.continuationGuard,
          preferenceChange("continuationGuard"),
        ),
        checkbox(
          "高价值得分要求 observed 成果证据",
          preferences.requireAssessmentForHighValueScore,
          preferenceChange("requireAssessmentForHighValueScore"),
        ),
        h(
          "p",
          null,
          "高价值要求用于服务器主机、集权系统和域名控制成果，检查可信采集回执、同目标、score_outcome 和基础分值档位。新默认开启，已明确保存的关闭值保留，历史文字记录仍会标注。",
        ),
        button(
          "保存偏好",
          { op: "assessmentPreferencesSave", value: preferences },
          !status?.preferences,
        ),
      ),
    ),
    h(
      "div",
      { className: "rt-card" },
      h("h4", null, "内置证据评估"),
      h(
        "p",
        null,
        "评估核心随项目提供，直接使用当前靶标的范围和台账。候选需通过真实对照与可复核证据确认。",
      ),
      h(
        "div",
        { className: "rt-tag", "data-assessment-engine": "embedded" },
        status?.engine?.embedded
          ? `项目内置评估核心 · ${status.engine.version || ""}`
          : "正在读取内置评估核心信息",
      ),
      engagement
        ? h(
            React.Fragment,
            null,
            h(
              "p",
              { "data-assessment-context": ready ? "ready" : "pending" },
              ready
                ? `当前靶标评估已准备 · ${status.context.target || ""}`
                : status?.context?.reason === "runtime_configuration_mismatch"
                  ? "当前配置与已有任务的固定后端不一致，请恢复对应后端设置。"
                  : "当前靶标尚需明确 HTTP 目标与范围。",
            ),
            !ready && !status?.context?.initialized
              ? h(
                  React.Fragment,
                  null,
                  field(
                    "目标 URL",
                    target,
                    contextChange(setTarget),
                    "https://example.test/app",
                  ),
                  h(
                    "label",
                    { style: { display: "grid", gap: 4, marginBottom: 8 } },
                    "明确 URL 范围（每行一项）",
                    h("textarea", {
                      className: "rt-textarea",
                      rows: 3,
                      value: scope,
                      onChange: (event) =>
                        contextChange(setScope)(event.target.value),
                    }),
                  ),
                  h(
                    "label",
                    { style: { display: "grid", gap: 4, marginBottom: 8 } },
                    "评估模型",
                    h(
                      "select",
                      {
                        className: "rt-input",
                        value: model,
                        onChange: (event) =>
                          contextChange(setModel)(event.target.value),
                        "data-assessment-model": true,
                      },
                      h("option", { value: "v1" }, "证据与测试义务"),
                      h("option", { value: "v2" }, "假设与测试配方"),
                    ),
                  ),
                  button(
                    "准备当前靶标评估",
                    {
                      op: "assessmentStart",
                      target,
                      scope: rules(scope),
                      assessmentModel: model,
                    },
                    !target || !rules(scope).length,
                  ),
                )
              : h(
                  React.Fragment,
                  null,
                  button("刷新评估状态", { op: "assessmentStatus" }),
                  status.context.workspace
                    ? h(
                        "details",
                        null,
                        h("summary", null, "台账位置"),
                        h(
                          "p",
                          { className: "rt-mono" },
                          status.context.workspace,
                        ),
                      )
                    : null,
                ),
            h("hr"),
            h(
              "details",
              null,
              h("summary", null, "从指定位置恢复读取"),
              field(
                "来源候选起始位置",
                String(sourceOffset),
                (value) => setSourceOffset(Number(value)),
                "0",
                { "data-assessment-cursor": "source_candidates" },
              ),
              field(
                "评估复核起始位置",
                String(reviewOffset),
                (value) => setReviewOffset(Number(value)),
                "0",
                { "data-assessment-cursor": "assessment_candidates" },
              ),
            ),
            h("p", null, "纳入候选后复核已有证据，使用结果中的下一页继续。"),
            h(
              "div",
              { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
              button(
                "纳入本页候选",
                { op: "assessmentImport", offset: sourceOffset, limit: 50 },
                !ready,
              ),
              button(
                "查看评估台账",
                {
                  op: "assessmentRun",
                  action: "project.status",
                  input: { limit: 3 },
                },
                !ready,
              ),
              button(
                "复核已有证据",
                {
                  op: "assessmentReview",
                  verify: false,
                  offset: reviewOffset,
                  limit: 50,
                },
                !ready,
              ),
              button(
                "确认已证明发现",
                {
                  op: "assessmentReview",
                  verify: true,
                  offset: reviewOffset,
                  limit: 50,
                },
                !ready,
              ),
            ),
          )
        : h("p", null, "先创建靶标，评估核心将使用该靶标的内部上下文。"),
      error ? h("div", { className: "rt-err" }, error) : null,
      result
        ? h(
            "details",
            { open: true },
            h("summary", null, "本次结果"),
            canPageResult
              ? h(
                  "button",
                  {
                    className: "rt-btn",
                    disabled: busy,
                    "data-assessment-next": resultPageKind,
                    onClick: nextResultPage,
                  },
                  resultPageKind === "source_candidates"
                    ? "选择下一来源候选页"
                    : "选择下一评估复核页",
                )
              : null,
            h(
              "pre",
              {
                className: "rt-mono",
                style: {
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  maxHeight: 360,
                  overflow: "auto",
                },
              },
              resultText.slice(0, 12000),
            ),
            resultText.length > 12000
              ? h(
                  "p",
                  null,
                  "当前结果仅显示前 12,000 个字符，请使用小页完成复核。",
                )
              : null,
          )
        : null,
    ),
    engagement
      ? h(AssessmentDeliveryReport, { engagement, api, embedded: true })
      : null,
  );
}

export const AwaEvidenceTab = AssessmentTab;

export function AssessmentDeliveryReport({
  engagement,
  api,
  embedded = false,
}) {
  const [report, setReport] = React.useState(null);
  const [scoreOffset, setScoreOffset] = React.useState(0);
  const [findingOffset, setFindingOffset] = React.useState(0);
  const [stopOffset, setStopOffset] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const { owner, captured } = useRequestGeneration(engagement, api);
  const flight = React.useRef(null);
  React.useLayoutEffect(() => {
    flight.current = null;
    setReport(null);
    setScoreOffset(0);
    setFindingOffset(0);
    setStopOffset(0);
    setCurrentPage({});
    setBusy(false);
    setError("");
    setMessage("");
  }, [captured]);
  const load = async (save = false, page = currentPage) => {
    if (!captured.engagement || !isCurrent(owner, captured) || flight.current)
      return;
    const generation = captured.generation,
      sequence = ++captured.readSequence;
    const requestFlight = { captured };
    flight.current = requestFlight;
    const pagination = page.page_token
      ? { page_token: page.page_token }
      : {
          offset: page.offset ?? 0,
          finding_offset: page.finding_offset ?? 0,
          stop_offset: page.stop_offset ?? 0,
          limit: 50,
        };
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const value = await captured.api({
        op: "assessmentReport",
        engagement: captured.engagement,
        save,
        ...pagination,
      });
      if (
        !isCurrent(owner, captured, generation) ||
        sequence !== captured.readSequence
      )
        return value;
      if (value?.ok === false) throw new Error(failureText(value.error));
      setReport(value);
      setScoreOffset(value.score?.offset ?? pagination.offset ?? 0);
      setFindingOffset(
        value.findings?.offset ?? pagination.finding_offset ?? 0,
      );
      setStopOffset(value.src_stops?.offset ?? pagination.stop_offset ?? 0);
      setCurrentPage(pagination);
      if (save)
        setMessage("本页 Markdown 与 JSON 快照已保存到当前靶标的报告目录。");
      return value;
    } catch (failure) {
      if (isCurrent(owner, captured, generation))
        setError(failureText(failure));
    } finally {
      if (flight.current === requestFlight) {
        flight.current = null;
        if (isCurrent(owner, captured, generation)) setBusy(false);
      }
    }
  };
  const download = () => {
    if (!report?.markdown || !isCurrent(owner, captured)) return;
    let url;
    try {
      url = URL.createObjectURL(
        new Blob([report.markdown], { type: "text/markdown;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download =
        "assessment-delivery-" +
        String(captured.engagement).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_") +
        ".md";
      link.click();
      setMessage("已下载当前交付报告页。");
    } catch (failure) {
      setError(failureText(failure));
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  };
  const legacyPage = {
    offset: scoreOffset,
    finding_offset: findingOffset,
    stop_offset: stopOffset,
  };
  return h(
    "div",
    { className: embedded ? "rt-card" : "rt-pane" },
    h(
      "div",
      { className: embedded ? undefined : "rt-card" },
      h("h4", null, "得分、发现与评估交付"),
      h(
        "p",
        null,
        "同时查看现有得分、证据强度、评估覆盖和 SRC 停止。汇总保留全部已登记分母，明细每页 50 项。",
      ),
      h(
        "div",
        { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
        h(
          "button",
          {
            className: "rt-btn",
            disabled: busy || !engagement,
            "data-delivery-action": "read",
            onClick: () => load(false),
          },
          report ? "刷新当前交付页" : "读取交付报告",
        ),
        h(
          "button",
          {
            className: "rt-btn",
            disabled: busy || !engagement,
            "data-delivery-action": "save",
            onClick: () => load(true),
          },
          "保存交付报告页",
        ),
        h(
          "button",
          { className: "rt-btn", disabled: busy || !report, onClick: download },
          "下载 Markdown",
        ),
      ),
      report
        ? h(
            React.Fragment,
            null,
            h(
              "p",
              { "data-delivery-state": report.assessment?.state },
              `评估：${coverageLabel[report.assessment?.state] || "未知"} · 来源发现 ${report.findings?.registered_total || 0} 项` +
                (report.assessment_mode === "src"
                  ? ` · 停止目标 ${report.src_stops?.targets || 0} 个`
                  : ` · 得分 ${report.score?.summary?.points || 0}`),
            ),
            h(
              "p",
              null,
              `漏洞 ${report.findings?.vulnerabilities ?? report.findings?.registered_total ?? 0} 项 · 加固建议 ${report.findings?.hardening || 0} 项 · 信息项 ${report.findings?.informational || 0} 项` +
                (report.assessment_mode === "src"
                  ? ` · 已排除历史配置/信息项 ${report.findings?.excluded_hardening || 0} 项`
                  : ""),
            ),
            h(
              "div",
              { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
              h(
                "button",
                {
                  className: "rt-btn",
                  disabled:
                    busy || (!scoreOffset && !findingOffset && !stopOffset),
                  "data-delivery-action": "first",
                  onClick: () =>
                    load(false, {
                      offset: 0,
                      finding_offset: 0,
                      stop_offset: 0,
                    }),
                },
                "返回首个交付页",
              ),
              report.next?.arguments
                ? h(
                    "button",
                    {
                      className: "rt-btn",
                      disabled: busy,
                      "data-delivery-action": "next",
                      onClick: () => load(false, report.next.arguments),
                    },
                    "下一交付页",
                  )
                : null,
              !report.next?.arguments &&
                h(
                  "button",
                  {
                    className: "rt-btn",
                    disabled: busy || report.score?.next_offset == null,
                    "data-delivery-action": "next-score",
                    onClick: () =>
                      load(false, {
                        ...legacyPage,
                        offset: report.score.next_offset,
                      }),
                  },
                  "下一得分明细页",
                ),
              !report.next?.arguments &&
                h(
                  "button",
                  {
                    className: "rt-btn",
                    disabled: busy || report.findings?.next_offset == null,
                    "data-delivery-action": "next-findings",
                    onClick: () =>
                      load(false, {
                        ...legacyPage,
                        finding_offset: report.findings.next_offset,
                      }),
                  },
                  "下一发现明细页",
                ),
              !report.next?.arguments &&
                report.assessment_mode === "src" &&
                h(
                  "button",
                  {
                    className: "rt-btn",
                    disabled: busy || report.src_stops?.next_offset == null,
                    "data-delivery-action": "next-stops",
                    onClick: () =>
                      load(false, {
                        ...legacyPage,
                        stop_offset: report.src_stops.next_offset,
                      }),
                  },
                  "下一停止明细页",
                ),
            ),
            report.path
              ? h(
                  "p",
                  { className: "rt-mono", style: { overflowWrap: "anywhere" } },
                  report.path,
                )
              : null,
            h(
              "details",
              { open: !embedded },
              h("summary", null, "交付报告内容"),
              h(
                "pre",
                {
                  style: {
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    maxHeight: embedded ? 480 : undefined,
                    overflow: "auto",
                  },
                },
                report.markdown,
              ),
            ),
          )
        : null,
      message ? h("p", null, message) : null,
      error ? h("div", { className: "rt-err" }, error) : null,
    ),
  );
}

const submissionLabels = {
  security_candidate: "安全漏洞候选",
  impact_review_required: "安全影响待核实",
  report_incomplete: "证明已核实，提交材料待补",
  submission_ready: "提交草稿完整",
  excluded_hardening: "历史加固项，已排除",
};
export function FindingSubmission({ finding, engagement, api, onSaved }) {
  const initial = () => ({
    submission: { ...finding.submission },
    reproduction: finding.reproduction || "",
    impact: finding.impact || "",
    remediation: finding.remediation || "",
  });
  const [draft, setDraft] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const { owner, captured } = useRequestGeneration(
    engagement + ":" + finding.id,
    api,
  );
  const draftOwner = React.useRef(null);
  React.useLayoutEffect(() => {
    if (draftOwner.current !== captured) {
      draftOwner.current = captured;
      captured.dirty = false;
      setBusy(false);
      setError("");
    }
    if (!captured.dirty && !captured.submissionPending) setDraft(initial());
  }, [finding, captured]);
  const change = (key, value, submission = true) => {
    captured.dirty = true;
    setDraft((previous) =>
      submission
        ? { ...previous, submission: { ...previous.submission, [key]: value } }
        : { ...previous, [key]: value },
    );
  };
  const save = async () => {
    if (captured.submissionPending || !isCurrent(owner, captured)) return;
    const generation = captured.generation;
    captured.submissionPending = true;
    setBusy(true);
    setError("");
    try {
      const result = await captured.api({
        op: "updateVuln",
        engagement,
        id: finding.id,
        patch: draft,
      });
      if (!isCurrent(owner, captured, generation)) return;
      if (result?.ok !== true) throw new Error(failureText(result?.error));
      captured.dirty = false;
      onSaved?.();
    } catch (failure) {
      if (isCurrent(owner, captured, generation))
        setError(failureText(failure));
    } finally {
      if (isCurrent(owner, captured, generation)) {
        captured.submissionPending = false;
        setBusy(false);
      }
    }
  };
  const state = finding.submission_state;
  const input = (key, label, maximum, multiline = false, submission = true) =>
    h(
      "label",
      { key, style: { display: "grid", gap: 4, marginBottom: 8 } },
      label,
      h(multiline ? "textarea" : "input", {
        className: "rt-input",
        value: (submission ? draft.submission[key] : draft[key]) || "",
        maxLength: maximum,
        rows: multiline ? 3 : undefined,
        disabled: busy,
        "data-src-submission-field": key,
        onChange: (event) => change(key, event.target.value, submission),
      }),
    );
  return h(
    "div",
    {
      "data-src-submission": state?.disposition || "security_candidate",
      style: { marginTop: 12 },
    },
    h("h4", null, "SRC 提交草稿"),
    h("p", null, submissionLabels[state?.disposition] || "安全漏洞候选"),
    h(
      "p",
      null,
      "按实际项目规则整理已有材料。草稿完整不代表平台接收；确认后的原目标继续停测。",
    ),
    state?.missing_fields?.length
      ? h("p", null, "待补：" + state.missing_fields.join("、"))
      : null,
    input("program", "实际 SRC 项目", 256),
    input("policy_reference", "项目规则引用", 2048),
    input("policy_basis", "规则收录依据", 4096, true),
    input("prerequisites", "实际复现前提", 4096, true),
    input("reproduction", "最小复现步骤（已有材料）", 8192, true, false),
    input("expected_result", "预期安全结果", 8192, true),
    h(
      "p",
      null,
      "实际可信观察：" +
        ((finding.current_proofs || [])
          .map((proof) => proof.observation)
          .filter(Boolean)
          .join("；") || "尚无当前可信证明"),
    ),
    input("impact", "影响分析（草稿，限于已有证明）", 8192, true, false),
    input("remediation", "修复建议", 8192, true, false),
    h(
      "label",
      null,
      "本地查重状态 ",
      h(
        "select",
        {
          className: "rt-input",
          disabled: busy,
          value: draft.submission.duplicate_check || "not_checked",
          onChange: (event) => change("duplicate_check", event.target.value),
        },
        h("option", { value: "not_checked" }, "尚未查重"),
        h("option", { value: "checked_local" }, "已核对本地重复"),
        h("option", { value: "potential_duplicate" }, "存在可能重复"),
      ),
    ),
    input("duplicate_reference", "查重参考记录", 2048),
    h(
      "button",
      {
        className: "rt-btn",
        disabled: busy,
        "data-src-submission-action": "save",
        onClick: save,
      },
      busy ? "保存中…" : "保存提交草稿",
    ),
    error ? h("p", { className: "rt-err" }, error) : null,
  );
}

export function AssessmentReportHub({
  engagement,
  api,
  detail: Detail,
  detailProps = {},
  src = false,
}) {
  const [view, setView] = React.useState("delivery");
  React.useLayoutEffect(() => {
    setView("delivery");
  }, [engagement]);
  return h(
    "div",
    { className: "rt-main" },
    h(
      "div",
      { className: "rt-toolbar" },
      h(
        "button",
        {
          className: "rt-btn",
          "aria-pressed": view === "delivery",
          onClick: () => setView("delivery"),
        },
        "合并交付",
      ),
      h(
        "button",
        {
          className: "rt-btn",
          "aria-pressed": view === "detail",
          onClick: () => setView("detail"),
        },
        src ? "直接证据发现" : "详细成果复现",
      ),
    ),
    view === "delivery"
      ? h(AssessmentDeliveryReport, { engagement, api })
      : h(Detail, { engagement, api, ...detailProps }),
  );
}

export function SrcDiscoveryReport({ engagement, api }) {
  const [report, setReport] = React.useState(null);
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const { owner, captured } = useRequestGeneration(engagement, api);
  const flight = React.useRef(null);
  React.useLayoutEffect(() => {
    flight.current = null;
    setReport(null);
    setError("");
    setSaving(false);
  }, [captured]);
  React.useEffect(() => {
    const generation = captured.generation;
    const sequence = ++captured.readSequence;
    const load = async () => {
      if (!isCurrent(owner, captured, generation)) return;
      try {
        const value = await captured.api({
          op: "srcReport",
          engagement: captured.engagement,
          save: false,
        });
        if (
          !isCurrent(owner, captured, generation) ||
          sequence !== captured.readSequence
        )
          return;
        if (value?.ok === false) setError(value.error || "报告读取失败");
        else setReport(value);
      } catch (failure) {
        if (
          isCurrent(owner, captured, generation) &&
          sequence === captured.readSequence
        )
          setError(failureText(failure));
      }
    };
    load();
  }, [captured]);
  const save = async () => {
    if (!isCurrent(owner, captured) || flight.current) return;
    const generation = captured.generation;
    const requestFlight = { captured };
    flight.current = requestFlight;
    const sequence = ++captured.readSequence;
    setSaving(true);
    setError("");
    try {
      const value = await captured.api({
        op: "srcReport",
        engagement: captured.engagement,
        save: true,
      });
      if (
        !isCurrent(owner, captured, generation) ||
        sequence !== captured.readSequence
      )
        return value;
      if (value?.ok === false) setError(value.error || "报告保存失败");
      else setReport(value);
      return value;
    } catch (failure) {
      if (
        isCurrent(owner, captured, generation) &&
        sequence === captured.readSequence
      )
        setError(failureText(failure));
    } finally {
      if (flight.current === requestFlight) {
        flight.current = null;
        if (isCurrent(owner, captured, generation)) setSaving(false);
      }
    }
  };
  return h(
    "div",
    { className: "rt-pane" },
    h(
      "div",
      { className: "rt-card" },
      h("h4", null, "SRC 漏洞发现报告"),
      h(
        "p",
        null,
        "报告保留直接证据、停止原因和待核实项。发现停止与整体覆盖完成分别记录。",
      ),
      h(
        "button",
        {
          className: "rt-btn",
          disabled: saving,
          "data-src-action": "save",
          onClick: save,
        },
        "保存发现报告",
      ),
      report?.path ? h("p", { className: "rt-mono" }, report.path) : null,
      error ? h("div", { className: "rt-err" }, error) : null,
      report
        ? h(
            "pre",
            { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" } },
            report.markdown,
          )
        : null,
    ),
  );
}

export function PentestReport({ engagement, api }) {
  const [report, setReport] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const { owner, captured } = useRequestGeneration(engagement, api);
  const flight = React.useRef(null);
  React.useLayoutEffect(() => {
    flight.current = null;
    setReport(null);
    setBusy(false);
    setError("");
    setMessage("");
  }, [captured]);
  const load = async (save = false) => {
    if (!captured.engagement || !isCurrent(owner, captured) || flight.current)
      return;
    const generation = captured.generation;
    const sequence = ++captured.readSequence;
    const requestFlight = { captured };
    flight.current = requestFlight;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const value = await captured.api({
        op: "pentestReport",
        engagement: captured.engagement,
        save,
      });
      if (
        !isCurrent(owner, captured, generation) ||
        sequence !== captured.readSequence
      )
        return value;
      if (value?.ok === false) throw new Error(failureText(value.error));
      if (value?.assessment_mode && value.assessment_mode !== "pentest") {
        throw new Error("返回的报告类型与当前渗透靶标不一致，请刷新后重试。");
      }
      setReport(value);
      if (save) setMessage("已保存完整 Markdown 与 JSON 报告。");
      return value;
    } catch (failure) {
      if (
        isCurrent(owner, captured, generation) &&
        sequence === captured.readSequence
      )
        setError(failureText(failure));
    } finally {
      if (flight.current === requestFlight) {
        flight.current = null;
        if (isCurrent(owner, captured, generation)) setBusy(false);
      }
    }
  };
  React.useEffect(() => {
    if (!captured.engagement || !isCurrent(owner, captured)) return;
    load(false);
  }, [captured]);
  const download = (kind) => {
    if (!isCurrent(owner, captured) || !report) return;
    const markdown = kind === "markdown";
    const content = markdown
      ? report.markdown
      : report.report == null
        ? null
        : JSON.stringify(report.report, null, 2);
    if (content == null || content === "") {
      setError(
        markdown
          ? "当前报告没有可下载的 Markdown。"
          : "当前报告没有可下载的 JSON 快照。",
      );
      return;
    }
    let url;
    try {
      url = URL.createObjectURL(
        new Blob([content], {
          type: markdown
            ? "text/markdown;charset=utf-8"
            : "application/json;charset=utf-8",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download =
        "pentest-report-" +
        String(captured.engagement).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_") +
        (markdown ? ".md" : ".json");
      link.click();
      setMessage(markdown ? "已下载 Markdown 报告。" : "已下载 JSON 快照。");
    } catch (failure) {
      setError(failureText(failure));
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  };
  return h(
    "div",
    { className: "rt-pane" },
    h(
      "div",
      { className: "rt-card" },
      h("h4", null, "渗透测试报告"),
      h(
        "p",
        null,
        "通过当前靶标的内置 awa-ddd 核心生成完整报告，汇总范围、资产、发现、复现、修复建议和未完成项。读取报告会生成版本化本地快照，不会向目标发起新请求。",
      ),
      h(
        "div",
        { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
        h(
          "button",
          {
            className: "rt-btn",
            disabled: busy || !engagement,
            "data-pentest-action": "read",
            onClick: () => load(false),
          },
          report ? "刷新报告" : "读取报告",
        ),
        h(
          "button",
          {
            className: "rt-btn",
            disabled: busy || !engagement,
            "data-pentest-action": "save",
            onClick: () => load(true),
          },
          "保存报告",
        ),
        h(
          "button",
          {
            className: "rt-btn",
            disabled: busy || !report?.markdown,
            "data-pentest-action": "download-markdown",
            onClick: () => download("markdown"),
          },
          "下载 Markdown",
        ),
        h(
          "button",
          {
            className: "rt-btn",
            disabled: busy || report?.report == null,
            "data-pentest-action": "download-json",
            onClick: () => download("json"),
          },
          "下载 JSON",
        ),
      ),
      report
        ? h(
            React.Fragment,
            null,
            Number(report.requests_sent) === 0
              ? h("p", null, "本次仅整理现有记录，未发送目标请求。")
              : null,
            report.path
              ? h(
                  "p",
                  {
                    className: "rt-mono",
                    "data-pentest-path": "markdown",
                    style: { overflowWrap: "anywhere" },
                  },
                  "Markdown：" + report.path,
                )
              : null,
            report.json_path
              ? h(
                  "p",
                  {
                    className: "rt-mono",
                    "data-pentest-path": "json",
                    style: { overflowWrap: "anywhere" },
                  },
                  "JSON：" + report.json_path,
                )
              : null,
            h(
              "details",
              { open: true },
              h("summary", null, "Markdown 报告"),
              h(
                "pre",
                {
                  "data-pentest-report": "markdown",
                  style: {
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    maxHeight: 560,
                    overflow: "auto",
                  },
                },
                report.markdown,
              ),
            ),
            report.report != null
              ? h(
                  "details",
                  null,
                  h("summary", null, "结构化完整快照"),
                  h(
                    "pre",
                    {
                      "data-pentest-report": "json",
                      style: {
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                        maxHeight: 420,
                        overflow: "auto",
                      },
                    },
                    JSON.stringify(report.report, null, 2),
                  ),
                )
              : null,
          )
        : null,
      message ? h("p", null, message) : null,
      error ? h("div", { className: "rt-err" }, error) : null,
    ),
  );
}
