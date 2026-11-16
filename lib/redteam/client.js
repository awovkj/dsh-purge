// Generated from src/ by npm run build. Do not edit.
// Derived UI: YuJunZhiXue/dsh-purge (MIT), see LICENSE.
(()=>{const __PURGE_MODULE_URL__ = typeof document !== 'undefined' ? document.currentScript?.src : undefined;
window.__ModuleLoader__.load({id:"dsh-purge",factory:(require)=>{
var module={exports:{}};var exports=module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/community/redteam-standalone.js
var redteam_standalone_exports = {};
__export(redteam_standalone_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(redteam_standalone_exports);
var import_react3 = __toESM(require("react"), 1);

// src/api/client.js
function apiUrl(p, context = {}) {
  try {
    const loc = context.href || window.location.href || window.location.origin + "/";
    const page = new URL(loc);
    const module2 = new URL(
      context.moduleUrl || typeof __PURGE_MODULE_URL__ !== "undefined" && __PURGE_MODULE_URL__ || page.href,
      page
    );
    let base;
    const marker = module2.pathname.indexOf("/plugins/");
    if (module2.origin === page.origin && marker >= 0) {
      base = new URL(module2.pathname.slice(0, marker + 1), page);
    } else {
      const declared = context.baseURI || typeof document !== "undefined" && document.baseURI;
      const candidate = declared && new URL(declared, page);
      base = candidate && candidate.origin === page.origin ? candidate : page;
      base = new URL(base.href);
      if (!base.pathname.endsWith("/")) base.pathname += "/";
    }
    base.search = "";
    base.hash = "";
    if (typeof p !== "string" || !p.startsWith("/") || p.startsWith("//"))
      return p;
    return new URL(p.slice(1), base).toString();
  } catch {
    return p;
  }
}

// src/vendor/drill.js
var import_react2 = __toESM(require("react"), 1);

// src/community/awa-evidence.js
var import_react = __toESM(require("react"), 1);
var h = import_react.default.createElement;
var rules = (value) => String(value || "").split(/[\r\n,]+/).map((item) => item.trim()).filter(Boolean);
var isScopedAssessmentMode = (mode) => mode === "src" || mode === "pentest";
var assessmentModeLabel = (mode) => mode === "src" ? "[SRC] " : mode === "pentest" ? "[\u6E17\u900F] " : "[\u7EA2\u961F] ";
var assessmentModeOptions = [
  ["src", "SRC \u6F0F\u6D1E\u53D1\u73B0\u6A21\u5F0F"],
  ["pentest", "\u6E17\u900F\u6A21\u5F0F"],
  ["redteam", "\u7EA2\u961F\u6A21\u5F0F"]
];
var assessmentTabsForMode = (mode, tabs) => {
  const allowed = mode === "src" ? ["assets", "evidence", "agents", "findings", "report"] : mode === "pentest" ? ["assets", "evidence", "findings", "report"] : null;
  return allowed ? tabs.filter((item) => allowed.includes(item[0])) : tabs;
};
var field = (label, value, set, placeholder, props = {}) => h(
  "label",
  { style: { display: "grid", gap: 4, marginBottom: 8 } },
  label,
  h("input", {
    className: "rt-input",
    value,
    placeholder,
    ...props,
    onChange: (event) => set(event.target.value)
  })
);
function useRequestGeneration(engagement, api) {
  const owner = import_react.default.useRef(null);
  const generation = import_react.default.useRef(0);
  const captured = import_react.default.useMemo(
    () => ({ engagement, api, active: false, generation: 0, readSequence: 0 }),
    [engagement, api]
  );
  import_react.default.useLayoutEffect(() => {
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
var isCurrent = (owner, captured, generation = captured?.generation) => captured?.active === true && owner.current === captured && captured.generation === generation;
var failureText = (failure) => String(failure?.message || failure || "\u64CD\u4F5C\u672A\u5B8C\u6210");
var emptyRuntime = () => ({
  pythonExecutable: "",
  executionBackend: "native",
  wslDistribution: "kali-linux",
  wslPythonExecutable: "python3",
  timeoutMs: 12e4
});
var defaultPreferences = () => ({
  continuationGuard: true,
  requireAssessmentForHighValueScore: true
});
var runtimeLabel = {
  located: "\u5DF2\u5B9A\u4F4D\uFF0C\u5C1A\u672A\u63A2\u6D4B",
  not_found: "\u672A\u627E\u5230",
  not_checked: "\u5C1A\u672A\u63A2\u6D4B",
  ready: "\u53EF\u7528",
  unavailable: "\u4E0D\u53EF\u7528",
  unsupported_or_unknown: "\u7248\u672C\u4E0D\u8DB3\u6216\u672A\u77E5",
  module_located: "\u5305\u5DF2\u5B9A\u4F4D\uFF0C\u5C1A\u672A\u63A2\u6D4B",
  cache_located: "\u7F13\u5B58\u5DF2\u5B9A\u4F4D\uFF0C\u5C1A\u672A\u63A2\u6D4B",
  probe_failed: "\u63A2\u6D4B\u672A\u5B8C\u6210",
  registered_receipt: "\u6700\u8FD1\u6CE8\u518C\u6210\u529F\u56DE\u6267",
  pending_or_failed: "\u7B49\u5F85\u6CE8\u518C\u6216\u6CE8\u518C\u5931\u8D25",
  not_recorded: "\u6CA1\u6709\u6CE8\u518C\u56DE\u6267",
  unknown: "\u672A\u77E5",
  unreadable: "\u56DE\u6267\u4E0D\u53EF\u8BFB\u53D6"
};
var coverageLabel = {
  completed_registered_scope: "\u5DF2\u767B\u8BB0\u4EFB\u52A1\u5DF2\u7ED3\u9879",
  unfinished: "\u6709\u672A\u5B8C\u6210\u9879",
  blocked: "\u5F53\u524D\u53D7\u963B",
  inactive_unfinished: "\u5DF2\u6682\u505C\u6216\u90E8\u5206\u4EA4\u4ED8",
  not_initialized: "\u5C1A\u672A\u51C6\u5907\u5185\u90E8\u4E0A\u4E0B\u6587",
  unavailable: "\u8986\u76D6\u6682\u4E0D\u53EF\u8BFB\u53D6"
};
var checkbox = (label, checked, set) => h(
  "label",
  {
    style: { display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }
  },
  h("input", {
    type: "checkbox",
    checked,
    onChange: (event) => set(event.target.checked)
  }),
  label
);
function AssessmentTab({ engagement, api }) {
  const [status, setStatus] = import_react.default.useState(null);
  const [target, setTarget] = import_react.default.useState("");
  const [scope, setScope] = import_react.default.useState("");
  const [model, setModel] = import_react.default.useState("v1");
  const [sourceOffset, setSourceOffset] = import_react.default.useState(0);
  const [reviewOffset, setReviewOffset] = import_react.default.useState(0);
  const [result, setResult] = import_react.default.useState(null);
  const [resultOperation, setResultOperation] = import_react.default.useState("");
  const [error, setError] = import_react.default.useState("");
  const [busy, setBusy] = import_react.default.useState(false);
  const [runtimeConfig, setRuntimeConfig] = import_react.default.useState(emptyRuntime);
  const [preferences, setPreferences] = import_react.default.useState(defaultPreferences);
  const runtimeDirty = import_react.default.useRef(false);
  const preferencesDirty = import_react.default.useRef(false);
  const contextDirty = import_react.default.useRef(false);
  const { owner, captured } = useRequestGeneration(engagement, api);
  const flight = import_react.default.useRef(null);
  import_react.default.useLayoutEffect(() => {
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
    const urls = (value.context?.scope || value.assessment_policy?.scope || []).filter((rule) => /^https?:\/\//i.test(rule));
    if (!contextDirty.current) {
      setTarget(value.context?.target || urls[0] || "");
      setScope(urls.join("\n"));
      setModel(
        value.context?.model || value.operator_config?.assessmentModel || "v1"
      );
    }
    if (value.operator_config && !runtimeDirty.current)
      setRuntimeConfig({ ...emptyRuntime(), ...value.operator_config });
    if (value.preferences && !preferencesDirty.current)
      setPreferences(value.preferences);
    if (value?.ok === false) setError(failureText(value.error));
  };
  const refresh = async (captured2, generation = captured2.generation) => {
    if (!isCurrent(owner, captured2, generation)) return;
    const sequence = ++captured2.readSequence;
    try {
      const value = await captured2.api({
        op: "assessmentStatus",
        ...captured2.engagement ? { engagement: captured2.engagement } : {}
      });
      if (!isCurrent(owner, captured2, generation) || sequence !== captured2.readSequence)
        return value;
      acceptStatus(value);
      return value;
    } catch (failure) {
      if (isCurrent(owner, captured2, generation) && sequence === captured2.readSequence)
        throw failure;
    }
  };
  import_react.default.useEffect(() => {
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
      "assessmentRuntimeProbe"
    ].includes(request.op) ? ++captured.readSequence : null;
    setBusy(true);
    setError("");
    try {
      const value = await captured.api({
        ...request,
        ...captured.engagement ? { engagement: captured.engagement } : {}
      });
      if (!isCurrent(owner, captured, generation)) return value;
      setResult(value);
      setResultOperation(request.op);
      if (request.op === "assessmentRuntimeProbe" && value.runtime) {
        setStatus((previous) => ({ ...previous, runtime: value.runtime }));
        if (value.ok === false)
          setError("\u672C\u5730\u8BC4\u4F30\u8FD0\u884C\u6761\u4EF6\u5C1A\u4E0D\u8DB3\uFF0C\u8BF7\u67E5\u770B Node\u3001\u89E3\u91CA\u5668\u72B6\u6001\u4E0E\u539F\u56E0\u3002");
      } else if (value?.ok === false) throw new Error(failureText(value.error));
      if (request.op === "assessmentStatus" && statusSequence === captured.readSequence)
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
      if ([
        "assessmentStart",
        "awaConfigSave",
        "assessmentPreferencesSave",
        "assessmentRuntimeProbe"
      ].includes(request.op)) {
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
  const button = (label, request, disabled = false) => h(
    "button",
    {
      className: "rt-btn",
      disabled: busy || disabled,
      "data-assessment-operation": request.op,
      "data-assessment-action": request.action || "",
      "data-assessment-verify": typeof request.verify === "boolean" ? String(request.verify) : "",
      onClick: () => run(request)
    },
    label
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
  const resultText = result ? JSON.stringify(
    result,
    (key, value) => ["project_id", "packagePath"].includes(key) ? void 0 : value,
    2
  ) : "";
  const resultPageKind = result?.page_kind || (resultOperation === "assessmentImport" ? "source_candidates" : resultOperation === "assessmentReview" ? "assessment_candidates" : "");
  const canPageResult = ["source_candidates", "assessment_candidates"].includes(resultPageKind) && (Boolean(result?.next?.arguments) || result?.next_offset != null);
  const nextResultPage = () => {
    if (!isCurrent(owner, captured) || !canPageResult) return;
    if (result.next?.arguments) {
      return run({
        ...result.next.arguments,
        op: resultPageKind === "source_candidates" ? "assessmentImport" : "assessmentReview"
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
      h("h4", null, "\u8BC4\u4F30\u8FD0\u884C\u73AF\u5883"),
      h(
        "p",
        null,
        "\u672C\u5730\u72B6\u6001\u533A\u5206\u6587\u4EF6\u5B9A\u4F4D\u4E0E\u5B9E\u9645\u63A2\u6D4B\u3002\u6D4F\u89C8\u5668\u8FD0\u884C\u65F6\u7F3A\u5931\u65F6\uFF0C\u76F8\u5173\u8BC4\u4F30\u9879\u4FDD\u7559\u53D7\u963B\u539F\u56E0\u3002"
      ),
      runtime ? h(
        import_react.default.Fragment,
        null,
        h(
          "div",
          { "data-runtime-kind": "node" },
          `Node ${runtime.node?.version || "\u672A\u77E5"} \xB7 ${runtime.node?.supported ? "\u6EE1\u8DB3\u8BC4\u4F30\u6838\u5FC3\u8981\u6C42" : "\u9700\u8981 Node 22.19 \u6216\u66F4\u9AD8\u7248\u672C"}`
        ),
        h(
          "p",
          null,
          "\u8FD0\u884C\u8981\u6C42\uFF1APurge \u57FA\u7840 Node \u226518\uFF1B\u7EA2\u961F\u5DE5\u5177 Node \u226522.5\uFF1B\u5185\u7F6E\u8BC4\u4F30 Node \u226522.19\u3001Python \u22653.10\uFF1B\u6D4F\u89C8\u5668\u5355\u72EC\u5224\u65AD\u3002"
        ),
        h(
          "div",
          {
            "data-runtime-kind": "python",
            "data-runtime-state": runtime.python?.state || "unknown"
          },
          `Python\uFF1A${runtimeLabel[runtime.python?.state] || runtime.python?.state || "\u672A\u77E5"}${runtime.python?.version ? " \xB7 " + runtime.python.version : ""}`
        ),
        h(
          "p",
          { className: "rt-mono", style: { overflowWrap: "anywhere" } },
          runtime.python?.path || runtime.python?.executable || "\u672A\u5B9A\u4F4D\u89E3\u91CA\u5668"
        ),
        runtime.python?.reason ? h("p", null, "\u89E3\u91CA\u5668\u539F\u56E0\uFF1A" + runtime.python.reason) : null,
        h(
          "div",
          {
            "data-runtime-kind": "browser",
            "data-runtime-state": runtime.browser?.state || "unknown"
          },
          `\u6D4F\u89C8\u5668\uFF1A${runtimeLabel[runtime.browser?.state] || runtime.browser?.state || "\u672A\u77E5"}${runtime.browser?.version ? " \xB7 " + runtime.browser.version : ""}`
        ),
        runtime.browser?.reason ? h("p", null, "\u6D4F\u89C8\u5668\u539F\u56E0\uFF1A" + runtime.browser.reason) : null,
        ...(status?.assessment_policy?.assessment_mode === "pentest" ? [["\u6E17\u900F", runtime.pentest_preset]] : [["SRC", runtime.src_preset]]).flatMap(([label, receipt]) => [
          h(
            "p",
            { key: label + "-preset" },
            `${label}\u9884\u8BBE\uFF1A${runtimeLabel[receipt?.state] || "\u672A\u77E5"}${receipt?.phase ? " \xB7 " + receipt.phase : ""}`
          ),
          receipt?.at ? h(
            "p",
            { key: label + "-receipt" },
            "\u56DE\u6267\u65F6\u95F4\uFF1A" + receipt.at + "\uFF1B\u8BE5\u56DE\u6267\u4E0D\u4EE3\u8868\u5F53\u524D\u754C\u9762\u5DF2\u91CD\u65B0\u52A0\u8F7D\u3002"
          ) : null
        ]),
        status?.assessment_policy?.assessment_mode !== "pentest" ? h(
          "p",
          null,
          "SRC \u6307\u5F15\uFF1A" + (runtime.src_skill?.installed ? "\u968F\u5305\u6280\u80FD\u5DF2\u540C\u6B65" : "\u540C\u6B65\u526F\u672C\u5C1A\u672A\u5B9A\u4F4D") + "\uFF1B\u53EF\u7528 redteam_src_runbook \u8BFB\u53D6\u5F53\u524D\u5B89\u88C5\u7684\u6B63\u6587\u3002"
        ) : null,
        h(
          "p",
          null,
          guard?.registered ? `\u7EED\u8DD1\u94A9\u5B50\u5DF2\u767B\u8BB0 \xB7 ${guard.active_agents || 0} \u4E2A\u6D3B\u52A8\u4F1A\u8BDD` : "\u5BBF\u4E3B\u7EED\u8DD1\u63A5\u53E3\u5C1A\u4E0D\u53EF\u7528\uFF1B\u8BC4\u4F30\u5DE5\u5177\u4ECD\u4F1A\u63D0\u4F9B\u4E0B\u4E00\u6B65\u3002"
        ),
        guard?.reason ? h(
          "details",
          null,
          h("summary", null, "\u7EED\u8DD1\u72B6\u6001"),
          h("p", { className: "rt-mono" }, guard.reason)
        ) : null,
        guard?.metrics ? h(
          "p",
          null,
          `\u672C\u8FDB\u7A0B\u6709\u6548\u8FDB\u5C55\uFF1A\u5B9E\u9645\u6750\u6599 ${guard.metrics.material_captures || 0}\uFF1B\u8EAB\u4EFD\u6838\u5B9E ${guard.metrics.identity_verifications || 0}\uFF1B\u5B89\u5168\u63A7\u5236 ${guard.metrics.security_control_runs || 0}\uFF1B\u91CD\u590D\u4EFB\u52A1\u53D7\u963B ${guard.metrics.repeated_task_failures || 0}\u3002`
        ) : null,
        runtime.checked_at ? h("p", null, "\u6700\u8FD1\u672C\u5730\u63A2\u6D4B\uFF1A" + runtime.checked_at) : null
      ) : h("p", null, "\u6B63\u5728\u8BFB\u53D6\u672C\u5730\u73AF\u5883\u4FE1\u606F\u3002"),
      button("\u63A2\u6D4B\u672C\u5730\u8FD0\u884C\u73AF\u5883", {
        op: "assessmentRuntimeProbe",
        browser: true
      }),
      h(
        "details",
        { style: { marginTop: 12 } },
        h("summary", null, "\u89E3\u91CA\u5668\u4E0E\u6267\u884C\u540E\u7AEF\u8BBE\u7F6E"),
        h(
          "p",
          null,
          "\u8BBE\u7F6E\u7531\u64CD\u4F5C\u8005\u4FDD\u5B58\u3002\u5DF2\u6709\u8BC4\u4F30\u4E0A\u4E0B\u6587\u7684\u540E\u7AEF\u4FDD\u6301\u56FA\u5B9A\uFF0C\u5207\u6362\u9ED8\u8BA4\u540E\u7AEF\u4E0D\u4F1A\u8FC1\u79FB\u5DF2\u6709\u53F0\u8D26\u3002"
        ),
        status?.context?.initialized ? h(
          "p",
          null,
          `\u5F53\u524D\u4EFB\u52A1\u540E\u7AEF\uFF1A${status.context.executionBackend}${status.context.wslDistribution ? " \xB7 " + status.context.wslDistribution : ""}`
        ) : null,
        field(
          "\u672C\u673A Python \u8DEF\u5F84\u6216\u540D\u79F0",
          runtimeConfig.pythonExecutable,
          runtimeChange("pythonExecutable"),
          "python \u6216\u7EDD\u5BF9\u8DEF\u5F84"
        ),
        h(
          "label",
          { style: { display: "grid", gap: 4, marginBottom: 8 } },
          "\u6267\u884C\u540E\u7AEF",
          h(
            "select",
            {
              className: "rt-input",
              value: runtimeConfig.executionBackend,
              onChange: (event) => runtimeChange("executionBackend")(event.target.value)
            },
            h("option", { value: "native" }, "\u672C\u673A"),
            h("option", { value: "wsl" }, "WSL\uFF08Windows\uFF09")
          )
        ),
        runtimeConfig.executionBackend === "wsl" ? h(
          import_react.default.Fragment,
          null,
          field(
            "WSL \u53D1\u884C\u7248",
            runtimeConfig.wslDistribution,
            runtimeChange("wslDistribution"),
            "kali-linux"
          ),
          field(
            "WSL Python \u8DEF\u5F84\u6216\u540D\u79F0",
            runtimeConfig.wslPythonExecutable,
            runtimeChange("wslPythonExecutable"),
            "python3"
          )
        ) : null,
        field(
          "\u5355\u6B21\u8C03\u7528\u8D85\u65F6\uFF08\u6BEB\u79D2\uFF09",
          String(runtimeConfig.timeoutMs),
          runtimeChange("timeoutMs"),
          "120000",
          { type: "number", min: 1e3, max: 6e5, step: 1e3 }
        ),
        button(
          "\u4FDD\u5B58\u73AF\u5883\u8BBE\u7F6E",
          {
            op: "awaConfigSave",
            config: {
              pythonExecutable: runtimeConfig.pythonExecutable.trim(),
              executionBackend: runtimeConfig.executionBackend,
              wslDistribution: runtimeConfig.wslDistribution.trim(),
              wslPythonExecutable: runtimeConfig.wslPythonExecutable.trim(),
              timeoutMs: Number(runtimeConfig.timeoutMs)
            }
          },
          !status?.operator_config || !runtimeConfig.pythonExecutable.trim()
        )
      ),
      h(
        "details",
        { style: { marginTop: 12 } },
        h("summary", null, "\u7EED\u8DD1\u4E0E\u8BB0\u5206\u504F\u597D"),
        h(
          "p",
          null,
          "\u7EED\u8DD1\u53EA\u63A8\u8FDB\u5DF2\u6709\u83B7\u51C6\u4EFB\u52A1\uFF1B\u53D6\u6D88\u3001\u65B0\u8F93\u5165\u3001SRC \u505C\u6B62\u548C\u7F3A\u5931\u524D\u63D0\u4F18\u5148\u3002\u65E0\u8FDB\u5C55\u65F6\u4FDD\u7559\u672A\u5B8C\u6210\u8BB0\u5F55\u3002"
        ),
        checkbox(
          "\u542F\u7528\u8BC4\u4F30\u7EED\u8DD1\u63D0\u9192",
          preferences.continuationGuard,
          preferenceChange("continuationGuard")
        ),
        checkbox(
          "\u9AD8\u4EF7\u503C\u5F97\u5206\u8981\u6C42 observed \u6210\u679C\u8BC1\u636E",
          preferences.requireAssessmentForHighValueScore,
          preferenceChange("requireAssessmentForHighValueScore")
        ),
        h(
          "p",
          null,
          "\u9AD8\u4EF7\u503C\u8981\u6C42\u7528\u4E8E\u670D\u52A1\u5668\u4E3B\u673A\u3001\u96C6\u6743\u7CFB\u7EDF\u548C\u57DF\u540D\u63A7\u5236\u6210\u679C\uFF0C\u68C0\u67E5\u53EF\u4FE1\u91C7\u96C6\u56DE\u6267\u3001\u540C\u76EE\u6807\u3001score_outcome \u548C\u57FA\u7840\u5206\u503C\u6863\u4F4D\u3002\u65B0\u9ED8\u8BA4\u5F00\u542F\uFF0C\u5DF2\u660E\u786E\u4FDD\u5B58\u7684\u5173\u95ED\u503C\u4FDD\u7559\uFF0C\u5386\u53F2\u6587\u5B57\u8BB0\u5F55\u4ECD\u4F1A\u6807\u6CE8\u3002"
        ),
        button(
          "\u4FDD\u5B58\u504F\u597D",
          { op: "assessmentPreferencesSave", value: preferences },
          !status?.preferences
        )
      )
    ),
    h(
      "div",
      { className: "rt-card" },
      h("h4", null, "\u5185\u7F6E\u8BC1\u636E\u8BC4\u4F30"),
      h(
        "p",
        null,
        "\u8BC4\u4F30\u6838\u5FC3\u968F\u9879\u76EE\u63D0\u4F9B\uFF0C\u76F4\u63A5\u4F7F\u7528\u5F53\u524D\u9776\u6807\u7684\u8303\u56F4\u548C\u53F0\u8D26\u3002\u5019\u9009\u9700\u901A\u8FC7\u771F\u5B9E\u5BF9\u7167\u4E0E\u53EF\u590D\u6838\u8BC1\u636E\u786E\u8BA4\u3002"
      ),
      h(
        "div",
        { className: "rt-tag", "data-assessment-engine": "embedded" },
        status?.engine?.embedded ? `\u9879\u76EE\u5185\u7F6E\u8BC4\u4F30\u6838\u5FC3 \xB7 ${status.engine.version || ""}` : "\u6B63\u5728\u8BFB\u53D6\u5185\u7F6E\u8BC4\u4F30\u6838\u5FC3\u4FE1\u606F"
      ),
      engagement ? h(
        import_react.default.Fragment,
        null,
        h(
          "p",
          { "data-assessment-context": ready ? "ready" : "pending" },
          ready ? `\u5F53\u524D\u9776\u6807\u8BC4\u4F30\u5DF2\u51C6\u5907 \xB7 ${status.context.target || ""}` : status?.context?.reason === "runtime_configuration_mismatch" ? "\u5F53\u524D\u914D\u7F6E\u4E0E\u5DF2\u6709\u4EFB\u52A1\u7684\u56FA\u5B9A\u540E\u7AEF\u4E0D\u4E00\u81F4\uFF0C\u8BF7\u6062\u590D\u5BF9\u5E94\u540E\u7AEF\u8BBE\u7F6E\u3002" : "\u5F53\u524D\u9776\u6807\u5C1A\u9700\u660E\u786E HTTP \u76EE\u6807\u4E0E\u8303\u56F4\u3002"
        ),
        !ready && !status?.context?.initialized ? h(
          import_react.default.Fragment,
          null,
          field(
            "\u76EE\u6807 URL",
            target,
            contextChange(setTarget),
            "https://example.test/app"
          ),
          h(
            "label",
            { style: { display: "grid", gap: 4, marginBottom: 8 } },
            "\u660E\u786E URL \u8303\u56F4\uFF08\u6BCF\u884C\u4E00\u9879\uFF09",
            h("textarea", {
              className: "rt-textarea",
              rows: 3,
              value: scope,
              onChange: (event) => contextChange(setScope)(event.target.value)
            })
          ),
          h(
            "label",
            { style: { display: "grid", gap: 4, marginBottom: 8 } },
            "\u8BC4\u4F30\u6A21\u578B",
            h(
              "select",
              {
                className: "rt-input",
                value: model,
                onChange: (event) => contextChange(setModel)(event.target.value),
                "data-assessment-model": true
              },
              h("option", { value: "v1" }, "\u8BC1\u636E\u4E0E\u6D4B\u8BD5\u4E49\u52A1"),
              h("option", { value: "v2" }, "\u5047\u8BBE\u4E0E\u6D4B\u8BD5\u914D\u65B9")
            )
          ),
          button(
            "\u51C6\u5907\u5F53\u524D\u9776\u6807\u8BC4\u4F30",
            {
              op: "assessmentStart",
              target,
              scope: rules(scope),
              assessmentModel: model
            },
            !target || !rules(scope).length
          )
        ) : h(
          import_react.default.Fragment,
          null,
          button("\u5237\u65B0\u8BC4\u4F30\u72B6\u6001", { op: "assessmentStatus" }),
          status.context.workspace ? h(
            "details",
            null,
            h("summary", null, "\u53F0\u8D26\u4F4D\u7F6E"),
            h(
              "p",
              { className: "rt-mono" },
              status.context.workspace
            )
          ) : null
        ),
        h("hr"),
        h(
          "details",
          null,
          h("summary", null, "\u4ECE\u6307\u5B9A\u4F4D\u7F6E\u6062\u590D\u8BFB\u53D6"),
          field(
            "\u6765\u6E90\u5019\u9009\u8D77\u59CB\u4F4D\u7F6E",
            String(sourceOffset),
            (value) => setSourceOffset(Number(value)),
            "0",
            { "data-assessment-cursor": "source_candidates" }
          ),
          field(
            "\u8BC4\u4F30\u590D\u6838\u8D77\u59CB\u4F4D\u7F6E",
            String(reviewOffset),
            (value) => setReviewOffset(Number(value)),
            "0",
            { "data-assessment-cursor": "assessment_candidates" }
          )
        ),
        h("p", null, "\u7EB3\u5165\u5019\u9009\u540E\u590D\u6838\u5DF2\u6709\u8BC1\u636E\uFF0C\u4F7F\u7528\u7ED3\u679C\u4E2D\u7684\u4E0B\u4E00\u9875\u7EE7\u7EED\u3002"),
        h(
          "div",
          { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
          button(
            "\u7EB3\u5165\u672C\u9875\u5019\u9009",
            { op: "assessmentImport", offset: sourceOffset, limit: 50 },
            !ready
          ),
          button(
            "\u67E5\u770B\u8BC4\u4F30\u53F0\u8D26",
            {
              op: "assessmentRun",
              action: "project.status",
              input: { limit: 3 }
            },
            !ready
          ),
          button(
            "\u590D\u6838\u5DF2\u6709\u8BC1\u636E",
            {
              op: "assessmentReview",
              verify: false,
              offset: reviewOffset,
              limit: 50
            },
            !ready
          ),
          button(
            "\u786E\u8BA4\u5DF2\u8BC1\u660E\u53D1\u73B0",
            {
              op: "assessmentReview",
              verify: true,
              offset: reviewOffset,
              limit: 50
            },
            !ready
          )
        )
      ) : h("p", null, "\u5148\u521B\u5EFA\u9776\u6807\uFF0C\u8BC4\u4F30\u6838\u5FC3\u5C06\u4F7F\u7528\u8BE5\u9776\u6807\u7684\u5185\u90E8\u4E0A\u4E0B\u6587\u3002"),
      error ? h("div", { className: "rt-err" }, error) : null,
      result ? h(
        "details",
        { open: true },
        h("summary", null, "\u672C\u6B21\u7ED3\u679C"),
        canPageResult ? h(
          "button",
          {
            className: "rt-btn",
            disabled: busy,
            "data-assessment-next": resultPageKind,
            onClick: nextResultPage
          },
          resultPageKind === "source_candidates" ? "\u9009\u62E9\u4E0B\u4E00\u6765\u6E90\u5019\u9009\u9875" : "\u9009\u62E9\u4E0B\u4E00\u8BC4\u4F30\u590D\u6838\u9875"
        ) : null,
        h(
          "pre",
          {
            className: "rt-mono",
            style: {
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              maxHeight: 360,
              overflow: "auto"
            }
          },
          resultText.slice(0, 12e3)
        ),
        resultText.length > 12e3 ? h(
          "p",
          null,
          "\u5F53\u524D\u7ED3\u679C\u4EC5\u663E\u793A\u524D 12,000 \u4E2A\u5B57\u7B26\uFF0C\u8BF7\u4F7F\u7528\u5C0F\u9875\u5B8C\u6210\u590D\u6838\u3002"
        ) : null
      ) : null
    ),
    engagement ? h(AssessmentDeliveryReport, { engagement, api, embedded: true }) : null
  );
}
function AssessmentDeliveryReport({
  engagement,
  api,
  embedded = false
}) {
  const [report, setReport] = import_react.default.useState(null);
  const [scoreOffset, setScoreOffset] = import_react.default.useState(0);
  const [findingOffset, setFindingOffset] = import_react.default.useState(0);
  const [stopOffset, setStopOffset] = import_react.default.useState(0);
  const [currentPage, setCurrentPage] = import_react.default.useState({});
  const [busy, setBusy] = import_react.default.useState(false);
  const [error, setError] = import_react.default.useState("");
  const [message, setMessage] = import_react.default.useState("");
  const { owner, captured } = useRequestGeneration(engagement, api);
  const flight = import_react.default.useRef(null);
  import_react.default.useLayoutEffect(() => {
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
    const generation = captured.generation, sequence = ++captured.readSequence;
    const requestFlight = { captured };
    flight.current = requestFlight;
    const pagination = page.page_token ? { page_token: page.page_token } : {
      offset: page.offset ?? 0,
      finding_offset: page.finding_offset ?? 0,
      stop_offset: page.stop_offset ?? 0,
      limit: 50
    };
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const value = await captured.api({
        op: "assessmentReport",
        engagement: captured.engagement,
        save,
        ...pagination
      });
      if (!isCurrent(owner, captured, generation) || sequence !== captured.readSequence)
        return value;
      if (value?.ok === false) throw new Error(failureText(value.error));
      setReport(value);
      setScoreOffset(value.score?.offset ?? pagination.offset ?? 0);
      setFindingOffset(
        value.findings?.offset ?? pagination.finding_offset ?? 0
      );
      setStopOffset(value.src_stops?.offset ?? pagination.stop_offset ?? 0);
      setCurrentPage(pagination);
      if (save)
        setMessage("\u672C\u9875 Markdown \u4E0E JSON \u5FEB\u7167\u5DF2\u4FDD\u5B58\u5230\u5F53\u524D\u9776\u6807\u7684\u62A5\u544A\u76EE\u5F55\u3002");
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
        new Blob([report.markdown], { type: "text/markdown;charset=utf-8" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "assessment-delivery-" + String(captured.engagement).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_") + ".md";
      link.click();
      setMessage("\u5DF2\u4E0B\u8F7D\u5F53\u524D\u4EA4\u4ED8\u62A5\u544A\u9875\u3002");
    } catch (failure) {
      setError(failureText(failure));
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  };
  const legacyPage = {
    offset: scoreOffset,
    finding_offset: findingOffset,
    stop_offset: stopOffset
  };
  return h(
    "div",
    { className: embedded ? "rt-card" : "rt-pane" },
    h(
      "div",
      { className: embedded ? void 0 : "rt-card" },
      h("h4", null, "\u5F97\u5206\u3001\u53D1\u73B0\u4E0E\u8BC4\u4F30\u4EA4\u4ED8"),
      h(
        "p",
        null,
        "\u540C\u65F6\u67E5\u770B\u73B0\u6709\u5F97\u5206\u3001\u8BC1\u636E\u5F3A\u5EA6\u3001\u8BC4\u4F30\u8986\u76D6\u548C SRC \u505C\u6B62\u3002\u6C47\u603B\u4FDD\u7559\u5168\u90E8\u5DF2\u767B\u8BB0\u5206\u6BCD\uFF0C\u660E\u7EC6\u6BCF\u9875 50 \u9879\u3002"
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
            onClick: () => load(false)
          },
          report ? "\u5237\u65B0\u5F53\u524D\u4EA4\u4ED8\u9875" : "\u8BFB\u53D6\u4EA4\u4ED8\u62A5\u544A"
        ),
        h(
          "button",
          {
            className: "rt-btn",
            disabled: busy || !engagement,
            "data-delivery-action": "save",
            onClick: () => load(true)
          },
          "\u4FDD\u5B58\u4EA4\u4ED8\u62A5\u544A\u9875"
        ),
        h(
          "button",
          { className: "rt-btn", disabled: busy || !report, onClick: download },
          "\u4E0B\u8F7D Markdown"
        )
      ),
      report ? h(
        import_react.default.Fragment,
        null,
        h(
          "p",
          { "data-delivery-state": report.assessment?.state },
          `\u8BC4\u4F30\uFF1A${coverageLabel[report.assessment?.state] || "\u672A\u77E5"} \xB7 \u6765\u6E90\u53D1\u73B0 ${report.findings?.registered_total || 0} \u9879` + (report.assessment_mode === "src" ? ` \xB7 \u505C\u6B62\u76EE\u6807 ${report.src_stops?.targets || 0} \u4E2A` : ` \xB7 \u5F97\u5206 ${report.score?.summary?.points || 0}`)
        ),
        h(
          "p",
          null,
          `\u6F0F\u6D1E ${report.findings?.vulnerabilities ?? report.findings?.registered_total ?? 0} \u9879 \xB7 \u52A0\u56FA\u5EFA\u8BAE ${report.findings?.hardening || 0} \u9879 \xB7 \u4FE1\u606F\u9879 ${report.findings?.informational || 0} \u9879` + (report.assessment_mode === "src" ? ` \xB7 \u5DF2\u6392\u9664\u5386\u53F2\u914D\u7F6E/\u4FE1\u606F\u9879 ${report.findings?.excluded_hardening || 0} \u9879` : "")
        ),
        h(
          "div",
          { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
          h(
            "button",
            {
              className: "rt-btn",
              disabled: busy || !scoreOffset && !findingOffset && !stopOffset,
              "data-delivery-action": "first",
              onClick: () => load(false, {
                offset: 0,
                finding_offset: 0,
                stop_offset: 0
              })
            },
            "\u8FD4\u56DE\u9996\u4E2A\u4EA4\u4ED8\u9875"
          ),
          report.next?.arguments ? h(
            "button",
            {
              className: "rt-btn",
              disabled: busy,
              "data-delivery-action": "next",
              onClick: () => load(false, report.next.arguments)
            },
            "\u4E0B\u4E00\u4EA4\u4ED8\u9875"
          ) : null,
          !report.next?.arguments && h(
            "button",
            {
              className: "rt-btn",
              disabled: busy || report.score?.next_offset == null,
              "data-delivery-action": "next-score",
              onClick: () => load(false, {
                ...legacyPage,
                offset: report.score.next_offset
              })
            },
            "\u4E0B\u4E00\u5F97\u5206\u660E\u7EC6\u9875"
          ),
          !report.next?.arguments && h(
            "button",
            {
              className: "rt-btn",
              disabled: busy || report.findings?.next_offset == null,
              "data-delivery-action": "next-findings",
              onClick: () => load(false, {
                ...legacyPage,
                finding_offset: report.findings.next_offset
              })
            },
            "\u4E0B\u4E00\u53D1\u73B0\u660E\u7EC6\u9875"
          ),
          !report.next?.arguments && report.assessment_mode === "src" && h(
            "button",
            {
              className: "rt-btn",
              disabled: busy || report.src_stops?.next_offset == null,
              "data-delivery-action": "next-stops",
              onClick: () => load(false, {
                ...legacyPage,
                stop_offset: report.src_stops.next_offset
              })
            },
            "\u4E0B\u4E00\u505C\u6B62\u660E\u7EC6\u9875"
          )
        ),
        report.path ? h(
          "p",
          { className: "rt-mono", style: { overflowWrap: "anywhere" } },
          report.path
        ) : null,
        h(
          "details",
          { open: !embedded },
          h("summary", null, "\u4EA4\u4ED8\u62A5\u544A\u5185\u5BB9"),
          h(
            "pre",
            {
              style: {
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                maxHeight: embedded ? 480 : void 0,
                overflow: "auto"
              }
            },
            report.markdown
          )
        )
      ) : null,
      message ? h("p", null, message) : null,
      error ? h("div", { className: "rt-err" }, error) : null
    )
  );
}
var submissionLabels = {
  security_candidate: "\u5B89\u5168\u6F0F\u6D1E\u5019\u9009",
  impact_review_required: "\u5B89\u5168\u5F71\u54CD\u5F85\u6838\u5B9E",
  report_incomplete: "\u8BC1\u660E\u5DF2\u6838\u5B9E\uFF0C\u63D0\u4EA4\u6750\u6599\u5F85\u8865",
  submission_ready: "\u63D0\u4EA4\u8349\u7A3F\u5B8C\u6574",
  excluded_hardening: "\u5386\u53F2\u52A0\u56FA\u9879\uFF0C\u5DF2\u6392\u9664"
};
function FindingSubmission({ finding, engagement, api, onSaved }) {
  const initial = () => ({
    submission: { ...finding.submission },
    reproduction: finding.reproduction || "",
    impact: finding.impact || "",
    remediation: finding.remediation || ""
  });
  const [draft, setDraft] = import_react.default.useState(initial);
  const [busy, setBusy] = import_react.default.useState(false);
  const [error, setError] = import_react.default.useState("");
  const { owner, captured } = useRequestGeneration(
    engagement + ":" + finding.id,
    api
  );
  const draftOwner = import_react.default.useRef(null);
  import_react.default.useLayoutEffect(() => {
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
    setDraft(
      (previous) => submission ? { ...previous, submission: { ...previous.submission, [key]: value } } : { ...previous, [key]: value }
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
        patch: draft
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
  const input = (key, label, maximum, multiline = false, submission = true) => h(
    "label",
    { key, style: { display: "grid", gap: 4, marginBottom: 8 } },
    label,
    h(multiline ? "textarea" : "input", {
      className: "rt-input",
      value: (submission ? draft.submission[key] : draft[key]) || "",
      maxLength: maximum,
      rows: multiline ? 3 : void 0,
      disabled: busy,
      "data-src-submission-field": key,
      onChange: (event) => change(key, event.target.value, submission)
    })
  );
  return h(
    "div",
    {
      "data-src-submission": state?.disposition || "security_candidate",
      style: { marginTop: 12 }
    },
    h("h4", null, "SRC \u63D0\u4EA4\u8349\u7A3F"),
    h("p", null, submissionLabels[state?.disposition] || "\u5B89\u5168\u6F0F\u6D1E\u5019\u9009"),
    h(
      "p",
      null,
      "\u6309\u5B9E\u9645\u9879\u76EE\u89C4\u5219\u6574\u7406\u5DF2\u6709\u6750\u6599\u3002\u8349\u7A3F\u5B8C\u6574\u4E0D\u4EE3\u8868\u5E73\u53F0\u63A5\u6536\uFF1B\u786E\u8BA4\u540E\u7684\u539F\u76EE\u6807\u7EE7\u7EED\u505C\u6D4B\u3002"
    ),
    state?.missing_fields?.length ? h("p", null, "\u5F85\u8865\uFF1A" + state.missing_fields.join("\u3001")) : null,
    input("program", "\u5B9E\u9645 SRC \u9879\u76EE", 256),
    input("policy_reference", "\u9879\u76EE\u89C4\u5219\u5F15\u7528", 2048),
    input("policy_basis", "\u89C4\u5219\u6536\u5F55\u4F9D\u636E", 4096, true),
    input("prerequisites", "\u5B9E\u9645\u590D\u73B0\u524D\u63D0", 4096, true),
    input("reproduction", "\u6700\u5C0F\u590D\u73B0\u6B65\u9AA4\uFF08\u5DF2\u6709\u6750\u6599\uFF09", 8192, true, false),
    input("expected_result", "\u9884\u671F\u5B89\u5168\u7ED3\u679C", 8192, true),
    h(
      "p",
      null,
      "\u5B9E\u9645\u53EF\u4FE1\u89C2\u5BDF\uFF1A" + ((finding.current_proofs || []).map((proof) => proof.observation).filter(Boolean).join("\uFF1B") || "\u5C1A\u65E0\u5F53\u524D\u53EF\u4FE1\u8BC1\u660E")
    ),
    input("impact", "\u5F71\u54CD\u5206\u6790\uFF08\u8349\u7A3F\uFF0C\u9650\u4E8E\u5DF2\u6709\u8BC1\u660E\uFF09", 8192, true, false),
    input("remediation", "\u4FEE\u590D\u5EFA\u8BAE", 8192, true, false),
    h(
      "label",
      null,
      "\u672C\u5730\u67E5\u91CD\u72B6\u6001 ",
      h(
        "select",
        {
          className: "rt-input",
          disabled: busy,
          value: draft.submission.duplicate_check || "not_checked",
          onChange: (event) => change("duplicate_check", event.target.value)
        },
        h("option", { value: "not_checked" }, "\u5C1A\u672A\u67E5\u91CD"),
        h("option", { value: "checked_local" }, "\u5DF2\u6838\u5BF9\u672C\u5730\u91CD\u590D"),
        h("option", { value: "potential_duplicate" }, "\u5B58\u5728\u53EF\u80FD\u91CD\u590D")
      )
    ),
    input("duplicate_reference", "\u67E5\u91CD\u53C2\u8003\u8BB0\u5F55", 2048),
    h(
      "button",
      {
        className: "rt-btn",
        disabled: busy,
        "data-src-submission-action": "save",
        onClick: save
      },
      busy ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58\u63D0\u4EA4\u8349\u7A3F"
    ),
    error ? h("p", { className: "rt-err" }, error) : null
  );
}
function AssessmentReportHub({
  engagement,
  api,
  detail: Detail,
  detailProps = {},
  src = false
}) {
  const [view, setView] = import_react.default.useState("delivery");
  import_react.default.useLayoutEffect(() => {
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
          onClick: () => setView("delivery")
        },
        "\u5408\u5E76\u4EA4\u4ED8"
      ),
      h(
        "button",
        {
          className: "rt-btn",
          "aria-pressed": view === "detail",
          onClick: () => setView("detail")
        },
        src ? "\u76F4\u63A5\u8BC1\u636E\u53D1\u73B0" : "\u8BE6\u7EC6\u6210\u679C\u590D\u73B0"
      )
    ),
    view === "delivery" ? h(AssessmentDeliveryReport, { engagement, api }) : h(Detail, { engagement, api, ...detailProps })
  );
}
function SrcDiscoveryReport({ engagement, api }) {
  const [report, setReport] = import_react.default.useState(null);
  const [error, setError] = import_react.default.useState("");
  const [saving, setSaving] = import_react.default.useState(false);
  const { owner, captured } = useRequestGeneration(engagement, api);
  const flight = import_react.default.useRef(null);
  import_react.default.useLayoutEffect(() => {
    flight.current = null;
    setReport(null);
    setError("");
    setSaving(false);
  }, [captured]);
  import_react.default.useEffect(() => {
    const generation = captured.generation;
    const sequence = ++captured.readSequence;
    const load = async () => {
      if (!isCurrent(owner, captured, generation)) return;
      try {
        const value = await captured.api({
          op: "srcReport",
          engagement: captured.engagement,
          save: false
        });
        if (!isCurrent(owner, captured, generation) || sequence !== captured.readSequence)
          return;
        if (value?.ok === false) setError(value.error || "\u62A5\u544A\u8BFB\u53D6\u5931\u8D25");
        else setReport(value);
      } catch (failure) {
        if (isCurrent(owner, captured, generation) && sequence === captured.readSequence)
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
        save: true
      });
      if (!isCurrent(owner, captured, generation) || sequence !== captured.readSequence)
        return value;
      if (value?.ok === false) setError(value.error || "\u62A5\u544A\u4FDD\u5B58\u5931\u8D25");
      else setReport(value);
      return value;
    } catch (failure) {
      if (isCurrent(owner, captured, generation) && sequence === captured.readSequence)
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
      h("h4", null, "SRC \u6F0F\u6D1E\u53D1\u73B0\u62A5\u544A"),
      h(
        "p",
        null,
        "\u62A5\u544A\u4FDD\u7559\u76F4\u63A5\u8BC1\u636E\u3001\u505C\u6B62\u539F\u56E0\u548C\u5F85\u6838\u5B9E\u9879\u3002\u53D1\u73B0\u505C\u6B62\u4E0E\u6574\u4F53\u8986\u76D6\u5B8C\u6210\u5206\u522B\u8BB0\u5F55\u3002"
      ),
      h(
        "button",
        {
          className: "rt-btn",
          disabled: saving,
          "data-src-action": "save",
          onClick: save
        },
        "\u4FDD\u5B58\u53D1\u73B0\u62A5\u544A"
      ),
      report?.path ? h("p", { className: "rt-mono" }, report.path) : null,
      error ? h("div", { className: "rt-err" }, error) : null,
      report ? h(
        "pre",
        { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" } },
        report.markdown
      ) : null
    )
  );
}
function PentestReport({ engagement, api }) {
  const [report, setReport] = import_react.default.useState(null);
  const [busy, setBusy] = import_react.default.useState(false);
  const [error, setError] = import_react.default.useState("");
  const [message, setMessage] = import_react.default.useState("");
  const { owner, captured } = useRequestGeneration(engagement, api);
  const flight = import_react.default.useRef(null);
  import_react.default.useLayoutEffect(() => {
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
        save
      });
      if (!isCurrent(owner, captured, generation) || sequence !== captured.readSequence)
        return value;
      if (value?.ok === false) throw new Error(failureText(value.error));
      if (value?.assessment_mode && value.assessment_mode !== "pentest") {
        throw new Error("\u8FD4\u56DE\u7684\u62A5\u544A\u7C7B\u578B\u4E0E\u5F53\u524D\u6E17\u900F\u9776\u6807\u4E0D\u4E00\u81F4\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002");
      }
      setReport(value);
      if (save) setMessage("\u5DF2\u4FDD\u5B58\u5B8C\u6574 Markdown \u4E0E JSON \u62A5\u544A\u3002");
      return value;
    } catch (failure) {
      if (isCurrent(owner, captured, generation) && sequence === captured.readSequence)
        setError(failureText(failure));
    } finally {
      if (flight.current === requestFlight) {
        flight.current = null;
        if (isCurrent(owner, captured, generation)) setBusy(false);
      }
    }
  };
  import_react.default.useEffect(() => {
    if (!captured.engagement || !isCurrent(owner, captured)) return;
    load(false);
  }, [captured]);
  const download = (kind) => {
    if (!isCurrent(owner, captured) || !report) return;
    const markdown = kind === "markdown";
    const content = markdown ? report.markdown : report.report == null ? null : JSON.stringify(report.report, null, 2);
    if (content == null || content === "") {
      setError(
        markdown ? "\u5F53\u524D\u62A5\u544A\u6CA1\u6709\u53EF\u4E0B\u8F7D\u7684 Markdown\u3002" : "\u5F53\u524D\u62A5\u544A\u6CA1\u6709\u53EF\u4E0B\u8F7D\u7684 JSON \u5FEB\u7167\u3002"
      );
      return;
    }
    let url;
    try {
      url = URL.createObjectURL(
        new Blob([content], {
          type: markdown ? "text/markdown;charset=utf-8" : "application/json;charset=utf-8"
        })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "pentest-report-" + String(captured.engagement).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_") + (markdown ? ".md" : ".json");
      link.click();
      setMessage(markdown ? "\u5DF2\u4E0B\u8F7D Markdown \u62A5\u544A\u3002" : "\u5DF2\u4E0B\u8F7D JSON \u5FEB\u7167\u3002");
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
      h("h4", null, "\u6E17\u900F\u6D4B\u8BD5\u62A5\u544A"),
      h(
        "p",
        null,
        "\u901A\u8FC7\u5F53\u524D\u9776\u6807\u7684\u5185\u7F6E awa-ddd \u6838\u5FC3\u751F\u6210\u5B8C\u6574\u62A5\u544A\uFF0C\u6C47\u603B\u8303\u56F4\u3001\u8D44\u4EA7\u3001\u53D1\u73B0\u3001\u590D\u73B0\u3001\u4FEE\u590D\u5EFA\u8BAE\u548C\u672A\u5B8C\u6210\u9879\u3002\u8BFB\u53D6\u62A5\u544A\u4F1A\u751F\u6210\u7248\u672C\u5316\u672C\u5730\u5FEB\u7167\uFF0C\u4E0D\u4F1A\u5411\u76EE\u6807\u53D1\u8D77\u65B0\u8BF7\u6C42\u3002"
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
            onClick: () => load(false)
          },
          report ? "\u5237\u65B0\u62A5\u544A" : "\u8BFB\u53D6\u62A5\u544A"
        ),
        h(
          "button",
          {
            className: "rt-btn",
            disabled: busy || !engagement,
            "data-pentest-action": "save",
            onClick: () => load(true)
          },
          "\u4FDD\u5B58\u62A5\u544A"
        ),
        h(
          "button",
          {
            className: "rt-btn",
            disabled: busy || !report?.markdown,
            "data-pentest-action": "download-markdown",
            onClick: () => download("markdown")
          },
          "\u4E0B\u8F7D Markdown"
        ),
        h(
          "button",
          {
            className: "rt-btn",
            disabled: busy || report?.report == null,
            "data-pentest-action": "download-json",
            onClick: () => download("json")
          },
          "\u4E0B\u8F7D JSON"
        )
      ),
      report ? h(
        import_react.default.Fragment,
        null,
        Number(report.requests_sent) === 0 ? h("p", null, "\u672C\u6B21\u4EC5\u6574\u7406\u73B0\u6709\u8BB0\u5F55\uFF0C\u672A\u53D1\u9001\u76EE\u6807\u8BF7\u6C42\u3002") : null,
        report.path ? h(
          "p",
          {
            className: "rt-mono",
            "data-pentest-path": "markdown",
            style: { overflowWrap: "anywhere" }
          },
          "Markdown\uFF1A" + report.path
        ) : null,
        report.json_path ? h(
          "p",
          {
            className: "rt-mono",
            "data-pentest-path": "json",
            style: { overflowWrap: "anywhere" }
          },
          "JSON\uFF1A" + report.json_path
        ) : null,
        h(
          "details",
          { open: true },
          h("summary", null, "Markdown \u62A5\u544A"),
          h(
            "pre",
            {
              "data-pentest-report": "markdown",
              style: {
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                maxHeight: 560,
                overflow: "auto"
              }
            },
            report.markdown
          )
        ),
        report.report != null ? h(
          "details",
          null,
          h("summary", null, "\u7ED3\u6784\u5316\u5B8C\u6574\u5FEB\u7167"),
          h(
            "pre",
            {
              "data-pentest-report": "json",
              style: {
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                maxHeight: 420,
                overflow: "auto"
              }
            },
            JSON.stringify(report.report, null, 2)
          )
        ) : null
      ) : null,
      message ? h("p", null, message) : null,
      error ? h("div", { className: "rt-err" }, error) : null
    )
  );
}

// src/vendor/drill.js
var __dshPurgeDrill = (() => {
  var module2 = { exports: {} };
  var exports = module2.exports;
  var module2 = { exports: {} };
  var exports = module2.exports;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  const h2 = import_react2.default.createElement;
  const CSS = `
.rt-dock{position:fixed;top:12px;right:12px;z-index:20;display:flex;flex-direction:column;box-sizing:border-box;
  background:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#1c1c1c) 52%,transparent);
  backdrop-filter:blur(20px) saturate(1.3);-webkit-backdrop-filter:blur(20px) saturate(1.3);
  border:1px solid color-mix(in srgb,var(--dsw-alias-border-l1,#444) 70%,transparent);
  border-radius:12px;
  box-shadow:0 18px 48px color-mix(in srgb,#000 28%,transparent);pointer-events:auto;color:var(--dsw-alias-label-primary);
  font-size:13px;line-height:1.5}
.rt-dock.rt-embedded{position:relative;inset:auto;width:100%;height:100%;max-width:none;border:0;border-radius:0;box-shadow:none;background:transparent!important;backdrop-filter:none;-webkit-backdrop-filter:none}
.rt-grip,.rt-resize-r,.rt-resize-b,.rt-resize-c{position:absolute;z-index:3;touch-action:none}
.rt-grip{left:-3px;top:0;bottom:0;width:8px;cursor:ew-resize;background:transparent}
.rt-resize-r{right:-3px;top:0;bottom:14px;width:8px;cursor:ew-resize}
.rt-resize-b{left:8px;right:14px;bottom:-3px;height:8px;cursor:ns-resize}
.rt-resize-c{right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize}
.rt-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.rt-title{font-weight:600;font-size:14px;display:flex;align-items:center;gap:6px;white-space:nowrap}
.rt-dot{width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-brand-primary)}
.rt-spacer{flex:1}
.rt-btn{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:inherit;
  border-radius:6px;padding:3px 9px;font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap}
.rt-btn:hover{border-color:var(--dsw-alias-border-l2)}
/* brand-primary \u5728\u6DF1\u8272\u4E3B\u9898\u4E0B\u662F\u8FD1\u767D\u8272\uFF08#f9fafb\uFF09\uFF0C\u5F53\u5E95\u8272\u914D #fff \u4F1A\u767D\u5E95\u767D\u5B57\u3002
   \u6539\u7528\u6807\u7B7E\u8272/\u5E95\u8272\u8FD9\u5BF9\u53CD\u8F6C token\uFF0C\u4E24\u5957\u4E3B\u9898\u90FD\u4FDD\u6301\u9AD8\u5BF9\u6BD4\u3002 */
.rt-btn-primary{background:var(--dsw-alias-label-primary,#111);border-color:var(--dsw-alias-label-primary,#111);color:var(--dsw-alias-bg-base,#fff)}
.rt-btn-primary:hover{opacity:.9}
.rt-btn:disabled{opacity:.5;cursor:default}
.rt-tabs{display:flex;flex-wrap:wrap;gap:2px;padding:6px 12px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
.rt-tab{padding:8px 10px 7px;border-radius:0;cursor:pointer;font-size:12.5px;color:var(--dsw-alias-label-secondary);
  display:inline-flex;align-items:center;gap:5px;border-bottom:2px solid transparent;margin-bottom:-1px;background:transparent}
.rt-tab:hover{color:var(--dsw-alias-label-primary)}
.rt-tab.on{color:var(--dsw-alias-label-primary);background:transparent;font-weight:600;border-bottom-color:var(--dsw-alias-brand-primary,#6dbf8c)}
/* \u672A\u8BFB\u7EA2\u70B9\uFF1A\u8BE5\u9875\u7B7E\u6709\u65B0\u5185\u5BB9\uFF08\u65B0\u8D44\u4EA7/\u65B0\u6F0F\u6D1E/\u65B0\u5F97\u5206/\u65B0\u6B65\u9AA4\u2026\uFF09\uFF0C\u70B9\u5F00\u770B\u8FC7\u5C31\u6D88\u5931 */
.rt-tab-dot{width:7px;height:7px;border-radius:50%;background:#ef4444;flex:none;
  box-shadow:0 0 0 2px color-mix(in srgb, #ef4444 22%, transparent)}
.rt-body{flex:1;min-height:0;display:flex;flex-direction:column}
.rt-split{flex:1;min-height:0;display:flex}
.rt-side{width:200px;flex:none;border-right:1px solid var(--dsw-alias-border-l1);overflow:auto;padding:8px}
.rt-main{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.rt-seg{padding:7px 8px;border-radius:6px;cursor:pointer;margin-bottom:4px;border:1px solid transparent}
.rt-seg:hover{background:var(--dsw-alias-bg-layer-2)}
.rt-seg.on{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-brand-primary)}
.rt-seg-cidr{font-family:ui-monospace,Menlo,monospace;font-size:12.5px}
.rt-seg-meta{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:2px}
.rt-toolbar{display:flex;gap:6px;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);flex-wrap:wrap;align-items:center}
.rt-input{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);color:inherit;
  border-radius:6px;padding:4px 8px;font-size:12px;font-family:inherit;outline:none;min-width:0}
.rt-input:focus{border-color:var(--dsw-alias-brand-primary)}
.rt-input option,.rt-eng-select option{background:var(--dsw-alias-bg-layer-1,#1c1c1c);color:var(--dsw-alias-label-primary,#f2f2f2)}
.rt-eng-select{color:var(--dsw-alias-label-primary,#f2f2f2);background:var(--dsw-alias-bg-layer-2,#2a2a2a)}
.rt-table{flex:1;overflow:auto}
.rt-row{display:grid;grid-template-columns:150px 74px 104px 1.15fr 1fr;gap:8px;padding:6px 10px;
  border-bottom:1px solid var(--dsw-alias-border-l1);align-items:center;cursor:pointer;font-size:12.5px}
.rt-row:hover{background:var(--dsw-alias-bg-layer-2)}
.rt-row.head{cursor:default;color:var(--dsw-alias-label-secondary);font-size:11.5px;font-weight:600;position:sticky;top:0;
  background:var(--dsw-alias-bg-layer-1);z-index:1}
.rt-row.head:hover{background:var(--dsw-alias-bg-layer-1)}
.rt-mono{font-family:ui-monospace,Menlo,monospace}
.rt-tag{display:inline-block;padding:0 5px;border-radius:4px;font-size:11px;margin-right:4px;
  border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);white-space:nowrap}
.rt-tag-passive{color:#8b5cf6;border-color:#8b5cf655;background:#8b5cf61a}
.rt-tag-active{color:#f59e0b;border-color:#f59e0b55;background:#f59e0b1a}
.rt-tag-live{color:#10b981;border-color:#10b98155;background:#10b9811a}
.rt-tag-warn{color:#ef4444;border-color:#ef444455;background:#ef44441a}
/* \u7EAA\u5F8B\u63D0\u793A\u6761\uFF1A\u4E0D\u6EE1\u8DB3\u4EA4\u4ED8\u8981\u6C42\uFF08\u975E\u51B0\u874E/\u54E5\u65AF\u62C9\u9A6C\u3001\u6CA1\u6709 suo5 \u96A7\u9053\uFF09\u65F6\u9876\u5728\u533A\u5757\u6700\u4E0A\u65B9 */
.rt-hint{border-radius:6px;padding:7px 9px;margin-bottom:8px;font-size:11.5px;line-height:1.6;
  border:1px dashed #ef444488;background:#ef44440f;color:var(--dsw-alias-label-primary)}
.rt-hint b{color:#ef4444}
.rt-tag-dead{color:var(--dsw-alias-label-secondary)}
.rt-expand{grid-column:1/-1;padding:8px 4px 10px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.rt-kv{display:flex;gap:8px;margin-bottom:3px;align-items:baseline}
.rt-kv b{color:var(--dsw-alias-label-primary);font-weight:600;min-width:64px;flex:none}
/* \u56FE\u8C31\u89C6\u56FE\u5DF2\u79FB\u9664\uFF08\u89C1 AssetsTab\uFF1A\u8D44\u4EA7\u5173\u7CFB\u7531\u300C\u57DF\u540D\u7EF4\u5EA6\u300D\u4E0E redteam_attack_path \u5DE5\u5177\u627F\u62C5\uFF09 */
.rt-pane{flex:1;min-height:0;overflow:auto;padding:12px}
.rt-card{border:1px solid color-mix(in srgb,var(--dsw-alias-border-l1,#444) 75%,transparent);border-radius:8px;padding:10px;margin-bottom:10px;
  background:color-mix(in srgb,var(--dsw-alias-bg-layer-2,#2a2a2a) 48%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
.rt-card h4{margin:0 0 6px;font-size:13px}
.rt-textarea{width:100%;min-height:260px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);
  color:inherit;border-radius:6px;padding:8px;font-size:12.5px;font-family:ui-monospace,Menlo,monospace;
  line-height:1.6;resize:vertical;outline:none;box-sizing:border-box}
.rt-textarea:focus{border-color:var(--dsw-alias-brand-primary)}
.rt-list{width:210px;flex:none;border-right:1px solid var(--dsw-alias-border-l1);overflow:auto;padding:8px}
.rt-item{padding:7px 8px;border-radius:6px;cursor:pointer;margin-bottom:4px;border:1px solid transparent}
.rt-item:hover{background:var(--dsw-alias-bg-layer-2)}
.rt-item.on{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-brand-primary)}
.rt-item-name{font-weight:600;font-size:12.5px}
.rt-item-desc{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:2px;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rt-empty{padding:24px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:12.5px}
.rt-err{color:var(--dsw-alias-state-error-primary);font-size:12px;padding:6px 10px}
.rt-foot{padding:8px 12px;border-top:1px solid var(--dsw-alias-border-l1);font-size:11px;
  color:var(--dsw-alias-label-secondary);display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.rt-icon-btn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;border:1px solid var(--dsw-alias-border-l1);
  background:transparent;color:inherit;border-radius:6px;padding:6px 8px;cursor:pointer;font-family:inherit;font-size:12.5px}
.rt-icon-btn:hover{background:var(--dsw-alias-bg-layer-2)}
.rt-icon-btn.on{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.rt-hbtn{border:1px solid var(--dsw-alias-border-l1);background:transparent;color:inherit;border-radius:6px;
  padding:2px 8px;font-size:12px;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:5px}
.rt-hbtn:hover{background:var(--dsw-alias-bg-layer-2)}
.rt-hbtn.on{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.rt-test{display:inline-block;padding:0 5px;border-radius:4px;font-size:11px;white-space:nowrap;
  border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}
.rt-test-testing{color:#f59e0b;border-color:#f59e0b55;background:#f59e0b1a}
.rt-test-tested{color:#10b981;border-color:#10b98155;background:#10b9811a}
.rt-test-blocked{color:#fff;background:#ef4444;border-color:#ef4444}
.rt-test-abandoned{color:#94a3b8;border-color:#94a3b855;background:#94a3b81a}
.rt-test-no_surface{color:#6366f1;border-color:#6366f155;background:#6366f11a}
.rt-scope-testing{color:#5b21b6;background:#ddd6fe}
.rt-pri{display:inline-block;padding:0 6px;border-radius:4px;font-size:11px;font-weight:600;white-space:nowrap}
.rt-pri-high{color:#fff;background:#ef4444}
.rt-pri-medium{color:#fff;background:#f59e0b}
.rt-pri-low{color:#fff;background:#94a3b8}
.rt-score-row{display:grid;grid-template-columns:16px 62px minmax(0,1fr) 116px 66px;gap:8px;padding:7px 10px;
  border-bottom:1px solid var(--dsw-alias-border-l1);align-items:center;font-size:12.5px;cursor:pointer}
.rt-score-row:hover{background:var(--dsw-alias-bg-layer-2)}
.rt-score-row.head{cursor:default;color:var(--dsw-alias-label-secondary);font-size:11.5px;font-weight:600;
  position:sticky;top:0;background:var(--dsw-alias-bg-layer-1);z-index:1}
.rt-score-detail{grid-column:1/-1;padding:8px 4px 10px;font-size:12px;color:var(--dsw-alias-label-secondary)}
/* \u5F97\u5206\u76EE\u6807\u6309\u5408\u5E76\u7248\u7684 8 \u4E2A\u7C7B\u522B\u5206\u7EC4\uFF1A\u7C7B\u522B\u5934 + \u7EC4\u5185\u6309\u5206\u503C\u5347\u5E8F */
.rt-score-group{display:flex;align-items:center;gap:8px;padding:7px 10px 5px;margin-top:2px;
  font-size:12px;font-weight:600;border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}
.rt-score-group:first-child{border-top:none}
.rt-score-group .rt-sg-sub{font-weight:400;font-size:11px;color:var(--dsw-alias-label-secondary)}
/* \u2500\u2500 \u4F1A\u8BDD\u4E0E\u5165\u53E3\uFF1A\u6BCF\u5F20\u5361\u7247\u5206\u300C\u6807\u9898\u884C / \u5173\u952E\u4E8B\u5B9E / \u53EF\u7528\u547D\u4EE4 / \u5907\u6CE8\u300D\u56DB\u6BB5\uFF0C\u907F\u514D\u4E00\u884C\u7CCA\u5728\u4E00\u8D77 \u2500\u2500 */
.rt-sess-facts{display:flex;flex-direction:column;gap:2px;margin-top:5px}
.rt-sess-fact{display:flex;gap:6px;font-size:11.5px;line-height:1.5}
.rt-sess-fact>b{flex:none;min-width:62px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.rt-sess-fact>span{min-width:0;overflow-wrap:anywhere}
.rt-sess-cmd{margin-top:6px}
.rt-sess-cmd>b{display:block;font-size:11px;color:var(--dsw-alias-label-secondary);margin-bottom:3px;font-weight:600}
.rt-sess-fold{margin-top:6px;font-size:11.5px}
.rt-sess-fold>summary{cursor:pointer;color:var(--dsw-alias-label-secondary);user-select:none}
.rt-sess-fold>summary:hover{color:var(--dsw-alias-label-primary)}
.rt-score-row .rt-scope{font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.rt-score-form{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px}
.rt-score-form input,.rt-score-form select{width:100%;box-sizing:border-box}
.rt-vrow{display:grid;grid-template-columns:62px minmax(0,1fr) 132px 108px 74px 52px;gap:8px;padding:6px 10px;
  border-bottom:1px solid var(--dsw-alias-border-l1);align-items:center;font-size:12.5px;cursor:pointer}
.rt-vrow:hover{background:var(--dsw-alias-bg-layer-2)}
.rt-vrow.head{cursor:default;color:var(--dsw-alias-label-secondary);font-size:11.5px;font-weight:600;
  position:sticky;top:0;background:var(--dsw-alias-bg-layer-1);z-index:1}
.rt-vdetail{grid-column:1/-1;padding:8px 4px 10px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.rt-vdetail .rt-kv{margin-bottom:4px}
.rt-actions{display:flex;gap:6px;margin-top:6px}
.rt-section{padding:8px 10px 2px;font-size:11.5px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.rt-link{color:var(--dsw-alias-brand-primary);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rt-link:hover{text-decoration:underline}
.rt-full{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;
  background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5;
  border-top:3px solid var(--dsw-alias-brand-primary)}
.rt-full .rt-head{padding:12px 18px}
.rt-full .rt-tabs{padding:10px 18px 0;gap:6px;flex-wrap:wrap}
.rt-full .rt-side{width:260px}
.rt-full .rt-list{width:280px}
.rt-full .rt-row{grid-template-columns:190px 90px 130px 1.4fr 1.2fr}
.rt-full .rt-vrow{grid-template-columns:80px minmax(0,1.6fr) 200px 150px 90px 64px}
.rt-full .rt-pane{padding:18px}
.rt-full .rt-textarea{min-height:60vh}
.rt-full .rt-foot{padding:10px 18px;font-size:12px}
.rt-full .rt-body{max-width:1400px;width:100%;margin:0 auto;flex:1;min-height:0;display:flex;flex-direction:column}
.rt-chain{flex:1;overflow:auto;padding:10px 12px}
.rt-step{display:flex;gap:10px;padding:8px 6px;border-left:2px solid var(--dsw-alias-border-l1);margin-left:6px}
.rt-step:last-child{border-left-color:transparent}
.rt-step-dot{width:22px;height:22px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:700;color:#fff;background:#64748b;margin-left:-13px}
.rt-step-body{min-width:0}
.rt-step-title{font-weight:600;font-size:13px}
.rt-step-meta{font-size:11.5px;color:var(--dsw-alias-label-secondary);margin-top:2px;word-break:break-word}
.rt-stage-recon{background:#6366f1}
.rt-stage-vuln{background:#f59e0b}
.rt-stage-exploit{background:#ef4444}
.rt-stage-access{background:#10b981}
.rt-stage-pivot{background:#8b5cf6}
.rt-stage-data{background:#0ea5e9}
.rt-stage-other{background:#64748b}
.rt-step-head{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}
.rt-step-time{font-size:11px;color:var(--dsw-alias-label-secondary);margin-left:auto;white-space:nowrap}
.rt-step-detail{font-size:12px;margin-top:5px;white-space:pre-wrap;word-break:break-word;
  border-left:2px solid var(--dsw-alias-border-l1);padding:2px 0 2px 9px;line-height:1.6}
.rt-chip{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:1px 7px;border-radius:5px;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);margin:4px 5px 0 0;max-width:100%}
.rt-chip>i{font-style:normal;color:var(--dsw-alias-label-secondary);font-size:10.5px}
.rt-chip>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:420px}
.rt-stage-tag{display:inline-block;padding:0 6px;border-radius:4px;font-size:11px;color:#fff;font-weight:600}
.rt-st-recon{background:#6366f1}.rt-st-vuln{background:#f59e0b}.rt-st-exploit{background:#ef4444}
.rt-st-access{background:#10b981}.rt-st-pivot{background:#8b5cf6}.rt-st-data{background:#0ea5e9}.rt-st-other{background:#64748b}
.rt-sev{display:inline-block;padding:0 6px;border-radius:4px;font-size:11px;font-weight:600;border:1px solid transparent}
.rt-sev-critical{color:#fff;background:#b91c1c}.rt-sev-high{color:#fff;background:#ef4444}
.rt-sev-medium{color:#7c2d12;background:#fdba74}.rt-sev-low{color:#1e3a8a;background:#bfdbfe}
.rt-sev-info{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1)}
.rt-dot-on{display:inline-block;width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 0 3px #10b98133}
.rt-dot-off{display:inline-block;width:7px;height:7px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 3px #ef444433}
.rt-dot-unk{display:inline-block;width:7px;height:7px;border-radius:50%;background:#94a3b8;box-shadow:0 0 0 3px #94a3b833}
.rt-sess-grid{display:grid;grid-template-columns:1fr;gap:8px;padding:10px 12px}
.rt-sess{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:9px 10px;background:var(--dsw-alias-bg-layer-2)}
.rt-sess-head{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.rt-sess-title{font-weight:600;font-size:12.5px;font-family:ui-monospace,Menlo,monospace;word-break:break-all}
.rt-sess-sub{font-size:11.5px;color:var(--dsw-alias-label-secondary);margin-top:3px;word-break:break-word}
.rt-code{font-family:ui-monospace,Menlo,monospace;font-size:11px;background:var(--dsw-alias-bg-base);
  border:1px solid var(--dsw-alias-border-l1);border-radius:4px;padding:1px 5px;cursor:pointer;word-break:break-all}
.rt-code:hover{border-color:var(--dsw-alias-brand-primary)}
.rt-evi{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden;margin-top:8px}
.rt-evi-head{display:flex;align-items:center;gap:8px;padding:5px 9px;background:var(--dsw-alias-bg-layer-2);
  font-size:11.5px;font-weight:600;border-bottom:1px solid var(--dsw-alias-border-l1)}
.rt-evi-body{margin:0;padding:9px 11px;font-family:ui-monospace,Menlo,monospace;font-size:11.5px;line-height:1.6;
  white-space:pre-wrap;word-break:break-word;max-height:340px;overflow:auto;background:var(--dsw-alias-bg-base)}
.rt-evi-body.req{max-height:220px}
.rt-hl-req{color:#10b981;font-weight:600}
.rt-hl-res{color:#0ea5e9;font-weight:600}
.rt-gain{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:12px;
  color:#065f46;background:#a7f3d0;border:1px solid #10b98155}
.rt-total{font-size:20px;font-weight:700;font-family:ui-monospace,Menlo,monospace}
.rt-sidehead{padding:7px 8px 2px;font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary);
  display:flex;align-items:center;gap:5px}
.rt-sidehead-btn{cursor:pointer;outline:none;padding:6px 6px 5px;border-radius:5px;user-select:none}
.rt-sidehead-btn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}
.rt-sidehead-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.rt-scope{display:inline-block;padding:0 4px;border-radius:3px;font-size:10px;font-weight:700;line-height:15px;flex:none}
.rt-scope-internal{color:#0e7490;background:#a5f3fc}
.rt-scope-external{color:#9a3412;background:#fed7aa}
.rt-hits{display:flex;flex-direction:column;gap:6px;margin-top:7px}
.rt-hit{border:1px solid var(--dsw-alias-border-l1);border-left:3px solid #10b981;border-radius:6px;
  padding:7px 9px;background:var(--dsw-alias-bg-layer-2)}
.rt-hit-head{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.rt-hit-idx{width:16px;height:16px;border-radius:50%;background:#10b981;color:#fff;font-size:10.5px;font-weight:700;
  display:inline-flex;align-items:center;justify-content:center;flex:none}
.rt-hit-target{font-family:ui-monospace,Menlo,monospace;font-weight:600;font-size:12px;word-break:break-all}
.rt-hit-time{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.rt-hit-evi{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;line-height:1.65;white-space:pre-wrap;word-break:break-word;
  background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:5px;padding:6px 8px;margin-top:5px}
.rt-hit-note{font-size:11.5px;color:var(--dsw-alias-label-secondary);margin-top:4px}
.rt-cred{border:1px solid var(--dsw-alias-border-l1);border-left:3px solid #f59e0b;border-radius:6px;
  padding:8px 10px;background:var(--dsw-alias-bg-layer-2);margin-bottom:7px}
.rt-cred-head{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.rt-cred-host{font-family:ui-monospace,Menlo,monospace;font-weight:600;font-size:12.5px;word-break:break-all}
.rt-secret{font-family:ui-monospace,Menlo,monospace;font-size:12.5px;line-height:1.6;background:#fef3c7;color:#78350f;
  border:1px solid #f59e0b66;border-radius:5px;padding:6px 9px;margin-top:6px;white-space:pre-wrap;word-break:break-all;
  user-select:all;cursor:text}
.rt-secret-none{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:var(--dsw-alias-state-error-primary);
  border:1px dashed var(--dsw-alias-state-error-primary);border-radius:5px;padding:5px 9px;margin-top:6px}
.rt-cred-meta{font-size:11.5px;color:var(--dsw-alias-label-secondary);margin-top:5px;word-break:break-word}
.rt-stage-score{background:#10b981}
.rt-counted{font-family:ui-monospace,Menlo,monospace;font-size:12px;font-weight:700;color:#065f46;background:#a7f3d0;border:1px solid #10b98155;border-radius:9px;padding:0 7px}
.rt-scorepts{font-size:11.5px;font-weight:700;color:#065f46;background:#a7f3d0;border:1px solid #10b98155;
  border-radius:10px;padding:0 7px;white-space:nowrap}
.rt-livebar{display:flex;align-items:center;gap:7px;padding:7px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-layer-2);flex-wrap:wrap}
.rt-live-dot{width:8px;height:8px;border-radius:50%;background:#10b981;flex:none;animation:rt-pulse 1.6s ease-in-out infinite}
.rt-live-dot.idle{background:#94a3b8;animation:none}
@keyframes rt-pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 #10b98166}50%{opacity:.5;box-shadow:0 0 0 5px #10b98100}}
.rt-live-body{padding:8px 12px 2px;max-height:44vh;overflow:auto}
.rt-atest{border:1px solid var(--dsw-alias-border-l1);border-left:3px solid #10b981;border-radius:6px;
  padding:7px 10px;background:var(--dsw-alias-bg-layer-2);margin-bottom:6px}
.rt-atest.past{border-left-color:#94a3b8;opacity:.85}
.rt-atest-head{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.rt-atest-ip{font-family:ui-monospace,Menlo,monospace;font-weight:600;font-size:12.5px;word-break:break-all}
.rt-atest-meta{font-size:11.5px;color:var(--dsw-alias-label-secondary);margin-top:3px;word-break:break-word}
.rt-atest-notes{font-family:ui-monospace,Menlo,monospace;font-size:11px;line-height:1.6;white-space:pre-wrap;
  word-break:break-word;background:var(--dsw-alias-bg-base);border-radius:4px;padding:5px 7px;margin-top:4px;max-height:76px;overflow:auto}
.rt-concl{display:flex;align-items:center;gap:4px;padding:6px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-layer-2);flex-wrap:wrap}
.rt-concl-i{display:inline-flex;align-items:baseline;gap:4px;padding:2px 8px;border-radius:6px;cursor:pointer;
  border:1px solid transparent}
.rt-concl-i:hover{border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1)}
.rt-concl-i.on{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-1)}
.rt-concl-i b{font-family:ui-monospace,Menlo,monospace;font-size:14px;font-weight:700}
.rt-concl-i>span{color:var(--dsw-alias-label-secondary);font-size:11.5px}
.rt-more{color:var(--dsw-alias-brand-primary);font-size:11.5px;cursor:pointer;user-select:none;margin-top:4px;display:inline-block}
.rt-more:hover{text-decoration:underline}
.rt-subtabs{display:flex;gap:4px;padding:6px 10px 0;border-bottom:1px solid var(--dsw-alias-border-l1);align-items:center}
.rt-subtab{padding:4px 10px;border-radius:6px 6px 0 0;cursor:pointer;font-size:12px;color:var(--dsw-alias-label-secondary)}
.rt-subtab.on{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);font-weight:600}
.rt-sevbar{width:3px;border-radius:2px;align-self:stretch;flex:none;margin-right:2px}
/* \u2500\u2500 \u6298\u53E0\u5C42\u6B21\u4F53\u7CFB \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   L1 \u6298\u53E0\u5934 .rt-sec   \uFF1A\u901A\u680F\u3001\u65E0\u5706\u89D2\u65E0\u8FB9\u6846\u3001\u5DE6\u8272\u6761\u3001\u6DF1\u5E95 \u2014\u2014 \u6C38\u8FDC\u662F"\u6241"\u7684
   L2 \u5185\u5BB9\u5361 .rt-atest/.rt-hit/.rt-cred/.rt-evi\uFF1A\u5185\u7F29\u3001\u6709\u8FB9\u6846\u3001\u5706\u89D2 \u2014\u2014 \u7ACB\u8D77\u6765
   L3 \u8BE6\u60C5/\u957F\u6587\u672C .rt-clip-body / .rt-evi-body \uFF1A\u65E0\u8FB9\u6846\u3001\u6700\u6D45\u3001\u7B49\u5BBD
   L4 \u5B50\u9879\u5BB9\u5668 .rt-sec-body\uFF1A\u5DE6\u7F29\u8FDB + \u7AD6\u5F15\u5BFC\u7EBF\uFF0C\u8868\u660E"\u5C5E\u4E8E\u4E0A\u9762\u90A3\u4E2A\u5934"
   \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.rt-sec-wrap{margin:0}
.rt-sec{display:flex;align-items:center;gap:8px;padding:7px 12px 7px 9px;cursor:pointer;
  background:var(--dsw-alias-bg-layer-2);border-left:3px solid var(--dsw-alias-border-l2);
  border-top:1px solid var(--dsw-alias-border-l1);user-select:none;outline:none}
.rt-sec:hover{background:var(--dsw-alias-bg-layer-1)}
.rt-sec:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.rt-sec.flat{cursor:default}
.rt-sec.flat:hover{background:var(--dsw-alias-bg-layer-2)}
.rt-sec-caret{flex:none;width:11px;font-size:10px;color:var(--dsw-alias-label-secondary);text-align:center}
.rt-sec-title{font-weight:600;font-size:13px;white-space:nowrap}
.rt-sec-count{font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.rt-sec-sub{font-size:11.5px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rt-sec-right{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap;flex:none}
.rt-sec.t-stage{border-left-color:#8b5cf6}
.rt-sec.t-target{border-left-color:#0ea5e9}
.rt-sec.t-folder{border-left-color:#64748b}
.rt-sec.t-test{border-left-color:#10b981}
.rt-sec.t-queue{border-left-color:#f59e0b}
.rt-sec.t-past{border-left-color:#94a3b8}
.rt-sec-body{margin-left:12px;border-left:1px solid var(--dsw-alias-border-l1);padding:7px 0 3px 10px}
.rt-sec-body>.rt-atest:last-child,.rt-sec-body>.rt-hit:last-child{margin-bottom:2px}
/* \u957F\u6587\u672C\u6298\u53E0\uFF08L3\uFF09\uFF1A\u9ED8\u8BA4\u9884\u89C8 2 \u884C\u5E76\u6E10\u9690\uFF0C\u5C55\u5F00\u540E\u9650\u9AD8\u6EDA\u52A8 */
.rt-clip{margin-top:6px}
.rt-clip-head{display:flex;align-items:center;gap:6px}
.rt-clip-label{font-size:11px;color:var(--dsw-alias-label-secondary);font-weight:600}
.rt-clip-body{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;line-height:1.65;white-space:pre-wrap;
  word-break:break-word;background:var(--dsw-alias-bg-base);border-radius:5px;padding:6px 8px;margin-top:3px}
.rt-clip:not(.open) .rt-clip-body{max-height:46px;overflow:hidden;
  -webkit-mask-image:linear-gradient(180deg,#000 55%,transparent);mask-image:linear-gradient(180deg,#000 55%,transparent)}
.rt-clip.open .rt-clip-body{max-height:340px;overflow:auto}
.rt-flow{padding:10px 12px 16px}
.rt-flow-start,.rt-flow-end{font-size:11.5px;color:var(--dsw-alias-label-secondary);padding:4px 0}
.rt-flow-end{font-weight:600;color:var(--dsw-alias-label-primary)}
.rt-flow-link{display:flex;align-items:center;gap:8px;padding:3px 0 3px 10px}
.rt-flow-arrow{color:var(--dsw-alias-border-l2);font-size:11px;flex:none}
.rt-flow-action{font-size:11.5px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rt-flow-action.inferred{opacity:.7;font-style:italic}
.rt-flow-node{border:1px solid var(--dsw-alias-border-l1);border-left:3px solid #10b981;border-radius:8px;
  padding:8px 11px;background:var(--dsw-alias-bg-layer-2);cursor:pointer;outline:none}
.rt-flow-node:hover{border-color:var(--dsw-alias-border-l2)}
.rt-flow-node:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.rt-flow-node.overflow{border-left-color:#94a3b8;opacity:.75}
.rt-flow-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.rt-flow-idx{width:18px;height:18px;border-radius:50%;background:#10b981;color:#fff;font-size:11px;font-weight:700;
  display:inline-flex;align-items:center;justify-content:center;flex:none}
.rt-flow-node.overflow .rt-flow-idx{background:#94a3b8}
.rt-flow-name{font-weight:600;font-size:13px}
.rt-flow-pts{margin-left:auto;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;font-weight:700;color:#065f46;
  background:#a7f3d0;border:1px solid #10b98155;border-radius:10px;padding:0 8px;white-space:nowrap}
.rt-flow-pts.off{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-border-l1)}
.rt-flow-times{font-size:11px;color:var(--dsw-alias-label-secondary)}
.rt-flow-target{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;margin-top:4px;word-break:break-all;
  color:var(--dsw-alias-label-secondary)}
.rt-flow-gain{font-size:12px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rt-flow-detail{margin-top:7px;padding-top:7px;border-top:1px dashed var(--dsw-alias-border-l1)}
.rt-hflow-wrap{flex:1;min-height:0;display:flex;flex-direction:column;overflow:auto}
.rt-hflow{display:flex;align-items:center;gap:0;padding:16px 12px;overflow-x:auto;flex-wrap:nowrap}
.rt-hflow-item{display:flex;align-items:center;flex:none}
.rt-hflow-start,.rt-hflow-end{font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap;padding:0 4px}
.rt-hflow-end{font-weight:600;color:var(--dsw-alias-label-primary)}
.rt-hflow-arrow{color:var(--dsw-alias-border-l2);padding:0 5px;font-size:13px;flex:none}
.rt-hflow-node{display:flex;align-items:center;gap:5px;border:1px solid var(--dsw-alias-border-l1);
  border-left:3px solid #10b981;border-radius:7px;padding:5px 8px;background:var(--dsw-alias-bg-layer-2);
  cursor:pointer;white-space:nowrap;outline:none}
.rt-hflow-node:hover{border-color:var(--dsw-alias-border-l2)}
.rt-hflow-node:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.rt-hflow-node.overflow{border-left-color:#94a3b8;opacity:.72}
.rt-hflow-node.open{border-color:var(--dsw-alias-brand-primary)}
.rt-hflow-pts{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;font-weight:700;color:#065f46;background:#a7f3d0;
  border-radius:8px;padding:0 6px}
.rt-hflow-node.overflow .rt-hflow-pts{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1)}
.rt-hflow-name{font-size:11.5px}
.rt-hflow-n{font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.rt-rep-list{padding:10px 12px 14px}
.rt-rep-tools{display:flex;gap:6px;justify-content:flex-end;margin-bottom:8px}
.rt-rep{border:1px solid var(--dsw-alias-border-l1);border-left:3px solid #10b981;border-radius:8px;
  padding:9px 11px;margin-bottom:10px;background:var(--dsw-alias-bg-layer-2)}
.rt-rep-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.rt-rep-idx{font-size:15px;color:#10b981;font-weight:700;flex:none}
.rt-rep-name{font-weight:600;font-size:13px}
.rt-rep-meta{font-size:12px;margin-top:4px;color:var(--dsw-alias-label-secondary);word-break:break-word}
.rt-rep-meta b{color:var(--dsw-alias-label-primary);font-weight:600;margin-right:2px}
.rt-rep-missing{font-size:11.5px;color:var(--dsw-alias-state-error-primary);margin-top:6px;
  border:1px dashed var(--dsw-alias-state-error-primary);border-radius:5px;padding:5px 8px}
.rt-rep-req{margin-top:7px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;overflow:hidden}
.rt-rep-req-head{display:flex;align-items:center;gap:7px;padding:4px 8px;font-size:11.5px;font-weight:600;
  background:var(--dsw-alias-bg-layer-1);border-bottom:1px solid var(--dsw-alias-border-l1)}
.rt-rep-http{margin:0;padding:8px 10px;font-family:ui-monospace,Menlo,monospace;font-size:11.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word;max-height:240px;overflow:auto;background:var(--dsw-alias-bg-base)}
/* \u2500\u2500 \u62A5\u544A\u91CC\u7684\u300C\u8FD9\u4E00\u6B65\u600E\u4E48\u6765\u7684\u300D\uFF1A\u52A8\u4F5C\u6B65\u9AA4 / \u547D\u4EE4 / \u51ED\u636E / \u96A7\u9053 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.rt-rep-trace{margin-top:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;padding:8px 10px;
  background:var(--dsw-alias-bg-base)}
.rt-rep-trace-head{display:flex;align-items:center;gap:7px;margin-bottom:5px}
.rt-rep-trace-title{font-weight:600;font-size:12.5px}
.rt-rep-trace-how{font-size:12px;color:var(--dsw-alias-label-secondary);margin-bottom:6px}
.rt-rep-step{border-left:2px solid var(--dsw-alias-border-l1);padding:2px 0 6px 9px;margin-bottom:6px}
.rt-rep-step-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.rt-rep-step-no{width:17px;height:17px;border-radius:50%;background:var(--dsw-alias-label-primary,#111);color:var(--dsw-alias-bg-base,#fff);
  font-size:10.5px;display:flex;align-items:center;justify-content:center;flex:none}
.rt-rep-step-title{font-weight:600;font-size:12.5px}
.rt-rep-step-detail{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:2px}
.rt-rep-step-cmd{font-size:11.5px;margin-top:4px;display:flex;gap:6px;align-items:flex-start;flex-wrap:wrap}
.rt-rep-step-cmd .rt-mono{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);
  border-radius:5px;padding:2px 6px;word-break:break-all}
.rt-rep-step-result{font-size:11.5px;margin-top:3px;word-break:break-word}
.rt-rep-src{margin-top:6px;padding-top:6px;border-top:1px dashed var(--dsw-alias-border-l1)}
.rt-rep-src-title{font-weight:600;font-size:12px;margin-bottom:3px}
/* \u2500\u2500 \u5168\u94FE\u8DEF\u653B\u51FB\u8DEF\u5F84\u56FE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.rt-ap{padding:10px 12px 18px;overflow:auto}
.rt-ap-stage{margin-bottom:2px}
.rt-ap-head{display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--dsw-alias-bg-layer-2);
  border-left:4px solid #64748b;border-top:1px solid var(--dsw-alias-border-l1);border-radius:6px 6px 0 0}
.rt-ap-no{width:20px;height:20px;border-radius:5px;color:#fff;font-size:11px;font-weight:700;flex:none;
  display:inline-flex;align-items:center;justify-content:center}
.rt-ap-name{font-weight:700;font-size:13.5px}
.rt-ap-en{font-size:10px;color:var(--dsw-alias-label-secondary);letter-spacing:.3px}
.rt-ap-phase{font-size:10.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.rt-ap-goal{display:flex;align-items:baseline;gap:8px;padding:6px 10px 6px 9px;font-size:12px;
  border-left:4px solid #64748b;background:var(--dsw-alias-bg-layer-1)}
.rt-ap-goal-tag{font-size:10.5px;font-weight:700;border:1px solid;border-radius:4px;padding:0 5px;white-space:nowrap;flex:none}
.rt-ap-result{padding:7px 10px 3px;border-left:4px solid transparent}
.rt-ap-result-head{display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap}
.rt-ap-pts{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;font-weight:700;color:#065f46;background:#a7f3d0;
  border:1px solid #10b98155;border-radius:10px;padding:0 7px;white-space:nowrap}
.rt-ap-pts.off{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-border-l1)}
/* \u6309\u670D\u52A1\u5C01\u9876/\u81EA\u5EFA\u800C\u4E0D\u8BA1\u5206\u7684\u547D\u4E2D\uFF1A\u5206\u503C\u6807\u7070\uFF08+0\uFF09\uFF0C\u907F\u514D\u770B\u7740\u50CF\u53C8\u52A0\u4E86\u5206 */
.rt-ap-pts.uncounted{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-border-l1)}
.rt-ap-nth{font-size:10.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.rt-ap-hit{border:1px solid var(--dsw-alias-border-l1);border-left:3px solid #10b981;border-radius:6px;
  padding:6px 9px;margin-bottom:5px;background:var(--dsw-alias-bg-layer-2);cursor:pointer;outline:none}
.rt-ap-hit:hover{border-color:var(--dsw-alias-border-l2)}
.rt-ap-hit:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.rt-ap-hit.overflow{border-left-color:#94a3b8;opacity:.75}
.rt-ap-hit-head{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.rt-ap-hit-name{font-weight:600;font-size:12.5px}
.rt-ap-hit-target{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-secondary);
  margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:46%}
.rt-ap-act{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:3px}
.rt-ap-act.inferred{font-style:italic;opacity:.75}
.rt-ap-none{font-size:11.5px;color:var(--dsw-alias-label-secondary);padding:2px 0 4px}
.rt-ap-trans{display:flex;align-items:center;gap:7px;padding:2px 0 2px 14px}
.rt-ap-trans-t{font-size:11px;color:var(--dsw-alias-label-secondary)}
/* \u6A2A\u5411\u8DEF\u5F84\u56FE */
.rt-ap-h{display:flex;align-items:stretch;padding:10px 12px 14px;overflow-x:auto;flex:1;min-height:0}
.rt-ap-col{display:flex;align-items:stretch;flex:none}
.rt-ap-col-arrow{align-self:center;color:var(--dsw-alias-border-l2);padding:0 6px;font-size:12px;flex:none}
.rt-hcol{width:228px;display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l1);
  border-top:3px solid #64748b;border-radius:7px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.rt-hcol-goal{font-size:11px;color:var(--dsw-alias-label-secondary);padding:5px 8px;line-height:1.45;
  border-bottom:1px solid var(--dsw-alias-border-l1);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rt-hcol-body{padding:6px 8px;flex:1;min-height:0;overflow:auto}
.rt-hcol-hit{display:flex;align-items:center;gap:5px;font-size:11px;margin-bottom:3px}
.rt-hcol-hit.off{opacity:.6}
.rt-hcol-pts{font-family:ui-monospace,Menlo,monospace;font-size:10.5px;font-weight:700;color:#065f46;background:#a7f3d0;
  border-radius:7px;padding:0 5px;flex:none}
.rt-hcol-hit.off .rt-hcol-pts{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2)}
.rt-hcol-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rt-hcol-none{font-size:11px;color:var(--dsw-alias-label-secondary)}
.rt-hcol-secs{display:flex;flex-wrap:wrap;gap:3px;margin-top:6px}
.rt-hcol-sec{font-size:10px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);
  border-radius:4px;padding:0 4px}
.rt-hcol-attck{font-family:ui-monospace,Menlo,monospace;font-size:9.5px;color:var(--dsw-alias-label-secondary);
  padding:4px 8px;border-top:1px solid var(--dsw-alias-border-l1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rt-ap-cum{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.rt-ap-sub{font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary);margin:6px 0 3px}
.rt-ap-assets,.rt-ap-tunnels{display:flex;flex-direction:column;gap:3px}
.rt-ap-asset{display:flex;align-items:center;gap:6px;font-size:11.5px;padding:3px 6px;border-radius:5px;
  background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1)}
.rt-ap-tunnel{display:flex;align-items:center;gap:6px;font-size:11.5px;padding:4px 7px;border-radius:5px;
  background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-left:3px solid #f59e0b}
.rt-hcol-sub{font-size:10.5px;color:var(--dsw-alias-label-secondary);margin-bottom:2px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;gap:5px;align-items:center}
.rt-hcol-sub.off{opacity:.6}
.rt-hit-row{display:flex;flex-wrap:wrap;align-items:center;gap:2px 7px;font-size:11.5px;padding:4px 7px;border-radius:5px;
  background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);margin-bottom:3px}
/* \u8D44\u4EA7\u4E0E\u5185\u5BB9\u90FD\u81EA\u9002\u5E94\u6362\u884C\uFF1A\u957F\u57DF\u540D/\u957F\u53E3\u4EE4/\u957F\u7ED3\u679C\u4E00\u5F8B\u6362\u884C\u663E\u793A\uFF0C\u4E0D\u622A\u65AD\u6210\u7701\u7565\u53F7 */
.rt-hit-asset{font-family:ui-monospace,Menlo,monospace;font-weight:600;flex:0 1 auto;max-width:100%;
  overflow-wrap:anywhere;word-break:break-word}
.rt-hit-txt{flex:1 1 100%;color:var(--dsw-alias-label-primary);line-height:1.55;
  white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word}
.rt-hit-txt.none{color:var(--dsw-alias-state-error-primary)}
.rt-hit-row .rt-hit-time{flex:none;margin-left:auto}
/* \u81EA\u5DF1\u6CE8\u518C/\u81EA\u5EFA\u7684\u8D26\u53F7\uFF1A\u7559\u75D5\u4F46\u4E0D\u8BA1\u5206\uFF0C\u6574\u884C\u538B\u6697 */
.rt-hit-row.self-created{opacity:.72;border-left:3px solid #ef444488}
/* \u540C\u4E00\u8D44\u4EA7\u540C\u4E00\u7AEF\u53E3\u7684\u91CD\u590D\u8D26\u53F7/\u5E93\u6743\u9650\uFF1A\u670D\u52A1\u5DF2\u62FF\u6EE1\uFF0C\u4E0D\u8BA1\u5206\uFF08\u53EA\u4F5C\u7559\u75D5\uFF09 */
.rt-hit-row.service-capped{opacity:.72;border-left:3px solid #f59e0b88}
.rt-hit-row.service-capped .rt-hit-idx{background:#f59e0b}
.rt-rep-group{margin-bottom:14px}
.rt-rep-stage{display:flex;align-items:center;gap:8px;padding:7px 10px;margin-bottom:7px;
  background:var(--dsw-alias-bg-layer-2);border-left:4px solid #64748b;border-radius:6px;
  cursor:pointer;outline:none;user-select:none}
.rt-rep-stage:hover{background:var(--dsw-alias-bg-layer-1)}
.rt-rep-stage:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.rt-rep-no{width:20px;height:20px;border-radius:5px;color:#fff;font-size:11px;font-weight:700;flex:none;
  display:inline-flex;align-items:center;justify-content:center}
.rt-rep-stage-name{font-weight:700;font-size:13px}
.rt-rep-stage-n{font-size:11px;color:var(--dsw-alias-label-secondary)}
/* \u6298\u53E0\u540E\u4ECD\u8981\u80FD\u4E00\u773C\u770B\u5230"\u8FD9\u4E00\u9636\u6BB5\u62FF\u4E86\u591A\u5C11\u5206"\uFF0C\u6240\u4EE5\u5206\u6570\u7559\u5728\u5934\u4E0A */
.rt-rep-pts{font-size:11px;font-weight:600;padding:1px 6px;border-radius:5px;border:1px solid transparent;flex:none}
.rt-rep-body{padding-left:6px}
/* \u2500\u2500 \u77E5\u8BC6\u5E93\uFF08POC/EXP\uFF09 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.rt-kb-filter{display:flex;align-items:center;gap:7px;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l1)}
/* \u77E5\u8BC6\u5E93\u5F52\u7C7B\u603B\u89C8\uFF1A\u4E00\u884C\u6807\u7B7E\uFF0C\u70B9\u4E00\u4E0B\u6309\u8BE5\u7C7B\u7B5B\u9009 */
.rt-kb-cats{display:flex;flex-wrap:wrap;gap:6px;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l1)}
/* \u77E5\u8BC6\u5E93\u5206\u7EC4\u6807\u9898\uFF08\u6309\u5F52\u7C7B\u5206\u7EC4\u65F6\u6BCF\u7EC4\u4E00\u6761\uFF09 */
.rt-kb-cat{display:flex;align-items:center;gap:7px;padding:7px 10px;background:var(--dsw-alias-bg-layer-2);
  border-bottom:1px solid var(--dsw-alias-border-l1);position:sticky;top:0;z-index:1}
.rt-kb-cat-name{font-weight:600;font-size:12.5px}
/* \u6280\u80FD\u53EF\u7528\u6027\u5FBD\u7AE0\uFF08\u6280\u80FD\u5E93\u9875\u7B7E\uFF09 */
.rt-avail{display:inline-block;padding:0 5px;border-radius:4px;font-size:10.5px;white-space:nowrap;
  border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}
.rt-avail-available{color:#10b981;border-color:#10b98155;background:#10b9811a}
.rt-avail-broken{color:#ef4444;border-color:#ef444455;background:#ef44441a}
.rt-avail-unknown{color:#94a3b8;border-color:#94a3b855;background:#94a3b81a}
/* \u7248\u672C / \u66F4\u65B0\u5F39\u7A97 */
.rt-modal{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}
.rt-modal-box{width:min(560px,92vw);max-height:80vh;overflow:auto;background:var(--dsw-alias-bg-layer-1);
  border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:14px 16px;font-size:12.5px;line-height:1.7;
  box-shadow:0 18px 48px rgba(0,0,0,.35);color:var(--dsw-alias-label-primary)}
.rt-modal-box .rt-kv b{min-width:76px}
.rt-kb-check{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap;cursor:pointer}
.rt-kb{border:1px solid var(--dsw-alias-border-l1);border-radius:7px;margin:0 0 8px;overflow:hidden;
  background:var(--dsw-alias-bg-layer-2)}
.rt-kb.open{border-color:var(--dsw-alias-brand-primary)}
.rt-kb-head{display:flex;align-items:center;gap:7px;padding:7px 9px;cursor:pointer;outline:none;flex-wrap:wrap}
.rt-kb-head:hover{background:var(--dsw-alias-bg-layer-1)}
.rt-kb-head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.rt-kb-title{font-weight:600;font-size:12.5px;overflow-wrap:anywhere}
.rt-kb-kind{font-size:10px;font-weight:700;letter-spacing:.4px;padding:1px 5px;border-radius:4px;
  color:#fff;background:#64748b;flex:none}
.rt-kb-kind.k-exp{background:#ef4444}
.rt-kb-kind.k-poc{background:#f59e0b}
.rt-kb-kind.k-template{background:#8b5cf6}
.rt-kb-kind.k-script{background:#0ea5e9}
.rt-kb-kind.k-payload{background:#10b981}
.rt-kb-sub{font-size:11px;color:var(--dsw-alias-label-secondary);padding:0 9px 7px;overflow-wrap:anywhere}
.rt-kb-body{padding:0 9px 9px}
.rt-kb-actions{display:flex;gap:6px;margin:7px 0}
.rt-kb-body .rt-kv span{overflow-wrap:anywhere;word-break:break-word}
/* \u672C\u673A nuclei \u6A21\u677F\u547D\u4E2D\uFF1A\u8DEF\u5F84\u8981\u80FD\u5B8C\u6574\u770B\u5230\uFF08\u590D\u5236\u6210\u547D\u4EE4\u76F4\u63A5\u8DD1\uFF09 */
.rt-kb-tpl{margin-top:12px;border-top:1px dashed var(--dsw-alias-border-l1);padding-top:8px}
.rt-kb-tpl-row{display:flex;align-items:center;gap:7px;font-size:11.5px;padding:3px 7px;border-radius:5px;
  background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);margin-bottom:3px}
.rt-kb-tpl-path{flex:0 1 auto;font-weight:600;overflow-wrap:anywhere}
.rt-kb-tpl-name{flex:1 1 auto;min-width:0;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.rt-md{flex:1;overflow:auto;margin:0;padding:14px 16px;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;
  line-height:1.65;white-space:pre-wrap;word-break:break-word;background:var(--dsw-alias-bg-base)}
.rt-weblink{display:block;font-size:11.5px;margin-top:1px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rt-shots{margin:8px 0 4px;padding:7px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;
  background:var(--dsw-alias-bg-layer-1)}
.rt-shots-head{display:flex;align-items:baseline;gap:8px;font-size:11.5px;margin-bottom:6px}
.rt-shots-n{color:var(--dsw-alias-label-secondary)}
.rt-shot-row{display:flex;gap:8px;flex-wrap:wrap}
.rt-shot{display:flex;flex-direction:column;gap:3px;max-width:220px}
.rt-shot-thumb{border:1px solid var(--dsw-alias-border-l1);border-radius:5px;background:#0b1020;
  object-fit:contain;display:block;width:auto;max-width:216px}
.rt-shot-loading{display:flex;align-items:center;justify-content:center;width:150px;font-size:11px;
  color:var(--dsw-alias-label-secondary)}
.rt-shot-cap{display:flex;align-items:center;gap:5px;font-size:10.5px;overflow-wrap:anywhere}
.rt-shot-label{color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px}
.rt-shot-zoom{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.82);display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:10px;cursor:zoom-out;padding:18px}
.rt-shot-zoom img{max-width:96vw;max-height:86vh;border-radius:6px;box-shadow:0 18px 48px rgba(0,0,0,.5)}
.rt-shot-zoom-cap{color:#e5e7eb;font-size:12px;text-align:center;max-width:90vw;overflow-wrap:anywhere}`;
  const isFullWindow = () => {
    try {
      return String(window.location.hash || "") === "#redteam-full";
    } catch {
      return false;
    }
  };
  const api = (req) => fetch(apiUrl("/redteam/api"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req)
  }).then(async (res) => {
    const text = await res.text().catch(() => "");
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return {
        ok: false,
        error: res.status + " non-json: " + String(text).slice(0, 120)
      };
    }
    if (!res.ok) {
      return Object.assign({}, data || {}, {
        ok: false,
        error: data && (data.error || data.message) || res.status + " " + res.statusText
      });
    }
    return data;
  });
  let ui = { open: true, tab: "assets" };
  const subs = /* @__PURE__ */ new Set();
  const setUI = (patch) => {
    ui = Object.assign({}, ui, patch);
    const snap = Object.assign({}, ui);
    for (const f of Array.from(subs)) {
      try {
        f(snap);
      } catch {
      }
    }
  };
  let dockWidthTag = null;
  const setDockWidth = () => {
  };
  const useUI = () => {
    const [st, setSt] = import_react2.default.useState(() => Object.assign({}, ui));
    import_react2.default.useEffect(() => {
      const f = (snap) => setSt(Object.assign({}, snap || ui));
      subs.add(f);
      setSt(Object.assign({}, ui));
      return () => {
        subs.delete(f);
      };
    }, []);
    return st;
  };
  const POC_CAT_NAME = {
    rce: "\u8FDC\u7A0B\u547D\u4EE4\u6267\u884C",
    deserialization: "\u53CD\u5E8F\u5217\u5316",
    "file-upload": "\u6587\u4EF6\u4E0A\u4F20 getshell",
    sqli: "SQL \u6CE8\u5165",
    unauthorized: "\u672A\u6388\u6743\u8BBF\u95EE",
    "auth-bypass": "\u8BA4\u8BC1\u7ED5\u8FC7 / \u8D8A\u6743",
    "weak-password": "\u5F31\u53E3\u4EE4 / \u7206\u7834",
    ssrf: "SSRF",
    xxe: "XXE",
    "path-traversal": "\u76EE\u5F55\u7A7F\u8D8A / \u4EFB\u610F\u6587\u4EF6\u8BFB",
    "info-leak": "\u4FE1\u606F\u6CC4\u9732",
    privesc: "\u63D0\u6743 / \u6A2A\u5411",
    tunnel: "\u96A7\u9053 / \u4EE3\u7406",
    other: "\u5176\u5B83"
  };
  const POC_CAT_ORDER = Object.keys(POC_CAT_NAME);
  const ROLE_LABEL = {
    plan: "\u4E3B\u4F1A\u8BDD\uFF08\u6307\u6325\uFF09",
    recon: "\u4FE1\u606F\u6536\u96C6",
    assess: "\u8D44\u4EA7\u68B3\u7406",
    "vuln-scan": "\u6F0F\u6D1E\u53D1\u73B0",
    exploit: "\u6F0F\u6D1E\u5229\u7528",
    internal: "\u5185\u7F51\u6E17\u900F"
  };
  const fmt = (s) => s ? String(s).replace("T", " ").slice(0, 16) : "\u2014";
  const shotCache = /* @__PURE__ */ new Map();
  const shotLoading = /* @__PURE__ */ new Map();
  const shotSrc = (eng, id) => shotCache.get(eng + ":" + id) || null;
  const loadShot = (eng, id) => {
    const key = eng + ":" + id;
    if (shotCache.has(key) || shotLoading.has(key)) return;
    const p = api({ op: "shotData", engagement: eng, id }).then((r) => {
      shotCache.set(
        key,
        r && r.base64 ? "data:" + (r.mime || "image/png") + ";base64," + r.base64 : ""
      );
      shotLoading.delete(key);
      const snap = Object.assign({}, ui);
      for (const f of Array.from(subs)) {
        try {
          f(snap);
        } catch {
        }
      }
    }).catch(() => {
      shotLoading.delete(key);
    });
    shotLoading.set(key, p);
  };
  const SHOT_KIND = { screenshot: "\u73B0\u573A\u622A\u56FE", card: "\u8BB0\u5F55\u751F\u6210\u7684\u8BC1\u636E\u6458\u5F55" };
  const ShotImage = ({ eng, shot, height }) => {
    const [zoom, setZoom] = import_react2.default.useState(false);
    const src = shotSrc(eng, shot.id);
    if (src === null) {
      loadShot(eng, shot.id);
    }
    const card = shot.kind === "card";
    return h2(
      "div",
      { className: "rt-shot" },
      src === null ? h2(
        "div",
        {
          className: "rt-shot-thumb rt-shot-loading",
          style: { height: (height || 96) + "px" }
        },
        "\u8F7D\u5165\u4E2D\u2026"
      ) : h2("img", {
        className: "rt-shot-thumb",
        src,
        alt: shot.label || "\u8BC1\u636E " + shot.id,
        style: { height: (height || 96) + "px", cursor: "zoom-in" },
        onClick: () => setZoom(true)
      }),
      h2(
        "div",
        { className: "rt-shot-cap" },
        h2(
          "span",
          {
            className: "rt-tag " + (card ? "rt-tag-warn" : "rt-tag-live"),
            title: card ? "\u7531\u5F53\u65E5\u8BB0\u5F55\u751F\u6210\u7684\u8BC1\u636E\u6458\u5F55\uFF0C\u4E0D\u662F\u73B0\u573A\u622A\u56FE \u2014\u2014 \u62A5\u544A\u91CC\u540C\u6837\u4F1A\u6807\u6CE8" : "\u73B0\u573A\u622A\u56FE"
          },
          SHOT_KIND[shot.kind] || shot.kind || "\u8BC1\u636E"
        ),
        h2(
          "span",
          { className: "rt-shot-label", title: shot.label || shot.note || "" },
          shot.label || shot.target || "#" + shot.id
        )
      ),
      zoom ? h2(
        "div",
        { className: "rt-shot-zoom", onClick: () => setZoom(false) },
        h2("img", { src, alt: shot.label || "" }),
        h2(
          "div",
          { className: "rt-shot-zoom-cap" },
          (shot.label || shot.target || "") + (card ? "\u3000\xB7\u3000\u7531\u5F53\u65E5\u8BB0\u5F55\u751F\u6210\uFF08\u975E\u73B0\u573A\u622A\u56FE\uFF09" : "") + (shot.captured_at ? "\u3000\xB7\u3000" + fmt(shot.captured_at) : "") + "\u3000\xB7\u3000\u70B9\u51FB\u4EFB\u610F\u5904\u5173\u95ED"
        )
      ) : null
    );
  };
  const ShotStrip = ({ eng, shots, total, title }) => {
    const list = shots || [];
    if (list.length === 0) return null;
    return h2(
      "div",
      { className: "rt-shots" },
      h2(
        "div",
        { className: "rt-shots-head" },
        h2("b", null, title || "\u8BC1\u636E\u622A\u56FE"),
        h2(
          "span",
          { className: "rt-shots-n" },
          "\u663E\u793A " + list.length + " \u5F20" + (total && total > list.length ? "\uFF08\u8BE5\u5F97\u5206\u70B9\u5171 " + total + " \u5F20\uFF0C\u53D6\u4EE3\u8868\u56FE\uFF09" : "")
        )
      ),
      h2(
        "div",
        { className: "rt-shot-row" },
        list.map(
          (sh) => h2(ShotImage, { key: "sh" + sh.id, eng, shot: sh })
        )
      )
    );
  };
  const fmtShort = (s) => {
    const t = String(s || "").replace("T", " ");
    return t.length >= 16 ? t.slice(5, 16) : t || "\u2014";
  };
  const provLabel = (p) => p === "passive" ? "\u88AB\u52A8" : p === "active" ? "\u4E3B\u52A8" : "\u672A\u77E5";
  const clickable = (onActivate, options = {}) => {
    const props = {
      role: "button",
      tabIndex: 0,
      onClick: onActivate,
      onKeyDown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate(e);
        }
      }
    };
    if (options.label !== void 0)
      props["aria-label"] = String(options.label);
    if (options.expanded !== void 0)
      props["aria-expanded"] = options.expanded ? "true" : "false";
    return props;
  };
  const copyText = async (text) => {
    const value = text === void 0 || text === null ? "" : String(text);
    if (value === "") return false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (e) {
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const okFlag = document.execCommand("copy");
      document.body.removeChild(ta);
      return okFlag === true;
    } catch (e) {
      return false;
    }
  };
  const copyWithFeedback = async (text, label, onResult) => {
    const okFlag = await copyText(text);
    const message = okFlag ? "\u5DF2\u590D\u5236\uFF1A" + label : "\u590D\u5236\u5931\u8D25\uFF08\u6D4F\u89C8\u5668\u672A\u6388\u6743\u526A\u8D34\u677F\uFF09\u2014\u2014 \u8BF7\u624B\u52A8\u9009\u4E2D\u6587\u672C\u590D\u5236";
    if (typeof onResult === "function") onResult(okFlag, message);
    return okFlag;
  };
  function ProvTag(props) {
    if (!props.p) return h2("span", { className: "rt-tag" }, "\u672A\u77E5");
    return h2(
      "span",
      { className: "rt-tag rt-tag-" + props.p },
      provLabel(props.p)
    );
  }
  const TEST_LABEL = {
    untested: "\u672A\u6D4B\u8BD5",
    testing: "\u6D4B\u8BD5\u4E2D",
    tested: "\u5DF2\u6D4B\u8BD5",
    blocked: "\u88AB\u5C01\u7981",
    abandoned: "\u5DF2\u653E\u5F03",
    no_surface: "\u65E0\u653B\u51FB\u9762"
  };
  const PRI_LABEL = { high: "\u9AD8", medium: "\u4E2D", low: "\u4F4E" };
  function PriTag(props) {
    if (!props.p) return h2("span", { className: "rt-tag" }, "\u672A\u8BC4");
    return h2(
      "span",
      { className: "rt-pri rt-pri-" + props.p, title: props.title || "" },
      PRI_LABEL[props.p] || props.p
    );
  }
  function TestTag(props) {
    const st = props.s || "untested";
    return h2(
      "span",
      { className: "rt-test rt-test-" + st },
      TEST_LABEL[st] || st
    );
  }
  function AssetsTab(props) {
    const eng = props.engagement;
    const snapshot = props.snapshot;
    const refreshKey = props.refreshKey || 0;
    const onRefresh = props.onRefresh;
    const [view, setView] = import_react2.default.useState("list");
    const [cidr, setCidr] = import_react2.default.useState(null);
    const [q, setQ] = import_react2.default.useState("");
    const [qApplied, setQApplied] = import_react2.default.useState("");
    const [service, setService] = import_react2.default.useState("");
    const [port, setPort] = import_react2.default.useState("");
    const [prov, setProv] = import_react2.default.useState("");
    const [testStatus, setTestStatus] = import_react2.default.useState("");
    const [priority, setPriority] = import_react2.default.useState("");
    const [scope, setScope] = import_react2.default.useState("");
    const [assetState, setAssetState] = import_react2.default.useState("");
    const [sort, setSort] = import_react2.default.useState("priority");
    const [showAll, setShowAll] = import_react2.default.useState(null);
    const [state, setState] = import_react2.default.useState({
      loading: false,
      error: null,
      total: 0,
      items: []
    });
    const [domains, setDomains] = import_react2.default.useState(null);
    const [web, setWeb] = import_react2.default.useState(null);
    const [openId, setOpenId] = import_react2.default.useState(null);
    const [detail, setDetail] = import_react2.default.useState(null);
    const sideCollapse = useCollapse("assets-side:" + eng);
    const seq = import_react2.default.useRef(0);
    const onData = props.onData;
    import_react2.default.useEffect(() => {
      if (!eng) return;
      const my = ++seq.current;
      setState((s) => Object.assign({}, s, { loading: true, error: null }));
      api({
        op: "assets",
        engagement: eng,
        cidr: cidr || void 0,
        q: qApplied || void 0,
        service: service || void 0,
        port: port || void 0,
        provenance: prov || void 0,
        test_status: testStatus || void 0,
        priority: priority || void 0,
        scope: scope || void 0,
        state: assetState || void 0,
        sort,
        limit: 400
      }).then(
        (r) => {
          if (my !== seq.current) return;
          if (!r || r.ok === false) {
            setState({
              loading: false,
              error: r && r.error || "\u67E5\u8BE2\u5931\u8D25",
              total: 0,
              items: []
            });
            return;
          }
          setState({
            loading: false,
            error: null,
            total: r.total,
            items: r.items || []
          });
          if (onData) onData();
        },
        (e) => {
          if (my === seq.current)
            setState({
              loading: false,
              error: String(e && e.message || e),
              total: 0,
              items: []
            });
        }
      );
    }, [
      eng,
      cidr,
      qApplied,
      service,
      port,
      prov,
      testStatus,
      priority,
      scope,
      assetState,
      sort,
      refreshKey
    ]);
    import_react2.default.useEffect(() => {
      if (!eng || view !== "domain") return;
      setDomains(null);
      api({ op: "domains", engagement: eng, cidr: cidr || void 0 }).then(
        (r) => setDomains(r && r.items || []),
        () => setDomains([])
      );
    }, [eng, view, cidr, refreshKey]);
    import_react2.default.useEffect(() => {
      if (!eng || view !== "web") return;
      setWeb(null);
      api({ op: "web", engagement: eng, cidr: cidr || void 0 }).then(
        (r) => setWeb(r && r.items || []),
        () => setWeb([])
      );
    }, [eng, view, cidr, refreshKey]);
    const toggleRow = (id) => {
      if (openId === id) {
        setOpenId(null);
        setDetail(null);
        return;
      }
      setOpenId(id);
      setDetail(null);
      api({ op: "asset", engagement: eng, id }).then(
        (r) => {
          if (r && r.ok && r.asset) setDetail(r.asset);
        },
        () => {
        }
      );
    };
    const segs = snapshot && snapshot.segments || [];
    const sideChildren = [];
    sideChildren.push(
      h2(
        "div",
        Object.assign(
          {
            key: "all",
            className: "rt-seg" + (cidr === null && view !== "testing" ? " on" : "")
          },
          clickable(
            () => {
              setView("list");
              setCidr(null);
            },
            {
              label: "\u5168\u90E8 C \u6BB5",
              expanded: cidr === null && view !== "testing"
            }
          )
        ),
        h2("div", { className: "rt-seg-cidr" }, "\u5168\u90E8 C \u6BB5"),
        h2("div", { className: "rt-seg-meta" }, segs.length + " \u4E2A\u7F51\u6BB5")
      )
    );
    sideChildren.push(
      h2(
        "div",
        Object.assign(
          {
            key: "testing",
            className: "rt-seg" + (view === "testing" ? " on" : ""),
            title: "\u6B63\u5728\u8DD1\u7684\u626B\u63CF / \u63A2\u6D4B\u4E0E\u8FDB\u5EA6\uFF085 \u79D2\u81EA\u52A8\u5237\u65B0\uFF09"
          },
          clickable(
            () => {
              setView("testing");
              setCidr(null);
            },
            { label: "\u5F53\u524D\u6D4B\u8BD5", expanded: view === "testing" }
          )
        ),
        h2(
          "div",
          {
            className: "rt-seg-cidr",
            style: { display: "flex", alignItems: "baseline", gap: 5 }
          },
          h2(
            "span",
            {
              className: "rt-scope rt-scope-testing",
              title: "\u5F53\u524D\u6D4B\u8BD5\uFF08\u65E2\u975E\u5185\u7F51\u4E5F\u975E\u5916\u7F51\uFF09"
            },
            "\u6D4B"
          ),
          h2("span", { style: { flex: 1 } }, "\u5F53\u524D\u6D4B\u8BD5")
        ),
        h2("div", { className: "rt-seg-meta" }, "\u6B63\u5728\u8DD1\u7684\u626B\u63CF\u4E0E\u63A2\u6D4B")
      )
    );
    const segBlock = (title, list, kind) => {
      const open = sideCollapse.isOpen("scope:" + kind, true);
      const toggle = sideCollapse.toggle("scope:" + kind, true);
      const out = [
        h2(
          "div",
          {
            key: "h" + kind,
            className: "rt-sidehead rt-sidehead-btn",
            role: "button",
            tabIndex: 0,
            "aria-expanded": open ? "true" : "false",
            title: (open ? "\u6536\u8D77\u672C\u7EC4" : "\u5C55\u5F00\u672C\u7EC4") + "\uFF08\u5E76\u5207\u56DE\u8D44\u4EA7\u5217\u8868\uFF09",
            onClick: () => {
              setView("list");
              toggle();
            },
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setView("list");
                toggle(e);
              }
            }
          },
          h2("span", { className: "rt-sec-caret" }, open ? "\u25BE" : "\u25B8"),
          h2(
            "span",
            { className: "rt-scope rt-scope-" + kind },
            kind === "internal" ? "\u5185\u7F51" : "\u5916\u7F51"
          ),
          h2("span", null, title + " \xB7 " + list.length + " \u4E2A C \u6BB5"),
          h2("span", { className: "rt-spacer" }),
          h2(
            "span",
            { style: { fontWeight: 400 } },
            list.reduce((n, x) => n + (x.assets || 0), 0) + " \u8D44\u4EA7"
          )
        )
      ];
      if (!open) return out;
      for (const s of list) {
        out.push(
          h2(
            "div",
            Object.assign(
              {
                key: s.cidr,
                className: "rt-seg" + (cidr === s.cidr ? " on" : ""),
                title: (s.org || "\u672A\u77E5\u5F52\u5C5E") + " \xB7 \u5B58\u6D3B " + (s.live || 0) + "/" + (s.assets || 0) + " \u53F0"
              },
              clickable(
                () => {
                  setView("list");
                  setCidr(s.cidr);
                },
                {
                  label: "\u7B5B\u9009 C \u6BB5 " + s.cidr,
                  expanded: cidr === s.cidr && view !== "testing"
                }
              )
            ),
            h2(
              "div",
              {
                className: "rt-seg-cidr",
                style: { display: "flex", alignItems: "baseline", gap: 5 }
              },
              h2(
                "span",
                { className: "rt-scope rt-scope-" + kind },
                kind === "internal" ? "\u5185" : "\u5916"
              ),
              h2("span", { style: { flex: 1 } }, s.cidr),
              h2(
                "span",
                {
                  className: "rt-seg-meta",
                  style: { margin: 0, whiteSpace: "nowrap" }
                },
                s.assets + " \u53F0"
              )
            )
          )
        );
      }
      return out;
    };
    const segExternal = segs.filter((x) => x.scope !== "internal");
    const segInternal = segs.filter((x) => x.scope === "internal");
    if (segExternal.length)
      sideChildren.push(...segBlock("\u5916\u7F51\u8D44\u4EA7", segExternal, "external"));
    if (segInternal.length)
      sideChildren.push(...segBlock("\u5185\u7F51\u8D44\u4EA7", segInternal, "internal"));
    const side = h2("div", { className: "rt-side" }, sideChildren);
    const toolbar = h2(
      "div",
      { className: "rt-toolbar" },
      h2("input", {
        className: "rt-input",
        style: { flex: "1 1 150px" },
        placeholder: "\u641C\u7D22 IP / \u57DF\u540D / \u6307\u7EB9\uFF08\u56DE\u8F66\uFF09",
        value: q,
        onChange: (e) => setQ(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter") setQApplied(q);
        }
      }),
      h2(
        "button",
        { className: "rt-btn", onClick: () => setQApplied(q) },
        "\u641C\u7D22"
      ),
      h2("input", {
        className: "rt-input",
        style: { width: "78px" },
        placeholder: "\u670D\u52A1",
        value: service,
        onChange: (e) => setService(e.target.value)
      }),
      h2("input", {
        className: "rt-input",
        style: { width: "60px" },
        placeholder: "\u7AEF\u53E3",
        value: port,
        onChange: (e) => setPort(e.target.value)
      }),
      h2(
        "select",
        {
          className: "rt-input",
          value: scope,
          onChange: (e) => setScope(e.target.value)
        },
        h2("option", { value: "" }, "\u5185\u5916\u7F51\u4E0D\u9650"),
        h2("option", { value: "external" }, "\u4EC5\u5916\u7F51\u8D44\u4EA7"),
        h2("option", { value: "internal" }, "\u4EC5\u5185\u7F51\u8D44\u4EA7")
      ),
      h2(
        "select",
        {
          className: "rt-input",
          value: prov,
          onChange: (e) => setProv(e.target.value),
          title: "\u6309\u7AEF\u53E3\u6765\u6E90\u8FC7\u6EE4\uFF08\u5217\u8868\u5DF2\u4E0D\u518D\u5355\u5217\u663E\u793A\uFF0C\u8BE6\u60C5\u91CC\u53EF\u89C1\uFF09"
        },
        h2("option", { value: "" }, "\u6765\u6E90\u4E0D\u9650"),
        h2("option", { value: "passive" }, "\u4EC5\u88AB\u52A8"),
        h2("option", { value: "active" }, "\u4EC5\u4E3B\u52A8")
      ),
      h2(
        "select",
        {
          className: "rt-input",
          value: priority,
          onChange: (e) => setPriority(e.target.value)
        },
        h2("option", { value: "" }, "\u6613\u6253\u6027\u4E0D\u9650"),
        h2("option", { value: "high" }, "\u6613\u6253\uFF08\u9AD8\uFF09"),
        h2("option", { value: "medium" }, "\u4E00\u822C\uFF08\u4E2D\uFF09"),
        h2("option", { value: "low" }, "\u96BE\u6253\uFF08\u4F4E\uFF09")
      ),
      h2(
        "select",
        {
          className: "rt-input",
          value: testStatus,
          onChange: (e) => setTestStatus(e.target.value)
        },
        h2("option", { value: "" }, "\u6D4B\u8BD5\u72B6\u6001\u4E0D\u9650"),
        h2("option", { value: "untested" }, "\u672A\u6D4B\u8BD5"),
        h2("option", { value: "testing" }, "\u6D4B\u8BD5\u4E2D"),
        h2("option", { value: "tested" }, "\u5DF2\u6D4B\u8BD5"),
        h2("option", { value: "blocked" }, "\u88AB\u5C01\u7981"),
        h2("option", { value: "abandoned" }, "\u5DF2\u653E\u5F03"),
        h2("option", { value: "no_surface" }, "\u65E0\u653B\u51FB\u9762")
      ),
      h2("div", { className: "rt-spacer" }),
      h2(
        "button",
        {
          className: "rt-btn",
          title: "\u91CD\u65B0\u62C9\u53D6\u5FEB\u7167\u4E0E\u5F53\u524D\u89C6\u56FE\u6570\u636E",
          onClick: () => {
            if (onRefresh) onRefresh();
          }
        },
        "\u5237\u65B0"
      ),
      h2(
        "button",
        {
          className: "rt-btn" + (view === "list" ? " rt-btn-primary" : ""),
          onClick: () => setView("list")
        },
        "\u5217\u8868"
      ),
      h2(
        "button",
        {
          className: "rt-btn" + (view === "timeline" ? " rt-btn-primary" : ""),
          title: "\u6309\u53D1\u73B0\u65F6\u95F4\u770B\u8D44\u4EA7\uFF08\u4EC0\u4E48\u65F6\u5019\u53D1\u73B0\u3001\u54EA\u5929\u6536\u4E86\u591A\u5C11\uFF09",
          onClick: () => setView("timeline")
        },
        "\u53D1\u73B0\u65F6\u95F4"
      ),
      h2(
        "button",
        {
          className: "rt-btn" + (view === "domain" ? " rt-btn-primary" : ""),
          onClick: () => setView("domain")
        },
        "\u57DF\u540D"
      ),
      h2(
        "button",
        {
          className: "rt-btn" + (view === "web" ? " rt-btn-primary" : ""),
          onClick: () => setView("web")
        },
        "Web"
      )
    );
    const tests = snapshot && snapshot.tests || {};
    const snapStats = snapshot && snapshot.stats || {};
    const noFilter = !testStatus && !priority && !scope && !prov && !assetState && !cidr;
    const conclItem = (key, label, value, active, onClick) => h2(
      "span",
      Object.assign(
        {
          key,
          className: "rt-concl-i" + (active ? " on" : ""),
          title: "\u70B9\u51FB\u7B5B\u9009 / \u518D\u70B9\u53D6\u6D88"
        },
        clickable(onClick, {
          label: "\u6309\u300C" + label + "\u300D\u7B5B\u9009\uFF08" + (value || 0) + "\uFF09",
          expanded: active
        })
      ),
      h2("b", null, String(value || 0)),
      h2("span", null, label)
    );
    const toggleTest = (v) => {
      setTestStatus((cur) => cur === v ? "" : v);
      setAssetState("");
    };
    const conclusion = h2(
      "div",
      { className: "rt-concl" },
      h2(
        "span",
        { className: "rt-tag" },
        "\u6F0F\u6D1E " + (stats.vulnerabilities || 0)
      ),
      !isSrc && h2(
        "span",
        { className: "rt-tag" },
        "\u52A0\u56FA\u5EFA\u8BAE " + (stats.hardening || 0) + " \xB7 \u4FE1\u606F\u9879 " + (stats.informational || 0)
      ),
      isSrc && h2(
        "span",
        { className: "rt-tag" },
        "\u5DF2\u6392\u9664\u5386\u53F2\u914D\u7F6E\u9879 " + (stats.excluded_hardening || 0)
      ),
      conclItem("all", "\u53F0\u8D44\u4EA7", snapStats.assets, noFilter, () => {
        setTestStatus("");
        setPriority("");
        setScope("");
        setProv("");
        setAssetState("");
        setCidr(null);
      }),
      conclItem(
        "live",
        "\u5B58\u6D3B",
        snapStats.liveAssets,
        assetState === "live",
        () => {
          setAssetState((v) => v === "live" ? "" : "live");
          setTestStatus("");
        }
      ),
      conclItem(
        "untested",
        "\u5F85\u6D4B",
        tests.untested,
        testStatus === "untested",
        () => toggleTest("untested")
      ),
      conclItem(
        "testing",
        "\u6D4B\u8BD5\u4E2D",
        tests.testing,
        testStatus === "testing",
        () => toggleTest("testing")
      ),
      conclItem(
        "tested",
        "\u5DF2\u6D4B",
        tests.tested,
        testStatus === "tested",
        () => toggleTest("tested")
      ),
      conclItem(
        "giveup",
        "\u653E\u5F03",
        (tests.abandoned || 0) + (tests.blocked || 0),
        testStatus === "abandoned,blocked",
        () => toggleTest("abandoned,blocked")
      ),
      h2("div", { className: "rt-spacer" }),
      h2(
        "select",
        {
          className: "rt-input",
          value: sort,
          onChange: (e) => setSort(e.target.value),
          title: "\u5217\u8868\u6392\u5E8F\u65B9\u5F0F"
        },
        h2("option", { value: "priority" }, "\u6392\u5E8F\uFF1A\u6613\u6253\u6027\u4F18\u5148"),
        h2("option", { value: "todo" }, "\u6392\u5E8F\uFF1A\u5F85\u6D4B\u4F18\u5148"),
        h2("option", { value: "discovered" }, "\u6392\u5E8F\uFF1A\u6700\u8FD1\u53D1\u73B0\u4F18\u5148"),
        h2("option", { value: "ports" }, "\u6392\u5E8F\uFF1A\u7AEF\u53E3\u591A\u4F18\u5148"),
        h2("option", { value: "ip" }, "\u6392\u5E8F\uFF1A\u6309 IP")
      )
    );
    const head = h2(
      "div",
      { className: "rt-row head" },
      h2("span", null, "IP"),
      h2("span", null, "\u6613\u6253"),
      h2("span", null, "\u6D4B\u8BD5\u72B6\u6001"),
      h2("span", null, "\u5F00\u653E\u7AEF\u53E3 / \u670D\u52A1"),
      h2("span", null, "\u6307\u7EB9")
    );
    const rowNodes = [];
    for (const it of state.items) {
      const openPorts = it.ports.filter((p) => p.state === "open");
      const portText = openPorts.map((p) => p.port + (p.service ? "/" + p.service : "")).join(", ") || "\u2014";
      const fpText = it.fingerprints.map(
        (f) => [f.vendor, f.product, f.version].filter(Boolean).join(" ")
      ).join(" / ") || "\u2014";
      const shownPorts = openPorts.slice(0, 3).map((p) => p.port + (p.service ? "/" + p.service : "")).join(", ");
      const morePorts = openPorts.length > 3 ? " +" + (openPorts.length - 3) : "";
      rowNodes.push(
        h2(
          "div",
          Object.assign(
            {
              key: "r" + it.id,
              className: "rt-row"
            },
            clickable(() => toggleRow(it.id), {
              label: "\u5C55\u5F00\u8D44\u4EA7 " + it.ip,
              expanded: openId === it.id
            })
          ),
          h2(
            "span",
            {
              className: "rt-mono",
              style: {
                display: "flex",
                alignItems: "baseline",
                gap: 4,
                flexWrap: "wrap"
              }
            },
            h2(
              "span",
              {
                className: "rt-scope rt-scope-" + (it.scope === "internal" ? "internal" : "external")
              },
              it.scope === "internal" ? "\u5185" : "\u5916"
            ),
            h2("span", {
              title: it.state === "live" ? "\u5B58\u6D3B" : String(it.state),
              style: {
                width: 7,
                height: 7,
                borderRadius: "50%",
                flex: "none",
                marginTop: 4,
                background: it.state === "live" ? "#10b981" : "#94a3b8"
              }
            }),
            h2(
              "span",
              { style: { overflow: "hidden", textOverflow: "ellipsis" } },
              it.ip
            ),
            /* 发现时间挂在 IP 下面一行：IP 列宽度有限，不另开列（列宽一改整表要跟着调） */
            h2(
              "span",
              {
                style: {
                  fontSize: 10.5,
                  color: "var(--dsw-alias-label-secondary)",
                  whiteSpace: "nowrap"
                },
                title: "\u53D1\u73B0\u65F6\u95F4\uFF1A" + (it.discovered_at ? fmt(it.discovered_at) : "\u672A\u8BB0\u5F55") + (it.last_seen ? "\n\u6700\u8FD1\u91C7\u96C6\uFF1A" + fmt(it.last_seen) : "")
              },
              it.discovered_at ? fmtShort(it.discovered_at) : "\u53D1\u73B0\u65F6\u95F4\u672A\u77E5"
            )
          ),
          h2(
            "span",
            null,
            h2(PriTag, { p: it.priority, title: it.potential || "" })
          ),
          h2(
            "span",
            null,
            h2(TestTag, { s: it.test_status }),
            it.blocked_count ? h2(
              "span",
              {
                className: "rt-tag",
                style: {
                  color: "#ef4444",
                  borderColor: "#ef444455",
                  marginLeft: 4
                }
              },
              "\u5C01" + it.blocked_count
            ) : null
          ),
          h2("span", { title: portText }, (shownPorts || "\u2014") + morePorts),
          h2(
            "span",
            { title: fpText },
            fpText.length > 30 ? fpText.slice(0, 30) + "\u2026" : fpText
          )
        )
      );
      if (openId !== it.id) continue;
      const d = detail && detail.id === it.id ? detail : null;
      const portRows = [];
      const fpRows = [];
      const obsRows = [];
      if (d) {
        for (const p of d.ports || []) {
          if (p.state !== "open") continue;
          portRows.push(
            h2(
              "div",
              { key: "p" + p.port, className: "rt-kv" },
              h2("b", { className: "rt-mono" }, p.port + "/" + p.proto),
              h2(
                "span",
                null,
                [p.service, p.product, p.version].filter(Boolean).join(" ") || "\u672A\u77E5\u670D\u52A1"
              ),
              p.url ? h2(
                "a",
                {
                  className: "rt-link",
                  href: p.url,
                  target: "_blank",
                  rel: "noreferrer",
                  title: p.url
                },
                p.title ? p.title : p.url
              ) : null,
              h2(ProvTag, { p: p.provenance })
            )
          );
        }
        for (const f of d.fingerprints || []) {
          fpRows.push(
            h2(
              "div",
              {
                key: "f" + (f.product || "") + (f.version || "") + (f.evidence || ""),
                className: "rt-kv"
              },
              h2("b", null, f.category || "\u2014"),
              h2(
                "span",
                null,
                [f.vendor, f.product, f.version].filter(Boolean).join(" ") + (f.evidence ? "\uFF08" + f.evidence + "\uFF09" : "")
              ),
              h2(ProvTag, { p: f.provenance })
            )
          );
        }
        for (const o of (d.observations || []).slice(0, 8)) {
          obsRows.push(
            h2(
              "div",
              {
                key: "o" + (o.attr || "") + (o.value || "") + (o.collected_at || ""),
                className: "rt-kv"
              },
              h2("b", null, o.attr || "\u2014"),
              h2(
                "span",
                null,
                (o.value || "") + " \xB7 " + (o.tool || "\u672A\u77E5\u5DE5\u5177") + " \xB7 " + fmt(o.collected_at)
              ),
              h2(ProvTag, { p: o.provenance })
            )
          );
        }
      }
      const all = showAll === it.id;
      const noteLines = d && d.test_notes ? d.test_notes.split("\n").filter(Boolean) : [];
      const inner = d ? h2(
        "div",
        null,
        /* 必读三行 */
        h2(
          "div",
          { className: "rt-kv" },
          h2("b", null, "\u6D4B\u8BD5"),
          h2(
            "span",
            null,
            h2(TestTag, { s: d.test_status }),
            d.blocked_count ? h2(
              "span",
              {
                className: "rt-tag",
                style: {
                  marginLeft: 6,
                  color: "#ef4444",
                  borderColor: "#ef444455"
                }
              },
              "\u88AB\u5C01 " + d.blocked_count + " \u6B21"
            ) : null,
            h2(
              "span",
              {
                style: {
                  marginLeft: 8,
                  color: "var(--dsw-alias-label-secondary)"
                }
              },
              (d.test_updated_at ? fmt(d.test_updated_at) : "\u672A\u6D4B\u8FC7") + (d.test_updated_by ? " \xB7 " + d.test_updated_by : "")
            )
          )
        ),
        h2(
          "div",
          { className: "rt-kv" },
          h2("b", null, "\u6613\u6253\u6027"),
          h2(
            "span",
            null,
            h2(PriTag, { p: d.priority }),
            h2(
              "span",
              { style: { marginLeft: 8 } },
              d.potential || "\u672A\u8BC4\u4F30"
            ),
            d.assess_reason ? h2(
              "span",
              {
                style: {
                  marginLeft: 8,
                  color: "var(--dsw-alias-label-secondary)"
                }
              },
              d.assess_reason
            ) : null
          )
        ),
        h2(
          "div",
          { className: "rt-kv" },
          h2("b", null, "\u653B\u51FB\u9762"),
          h2(
            "span",
            null,
            d.test_surface || (portRows.length ? "\u672A\u8BB0\u5F55\uFF08\u5F00\u653E\u7AEF\u53E3\u89C1\u4E0B\uFF09" : "\u65E0\u5F00\u653E\u7AEF\u53E3"),
            d.scope ? h2(
              "span",
              {
                className: "rt-scope rt-scope-" + (d.scope === "internal" ? "internal" : "external"),
                style: { marginLeft: 8 }
              },
              d.scope === "internal" ? "\u5185\u7F51\u8D44\u4EA7" : "\u5916\u7F51\u8D44\u4EA7"
            ) : null
          )
        ),
        h2(
          "span",
          Object.assign(
            { className: "rt-more" },
            clickable(() => setShowAll(all ? null : it.id), {
              label: all ? "\u6536\u8D77\u8D44\u4EA7\u8BE6\u60C5" : "\u5C55\u5F00\u8D44\u4EA7\u8BE6\u60C5",
              expanded: all
            })
          ),
          all ? "\u6536\u8D77\u5168\u90E8 \u25B2" : "\u5C55\u5F00\u5168\u90E8\uFF08\u7AEF\u53E3 \xB7 \u6307\u7EB9 \xB7 \u91C7\u96C6\u6EAF\u6E90 \xB7 \u6D4B\u8BD5\u8BB0\u5F55\uFF09\u25BC"
        ),
        all ? h2(
          "div",
          null,
          h2(
            "div",
            { className: "rt-kv" },
            h2("b", null, "\u4E3B\u673A\u540D"),
            h2(
              "span",
              null,
              (d.names || []).map((n) => n.name).join(", ") || "\u2014"
            )
          ),
          h2(
            "div",
            { className: "rt-kv" },
            h2("b", null, "\u53D1\u73B0\u65F6\u95F4"),
            h2(
              "span",
              {
                title: '\u672C\u6761\u8D44\u4EA7\u7B2C\u4E00\u6B21\u8FDB\u5165\u8D44\u4EA7\u5E93\u7684\u65F6\u523B\uFF08\u91CD\u590D\u91C7\u96C6\u53EA\u5237\u65B0"\u6700\u8FD1\u91C7\u96C6"\uFF09'
              },
              fmt(d.discovered_at)
            ),
            h2(
              "b",
              { style: { minWidth: 0, marginLeft: 8 } },
              "\u6700\u8FD1\u91C7\u96C6"
            ),
            h2("span", null, fmt(d.last_seen)),
            h2(
              "b",
              { style: { minWidth: 0, marginLeft: 8 } },
              "\u6570\u636E\u6E90\u9996\u89C1"
            ),
            h2("span", null, fmt(d.first_seen))
          ),
          h2(
            "div",
            { className: "rt-kv" },
            h2("b", null, "C \u6BB5"),
            h2("span", null, d.segment_cidr)
          ),
          h2(
            "div",
            { className: "rt-kv" },
            h2("b", null, "\u6613\u6253\u6027"),
            h2(
              "span",
              null,
              (d.priority || "\u672A\u8BC4\u4F30") + (d.potential ? " \xB7 \u9884\u671F\uFF1A" + d.potential : "") + (d.assess_reason ? " \xB7 \u4F9D\u636E\uFF1A" + d.assess_reason : "") + (d.assessed_at ? "\uFF08" + fmt(d.assessed_at) + "\uFF09" : "")
            )
          ),
          h2(
            "div",
            { className: "rt-kv" },
            h2("b", null, "\u6765\u6E90"),
            h2(
              "span",
              null,
              "\u88AB\u52A8\u7AEF\u53E3 " + (d.passive || 0) + " \xB7 \u4E3B\u52A8\u7AEF\u53E3 " + (d.active || 0)
            )
          ),
          h2(
            "div",
            { style: { margin: "6px 0 3px", fontWeight: 600 } },
            "\u5F00\u653E\u7AEF\u53E3 / \u670D\u52A1"
          ),
          h2("div", null, portRows.length ? portRows : "\u2014"),
          h2(
            "div",
            { style: { margin: "6px 0 3px", fontWeight: 600 } },
            "\u6307\u7EB9"
          ),
          h2("div", null, fpRows.length ? fpRows : "\u2014"),
          noteLines.length ? h2(Clip, {
            key: "notes",
            label: "\u6D4B\u8BD5\u8BB0\u5F55\uFF08" + noteLines.length + " \u6761\uFF09",
            text: noteLines.join("\n")
          }) : null,
          h2(
            "div",
            { style: { margin: "6px 0 3px", fontWeight: 600 } },
            "\u91C7\u96C6\u6EAF\u6E90\uFF08\u6700\u8FD1 8 \u6761\uFF09"
          ),
          h2("div", null, obsRows.length ? obsRows : "\u2014")
        ) : null
      ) : h2("div", null, "\u52A0\u8F7D\u4E2D\u2026");
      rowNodes.push(
        h2(
          "div",
          {
            key: "d" + it.id,
            className: "rt-row",
            style: { cursor: "default", gridTemplateColumns: "1fr" }
          },
          h2("div", { className: "rt-expand" }, inner)
        )
      );
    }
    const listPane = h2(
      "div",
      { className: "rt-table" },
      head,
      rowNodes,
      !state.loading && !state.items.length ? h2("div", { className: "rt-empty" }, "\u6CA1\u6709\u5339\u914D\u7684\u8D44\u4EA7") : null
    );
    const domainPane = h2(
      "div",
      { className: "rt-table" },
      domains === null ? h2("div", { className: "rt-empty" }, "\u52A0\u8F7D\u4E2D\u2026") : domains.length ? domains.map(
        (g) => h2(
          "div",
          { key: g.domain },
          h2(
            "div",
            {
              className: "rt-section",
              style: { padding: "8px 10px 4px" }
            },
            h2(
              "a",
              {
                className: "rt-link",
                href: "http://" + g.domain,
                target: "_blank",
                rel: "noreferrer"
              },
              g.domain
            ),
            h2(
              "span",
              { className: "rt-tag", style: { marginLeft: 8 } },
              g.count + " \u4E2A\u8D44\u4EA7"
            )
          ),
          g.assets.map(
            (a) => h2(
              "div",
              {
                key: String(g.domain) + "\0" + a.id + "\0" + a.ip,
                className: "rt-row",
                style: {
                  gridTemplateColumns: "150px 130px 70px 1fr",
                  cursor: "pointer"
                },
                onClick: () => {
                  setView("list");
                  setQ("");
                  setQApplied(a.ip);
                }
              },
              h2("span", { className: "rt-mono" }, a.ip),
              h2("span", { className: "rt-mono" }, a.segment),
              h2(
                "span",
                null,
                h2(
                  "span",
                  {
                    className: "rt-tag rt-tag-" + (a.state === "live" ? "live" : "dead")
                  },
                  a.state === "live" ? "\u5B58\u6D3B" : a.state
                )
              ),
              h2(
                "span",
                {
                  style: {
                    fontSize: 11,
                    color: "var(--dsw-alias-label-secondary)"
                  }
                },
                (a.names || []).join(", ")
              )
            )
          )
        )
      ) : h2(
        "div",
        { className: "rt-empty" },
        cidr ? "\u8BE5 C \u6BB5\u4E0B\u6682\u65E0\u57DF\u540D\uFF08\u5207\u6362\u5230\u300C\u5168\u90E8 C \u6BB5\u300D\u770B\u5168\u91CF\uFF09" : "\u6682\u65E0\u57DF\u540D\u6570\u636E\uFF08\u4FE1\u606F\u6536\u96C6\u9636\u6BB5\u4F1A\u5199\u5165\u57DF\u540D\uFF09"
      )
    );
    const webPane = h2(
      "div",
      { className: "rt-table" },
      h2(
        "div",
        {
          className: "rt-row head",
          style: { gridTemplateColumns: "1.6fr 1.2fr 130px 110px" }
        },
        h2("span", null, "URL\uFF08\u53EF\u70B9\u51FB\uFF09"),
        h2("span", null, "\u6807\u9898"),
        h2("span", null, "\u8D44\u4EA7"),
        h2("span", null, "\u670D\u52A1")
      ),
      (web || []).map((w) => {
        const url = w.url || "http" + (w.port === 443 || w.port === 8443 || w.port === 9443 ? "s" : "") + "://" + w.ip + (w.port === 80 || w.port === 443 ? "" : ":" + w.port);
        return h2(
          "div",
          {
            key: "w" + w.port_id,
            className: "rt-row",
            style: {
              gridTemplateColumns: "1.6fr 1.2fr 130px 110px",
              cursor: "default"
            }
          },
          h2(
            "a",
            {
              className: "rt-link rt-mono",
              href: url,
              target: "_blank",
              rel: "noreferrer",
              title: url
            },
            url
          ),
          h2("span", { title: w.title || "" }, w.title || "\u2014"),
          h2("span", { className: "rt-mono" }, w.ip + " \xB7 " + w.segment_cidr),
          h2(
            "span",
            { style: { fontSize: 11 } },
            [w.service, w.product, w.version].filter(Boolean).join(" ")
          )
        );
      }),
      web === null ? h2("div", { className: "rt-empty" }, "\u52A0\u8F7D\u4E2D\u2026") : !web.length ? h2(
        "div",
        { className: "rt-empty" },
        cidr ? "\u8BE5 C \u6BB5\u4E0B\u6682\u65E0 Web \u8D44\u4EA7" : "\u6682\u65E0 Web \u8D44\u4EA7\uFF08HTTP \u63A2\u6D4B\u540E\u4F1A\u5199\u5165 URL \u4E0E\u6807\u9898\uFF09"
      ) : null
    );
    let pane = listPane;
    if (view === "testing")
      pane = h2(TestingTab, { engagement: eng, refreshKey });
    else if (view === "domain") pane = domainPane;
    else if (view === "web") pane = webPane;
    else if (view === "timeline")
      pane = h2(DiscoveryView, { engagement: eng, refreshKey });
    return h2(
      "div",
      { className: "rt-split" },
      side,
      h2(
        "div",
        { className: "rt-main" },
        view === "testing" ? null : toolbar,
        conclusion,
        state.error ? h2("div", { className: "rt-err" }, state.error) : null,
        pane
      )
    );
  }
  function DiscoveryView(props) {
    const eng = props.engagement;
    const refreshKey = props.refreshKey || 0;
    const [data, setData] = import_react2.default.useState(null);
    const [err, setErr] = import_react2.default.useState(null);
    const [day, setDay] = import_react2.default.useState("");
    import_react2.default.useEffect(() => {
      if (!eng) return;
      setData(null);
      api({ op: "discoveryTimeline", engagement: eng, limit: 200 }).then(
        (r) => {
          if (!r || r.ok === false) setErr(r && r.error || "\u52A0\u8F7D\u5931\u8D25");
          else {
            setErr(null);
            setData(r);
          }
        },
        (e) => setErr(String(e && e.message || e))
      );
    }, [eng, refreshKey]);
    if (err)
      return h2(
        "div",
        { className: "rt-pane" },
        h2("div", { className: "rt-err" }, err)
      );
    if (!data) return h2("div", { className: "rt-empty" }, "\u52A0\u8F7D\u4E2D\u2026");
    const recent = (data.recent || []).filter(
      (a) => day === "" || String(a.discovered_at || "").slice(0, 10) === day
    );
    return h2(
      "div",
      { className: "rt-pane", style: { flex: 1, minHeight: 0 } },
      h2(
        "div",
        { className: "rt-card" },
        h2("h4", null, "\u8D44\u4EA7\u53D1\u73B0\u65F6\u95F4\u7EBF"),
        h2(
          "div",
          {
            style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" }
          },
          "\u5171 " + (data.span && data.span.total || 0) + " \u53F0 \xB7 \u6700\u65E9 " + (data.span && data.span.first ? fmt(data.span.first) : "\u2014") + " \xB7 \u6700\u8FD1 " + (data.span && data.span.last ? fmt(data.span.last) : "\u2014") + '\uFF08\u53D1\u73B0\u65F6\u95F4 = \u7B2C\u4E00\u6B21\u8FDB\u5165\u8D44\u4EA7\u5E93\u7684\u65F6\u523B\uFF1B\u91CD\u590D\u91C7\u96C6\u53EA\u5237\u65B0"\u6700\u8FD1\u91C7\u96C6"\uFF09'
        )
      ),
      (data.days || []).length === 0 ? h2("div", { className: "rt-empty" }, "\u8FD8\u6CA1\u6709\u8D44\u4EA7\u3002") : null,
      h2(
        "div",
        { className: "rt-card" },
        h2(
          "h4",
          null,
          "\u6309\u5929\u7EDF\u8BA1",
          day ? h2(
            "span",
            Object.assign(
              {
                className: "rt-tag",
                style: { marginLeft: 6, cursor: "pointer" }
              },
              clickable(() => setDay(""), {
                label: "\u6E05\u9664\u6309\u5929\u7B5B\u9009\uFF1A" + day
              })
            ),
            "\u6E05\u9664\u7B5B\u9009\uFF1A" + day
          ) : null
        ),
        h2(
          "div",
          { style: { display: "flex", flexWrap: "wrap", gap: 8 } },
          (data.days || []).map(
            (d) => h2(
              "div",
              Object.assign(
                {
                  key: d.day,
                  className: "rt-seg" + (day === d.day ? " on" : ""),
                  style: { marginBottom: 0, cursor: "pointer" },
                  title: d.day + "\uFF1A\u65B0\u589E " + d.assets + " \u53F0\uFF08\u5185\u7F51 " + d.internal + " / \u5916\u7F51 " + d.external + "\uFF09"
                },
                clickable(() => setDay(day === d.day ? "" : d.day), {
                  label: "\u7B5B\u9009 " + d.day + " \u53D1\u73B0\u7684\u8D44\u4EA7",
                  expanded: day === d.day
                })
              ),
              h2("div", { className: "rt-seg-cidr" }, d.day),
              h2(
                "div",
                { className: "rt-seg-meta" },
                d.assets + " \u53F0 \xB7 \u5185 " + d.internal + " / \u5916 " + d.external
              )
            )
          )
        )
      ),
      h2(
        "div",
        { className: "rt-card" },
        h2(
          "h4",
          null,
          day ? day + " \u53D1\u73B0\u7684\u8D44\u4EA7\uFF08" + recent.length + "\uFF09" : "\u6700\u8FD1\u53D1\u73B0\u7684\u8D44\u4EA7\uFF08" + recent.length + "\uFF09"
        ),
        recent.length === 0 ? h2("div", { className: "rt-empty" }, "\u8FD9\u4E00\u5929\u6CA1\u6709\u65B0\u589E\u8D44\u4EA7\u3002") : null,
        recent.map(
          (a) => h2(
            "div",
            { key: a.id, className: "rt-kv" },
            h2(
              "b",
              { className: "rt-mono", style: { minWidth: 110 } },
              h2(
                "span",
                {
                  className: "rt-scope rt-scope-" + (a.scope === "internal" ? "internal" : "external"),
                  style: { marginRight: 4 }
                },
                a.scope === "internal" ? "\u5185" : "\u5916"
              ),
              a.ip
            ),
            h2(
              "span",
              {
                style: {
                  minWidth: 132,
                  fontSize: 11.5,
                  color: "var(--dsw-alias-label-secondary)"
                }
              },
              a.discovered_at ? fmt(a.discovered_at) : "\u65F6\u95F4\u672A\u77E5"
            ),
            h2(
              "span",
              { style: { flex: 1 } },
              (a.primary_name || "\u2014") + (a.open_ports ? " \xB7 " + a.open_ports + " \u7AEF\u53E3" : "")
            ),
            h2(PriTag, { p: a.priority })
          )
        )
      )
    );
  }
  function PromptsTab(props) {
    const eng = props.engagement;
    const refreshKey = props.refreshKey || 0;
    const [roles, setRoles] = import_react2.default.useState([]);
    const [active, setActive] = import_react2.default.useState(null);
    const [draft, setDraft] = import_react2.default.useState("");
    const [msg, setMsg] = import_react2.default.useState(null);
    const [busy, setBusy] = import_react2.default.useState(false);
    import_react2.default.useEffect(() => {
      api(eng ? { op: "prompts", engagement: eng } : { op: "prompts" }).then(
        (r) => {
          if (!r || r.ok === false) {
            setMsg({ err: r && r.error || "\u8BFB\u53D6\u5931\u8D25" });
            return;
          }
          setRoles(r.roles || []);
          if (r.roles && r.roles.length)
            setActive((cur2) => cur2 || r.roles[0].role);
          if (r.builtin)
            setMsg({
              ok: "\u5F53\u524D\u4E3A\u5185\u7F6E\u9ED8\u8BA4\u63D0\u793A\u8BCD\uFF08\u521B\u5EFA\u9776\u6807\u540E\u53EF\u6309\u9776\u6807\u4FDD\u5B58\u4FEE\u6539\uFF09"
            });
        },
        (e) => setMsg({ err: String(e && e.message || e) })
      );
    }, [eng, refreshKey]);
    import_react2.default.useEffect(() => {
      const r = roles.find((x) => x.role === active);
      if (r) setDraft(r.content || "");
    }, [active, roles]);
    const save = () => {
      if (!eng) {
        setMsg({ err: "\u8BF7\u5148\u521B\u5EFA\u9776\u6807\uFF0C\u518D\u4FDD\u5B58\u63D0\u793A\u8BCD" });
        return;
      }
      setBusy(true);
      setMsg(null);
      api({
        op: "savePrompt",
        engagement: eng,
        role: active,
        content: draft
      }).then(
        (r) => {
          setBusy(false);
          if (!r || r.ok === false) {
            setMsg({ err: r && r.error || "\u4FDD\u5B58\u5931\u8D25" });
            return;
          }
          setRoles(
            (list) => list.map(
              (x) => x.role === active ? Object.assign({}, x, {
                content: draft,
                updated_at: (/* @__PURE__ */ new Date()).toISOString()
              }) : x
            )
          );
          setMsg({ ok: "\u5DF2\u4FDD\u5B58" });
        },
        (e) => {
          setBusy(false);
          setMsg({ err: String(e && e.message || e) });
        }
      );
    };
    const reset = (all) => {
      if (!eng) {
        setMsg({ err: "\u8BF7\u5148\u521B\u5EFA\u9776\u6807\uFF0C\u518D\u6062\u590D\u9ED8\u8BA4\u63D0\u793A\u8BCD" });
        return;
      }
      setBusy(true);
      setMsg(null);
      api({
        op: "resetPrompts",
        engagement: eng,
        role: all ? void 0 : active
      }).then(
        (r) => {
          setBusy(false);
          if (!r || r.ok === false) {
            setMsg({ err: r && r.error || "\u6062\u590D\u5931\u8D25" });
            return;
          }
          setMsg({ ok: "\u5DF2\u6062\u590D\u5185\u7F6E\u9ED8\u8BA4\uFF1A" + (r.reset || []).join("\u3001") });
          api({ op: "prompts", engagement: eng }).then(
            (rr) => {
              if (rr && rr.ok) {
                setRoles(rr.roles || []);
                const cur2 = (rr.roles || []).find((x) => x.role === active);
                if (cur2) setDraft(cur2.content || "");
              }
            },
            () => {
            }
          );
        },
        (e) => {
          setBusy(false);
          setMsg({ err: String(e && e.message || e) });
        }
      );
    };
    const cur = roles.find((x) => x.role === active);
    const items = roles.map(
      (r) => h2(
        "div",
        Object.assign(
          {
            key: r.role,
            className: "rt-item" + (active === r.role ? " on" : "")
          },
          clickable(
            () => {
              setActive(r.role);
              setMsg(null);
            },
            {
              label: "\u67E5\u770B\u300C" + r.title + "\u300D\u63D0\u793A\u8BCD",
              expanded: active === r.role
            }
          )
        ),
        h2("div", { className: "rt-item-name" }, r.title),
        h2(
          "div",
          { className: "rt-item-desc" },
          (r.content || "").replace(/[#*`]/g, "").slice(0, 60) || "\uFF08\u7A7A\uFF09"
        )
      )
    );
    return h2(
      "div",
      { className: "rt-split" },
      h2("div", { className: "rt-list" }, items),
      h2(
        "div",
        { className: "rt-main" },
        h2(
          "div",
          { className: "rt-toolbar" },
          h2("span", { style: { fontWeight: 600 } }, cur ? cur.title : "\u63D0\u793A\u8BCD"),
          h2(
            "span",
            { className: "rt-tag" },
            "\u66F4\u65B0 " + fmt(cur && cur.updated_at)
          ),
          h2("div", { className: "rt-spacer" }),
          h2(
            "button",
            {
              className: "rt-btn",
              disabled: busy || !active,
              title: "\u628A\u5F53\u524D\u89D2\u8272\u6062\u590D\u6210\u5185\u7F6E\u6700\u65B0\u7248\u63D0\u793A\u8BCD",
              onClick: () => reset(false)
            },
            "\u6062\u590D\u9ED8\u8BA4\u4E3A\u5F53\u524D"
          ),
          h2(
            "button",
            {
              className: "rt-btn",
              disabled: busy,
              title: "\u56DB\u4E2A\u89D2\u8272\u5168\u90E8\u6062\u590D\u6210\u5185\u7F6E\u6700\u65B0\u7248\u63D0\u793A\u8BCD",
              onClick: () => reset(true)
            },
            "\u5168\u90E8\u6062\u590D\u9ED8\u8BA4"
          ),
          h2(
            "button",
            {
              className: "rt-btn rt-btn-primary",
              disabled: busy || !active,
              onClick: save
            },
            busy ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58"
          )
        ),
        msg ? h2(
          "div",
          { className: msg.err ? "rt-err" : "rt-foot" },
          msg.err || msg.ok
        ) : null,
        h2(
          "div",
          { className: "rt-pane" },
          h2("textarea", {
            className: "rt-textarea",
            value: draft,
            spellCheck: false,
            onChange: (e) => setDraft(e.target.value),
            placeholder: "\u8BE5\u89D2\u8272\u7684\u7CFB\u7EDF\u63D0\u793A\u8BCD\uFF08Markdown\uFF09"
          }),
          h2(
            "div",
            {
              style: {
                fontSize: 11,
                color: "var(--dsw-alias-label-secondary)",
                marginTop: 6
              }
            },
            "\u4FDD\u5B58\u540E\u5199\u5165 agents/" + (active || "role") + ".md\u3002\u5B50\u4F1A\u8BDD\u4EFB\u52A1\u7B2C\u4E00\u884C\u5199 redteamRole: recon\u3001assess\u3001vuln-scan\u3001exploit \u6216 internal \u540E\uFF0C\u5BF9\u5E94\u6587\u4EF6\u8FDB\u5165\u7CFB\u7EDF\u63D0\u793A\u8BCD\u3002"
          )
        )
      )
    );
  }
  function SkillsTab(props) {
    const refreshKey = props.refreshKey || 0;
    const [items, setItems] = import_react2.default.useState([]);
    const [meta, setMeta] = import_react2.default.useState({});
    const [err, setErr] = import_react2.default.useState(null);
    const [q, setQ] = import_react2.default.useState("");
    const [srcOnly, setSrcOnly] = import_react2.default.useState(false);
    const [active, setActive] = import_react2.default.useState(null);
    const [detail, setDetail] = import_react2.default.useState(null);
    const [busy, setBusy] = import_react2.default.useState(false);
    const [brokenOnly, setBrokenOnly] = import_react2.default.useState(false);
    const load = (force) => {
      setBusy(true);
      api({ op: "skillCatalog", refresh: force === true }).then(
        (r) => {
          setBusy(false);
          if (!r || r.ok === false) {
            setErr(r && r.error || "\u8BFB\u53D6\u5931\u8D25");
            return;
          }
          setErr(null);
          setMeta(r || {});
          setItems(r.items || []);
        },
        (e) => {
          setBusy(false);
          setErr(String(e && e.message || e));
        }
      );
    };
    import_react2.default.useEffect(load, [refreshKey]);
    const open = (skill) => {
      const name = skill && skill.name;
      const key = (skill && skill.library ? skill.library : "redteam") + ":" + name;
      if (active === key) {
        setActive(null);
        setDetail(null);
        return;
      }
      setActive(key);
      setDetail(null);
      api({
        op: "skillRead",
        name,
        library: skill.library || "redteam"
      }).then(
        (r) => {
          if (r && r.ok) setDetail(r);
          else setErr(r && r.error || "\u8BFB\u53D6\u5931\u8D25");
        },
        (e) => setErr(String(e && e.message || e))
      );
    };
    const needle = q.trim().toLowerCase();
    let filtered = needle ? items.filter(
      (s) => (s.name + " " + s.description + " " + s.whenToUse).toLowerCase().indexOf(needle) >= 0
    ) : items;
    if (srcOnly)
      filtered = filtered.filter(
        (s) => s.library !== "official" && s.fromPlugin === true
      );
    if (brokenOnly)
      filtered = filtered.filter(
        (s) => s.library !== "official" && (s.availability === "broken" || s.availability === "unknown")
      );
    const dirs = (meta.byDir || []).filter((d) => d.n > 0).slice(0, 6);
    const availSummary = meta.availability ? meta.availability.summary : null;
    const needRestart = err !== null && String(err).indexOf("unknown op") >= 0;
    const renderSkill = (s) => h2(
      "div",
      Object.assign(
        {
          key: (s.library || "redteam") + ":" + s.name,
          className: "rt-item" + (active === (s.library || "redteam") + ":" + s.name ? " on" : "")
        },
        clickable(() => open(s), {
          label: "\u67E5\u770B\u6280\u80FD " + s.name,
          expanded: active === (s.library || "redteam") + ":" + s.name
        })
      ),
      h2(
        "div",
        { className: "rt-item-name" },
        s.name,
        s.modelInvocable === false ? h2(
          "span",
          { className: "rt-tag", style: { marginLeft: 6 } },
          "\u4EC5\u4EBA\u5DE5"
        ) : null,
        s.library === "official" ? h2(
          "span",
          {
            className: "rt-tag",
            style: { marginLeft: 6 },
            title: "\u5B98\u65B9\u6280\u80FD\u76EE\u5F55\uFF0C\u4E0D\u6309\u7EA2\u961F\u5DE5\u5177\u8DEF\u5F84\u68C0\u67E5"
          },
          "\u5B98\u65B9"
        ) : h2(
          "span",
          {
            className: "rt-avail rt-avail-" + (s.availability || "unknown"),
            style: { marginLeft: 6 },
            title: s.availability === "available" ? "\u53EF\u7528\uFF1A\u6280\u80FD\u6B63\u6587\u53EF\u4EE5\u52A0\u8F7D\u3002\u7F3A\u7684\u5916\u90E8\u5DE5\u5177\u6216\u5BC6\u94A5\u8BB0\u5728\u8BE6\u60C5\u91CC\uFF0C\u4E0D\u963B\u6B62\u8C03\u7528\u3002" : (s.problems || []).join("\n") || "\u672A\u77E5"
          },
          s.availability === "available" ? "\u53EF\u7528" : s.availability === "broken" ? "\u4E0D\u53EF\u7528" : "\u672A\u77E5"
        ),
        h2(
          "div",
          { className: "rt-item-desc" },
          s.description || "\uFF08\u65E0\u63CF\u8FF0\uFF09"
        ),
        h2(
          "div",
          { className: "rt-kb-sub" },
          [
            s.source ? "\u6765\u6E90 " + s.source : null,
            s.fromPlugin ? "\u672C\u63D2\u4EF6\u81EA\u5E26" : null,
            s.provider ? s.provider : null,
            s.dir ? s.dir : null
          ].filter(Boolean).join(" \xB7 ")
        ),
        (s.problems || []).length > 0 && s.availability !== "available" && s.library !== "official" ? h2(
          "div",
          {
            className: "rt-kb-sub",
            style: {
              color: "var(--dsw-alias-state-warn-primary, #f59e0b)"
            }
          },
          "\u26A0 " + String(s.problems[0]).slice(0, 60)
        ) : null
      )
    );
    const redteamRows = filtered.filter((s) => s.library !== "official").map(renderSkill);
    const officialRows = filtered.filter((s) => s.library === "official").map(renderSkill);
    const listItems = [];
    if (redteamRows.length > 0) {
      listItems.push(
        h2(
          "div",
          {
            key: "head-redteam",
            className: "rt-kb-sub",
            style: { margin: "8px 0 4px", fontWeight: 600 }
          },
          "\u7EA2\u961F\u6280\u80FD"
        )
      );
      listItems.push.apply(listItems, redteamRows);
    }
    if (officialRows.length > 0) {
      listItems.push(
        h2(
          "div",
          {
            key: "head-official",
            className: "rt-kb-sub",
            style: { margin: "8px 0 4px", fontWeight: 600 }
          },
          "\u5B98\u65B9\u6280\u80FD"
        )
      );
      listItems.push.apply(listItems, officialRows);
    }
    return h2(
      "div",
      { className: "rt-split" },
      h2(
        "div",
        { className: "rt-list" },
        h2("input", {
          className: "rt-input",
          style: { width: "100%", marginBottom: 8, boxSizing: "border-box" },
          placeholder: "\u8FC7\u6EE4\u6280\u80FD",
          value: q,
          onChange: (e) => setQ(e.target.value)
        }),
        h2(
          "label",
          {
            className: "rt-kb-check",
            style: { display: "flex", margin: "0 0 6px" }
          },
          h2("input", {
            type: "checkbox",
            checked: srcOnly,
            onChange: (e) => setSrcOnly(e.target.checked)
          }),
          "\u53EA\u770B\u672C\u63D2\u4EF6\u81EA\u5E26\uFF08" + (meta.fromPlugin || 0) + " \u4E2A\uFF09"
        ),
        availSummary && (availSummary.broken > 0 || availSummary.unknown > 0) ? h2(
          "label",
          {
            className: "rt-kb-check",
            style: { display: "flex", margin: "0 0 8px" },
            title: "\u53EA\u770B\u6709\u660E\u786E\u7F3A\u53E3\uFF08\u7F3A key / \u7F3A\u672C\u673A\u8DEF\u5F84 / \u57FA\u7840\u8BBE\u65BD\u8FD8\u662F\u5360\u4F4D\u7B26\uFF09\u6216\u5224\u4E0D\u4E86\u53EF\u7528\u6027\u7684\u6280\u80FD"
          },
          h2("input", {
            type: "checkbox",
            checked: brokenOnly,
            onChange: (e) => setBrokenOnly(e.target.checked)
          }),
          "\u53EA\u770B\u4E0D\u53EF\u7528/\u672A\u77E5\uFF08" + ((availSummary.broken || 0) + (availSummary.unknown || 0)) + " \u4E2A\uFF09"
        ) : null,
        availSummary ? h2(
          "div",
          {
            style: {
              display: "flex",
              gap: 4,
              flexWrap: "wrap",
              marginBottom: 6
            }
          },
          h2(
            "span",
            { className: "rt-avail rt-avail-available" },
            "\u53EF\u7528 " + (availSummary.available || 0)
          ),
          availSummary.broken > 0 ? h2(
            "span",
            { className: "rt-avail rt-avail-broken" },
            "\u4E0D\u53EF\u7528 " + availSummary.broken
          ) : null,
          availSummary.unknown > 0 ? h2(
            "span",
            { className: "rt-avail rt-avail-unknown" },
            "\u672A\u77E5 " + availSummary.unknown
          ) : null,
          h2(
            "span",
            Object.assign(
              {
                className: "rt-tag",
                style: { cursor: "pointer" },
                title: "\u6280\u80FD\u6B63\u6587\u6216\u73AF\u5883\u53D8\u91CF\u521A\u6539\u8FC7\uFF1F\u70B9\u8FD9\u91CC\u8DF3\u8FC7 30 \u79D2\u7F13\u5B58\u91CD\u67E5"
              },
              clickable(() => load(true), { label: "\u91CD\u65B0\u68C0\u67E5\u6280\u80FD\u53EF\u7528\u6027" })
            ),
            "\u91CD\u67E5\u53EF\u7528\u6027"
          )
        ) : null,
        h2(
          "div",
          {
            style: {
              fontSize: 11,
              color: "var(--dsw-alias-label-secondary)",
              marginBottom: 6
            }
          },
          "\u7EA2\u961F " + (meta.libraries && meta.libraries.redteam || 0) + " \xB7 \u5B98\u65B9 " + (meta.libraries && meta.libraries.official || 0),
          items.length > 100 ? h2(
            "div",
            { style: { marginTop: 3 } },
            "\uFF08\u6280\u80FD\u591A\u6765\u81EA\u5176\u5B83\u63D2\u4EF6\u6CE8\u518C\u7684\u6839\u6216\u4F60\u81EA\u5DF1\u7684\u6280\u80FD\u76EE\u5F55\uFF1B\u672C\u63D2\u4EF6\u53EA\u81EA\u5E26 " + (meta.fromPlugin || 0) + " \u4E2A\uFF09"
          ) : null
        ),
        listItems
      ),
      h2(
        "div",
        { className: "rt-main" },
        h2(
          "div",
          { className: "rt-toolbar" },
          h2(
            "span",
            { style: { fontWeight: 600 } },
            detail ? detail.name : "\u6280\u80FD\u76EE\u5F55\uFF08DSH \u539F\u751F\uFF09"
          ),
          h2("div", { className: "rt-spacer" }),
          h2(
            "button",
            { className: "rt-btn", disabled: busy, onClick: () => load(true) },
            busy ? "\u5237\u65B0\u4E2D\u2026" : "\u5237\u65B0"
          )
        ),
        err ? needRestart ? h2(
          "div",
          { className: "rt-empty" },
          "\u8BE5\u6A21\u5757\u7684\u5BBF\u4E3B\u4EE3\u7801\u5DF2\u66F4\u65B0\uFF0C\u9700\u91CD\u542F\u4E00\u6B21\u5F53\u524D\u5BBF\u4E3B\uFF08\u5B98\u65B9 exe / \u793E\u533A\u7248 / dsh web\uFF09\u540E\u751F\u6548"
        ) : h2("div", { className: "rt-err" }, err) : null,
        detail ? h2(
          "div",
          { className: "rt-pane" },
          h2(
            "div",
            { className: "rt-kv" },
            h2("b", null, "\u63CF\u8FF0"),
            h2("span", null, detail.description || "\u2014")
          ),
          h2(
            "div",
            { className: "rt-kv" },
            h2("b", null, "\u4F55\u65F6\u4F7F\u7528"),
            h2("span", null, detail.whenToUse || "\u2014")
          ),
          h2(
            "div",
            { className: "rt-kv" },
            h2("b", null, "\u6765\u6E90"),
            h2(
              "span",
              null,
              (detail.provider || "\u2014") + " / " + (detail.source || "\u2014")
            )
          ),
          (() => {
            const s2 = items.find(
              (x) => (x.library || "redteam") + ":" + x.name === active
            );
            if (!s2) return null;
            if (s2.library === "official") {
              return h2(
                "div",
                { className: "rt-kv" },
                h2("b", null, "\u7C7B\u578B"),
                h2(
                  "span",
                  null,
                  "\u5B98\u65B9\u6280\u80FD\u3002\u7531\u5BBF\u4E3B\u6309\u4EFB\u52A1\u8C03\u7528\uFF0C\u4E0D\u6309\u7EA2\u961F\u5DE5\u5177\u8DEF\u5F84\u68C0\u67E5\u3002"
                )
              );
            }
            const avail = s2.availability || "unknown";
            return h2(
              "div",
              null,
              h2(
                "div",
                { className: "rt-kv" },
                h2("b", null, "\u53EF\u7528\u6027"),
                h2(
                  "span",
                  { className: "rt-avail rt-avail-" + avail },
                  avail === "available" ? "\u53EF\u7528" : avail === "broken" ? "\u4E0D\u53EF\u7528\uFF08\u6709\u660E\u786E\u7F3A\u53E3\uFF09" : "\u672A\u77E5\uFF08\u6B63\u6587\u8BFB\u4E0D\u5230\uFF09"
                )
              ),
              (s2.problems || []).length > 0 ? h2(
                "div",
                { className: "rt-kv" },
                h2(
                  "b",
                  null,
                  avail === "available" ? "\u672A\u88C5\u4E0A\u7684\u5916\u90E8\u5DE5\u5177" : "\u7F3A\u53E3"
                ),
                h2(
                  "span",
                  null,
                  s2.problems.map(
                    (x, i) => h2("div", { key: "p" + i }, "\xB7 " + x)
                  )
                )
              ) : null,
              (s2.needs_user || []).length > 0 ? h2(
                "div",
                { className: "rt-kv" },
                h2("b", null, "\u9700\u8981\u4F60\u63D0\u4F9B"),
                h2(
                  "span",
                  {
                    style: {
                      color: "var(--dsw-alias-state-warn-primary, #f59e0b)"
                    }
                  },
                  s2.needs_user.map(
                    (x, i) => h2("div", { key: "n" + i }, "\xB7 " + x)
                  )
                )
              ) : null
            );
          })(),
          detail.path ? h2(
            "div",
            { className: "rt-kv" },
            h2("b", null, "\u6587\u4EF6"),
            h2(
              "span",
              {
                className: "rt-mono",
                style: { wordBreak: "break-all" }
              },
              detail.path
            )
          ) : null,
          h2(
            "pre",
            {
              className: "rt-md",
              style: {
                border: "1px solid var(--dsw-alias-border-l1)",
                borderRadius: 6,
                maxHeight: "52vh"
              }
            },
            detail.content || "\uFF08\u7A7A\uFF09"
          )
        ) : h2(
          "div",
          { className: "rt-pane" },
          h2(
            "div",
            {
              style: {
                fontSize: 12,
                color: "var(--dsw-alias-label-secondary)",
                marginBottom: 8
              }
            },
            meta.note || "\u6280\u80FD\u7531 DSH \u539F\u751F skill \u4F53\u7CFB\u7BA1\u7406\uFF0C\u7EA2\u961F\u667A\u80FD\u4F53\u901A\u8FC7 skill \u5DE5\u5177\u8C03\u7528\u3002"
          ),
          availSummary ? h2(
            "div",
            {
              style: {
                fontSize: 12,
                marginBottom: 8,
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                alignItems: "center"
              }
            },
            h2(
              "span",
              { className: "rt-avail rt-avail-available" },
              "\u53EF\u7528 " + (availSummary.available || 0)
            ),
            availSummary.broken > 0 ? h2(
              "span",
              { className: "rt-avail rt-avail-broken" },
              "\u4E0D\u53EF\u7528 " + availSummary.broken
            ) : null,
            availSummary.unknown > 0 ? h2(
              "span",
              { className: "rt-avail rt-avail-unknown" },
              "\u672A\u77E5 " + availSummary.unknown
            ) : null,
            h2(
              "span",
              { style: { color: "var(--dsw-alias-label-secondary)" } },
              "\uFF08" + (meta.availability && meta.availability.cached ? "\u7F13\u5B58\u4E8E " : "\u68C0\u67E5\u4E8E ") + (meta.availability && meta.availability.checked_at ? fmt(meta.availability.checked_at) : "\u2014") + "\uFF09"
            )
          ) : null,
          meta.availability && (meta.availability.broken || []).length > 0 ? h2(
            "div",
            { className: "rt-hint" },
            h2(
              "div",
              { style: { fontWeight: 600, marginBottom: 4 } },
              "\u73B0\u5728\u8DD1\u4E0D\u8D77\u6765\u7684\u6280\u80FD\uFF1A"
            ),
            meta.availability.broken.slice(0, 12).map(
              (b) => h2(
                "div",
                { key: b.name },
                "\xB7 " + b.name + (b.problems && b.problems.length ? " \u2014 " + b.problems[0] : "")
              )
            )
          ) : null,
          (meta.byDir || []).slice(0, 6).map(
            (d) => h2(
              "div",
              {
                key: d.key,
                className: "rt-mono",
                style: {
                  fontSize: 11,
                  marginBottom: 2,
                  overflowWrap: "anywhere"
                }
              },
              d.n + " \u4E2A \xB7 " + d.key
            )
          ),
          (meta.byDir || []).length > 6 ? h2(
            "div",
            {
              style: {
                fontSize: 11,
                color: "var(--dsw-alias-label-secondary)"
              }
            },
            "\u2026\u53E6\u6709 " + ((meta.byDir || []).length - 6) + " \u4E2A\u76EE\u5F55\uFF08\u5171 " + items.length + " \u4E2A\u6280\u80FD\uFF09"
          ) : null,
          h2("div", { className: "rt-empty" }, "\u5DE6\u4FA7\u9009\u62E9\u6280\u80FD\u67E5\u770B\u5185\u5BB9")
        )
      )
    );
  }
  const SEV_LABEL = {
    critical: "\u4E25\u91CD",
    high: "\u9AD8\u5371",
    medium: "\u4E2D\u5371",
    low: "\u4F4E\u5371",
    info: "\u4FE1\u606F"
  };
  const STATUS_LABEL = {
    candidate: "\u5F85\u9A8C\u8BC1",
    confirmed: "\u5DF2\u786E\u8BA4",
    "false-positive": "\u8BEF\u62A5",
    exploited: "\u5DF2\u5229\u7528",
    fixed: "\u5DF2\u4FEE\u590D"
  };
  const sevClass = (s) => "rt-sev rt-sev-" + (SEV_LABEL[s] ? s : "info");
  function targetKeyOf(v) {
    const t = String(v.target || "").trim();
    if (t !== "") {
      const url = /^([a-z][a-z0-9+.-]*:\/\/[^/?#\s]+)/i.exec(t);
      if (url) return url[1];
      const head = /^([^\s/?#]+)/.exec(t);
      if (head) return head[1];
      return t;
    }
    return v.asset_ip || "(\u672A\u6307\u5B9A\u76EE\u6807)";
  }
  function HttpBlock(props) {
    const text = String(props.text || "");
    if (!text) return null;
    const lines = text.split(/\r?\n/);
    const nodes = lines.map((ln, i) => {
      let cls = null;
      if (i === 0 && /^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH|TRACE)\s/.test(ln))
        cls = "rt-hl-req";
      else if (i === 0 && /^HTTP\//.test(ln)) cls = "rt-hl-res";
      else if (/^[A-Za-z0-9-]+:/.test(ln)) {
        const name = ln.split(":")[0].toLowerCase();
        if (name === "host" || name === "cookie" || name === "authorization" || name === "content-type")
          cls = "rt-hl-req";
      }
      return h2(
        "div",
        { key: "l" + i, className: cls || void 0 },
        ln === "" ? "\xA0" : ln
      );
    });
    return h2(
      "pre",
      { className: "rt-evi-body" + (props.compact ? " req" : "") },
      nodes
    );
  }
  function detailEvidence(v) {
    const evi = String(v.evidence || "").trim();
    const looksHttp = /^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH|HTTP\/)/m.test(evi) || /\n[A-Za-z-]+: /.test(evi);
    const blocks = [];
    if (evi) {
      blocks.push(
        h2(
          "div",
          { key: "ev", className: "rt-evi" },
          h2(
            "div",
            { className: "rt-evi-head" },
            "\u8BC1\u636E\u6458\u8981",
            h2("span", { className: "rt-tag" }, looksHttp ? "\u539F\u59CB\u62A5\u6587" : "\u6587\u672C"),
            h2("div", { className: "rt-spacer" }),
            h2(
              "button",
              {
                className: "rt-btn",
                style: { padding: "0 6px", fontSize: 11 },
                onClick: (e) => {
                  e.stopPropagation();
                  copyText(evi);
                }
              },
              "\u590D\u5236"
            )
          ),
          looksHttp ? h2(HttpBlock, { text: evi }) : h2("pre", { className: "rt-evi-body" }, evi)
        )
      );
    }
    const http = v.http_evidence || [];
    for (const e of http) {
      blocks.push(
        h2(
          "div",
          { key: "h" + e.id, className: "rt-evi" },
          h2(
            "div",
            { className: "rt-evi-head" },
            e.label || "HTTP \u8BC1\u636E",
            h2(
              "span",
              { className: "rt-tag" },
              (e.method || "") + " " + (e.status === null || e.status === void 0 ? "" : e.status)
            ),
            h2("div", { className: "rt-spacer" }),
            h2(
              "span",
              {
                style: {
                  fontWeight: 400,
                  color: "var(--dsw-alias-label-secondary)"
                }
              },
              fmt(e.captured_at || e.created_at)
            )
          ),
          e.request ? h2(
            "div",
            null,
            h2(
              "div",
              { className: "rt-evi-head", style: { borderTop: "none" } },
              "\u25B8 \u8BF7\u6C42\uFF08\u53EF\u76F4\u63A5\u7C98\u8FDB Burp Repeater\uFF09"
            ),
            h2(HttpBlock, { text: e.request, compact: true })
          ) : null,
          e.response ? h2(
            "div",
            null,
            h2("div", { className: "rt-evi-head" }, "\u25B8 \u54CD\u5E94"),
            h2(HttpBlock, { text: e.response })
          ) : null,
          e.note ? h2(
            "pre",
            { className: "rt-evi-body", style: { maxHeight: 80 } },
            e.note
          ) : null
        )
      );
    }
    if (blocks.length === 0) {
      blocks.push(
        h2(
          "div",
          { key: "none", className: "rt-kv" },
          h2("b", null, "\u8BC1\u636E"),
          h2(
            "span",
            { style: { color: "var(--dsw-alias-state-error-primary)" } },
            "\u7F3A\u5931 \u2014\u2014 \u672A\u9A8C\u8BC1/\u65E0\u8BC1\u636E\u7684\u6F0F\u6D1E\u4E0D\u8BA1\u5165\u62A5\u544A\uFF0C\u8BF7\u8865 redteam_http_evidence_add"
          )
        )
      );
    }
    return h2("div", { key: "eviwrap" }, blocks);
  }
  function FindingsTab(props) {
    const eng = props.engagement;
    const queryApi = props.api || api;
    const isSrc2 = props.assessmentMode === "src";
    const isPentest = props.assessmentMode === "pentest";
    const hideRedteamCollections = isScopedAssessmentMode(props.assessmentMode);
    const refsOf = (value) => {
      try {
        const refs = typeof value === "string" ? JSON.parse(value) : value;
        return Array.isArray(refs) ? refs : [];
      } catch {
        return [];
      }
    };
    const refreshKey = props.refreshKey || 0;
    const [sev, setSev] = import_react2.default.useState("");
    const [status, setStatus] = import_react2.default.useState("");
    const [q, setQ] = import_react2.default.useState("");
    const [qApplied, setQApplied] = import_react2.default.useState("");
    const [state, setState] = import_react2.default.useState({
      loading: false,
      error: null,
      total: 0,
      items: [],
      stats: null
    });
    const [creds, setCreds] = import_react2.default.useState([]);
    const [accesses, setAccesses] = import_react2.default.useState([]);
    const [files, setFiles] = import_react2.default.useState([]);
    const [openId, setOpenId] = import_react2.default.useState(null);
    const [msg, setMsg] = import_react2.default.useState(null);
    const [copyingCredential, setCopyingCredential] = import_react2.default.useState(null);
    const credentialRequest = import_react2.default.useRef({ engagement: eng, sequence: 0 });
    credentialRequest.current.engagement = eng;
    const { owner, captured } = useRequestGeneration(
      eng + ":" + props.assessmentMode,
      queryApi
    );
    import_react2.default.useLayoutEffect(() => {
      setState({
        loading: false,
        error: null,
        total: 0,
        items: [],
        stats: null
      });
      setCreds([]);
      setAccesses([]);
      setFiles([]);
      setOpenId(null);
      setMsg(null);
      setCopyingCredential(null);
      credentialRequest.current.sequence++;
    }, [captured]);
    const [subTab, setSubTab] = import_react2.default.useState("vulns");
    const [grouped, setGrouped] = import_react2.default.useState(true);
    const collapse = useCollapse("findings:" + eng);
    const load = () => {
      if (!eng || !isCurrent(owner, captured)) return;
      const sequence = ++captured.readSequence, generation = captured.generation;
      const current = () => isCurrent(owner, captured, generation) && sequence === captured.readSequence;
      setState((previous) => ({ ...previous, loading: true, error: null }));
      queryApi({
        op: "vulns",
        engagement: eng,
        severity: sev || void 0,
        status: status || void 0,
        q: qApplied || void 0,
        limit: 200
      }).then(
        (r) => {
          if (!current()) return;
          if (!r || r.ok === false) {
            setState({
              loading: false,
              error: r && r.error || "\u67E5\u8BE2\u5931\u8D25",
              total: 0,
              items: [],
              stats: null
            });
            return;
          }
          setState({
            loading: false,
            error: null,
            total: r.total,
            items: r.items || [],
            stats: r.stats || null
          });
        },
        (e) => current() && setState({
          loading: false,
          error: String(e && e.message || e),
          total: 0,
          items: [],
          stats: null
        })
      );
      if (!isSrc2)
        queryApi({ op: "credentials", engagement: eng }).then(
          (r) => current() && setCreds(r && r.items || []),
          () => {
          }
        );
      if (!hideRedteamCollections)
        queryApi({ op: "access", engagement: eng }).then(
          (r) => current() && setAccesses(r && r.items || []),
          () => {
          }
        );
      if (!hideRedteamCollections)
        queryApi({ op: "attackFiles", engagement: eng }).then(
          (r) => current() && setFiles(r && r.items || []),
          () => {
          }
        );
    };
    import_react2.default.useEffect(load, [captured, sev, status, qApplied, refreshKey]);
    import_react2.default.useEffect(() => {
      if (isSrc2 && subTab !== "vulns" || isPentest && !["vulns", "creds"].includes(subTab))
        setSubTab("vulns");
    }, [eng, hideRedteamCollections, subTab]);
    const setVulnStatus = (id, next) => {
      if (!isCurrent(owner, captured)) return;
      const generation = captured.generation;
      setMsg(null);
      queryApi({
        op: "updateVuln",
        engagement: eng,
        id,
        patch: {
          status: next,
          ...isSrc2 ? {
            evidence_refs: refsOf(
              state.items.find((item) => item.id === id)?.evidence_refs
            )
          } : {}
        }
      }).then(
        (r) => {
          if (!isCurrent(owner, captured, generation)) return;
          if (!r || r.ok === false) {
            setMsg({ err: r && r.error || "\u66F4\u65B0\u5931\u8D25" });
            return;
          }
          setMsg({ ok: "\u5DF2\u66F4\u65B0\u4E3A\u300C" + (STATUS_LABEL[next] || next) + "\u300D" });
          load();
        },
        (e) => isCurrent(owner, captured, generation) && setMsg({ err: String(e && e.message || e) })
      );
    };
    const copyCredential = async (credential) => {
      if (!isCurrent(owner, captured)) return;
      const generation = captured.generation;
      const sequence = ++credentialRequest.current.sequence;
      setCopyingCredential(credential.id);
      setMsg(null);
      try {
        const result = await queryApi({
          op: "credentialReveal",
          engagement: eng,
          credential_handle: credential.credential_handle,
          purpose: "\u9762\u677F\u590D\u5236\u5F53\u524D\u9009\u4E2D\u5355\u6761\u51ED\u636E\uFF0C\u7528\u4E8E\u5F53\u524D\u9776\u6807\u4EFB\u52A1"
        });
        if (!isCurrent(owner, captured, generation) || credentialRequest.current.sequence !== sequence)
          return;
        if (result?.ok !== true || typeof result.credential?.secret_value !== "string")
          throw new Error(result?.error || "\u5F53\u524D\u51ED\u636E\u5B9E\u9645\u503C\u4E0D\u53EF\u7528");
        if (!await copyText(result.credential.secret_value))
          throw new Error("\u526A\u8D34\u677F\u5199\u5165\u5931\u8D25");
        if (!isCurrent(owner, captured, generation) || credentialRequest.current.sequence !== sequence)
          return;
        setMsg({ ok: "\u5DF2\u590D\u5236\u5F53\u524D\u5355\u6761\u51ED\u636E" });
      } catch (error) {
        if (isCurrent(owner, captured, generation) && credentialRequest.current.sequence === sequence)
          setMsg({ err: error.message || "\u590D\u5236\u5931\u8D25" });
      } finally {
        if (isCurrent(owner, captured, generation) && credentialRequest.current.sequence === sequence)
          setCopyingCredential(null);
      }
    };
    const stats2 = state.stats && state.stats.bySeverity ? state.stats : { bySeverity: {}, byStatus: {} };
    const needRestart = state.error !== null && String(state.error).indexOf("unknown op") >= 0;
    const allFiles = (files || []).flatMap(
      (g) => (g.files || []).map((f) => Object.assign({ target: g.target }, f))
    );
    const filesByVuln = /* @__PURE__ */ new Map();
    const orphanFiles = [];
    for (const f of allFiles) {
      const vid = f.vuln_id === null || f.vuln_id === void 0 ? null : Number(f.vuln_id);
      if (vid === null) {
        orphanFiles.push(f);
        continue;
      }
      if (!filesByVuln.has(vid)) filesByVuln.set(vid, []);
      filesByVuln.get(vid).push(f);
    }
    const concl = (key, label, value, active, onClick) => h2(
      "span",
      Object.assign(
        {
          key,
          className: "rt-concl-i" + (active ? " on" : ""),
          title: "\u70B9\u51FB\u7B5B\u9009 / \u518D\u70B9\u53D6\u6D88"
        },
        clickable(onClick, {
          label: "\u6309\u300C" + label + "\u300D\u7B5B\u9009\uFF08" + (value || 0) + "\uFF09",
          expanded: active
        })
      ),
      h2("b", null, String(value || 0)),
      h2("span", null, label)
    );
    const conclusion = h2(
      "div",
      { className: "rt-concl" },
      concl(
        "conf",
        "\u5F53\u524D\u8BC1\u660E\u786E\u8BA4",
        stats2.byProof?.confirmed || 0,
        status === "confirmed",
        () => setStatus((v) => v === "confirmed" ? "" : "confirmed")
      ),
      !hideRedteamCollections && concl(
        "exp",
        "\u5F53\u524D\u8BC1\u660E\u5229\u7528",
        stats2.byProof?.exploited || 0,
        status === "exploited",
        () => setStatus((v) => v === "exploited" ? "" : "exploited")
      ),
      concl(
        "crit",
        "\u4E25\u91CD",
        stats2.bySeverity.critical || 0,
        sev === "critical",
        () => setSev((v) => v === "critical" ? "" : "critical")
      ),
      concl(
        "high",
        "\u9AD8\u5371",
        stats2.bySeverity.high || 0,
        sev === "high",
        () => setSev((v) => v === "high" ? "" : "high")
      ),
      concl(
        "med",
        "\u4E2D\u5371",
        stats2.bySeverity.medium || 0,
        sev === "medium",
        () => setSev((v) => v === "medium" ? "" : "medium")
      ),
      !hideRedteamCollections && concl("gain", "\u62FF\u5230\u6743\u9650", stats2.withGained || 0, false, () => {
      }),
      h2("div", { className: "rt-spacer" }),
      h2(
        "span",
        { style: { fontSize: 11, color: "var(--dsw-alias-label-secondary)" } },
        "\u9ED8\u8BA4\u6309\u76EE\u6807\u805A\u5408 \xB7 \u5171 " + (stats2.targetGroups || 0) + " \u4E2A\u76EE\u6807"
      )
    );
    const head = h2(
      "div",
      { className: "rt-vrow head" },
      h2("span", null, "\u7B49\u7EA7"),
      h2("span", null, "\u6F0F\u6D1E / \u7F16\u53F7"),
      h2("span", null, "\u76EE\u6807"),
      h2("span", null, "\u62FF\u5230\u4EC0\u4E48"),
      h2("span", null, "\u72B6\u6001"),
      h2("span", null, "\u7F6E\u4FE1")
    );
    const vulnRows = (v, compact) => {
      const out = [];
      const gainedList = String(v.gained || "").split(/[、,;，；]/).map((x) => x.trim()).filter(Boolean);
      const open = openId === v.id;
      out.push(
        h2(
          "div",
          {
            key: "v" + v.id,
            className: "rt-vrow",
            role: "button",
            tabIndex: 0,
            style: compact ? {
              cursor: "pointer",
              gridTemplateColumns: "58px minmax(0,1fr) 104px 68px"
            } : { cursor: "pointer" },
            onClick: () => setOpenId(open ? null : v.id),
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpenId(open ? null : v.id);
              }
            }
          },
          h2(
            "span",
            null,
            h2(
              "span",
              { className: sevClass(v.severity) },
              SEV_LABEL[v.severity] || v.severity
            )
          ),
          h2(
            "span",
            { title: v.title || "" },
            h2("span", { className: "rt-sec-caret" }, open ? "\u25BE" : "\u25B8"),
            (v.cve ? v.cve + " " : "") + (v.title || ""),
            v.finding_kind !== "vulnerability" && h2(
              "span",
              { className: "rt-tag" },
              v.finding_kind === "hardening" ? "\u52A0\u56FA\u5EFA\u8BAE" : "\u4FE1\u606F\u9879"
            )
          ),
          compact ? null : h2(
            "span",
            { className: "rt-mono", title: v.target || "" },
            v.target || v.asset_ip || "\u2014"
          ),
          h2(
            "span",
            { title: v.gained || "" },
            gainedList.length ? h2(
              "span",
              {
                className: "rt-gain",
                style: {
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  display: "inline-block"
                }
              },
              gainedList[0] + (gainedList.length > 1 ? " +" + (gainedList.length - 1) : "")
            ) : h2(
              "span",
              { style: { color: "var(--dsw-alias-label-secondary)" } },
              "\u2014"
            )
          ),
          h2(
            "span",
            null,
            h2(
              "span",
              {
                className: "rt-tag",
                title: (v.proof_pending || []).join("\uFF1B")
              },
              v.confirmation_state === "pending_proof" ? "\u6807\u7B7E\u5F85\u590D\u6838" : STATUS_LABEL[v.status] || v.status
            )
          ),
          compact ? null : h2(
            "span",
            null,
            v.confidence === null || v.confidence === void 0 ? "\u2014" : Math.round(v.confidence * 100) + "%"
          )
        )
      );
      if (openId !== v.id) return out;
      out.push(
        h2(
          "div",
          {
            key: "vd" + v.id,
            className: "rt-vrow",
            style: { cursor: "default", gridTemplateColumns: "1fr" }
          },
          h2(
            "div",
            { className: "rt-vdetail" },
            isSrc2 && h2(FindingSubmission, {
              finding: v,
              engagement: eng,
              api: queryApi,
              onSaved: load
            }),
            h2(
              "div",
              { className: "rt-kv" },
              h2(
                "b",
                null,
                isSrc2 ? "\u505C\u6B62\u8BB0\u5F55" : isPentest ? "\u5F71\u54CD\u5206\u6790" : "\u62FF\u5230\u4EC0\u4E48"
              ),
              isSrc2 ? h2("span", null, v.stop_reason || "\u5F85\u76F4\u63A5\u8BC1\u636E\u6838\u5B9E") : isPentest ? h2("span", null, v.impact || "\u5F85\u4F9D\u636E\u5F53\u524D\u8BC1\u660E\u6574\u7406\u5F71\u54CD") : gainedList.length ? h2(
                "span",
                null,
                gainedList.map(
                  (g, gi) => h2(
                    "span",
                    {
                      key: "g" + gi,
                      className: "rt-gain",
                      style: { marginRight: 6 }
                    },
                    g
                  )
                )
              ) : h2(
                "span",
                {
                  style: { color: "var(--dsw-alias-label-secondary)" }
                },
                "\u672A\u8BB0\u5F55 \u2014\u2014 \u62FF\u5230\u6743\u9650/\u6210\u679C\u540E\u8BF7\u7528 redteam_vuln_update \u8865 gained\uFF08\u4F8B\uFF1A\u670D\u52A1\u5668\u6743\u9650\u3001\u5185\u7F51\u96A7\u9053\u3001\u540E\u53F0\u7BA1\u7406\u5458\u8D26\u53F7\uFF09"
              )
            ),
            h2(
              "div",
              { className: "rt-kv" },
              h2("b", null, "\u76EE\u6807"),
              h2(
                "span",
                { className: "rt-mono", style: { wordBreak: "break-all" } },
                v.target || "\u2014"
              )
            ),
            h2(
              "div",
              { className: "rt-kv" },
              h2("b", null, "\u8D44\u4EA7"),
              h2(
                "span",
                null,
                (v.asset_ip || "\u2014") + " \xB7 " + (v.segment_cidr || "")
              )
            ),
            h2(
              "div",
              { className: "rt-kv" },
              h2("b", null, "\u6765\u6E90"),
              h2(
                "span",
                null,
                (v.source || "\u2014") + " \xB7 " + (v.found_by_agent || "\u2014") + " \xB7 " + fmt(v.found_at)
              )
            ),
            detailEvidence(v),
            !isPentest && (() => {
              const mine = filesByVuln.get(Number(v.id)) || [];
              return h2(
                "div",
                { className: "rt-kv" },
                h2("b", null, "\u653B\u51FB\u6587\u4EF6"),
                mine.length ? h2(
                  "span",
                  null,
                  mine.map(
                    (f, fi) => h2(
                      "div",
                      { key: "af" + fi, style: { marginBottom: 3 } },
                      "\xB7 " + (f.kind ? "[" + f.kind + "] " : "") + (f.name || "(\u672A\u547D\u540D)") + (f.description ? " \u2014 " + f.description : ""),
                      h2(
                        "div",
                        {
                          className: "rt-mono",
                          style: {
                            fontSize: 11,
                            marginLeft: 12,
                            color: "var(--dsw-alias-label-secondary)",
                            overflowWrap: "anywhere"
                          }
                        },
                        f.path || ""
                      )
                    )
                  )
                ) : h2(
                  "span",
                  {
                    style: { color: "var(--dsw-alias-label-secondary)" }
                  },
                  "\uFF08\u65E0\uFF09\u7528 redteam_attack_file_add \u628A\u8FD9\u6761\u6F0F\u6D1E\u6253\u901A\u7684\u811A\u672C/\u9A6C/EXP \u5F52\u6863\uFF0C\u5E76\u5E26\u4E0A vuln_id"
                )
              );
            })(),
            h2(
              "div",
              { className: "rt-actions" },
              h2(
                "button",
                {
                  className: "rt-btn",
                  disabled: hideRedteamCollections && v.confirmation_state !== "verified",
                  onClick: (e) => {
                    e.stopPropagation();
                    setVulnStatus(v.id, "confirmed");
                  }
                },
                "\u786E\u8BA4"
              ),
              !hideRedteamCollections && h2(
                "button",
                {
                  className: "rt-btn",
                  onClick: (e) => {
                    e.stopPropagation();
                    setVulnStatus(v.id, "exploited");
                  }
                },
                "\u5DF2\u5229\u7528"
              ),
              h2(
                "button",
                {
                  className: "rt-btn",
                  onClick: (e) => {
                    e.stopPropagation();
                    setVulnStatus(v.id, "false-positive");
                  }
                },
                "\u8BEF\u62A5"
              ),
              h2(
                "button",
                {
                  className: "rt-btn",
                  onClick: (e) => {
                    e.stopPropagation();
                    setVulnStatus(v.id, "fixed");
                  }
                },
                "\u5DF2\u4FEE\u590D"
              )
            )
          )
        )
      );
      return out;
    };
    const rows = [];
    if (grouped) {
      const groups = /* @__PURE__ */ new Map();
      for (const v of state.items) {
        const key = targetKeyOf(v);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(v);
      }
      const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      const list = Array.from(groups.entries()).map(([key, vs]) => ({
        key,
        vulns: vs,
        top: vs.slice().sort(
          (a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9)
        )[0],
        gained: Array.from(
          new Set(
            vs.flatMap(
              (v) => String(v.gained || "").split(/[、,;，；]/).map((x) => x.trim()).filter(Boolean)
            )
          )
        ),
        exploited: vs.filter((v) => v.status === "exploited").length
      })).sort(
        (a, b) => (SEV_RANK[a.top.severity] ?? 9) - (SEV_RANK[b.top.severity] ?? 9) || b.vulns.length - a.vulns.length
      );
      for (const g of list) {
        const key = "target:" + g.key;
        const defOpen = false;
        rows.push(
          h2(
            Section,
            {
              key: "sec:" + g.key,
              tone: "target",
              title: g.key,
              count: g.vulns.length + " \u4E2A\u6F0F\u6D1E",
              sub: [
                SEV_LABEL[g.top.severity] || g.top.severity,
                g.exploited ? "\u5DF2\u5229\u7528 " + g.exploited : null,
                g.top.asset_ip && g.top.asset_ip !== g.key ? "\u8D44\u4EA7 " + g.top.asset_ip : null
              ].filter(Boolean).join(" \xB7 "),
              right: g.gained.length ? g.gained.slice(0, 2).join(" / ") + (g.gained.length > 2 ? " +" + (g.gained.length - 2) : "") : "\u672A\u8BB0\u5F55\u6743\u9650",
              open: collapse.isOpen(key, defOpen),
              onToggle: collapse.toggle(key, defOpen)
            },
            g.vulns.map((v) => vulnRows(v, true))
          )
        );
      }
      if (!list.length && !state.loading && !state.error) {
        rows.push(
          h2("div", { key: "none", className: "rt-empty" }, "\u6682\u65E0\u6F0F\u6D1E\u8BB0\u5F55")
        );
      }
    } else {
      for (const v of state.items) rows.push(...vulnRows(v));
    }
    const toolbar = h2(
      "div",
      { className: "rt-toolbar" },
      h2("input", {
        className: "rt-input",
        style: { flex: "1 1 140px" },
        placeholder: "\u641C\u7D22\u6807\u9898 / CVE / \u76EE\u6807\uFF08\u56DE\u8F66\uFF09",
        value: q,
        onChange: (e) => setQ(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter") setQApplied(q);
        }
      }),
      h2(
        "button",
        { className: "rt-btn", onClick: () => setQApplied(q) },
        "\u641C\u7D22"
      ),
      h2(
        "select",
        {
          className: "rt-input",
          value: sev,
          onChange: (e) => setSev(e.target.value)
        },
        h2("option", { value: "" }, "\u5168\u90E8\u7B49\u7EA7"),
        h2("option", { value: "critical" }, "\u4E25\u91CD"),
        h2("option", { value: "high" }, "\u9AD8\u5371"),
        h2("option", { value: "medium" }, "\u4E2D\u5371"),
        h2("option", { value: "low" }, "\u4F4E\u5371"),
        h2("option", { value: "info" }, "\u4FE1\u606F")
      ),
      h2(
        "select",
        {
          className: "rt-input",
          value: status,
          onChange: (e) => setStatus(e.target.value)
        },
        h2("option", { value: "" }, "\u5168\u90E8\u72B6\u6001"),
        h2("option", { value: "candidate" }, "\u5F85\u9A8C\u8BC1"),
        h2("option", { value: "confirmed" }, "\u5DF2\u786E\u8BA4"),
        !isSrc2 && h2("option", { value: "exploited" }, "\u5DF2\u5229\u7528"),
        h2("option", { value: "false-positive" }, "\u8BEF\u62A5"),
        h2("option", { value: "fixed" }, "\u5DF2\u4FEE\u590D")
      )
    );
    const credSection = h2(
      "div",
      null,
      h2(
        "div",
        { className: "rt-section" },
        "\u51ED\u636E \xB7 " + creds.length + "\uFF08\u9ED8\u8BA4\u9690\u85CF\u5B9E\u9645\u503C\uFF09"
      ),
      creds.length ? h2(
        "div",
        { style: { padding: "4px 10px 0" } },
        creds.map(
          (c) => h2(
            "div",
            { key: "c" + c.id, className: "rt-cred" },
            h2(
              "div",
              { className: "rt-cred-head" },
              h2("span", { className: "rt-cred-host" }, c.host),
              c.username ? h2("span", { className: "rt-tag" }, c.username) : null,
              h2(
                "span",
                { className: "rt-tag rt-tag-passive" },
                c.secret_type || "password"
              ),
              c.privilege ? h2(
                "span",
                { className: "rt-tag rt-tag-active" },
                c.privilege
              ) : null,
              h2("div", { className: "rt-spacer" }),
              h2(
                "button",
                {
                  className: "rt-btn",
                  style: { padding: "0 6px", fontSize: 11 },
                  disabled: !c.secret_available || copyingCredential !== null,
                  onClick: (e) => {
                    e.stopPropagation();
                    copyCredential(c);
                  }
                },
                copyingCredential === c.id ? "\u8BFB\u53D6\u4E2D\u2026" : "\u590D\u5236\u5B9E\u9645\u503C"
              )
            ),
            h2(
              "div",
              { className: "rt-secret-none" },
              (c.credential_handle || "\u2014") + " \xB7 " + (c.secret_state === "vault_unavailable" ? "\u672C\u5730\u5BC6\u94A5\u6216\u79C1\u6709\u6750\u6599\u4E0D\u53EF\u7528" : c.secret_available ? "\u5B9E\u9645\u503C\u5DF2\u4FDD\u5B58\uFF0C\u6309\u9700\u8BFB\u53D6" : "\u4EC5\u6709\u5F15\u7528\uFF0C\u672A\u4FDD\u5B58\u5B9E\u9645\u503C")
            ),
            h2(
              "div",
              { className: "rt-cred-meta" },
              [
                c.source ? "\u6765\u6E90 " + c.source : null,
                c.tool ? "\u5DE5\u5177 " + c.tool : null,
                c.secret_ref ? "\u8BC1\u636E " + c.secret_ref : null,
                c.found_by_agent ? "by " + c.found_by_agent : null,
                c.found_at ? fmt(c.found_at) : null
              ].filter(Boolean).join(" \xB7 ")
            ),
            c.note ? h2("div", { className: "rt-cred-meta" }, "\u5907\u6CE8\uFF1A" + c.note) : null
          )
        )
      ) : h2(
        "div",
        { className: "rt-empty" },
        "\u6682\u65E0\u51ED\u636E\uFF08\u62FF\u5230\u53E3\u4EE4/\u5BC6\u94A5/Hash \u540E\u7528 redteam_credential_add \u843D\u5E93\uFF0C\u79D2\u7EA7\u53EF\u590D\u7528\uFF09"
      )
    );
    const accessSection = h2(
      "div",
      null,
      h2(
        "div",
        { className: "rt-section" },
        "\u5DF2\u83B7\u5F97\u8BBF\u95EE\u4F1A\u8BDD \xB7 " + accesses.length
      ),
      accesses.length ? accesses.map(
        (a) => h2(
          "div",
          {
            key: "a" + a.id,
            className: "rt-vrow",
            style: {
              cursor: "default",
              gridTemplateColumns: "1fr 110px 80px 80px 1fr"
            }
          },
          h2("span", { className: "rt-mono" }, a.host),
          h2("span", null, a.username || "\u2014"),
          h2(
            "span",
            null,
            h2(
              "span",
              { className: "rt-tag rt-tag-active" },
              a.method || "\u2014"
            )
          ),
          h2("span", null, a.privilege || "\u2014"),
          h2(
            "span",
            { className: "rt-mono", title: a.session_ref || "" },
            a.session_ref || "\u2014"
          )
        )
      ) : h2("div", { className: "rt-empty" }, "\u6682\u65E0")
    );
    const subTabBtn = (key, label, n) => h2(
      "span",
      Object.assign(
        {
          className: "rt-subtab" + (subTab === key ? " on" : "")
        },
        clickable(() => setSubTab(key), {
          label: label + "\uFF08" + n + "\uFF09",
          expanded: subTab === key
        })
      ),
      label + " " + n
    );
    return h2(
      "div",
      { className: "rt-main" },
      toolbar,
      conclusion,
      h2(
        "div",
        { className: "rt-subtabs" },
        subTabBtn("vulns", "\u6F0F\u6D1E", state.total || 0),
        !hideRedteamCollections && subTabBtn("files", "\u653B\u51FB\u6587\u4EF6", allFiles.length),
        !isSrc2 && subTabBtn("creds", isPentest ? "\u6D4B\u8BD5\u51ED\u636E" : "\u51ED\u636E", creds.length),
        !hideRedteamCollections && subTabBtn("access", "\u8BBF\u95EE\u4F1A\u8BDD", accesses.length),
        h2("div", { className: "rt-spacer" }),
        grouped ? h2(
          "button",
          {
            className: "rt-btn",
            title: "\u5C55\u5F00\u6240\u6709\u76EE\u6807",
            onClick: () => collapse.setAll(
              (state.items || []).map((v) => "target:" + targetKeyOf(v)),
              true
            )
          },
          "\u5168\u90E8\u5C55\u5F00"
        ) : null,
        grouped ? h2(
          "button",
          {
            className: "rt-btn",
            title: "\u6536\u8D77\u6240\u6709\u76EE\u6807",
            onClick: () => collapse.setAll(
              (state.items || []).map((v) => "target:" + targetKeyOf(v)),
              false
            )
          },
          "\u5168\u90E8\u6536\u8D77"
        ) : null,
        h2(
          "button",
          {
            className: "rt-btn" + (grouped ? " rt-btn-primary" : ""),
            title: grouped ? "\u5F53\u524D\uFF1A\u6309\u76EE\u6807\u805A\u5408\uFF08\u5148\u770B\u54EA\u53F0\u88AB\u6253\u4E0B\u4EC0\u4E48\uFF09" : "\u5F53\u524D\uFF1A\u5E73\u94FA\u6BCF\u6761\u6F0F\u6D1E",
            onClick: () => setGrouped((g) => !g)
          },
          grouped ? "\u6309\u76EE\u6807\u805A\u5408" : "\u5E73\u94FA\u5217\u8868"
        )
      ),
      msg ? h2(
        "div",
        { className: msg.err ? "rt-err" : "rt-foot" },
        msg.err || msg.ok
      ) : null,
      needRestart ? h2(
        "div",
        { className: "rt-empty" },
        "\u8BE5\u6A21\u5757\u7684\u5BBF\u4E3B\u4EE3\u7801\u5DF2\u66F4\u65B0\uFF0C\u9700\u91CD\u542F\u4E00\u6B21\u5F53\u524D\u5BBF\u4E3B\uFF08\u5B98\u65B9 exe / \u793E\u533A\u7248 / dsh web\uFF09\u540E\u751F\u6548"
      ) : null,
      state.error && !needRestart ? h2("div", { className: "rt-err" }, state.error) : null,
      !hideRedteamCollections && subTab === "files" ? h2(
        "div",
        { className: "rt-body", style: { overflow: "auto" } },
        h2(
          "div",
          { className: "rt-hint", style: { marginBottom: 8 } },
          "\u653B\u51FB\u6587\u4EF6\u6309\u9776\u6807\u76EE\u5F55\u7EC4\u7EC7\uFF08\u539F\u300C\u653B\u51FB\u6587\u4EF6\u300D\u9875\u7B7E\uFF09\uFF1B\u6BCF\u6761\u6F0F\u6D1E\u7684\u5173\u8054\u6587\u4EF6\u4E5F\u80FD\u5728\u8BE5\u6F0F\u6D1E\u8BE6\u60C5\u91CC\u76F4\u63A5\u770B\u5230\u3002" + (orphanFiles.length ? " \u76EE\u524D\u6709 " + orphanFiles.length + " \u4E2A\u6587\u4EF6\u6CA1\u6302 vuln_id\uFF0C\u5EFA\u8BAE\u8865\u4E0A\u4EE5\u4FBF\u4E0E\u6F0F\u6D1E\u5BF9\u5E94\u3002" : "")
        ),
        h2(AttackFilesTab, { engagement: eng, refreshKey })
      ) : !isSrc2 && subTab === "creds" ? h2(
        "div",
        { className: "rt-body", style: { overflow: "auto" } },
        credSection
      ) : !hideRedteamCollections && subTab === "access" ? h2(
        "div",
        { className: "rt-body", style: { overflow: "auto" } },
        accessSection
      ) : h2(
        "div",
        { className: "rt-table" },
        grouped ? null : head,
        rows,
        !state.loading && !state.items.length && !state.error ? h2("div", { className: "rt-empty" }, "\u6682\u65E0\u6F0F\u6D1E\u8BB0\u5F55") : null
      )
    );
  }
  const STAGE_LABEL = {
    recon: "\u4FE1\u606F\u6536\u96C6",
    vuln: "\u6F0F\u6D1E\u53D1\u73B0",
    exploit: "\u6F0F\u6D1E\u5229\u7528",
    access: "\u83B7\u5F97\u6743\u9650",
    pivot: "\u5185\u7F51\u7A81\u7834",
    data: "\u654F\u611F\u6570\u636E",
    other: "\u5176\u4ED6"
  };
  function ChainTab(props) {
    const eng = props.engagement;
    const refreshKey = props.refreshKey || 0;
    const [data, setData] = import_react2.default.useState(null);
    const [err, setErr] = import_react2.default.useState(null);
    const [loading, setLoading] = import_react2.default.useState(false);
    const [view, setView] = import_react2.default.useState("A");
    const [openId, setOpenId] = import_react2.default.useState(null);
    const load = () => {
      if (!eng) return;
      setLoading(true);
      api({ op: "scoreChain", engagement: eng }).then(
        (r) => {
          setLoading(false);
          if (!r || r.ok === false) {
            setErr(r && r.error || "\u8BFB\u53D6\u5931\u8D25");
            return;
          }
          setErr(null);
          setData(r);
        },
        (e) => {
          setLoading(false);
          setErr(String(e && e.message || e));
        }
      );
    };
    import_react2.default.useEffect(load, [eng, refreshKey]);
    const stages = data && data.stages || [];
    const summary = data && data.summary || null;
    const toggle = (id) => setOpenId((cur) => cur === id ? null : id);
    const CIRCLED = ["\u2460", "\u2461", "\u2462", "\u2463", "\u2464", "\u2465"];
    const hitDetail = (x) => h2(
      "div",
      { className: "rt-flow-detail" },
      h2(
        "div",
        { className: "rt-kv" },
        h2("b", null, "\u76EE\u6807"),
        h2(
          "span",
          { className: "rt-mono", style: { wordBreak: "break-all" } },
          x.target || "\u2014"
        )
      ),
      x.asset_ip ? h2(
        "div",
        { className: "rt-kv" },
        h2("b", null, "\u8D44\u4EA7"),
        h2("span", { className: "rt-mono" }, x.asset_ip)
      ) : null,
      x.vuln_title ? h2(
        "div",
        { className: "rt-kv" },
        h2("b", null, "\u5229\u7528\u6F0F\u6D1E"),
        h2(
          "span",
          null,
          [x.vuln_cve, x.vuln_title].filter(Boolean).join(" ")
        )
      ) : null,
      h2(
        "div",
        { className: "rt-kv" },
        h2("b", null, "\u6B21\u6570"),
        h2(
          "span",
          null,
          "\u540C\u7C7B\u7B2C " + x.nth_of_point + " \u6B21 \xB7 +" + (x.points || 0) + " \u5206"
        )
      ),
      h2(
        "div",
        { className: "rt-kv" },
        h2("b", null, "\u8BB0\u5F55"),
        h2(
          "span",
          null,
          fmt(x.recorded_at) + (x.recorded_by ? " \xB7 " + x.recorded_by : "")
        )
      ),
      x.evidence ? h2(Clip, { label: "\u7ED3\u679C\u4E0E\u8BC1\u636E", text: x.evidence }) : null
    );
    const hitRow = (x) => h2(
      "div",
      {
        key: "h" + x.id,
        className: "rt-ap-hit" + (openId === x.id ? " open" : ""),
        role: "button",
        tabIndex: 0,
        onClick: () => toggle(x.id),
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle(x.id);
          }
        }
      },
      h2(
        "div",
        { className: "rt-ap-hit-head" },
        h2(
          "span",
          {
            className: "rt-ap-pts" + (x.counted ? "" : " uncounted"),
            title: x.capped_reason || void 0
          },
          "+" + (x.counted ? x.points || 0 : 0)
        ),
        h2("span", { className: "rt-ap-hit-name" }, x.point_name),
        x.capped ? h2(
          "span",
          {
            className: "rt-tag rt-tag-warn",
            title: x.capped_reason || "\u540C\u4E00\u8D44\u4EA7\u540C\u4E00\u7AEF\u53E3\u53EA\u7B97\u5206\u503C\u6700\u9AD8\u7684\u4E00\u6761"
          },
          "\u670D\u52A1\u5DF2\u62FF\u6EE1 \xB7 \u4E0D\u8BA1\u5206"
        ) : null,
        x.nth_of_point > 1 ? h2(
          "span",
          { className: "rt-ap-nth" },
          "\u7B2C " + x.nth_of_point + " \u6B21"
        ) : null,
        h2(
          "span",
          { className: "rt-ap-hit-target" },
          x.target || x.asset_ip || "\u2014"
        )
      ),
      x.action ? h2(
        "div",
        {
          className: "rt-ap-act" + (x.action_inferred ? " inferred" : "")
        },
        "\u52A8\u4F5C\uFF1A" + (x.action.title || "\uFF08\u672A\u547D\u540D\u6B65\u9AA4\uFF09") + (x.action_inferred ? "\uFF08\u63A8\u65AD\uFF09" : "")
      ) : null,
      openId === x.id ? hitDetail(x) : null
    );
    const assetRow = (a) => h2(
      "div",
      { key: "a" + a.id, className: "rt-ap-asset" },
      h2(
        "span",
        {
          className: "rt-scope rt-scope-" + (a.scope === "internal" ? "internal" : "external")
        },
        a.scope === "internal" ? "\u5185" : "\u5916"
      ),
      h2("span", { className: "rt-mono", style: { fontWeight: 600 } }, a.ip),
      a.segment_cidr ? h2("span", { className: "rt-ap-nth" }, a.segment_cidr) : null,
      h2("span", { className: "rt-ap-nth" }, "\u7AEF\u53E3 " + (a.open_ports || 0)),
      a.vulns ? h2("span", { className: "rt-ap-nth" }, "\u6F0F\u6D1E " + a.vulns) : null,
      a.priority ? h2("span", { className: "rt-tag" }, "\u6613\u6253 " + a.priority) : null,
      h2("div", { className: "rt-spacer" }),
      h2("span", { className: "rt-ap-pts" }, "+" + (a.points || 0) + " \u5206"),
      h2("span", { className: "rt-ap-nth" }, (a.hits || 0) + " \u6B21")
    );
    const stageA = (st, i) => {
      const isRecon = st.code === "recon";
      const body = [];
      if (isRecon) {
        body.push(
          h2(
            "div",
            { key: "at", className: "rt-ap-sub" },
            "\u62FF\u5230\u5206\u6570\u7684\u8D44\u4EA7 \xB7 " + st.assetCount + " \u53F0"
          )
        );
        body.push(
          h2(
            "div",
            { key: "al", className: "rt-ap-assets" },
            st.assets.length ? st.assets.map(assetRow) : h2("div", { className: "rt-ap-none" }, "\u8FD8\u6CA1\u6709\u4EA7\u751F\u5F97\u5206\u7684\u8D44\u4EA7")
          )
        );
      } else {
        body.push(
          h2(
            "div",
            { key: "ht", className: "rt-ap-sub" },
            "\u672C\u9636\u6BB5\u547D\u4E2D " + st.hits + " \u6B21" + (st.points ? " \xB7 +" + st.points + " \u5206" : "")
          )
        );
        body.push(
          h2(
            "div",
            { key: "hl", className: "rt-ap-hits" },
            st.items.length ? st.items.map(hitRow) : h2("div", { className: "rt-ap-none" }, "\u672C\u9636\u6BB5\u8FD8\u6CA1\u6709\u5F97\u5206")
          )
        );
        if (st.code === "boundary") {
          const selfOnly = (st.tunnels_self_only || []).length;
          body.push(
            h2(
              "div",
              { key: "tt", className: "rt-ap-sub" },
              "\u8DE8\u8D8A\u9776\u6807\u8FB9\u754C\u7684\u901A\u9053 \xB7 " + st.tunnels.length + " \u6761" + (selfOnly ? "\uFF08\u53E6\u6709 " + selfOnly + " \u6761\u53EA\u5728\u81EA\u5DF1 VPS/\u81EA\u5EFA\u670D\u52A1\u5668\u4E0A\uFF0C\u4E0D\u7B97\u7A81\u7834\uFF09" : "")
            )
          );
          if (selfOnly && st.tunnels.length === 0) {
            body.push(
              h2(
                "div",
                { key: "tw", className: "rt-ap-none" },
                "\u26A0\uFE0F \u73B0\u6709\u7684\u901A\u9053\u90FD\u5728\u81EA\u5DF1\u7684\u670D\u52A1\u5668\u4E0A\uFF0C\u6CA1\u6709\u78B0\u5230\u76EE\u6807 \u2014\u2014 \u4E0D\u8BA1\u8FB9\u754C\u7A81\u7834\u3002\u9700\u8981\u76EE\u6807\u4FA7\u53D1\u8D77\u7684\u901A\u9053\uFF08\u53CD\u5F39 shell \u5230\u6211\u8FD9 / \u76EE\u6807\u4E0A\u8DD1 frp \u5BA2\u6237\u7AEF / \u7ECF\u76EE\u6807 WebShell \u7684 suo5\uFF09\u3002"
              )
            );
          }
          body.push(
            h2(
              "div",
              { key: "tl", className: "rt-ap-tunnels" },
              st.tunnels.length ? st.tunnels.map(
                (t) => h2(
                  "div",
                  { key: "t" + t.id, className: "rt-ap-tunnel" },
                  h2(
                    "span",
                    { className: "rt-tag rt-tag-passive" },
                    t.kind || "tunnel"
                  ),
                  h2(
                    "span",
                    { className: "rt-mono", style: { fontWeight: 600 } },
                    t.listen || "\u2014"
                  ),
                  h2(
                    "span",
                    {
                      className: "rt-tag " + (t.status === "active" ? "rt-tag-live" : ""),
                      style: t.status === "active" ? {} : { opacity: 0.7 }
                    },
                    t.status === "active" ? "\u53EF\u7528" : t.status || "\u672A\u77E5"
                  ),
                  h2(
                    "span",
                    {
                      className: "rt-ap-nth",
                      style: {
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }
                    },
                    "\u53EF\u8FBE " + (t.reach || "\u2014")
                  )
                )
              ) : h2(
                "div",
                { className: "rt-ap-none" },
                "\u8FD8\u6CA1\u6709\u5EFA\u7ACB\u96A7\u9053\uFF08\u5EFA\u597D\u540E\u7528 redteam_tunnel_add \u767B\u8BB0\uFF09"
              )
            )
          );
        }
        if (st.assets.length && st.code !== "boundary") {
          body.push(
            h2(
              "div",
              { key: "at", className: "rt-ap-sub" },
              "\u6D89\u53CA\u8D44\u4EA7 \xB7 " + st.assetCount + " \u53F0"
            )
          );
          body.push(
            h2(
              "div",
              { key: "al", className: "rt-ap-assets" },
              st.assets.map(assetRow)
            )
          );
        }
      }
      return h2(
        "div",
        { key: "st" + st.code, className: "rt-ap-stage" },
        h2(
          "div",
          { className: "rt-ap-head", style: { borderLeftColor: st.color } },
          h2(
            "span",
            { className: "rt-ap-no", style: { background: st.color } },
            CIRCLED[i] || "0" + (i + 1)
          ),
          h2("span", { className: "rt-ap-name" }, st.name),
          st.subtitle ? h2("span", { className: "rt-ap-en" }, st.subtitle) : null,
          h2("div", { className: "rt-spacer" }),
          st.points > 0 ? h2(
            "span",
            {
              className: "rt-ap-pts",
              style: {
                background: st.color + "22",
                color: st.color,
                borderColor: st.color + "66"
              }
            },
            "+" + st.points
          ) : null,
          h2(
            "span",
            { className: "rt-ap-cum" },
            "\u7D2F\u8BA1 " + st.cumulative + " \u5206"
          )
        ),
        h2(
          "div",
          { className: "rt-ap-goal", style: { borderLeftColor: st.color } },
          h2(
            "span",
            {
              className: "rt-ap-goal-tag",
              style: { color: st.color, borderColor: st.color + "66" }
            },
            "\u9636\u6BB5\u76EE\u6807"
          ),
          h2("span", null, st.goal)
        ),
        h2(
          "div",
          { className: "rt-ap-result", style: { borderLeftColor: st.color } },
          body
        ),
        i < stages.length - 1 ? h2(
          "div",
          { className: "rt-ap-trans" },
          h2("span", { className: "rt-flow-arrow" }, "\u25BC"),
          st.transition ? h2("span", { className: "rt-ap-trans-t" }, st.transition) : null,
          h2(
            "span",
            { className: "rt-ap-trans-t", style: { marginLeft: "auto" } },
            "\u7D2F\u8BA1 " + st.cumulative + " \u5206"
          )
        ) : h2(
          "div",
          { className: "rt-ap-trans" },
          h2("span", { className: "rt-flow-arrow" }, "\u25BC"),
          h2(
            "span",
            { className: "rt-ap-trans-t" },
            "\u5408\u8BA1 " + (summary && summary.points || 0) + " \u5206"
          )
        )
      );
    };
    const stageB = (st, i) => h2(
      "div",
      { key: "c" + st.code, className: "rt-ap-col" },
      i > 0 ? h2("span", { className: "rt-ap-col-arrow" }, "\u25B6") : null,
      h2(
        "div",
        { className: "rt-hcol", style: { borderTopColor: st.color } },
        h2(
          "div",
          {
            className: "rt-ap-head",
            style: { borderLeftColor: st.color, padding: "5px 8px" }
          },
          h2(
            "span",
            {
              className: "rt-ap-no",
              style: {
                background: st.color,
                width: 16,
                height: 16,
                fontSize: 10
              }
            },
            String(i + 1)
          ),
          h2(
            "span",
            { className: "rt-ap-name", style: { fontSize: 12 } },
            st.name
          ),
          h2("div", { className: "rt-spacer" }),
          h2(
            "span",
            { className: "rt-ap-cum", style: { fontWeight: 700 } },
            st.cumulative
          )
        ),
        h2("div", { className: "rt-hcol-goal", title: st.goal }, st.goal),
        h2(
          "div",
          { className: "rt-hcol-body" },
          st.code === "boundary" ? h2(
            "div",
            null,
            h2(
              "div",
              { className: "rt-hcol-hit" },
              h2("span", { className: "rt-hcol-pts" }, "+" + st.points),
              h2(
                "span",
                { className: "rt-hcol-name" },
                "\u96A7\u9053 " + st.tunnels.length + " \u6761"
              )
            ),
            st.tunnels.slice(0, 3).map(
              (t) => h2(
                "div",
                { key: "t" + t.id, className: "rt-hcol-sub" },
                "\u25B8 " + (t.kind || "") + " " + (t.listen || "")
              )
            )
          ) : st.code === "recon" ? h2(
            "div",
            null,
            h2(
              "div",
              { className: "rt-hcol-hit" },
              h2("span", { className: "rt-hcol-pts" }, st.assetCount),
              h2("span", { className: "rt-hcol-name" }, "\u53F0\u8D44\u4EA7\u62FF\u5230\u5206")
            ),
            st.assets.slice(0, 6).map(
              (a) => h2(
                "div",
                {
                  key: "a" + a.id,
                  className: "rt-hcol-sub",
                  title: a.ip + "  +" + a.points + " \u5206"
                },
                (a.scope === "internal" ? "\u5185 " : "\u5916 ") + a.ip + "  +" + a.points
              )
            )
          ) : h2(
            "div",
            null,
            h2(
              "div",
              { className: "rt-hcol-hit" },
              h2("span", { className: "rt-hcol-pts" }, "+" + st.points),
              h2(
                "span",
                { className: "rt-hcol-name" },
                st.hits + " \u6B21\u547D\u4E2D"
              )
            ),
            st.items.slice(0, 6).map(
              (x) => h2(
                "div",
                {
                  key: "c" + x.id,
                  className: "rt-hcol-sub",
                  title: x.point_name + "  " + (x.target || "")
                },
                h2("span", { className: "rt-hcol-pts" }, "+" + x.points),
                h2("span", { className: "rt-hcol-name" }, x.point_name)
              )
            ),
            st.items.length > 6 ? h2(
              "div",
              { className: "rt-hcol-none" },
              "\u2026\u53E6\u6709 " + (st.items.length - 6) + " \u6B21"
            ) : null,
            st.assetCount ? h2(
              "div",
              { className: "rt-hcol-none" },
              "\u6D89\u53CA " + st.assetCount + " \u53F0\u8D44\u4EA7"
            ) : null
          )
        )
      )
    );
    return h2(
      "div",
      { className: "rt-main" },
      h2(
        "div",
        { className: "rt-toolbar" },
        h2("span", { style: { fontWeight: 600 } }, "\u653B\u51FB\u94FE"),
        h2(
          "span",
          { className: "rt-tag", style: { fontSize: 10.5 } },
          "\u4FE1\u606F\u6536\u96C6 \u2192 \u4E92\u8054\u7F51\u8D44\u4EA7\u6743\u9650 \u2192 \u8FB9\u754C\u7A81\u7834 \u2192 \u5185\u7F51\u8D44\u4EA7\u6743\u9650 \u2192 \u9776\u6807\u6743\u9650"
        ),
        summary ? h2(
          "span",
          { className: "rt-tag rt-tag-live" },
          "\u603B\u5206 " + summary.points + " \u5206"
        ) : null,
        h2("div", { className: "rt-spacer" }),
        h2(
          "button",
          {
            className: "rt-btn" + (view === "A" ? " rt-btn-primary" : ""),
            title: "\u7AD6\u5411\u653B\u51FB\u94FE\uFF1A\u9010\u9636\u6BB5\u5411\u4E0B\u770B\u7EC6\u8282",
            onClick: () => setView("A")
          },
          "\u94FE\u8DEF A"
        ),
        h2(
          "button",
          {
            className: "rt-btn" + (view === "B" ? " rt-btn-primary" : ""),
            title: "\u6A2A\u5411\u653B\u51FB\u94FE\uFF1A\u4E00\u5C4F\u770B\u5B8C\u4E94\u4E2A\u9636\u6BB5",
            onClick: () => setView("B")
          },
          "\u94FE\u8DEF B"
        ),
        h2(
          "button",
          { className: "rt-btn", disabled: loading, onClick: load },
          loading ? "\u52A0\u8F7D\u4E2D\u2026" : "\u5237\u65B0"
        )
      ),
      err ? h2("div", { className: "rt-err" }, err) : null,
      !stages.length && !err && data !== null ? h2(
        "div",
        { className: "rt-empty" },
        "\u8FD8\u6CA1\u6709\u5F97\u5206\u8BB0\u5F55\u3002\u62FF\u5230\u6210\u679C\u540E\u7528 redteam_score_hit \u8BB0\u5206\uFF0C\u8FD9\u6761\u94FE\u624D\u4F1A\u957F\u51FA\u6765\u3002"
      ) : view === "A" ? h2("div", { className: "rt-ap" }, stages.map(stageA)) : h2("div", { className: "rt-ap-h" }, stages.map(stageB))
    );
  }
  function groupByStage(reportItems, chain) {
    const byId = new Map((reportItems || []).map((x) => [x.id, x]));
    const groups = [];
    const stageList = chain && chain.stages || [];
    stageList.forEach((st, si) => {
      const items = (st.items || []).map((x) => byId.get(x.id)).filter(Boolean);
      if (items.length === 0) return;
      groups.push({
        code: st.code,
        name: st.name,
        color: st.color || "#64748b",
        ordinal: st.ordinal || si + 1,
        points: st.points || 0,
        cumulative: st.cumulative || 0,
        items
      });
    });
    const grouped = new Set(
      groups.reduce((acc, g) => acc.concat(g.items.map((x) => x.id)), [])
    );
    const rest = (reportItems || []).filter((x) => !grouped.has(x.id));
    if (rest.length > 0) {
      groups.push({
        code: "other",
        name: "\u5176\u4ED6\u5F97\u5206",
        color: "#64748b",
        ordinal: groups.length + 1,
        points: rest.reduce((n, x) => n + (x.counted ? x.points : 0), 0),
        cumulative: 0,
        items: rest
      });
    }
    return groups;
  }
  function ReportTab(props) {
    const eng = props.engagement;
    const refreshKey = props.refreshKey || 0;
    const [data, setData] = import_react2.default.useState(null);
    const [err, setErr] = import_react2.default.useState(null);
    const [busy, setBusy] = import_react2.default.useState(false);
    const [msg, setMsg] = import_react2.default.useState(null);
    const collapse = useCollapse("report:" + eng);
    const load = () => {
      if (!eng) return;
      setBusy(true);
      setMsg(null);
      api({ op: "scoreReport", engagement: eng }).then(
        (r) => {
          if (!r || r.ok === false) {
            setBusy(false);
            setErr(r && r.error || "\u751F\u6210\u5931\u8D25");
            return;
          }
          if ((!r.stages || r.stages.length === 0) && (r.items || []).length > 0) {
            api({ op: "scoreChain", engagement: eng }).then(
              (c) => {
                setBusy(false);
                setErr(null);
                setData(
                  Object.assign({}, r, { stages: groupByStage(r.items, c) })
                );
              },
              () => {
                setBusy(false);
                setErr(null);
                setData(r);
              }
            );
            return;
          }
          setBusy(false);
          setErr(null);
          setData(r);
        },
        (e) => {
          setBusy(false);
          setErr(String(e && e.message || e));
        }
      );
    };
    import_react2.default.useEffect(load, [eng, refreshKey]);
    const copy = (text, label) => copyWithFeedback(text, label, (okFlag, message) => {
      setMsg(okFlag ? { ok: message } : { err: message });
    });
    const download = (text, label) => {
      try {
        const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "report-" + String(label || "score").replace(/[^\w.\-]/g, "_") + ".md";
        a.click();
        setTimeout(() => {
          try {
            URL.revokeObjectURL(url);
          } catch {
          }
        }, 1e3);
        setMsg({ ok: "\u5DF2\u4E0B\u8F7D\uFF1A" + label });
      } catch (e) {
        setMsg({ err: "\u4E0B\u8F7D\u5931\u8D25\uFF1A" + (e && e.message || e) });
      }
    };
    const items = data && data.items || [];
    const stages = data && data.stages || [];
    const summary = data && data.summary || null;
    const mdText = data && data.markdown || "";
    const CIRCLED = [
      "\u2460",
      "\u2461",
      "\u2462",
      "\u2463",
      "\u2464",
      "\u2465",
      "\u2466",
      "\u2467",
      "\u2468",
      "\u2469",
      "\u246A",
      "\u246B",
      "\u246C",
      "\u246D",
      "\u246E",
      "\u246F",
      "\u2470",
      "\u2471",
      "\u2472",
      "\u2473"
    ];
    const card = (x) => h2(
      "div",
      { key: "r" + x.id, className: "rt-rep" },
      h2(
        "div",
        { className: "rt-rep-head" },
        h2("span", { className: "rt-rep-idx" }, String(x.seq)),
        h2("span", { className: "rt-rep-name" }, x.point_name),
        h2("span", { className: "rt-flow-pts" }, "+" + x.points + " \u5206"),
        x.nth_of_point > 1 ? h2(
          "span",
          { className: "rt-tag" },
          "\u540C\u7C7B\u7B2C " + x.nth_of_point + " \u6B21"
        ) : null,
        h2("div", { className: "rt-spacer" }),
        h2(
          "button",
          {
            className: "rt-btn",
            style: { padding: "0 6px", fontSize: 11 },
            onClick: () => copy(
              (x.requests || []).map((v) => v.request || "").filter(Boolean).join("\n\n"),
              "\u7B2C " + x.seq + " \u9879\u8BF7\u6C42"
            )
          },
          "\u590D\u5236\u8BF7\u6C42"
        )
      ),
      h2(
        "div",
        { className: "rt-rep-meta" },
        h2("span", null, h2("b", null, "\u76EE\u6807 ")),
        h2("span", { className: "rt-mono" }, x.target || x.asset_ip || "\u2014")
      ),
      x.gained ? h2(
        "div",
        { className: "rt-rep-meta" },
        h2("b", null, "\u62FF\u5230 "),
        h2("span", null, x.gained)
      ) : null,
      x.vuln ? h2(
        "div",
        { className: "rt-rep-meta" },
        h2("b", null, "\u5229\u7528\u6F0F\u6D1E "),
        h2(
          "span",
          null,
          [x.vuln.cve, x.vuln.title].filter(Boolean).join(" ")
        )
      ) : null,
      x.evidence ? h2(
        "div",
        { className: "rt-rep-meta" },
        h2("b", null, "\u7ED3\u679C "),
        h2("span", null, String(x.evidence).replace(/\n+/g, " "))
      ) : null,
      h2(
        "div",
        {
          className: "rt-rep-meta",
          "data-score-evidence": x.evidence_state || "legacy_text"
        },
        h2("b", null, "\u8BC1\u636E\u5173\u8054 "),
        h2(
          "span",
          null,
          x.evidence_state === "observed" ? "observed \u5F15\u7528" : x.evidence_state === "pending" ? "\u5F85\u8865\u6210\u679C\u5173\u8054" : "\u5386\u53F2\u6587\u5B57\u8BF4\u660E"
        ),
        (x.evidence_refs || []).length ? h2(
          "span",
          { className: "rt-mono", style: { overflowWrap: "anywhere" } },
          " \xB7 " + x.evidence_refs.join("\u3001")
        ) : null
      ),
      x.recorded_at ? h2(
        "div",
        { className: "rt-rep-meta" },
        h2("b", null, "\u53D6\u5F97\u65F6\u95F4 "),
        h2(
          "span",
          null,
          fmt(x.recorded_at) + (x.recorded_by ? "\uFF08" + (ROLE_LABEL[x.recorded_by] || x.recorded_by) + "\uFF09" : "")
        )
      ) : null,
      h2(ShotStrip, {
        eng,
        shots: x.shots,
        total: x.shot_total,
        title: "\u8BC1\u636E\u622A\u56FE"
      }),
      /* ── 复现步骤：动作记录（含实际命令与回显）+ 凭据 + 隧道 + WebShell ─────
         报告的交付价值全在这块：账号密码怎么来的、隧道怎么搭的，用户照着就能复现。 */
      h2(
        "details",
        {
          className: "rt-rep-trace",
          open: x.incomplete === true || (x.steps || []).length === 0
        },
        h2(
          "summary",
          { className: "rt-rep-trace-head", style: { cursor: "pointer" } },
          h2(
            "span",
            { className: "rt-rep-trace-title" },
            "\u590D\u73B0\u6B65\u9AA4\uFF08\u70B9\u51FB\u5C55\u5F00\uFF09"
          ),
          (x.steps || []).length ? h2(
            "span",
            { className: "rt-tag" },
            (x.steps || []).length + " \u4E2A\u52A8\u4F5C"
          ) : null,
          (x.credentials || []).length ? h2(
            "span",
            { className: "rt-tag" },
            (x.credentials || []).length + " \u6761\u51ED\u636E"
          ) : null,
          (x.tunnels || []).length ? h2(
            "span",
            { className: "rt-tag" },
            (x.tunnels || []).length + " \u6761\u96A7\u9053"
          ) : null,
          x.incomplete ? h2("span", { className: "rt-tag rt-tag-warn" }, "\u590D\u73B0\u6750\u6599\u5F85\u8865") : h2("span", { className: "rt-tag rt-tag-live" }, "\u53EF\u590D\u73B0")
        ),
        h2(
          "div",
          { style: { paddingTop: 6 } },
          x.how ? h2("div", { className: "rt-rep-trace-how" }, x.how) : null,
          (x.steps || []).length === 0 ? h2(
            "div",
            { className: "rt-rep-missing" },
            "\u26A0\uFE0F \u6CA1\u6709\u5173\u8054\u7684\u653B\u51FB\u6B65\u9AA4\uFF1A\u8BF4\u4E0D\u6E05\u8FD9\u4E00\u6B65\u662F\u600E\u4E48\u505A\u7684\u3002\u8BF7\u7528 redteam_chain_add \u8865\u4E0A\u52A8\u4F5C\uFF08title / detail / tool / result\uFF09\uFF0C\u8BB0\u5206\u65F6\u4E5F\u53EF\u4EE5\u5E26 point_code + evidence \u4E00\u6B21\u5B8C\u6210\u3002"
          ) : (x.steps || []).map(
            (s, si) => h2(
              "div",
              { key: "s" + s.id, className: "rt-rep-step" },
              h2(
                "div",
                { className: "rt-rep-step-head" },
                h2(
                  "span",
                  { className: "rt-rep-step-no" },
                  String(si + 1)
                ),
                h2(
                  "span",
                  { className: "rt-rep-step-title" },
                  s.title || "(\u672A\u547D\u540D\u52A8\u4F5C)"
                ),
                s.agent ? h2(
                  "span",
                  { className: "rt-tag" },
                  ROLE_LABEL[s.agent] || s.agent
                ) : null,
                s.stage_code ? h2("span", { className: "rt-tag" }, s.stage_code) : null,
                s.inferred ? h2("span", { className: "rt-tag" }, "\u6309\u540C\u8D44\u4EA7\u63A8\u65AD") : null,
                h2("div", { className: "rt-spacer" }),
                s.recorded_at ? h2(
                  "span",
                  {
                    style: {
                      fontSize: 11,
                      color: "var(--dsw-alias-label-secondary)"
                    }
                  },
                  fmt(s.recorded_at)
                ) : null
              ),
              s.detail ? h2("div", { className: "rt-rep-step-detail" }, s.detail) : null,
              h2(
                "div",
                { className: "rt-rep-step-cmd" },
                h2("b", null, "\u6267\u884C "),
                s.tool ? h2("span", { className: "rt-mono" }, s.tool) : h2(
                  "span",
                  {
                    style: {
                      color: "var(--dsw-alias-state-warn-primary, #f59e0b)"
                    }
                  },
                  "\u672A\u8BB0\u5F55\u5B9E\u9645\u547D\u4EE4\uFF08redteam_chain_add \u7684 tool\uFF09"
                )
              ),
              s.tool ? h2(
                "div",
                { style: { marginTop: 3 } },
                h2(
                  "button",
                  {
                    className: "rt-btn",
                    style: { padding: "0 6px", fontSize: 11 },
                    onClick: () => copy(
                      String(s.tool),
                      "\u7B2C " + (si + 1) + " \u6B65\u547D\u4EE4"
                    )
                  },
                  "\u590D\u5236\u547D\u4EE4"
                )
              ) : null,
              s.result ? h2(
                "div",
                { className: "rt-rep-step-result" },
                h2("b", null, "\u7ED3\u679C "),
                String(s.result).replace(/\n+/g, " ")
              ) : null,
              s.evidence_ref ? h2(
                "div",
                { className: "rt-rep-step-result" },
                h2("b", null, "\u8BC1\u636E "),
                h2("span", { className: "rt-mono" }, s.evidence_ref)
              ) : null
            )
          ),
          /* 账号密码怎么来的：凭据的来源 + 取得方式 */
          (x.credentials || []).length ? h2(
            "div",
            { className: "rt-rep-src" },
            h2(
              "div",
              { className: "rt-rep-src-title" },
              "\u62FF\u5230\u7684\u51ED\u636E\uFF08\u6765\u6E90\u53EF\u8FFD\u6EAF\uFF09"
            ),
            (x.credentials || []).map(
              (c) => h2(
                "div",
                { key: "c" + c.id, className: "rt-kv" },
                h2(
                  "b",
                  { className: "rt-mono", style: { minWidth: 120 } },
                  c.host || "\u2014"
                ),
                h2(
                  "span",
                  null,
                  (c.username || "(\u65E0\u7528\u6237\u540D)") + " / " + (c.secret_type || "password") + (c.privilege ? " \xB7 \u6743\u9650 " + c.privilege : "") + " \xB7 \u6765\u6E90 " + (c.source || "\u672A\u6807\u6CE8") + (c.tool ? " \xB7 \u53D6\u5F97\u65B9\u5F0F " + String(c.tool).replace(/\n+/g, " ").slice(0, 160) : "")
                )
              )
            )
          ) : null,
          /* 隧道怎么搭的 */
          (x.tunnels || []).length ? h2(
            "div",
            { className: "rt-rep-src" },
            h2(
              "div",
              { className: "rt-rep-src-title" },
              "\u7528\u5230\u7684\u96A7\u9053 / \u901A\u9053"
            ),
            (x.tunnels || []).map(
              (t) => h2(
                "div",
                { key: "t" + t.id, className: "rt-kv" },
                h2(
                  "b",
                  { className: "rt-mono", style: { minWidth: 120 } },
                  (t.kind || "socks5") + " " + (t.listen || "")
                ),
                h2(
                  "span",
                  null,
                  "\u5165\u53E3 " + (t.entry || "\u672A\u767B\u8BB0") + (t.reach ? " \xB7 \u53EF\u8FBE " + t.reach : "") + " \xB7 \u76EE\u6807\u4FA7 " + (t.entry_kind || "\u672A\u58F0\u660E") + (t.legit === false ? " \xB7 \u26A0\uFE0F \u4E0D\u7B97\u8DE8\u8D8A\u9776\u6807\u8FB9\u754C" : "") + (t.status ? " \xB7 " + t.status : "") + (t.command ? " \xB7 \u547D\u4EE4 " + String(t.command).replace(/\n+/g, " ").slice(0, 160) : "")
                )
              )
            )
          ) : null,
          (x.webshells || []).length ? h2(
            "div",
            { className: "rt-rep-src" },
            h2(
              "div",
              { className: "rt-rep-src-title" },
              "\u7528\u5230\u7684 WebShell"
            ),
            (x.webshells || []).map(
              (w) => h2(
                "div",
                { key: "w" + w.id, className: "rt-kv" },
                h2(
                  "b",
                  { className: "rt-mono", style: { minWidth: 120 } },
                  w.shell_type || "shell"
                ),
                h2(
                  "span",
                  null,
                  (w.url || "") + (w.pass_key ? " \xB7 \u53E3\u4EE4/\u5BC6\u94A5 " + w.pass_key : "") + (w.privilege ? " \xB7 \u6743\u9650 " + w.privilege : "") + (w.status ? " \xB7 " + w.status : "")
                )
              )
            )
          ) : null,
          (x.gaps || []).length ? h2(
            "div",
            { className: "rt-rep-missing" },
            "\u26A0\uFE0F \u590D\u73B0\u7F3A\u53E3\uFF1A" + x.gaps.join("\uFF1B")
          ) : null
        ),
        (x.requests || []).length === 0 ? h2(
          "div",
          { className: "rt-rep-missing" },
          "\u26A0\uFE0F \u8FD9\u4E00\u9879\u6CA1\u6709\u539F\u59CB\u8BF7\u6C42\u8BB0\u5F55\uFF0C\u65E0\u6CD5\u76F4\u63A5\u590D\u73B0 \u2014\u2014 \u8BF7\u7528 redteam_http_evidence_add \u8865\u4E0A"
        ) : (x.requests || []).map(
          (r, ri) => h2(
            "div",
            { key: "q" + ri, className: "rt-rep-req" },
            h2(
              "div",
              { className: "rt-rep-req-head" },
              h2(
                "span",
                null,
                "\u590D\u73B0\u8BF7\u6C42 " + (ri + 1) + (r.source === "auto" ? "\uFF08\u6309\u76EE\u6807\u8DEF\u5F84\u81EA\u52A8\u5339\u914D\uFF0C\u8BF7\u6838\u5BF9\uFF09" : "")
              ),
              h2(
                "span",
                { className: "rt-tag" },
                (r.method || "GET") + " " + (r.status === null || r.status === void 0 ? "" : r.status)
              ),
              h2("div", { className: "rt-spacer" }),
              h2(
                "button",
                {
                  className: "rt-btn",
                  style: { padding: "0 6px", fontSize: 11 },
                  onClick: () => copy(String(r.request || ""), "\u8BF7\u6C42 " + (ri + 1))
                },
                "\u590D\u5236\u5230 Yakit"
              )
            ),
            h2(
              "pre",
              { className: "rt-rep-http" },
              r.request || (r.method || "GET") + " " + (r.url || "") + " HTTP/1.1"
            ),
            r.response ? h2(
              "div",
              null,
              h2(
                "div",
                { className: "rt-rep-req-head" },
                h2("span", null, "\u54CD\u5E94\u6458\u8981")
              ),
              h2(
                "pre",
                {
                  className: "rt-rep-http",
                  style: { maxHeight: 160 }
                },
                String(r.response).slice(0, 1600)
              )
            ) : null
          )
        ),
        x.note ? h2(
          "div",
          { className: "rt-rep-meta" },
          h2("b", null, "\u5907\u6CE8 "),
          h2("span", null, x.note)
        ) : null
      )
    );
    return h2(
      "div",
      { className: "rt-main" },
      h2(
        "div",
        { className: "rt-toolbar" },
        h2("span", { style: { fontWeight: 600 } }, "\u653B\u51FB\u5F97\u5206\u94FE\u8DEF\u590D\u73B0\u62A5\u544A"),
        summary ? h2(
          "span",
          { className: "rt-tag rt-tag-live" },
          "\u5408\u8BA1 " + summary.points + " \u5206"
        ) : null,
        summary ? h2("span", { className: "rt-tag" }, summary.count + " \u9879\u5F97\u5206") : null,
        summary ? h2(
          "span",
          {
            className: "rt-tag" + (summary.missingRequests ? "" : " rt-tag-live")
          },
          summary.withRequests + "/" + summary.count + " \u9879\u5E26\u539F\u59CB\u8BF7\u6C42"
        ) : null,
        summary ? h2(
          "span",
          {
            className: "rt-tag" + (summary.incomplete ? " rt-tag-warn" : " rt-tag-live"),
            title: "\u590D\u73B0\u94FE\u662F\u5426\u5B8C\u6574\uFF1A\u6709\u653B\u51FB\u6B65\u9AA4\u3001\u5199\u4E86\u5B9E\u9645\u547D\u4EE4\u3001\u5173\u8054\u4E86\u6F0F\u6D1E/\u51ED\u636E/\u96A7\u9053"
          },
          "\u53EF\u590D\u73B0 " + (summary.count - (summary.incomplete || 0)) + "/" + summary.count
        ) : null,
        summary && summary.serviceCappedExcluded ? h2(
          "span",
          {
            className: "rt-tag rt-tag-warn",
            title: (summary.serviceCapped || []).map((x) => (x.service || "") + "\uFF5C" + (x.point_name || "")).join("\n") || "\u540C\u4E00\u8D44\u4EA7\u540C\u4E00\u7AEF\u53E3\u7684\u91CD\u590D\u8D26\u53F7/\u6570\u636E\u5E93\u6743\u9650\u547D\u4E2D\uFF1A\u670D\u52A1\u5DF2\u62FF\u6EE1\uFF0C\u4E0D\u8BA1\u5206\u3001\u4E0D\u8FDB\u62A5\u544A"
          },
          "\u540C\u670D\u52A1\u5DF2\u62FF\u6EE1\u4E0D\u8BA1\u5206 " + summary.serviceCappedExcluded
        ) : null,
        h2("div", { className: "rt-spacer" }),
        h2(
          "button",
          {
            className: "rt-btn",
            disabled: busy || !mdText,
            onClick: () => copy(mdText, "\u6574\u4EFD\u62A5\u544A")
          },
          "\u590D\u5236\u5168\u6587"
        ),
        h2(
          "button",
          {
            className: "rt-btn",
            disabled: busy || !mdText,
            onClick: () => download(mdText, data && data.target || eng)
          },
          "\u4E0B\u8F7D .md"
        ),
        h2(
          "button",
          { className: "rt-btn", disabled: busy, onClick: load },
          busy ? "\u751F\u6210\u4E2D\u2026" : "\u91CD\u65B0\u751F\u6210"
        )
      ),
      msg ? h2(
        "div",
        { className: msg.err ? "rt-err" : "rt-foot" },
        msg.err || msg.ok
      ) : null,
      err ? h2("div", { className: "rt-err" }, err) : null,
      h2(
        "div",
        { className: "rt-body", style: { overflow: "auto" } },
        stages.length ? h2(
          "div",
          { className: "rt-rep-list" },
          h2(
            "div",
            { className: "rt-rep-tools" },
            h2(
              "button",
              {
                className: "rt-btn",
                onClick: () => collapse.setAll(
                  stages.map((s) => "st:" + s.code),
                  true
                )
              },
              "\u5168\u90E8\u5C55\u5F00"
            ),
            h2(
              "button",
              {
                className: "rt-btn",
                onClick: () => collapse.setAll(
                  stages.map((s) => "st:" + s.code),
                  false
                )
              },
              "\u5168\u90E8\u6298\u53E0"
            )
          ),
          stages.map((st) => {
            const open = collapse.isOpen("st:" + st.code, true);
            const toggle = collapse.toggle("st:" + st.code, true);
            return h2(
              "div",
              { key: "g" + st.code, className: "rt-rep-group" },
              h2(
                "div",
                {
                  className: "rt-rep-stage",
                  role: "button",
                  tabIndex: 0,
                  style: { borderLeftColor: st.color },
                  "aria-expanded": open ? "true" : "false",
                  onClick: toggle,
                  onKeyDown: (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggle(e);
                    }
                  }
                },
                h2("span", { className: "rt-sec-caret" }, open ? "\u25BE" : "\u25B8"),
                h2(
                  "span",
                  {
                    className: "rt-rep-no",
                    style: { background: st.color }
                  },
                  CIRCLED[st.ordinal - 1] || st.ordinal
                ),
                h2("span", { className: "rt-rep-stage-name" }, st.name),
                h2(
                  "span",
                  { className: "rt-rep-stage-n" },
                  st.items.length + " \u9879"
                ),
                h2("div", { className: "rt-spacer" }),
                h2(
                  "span",
                  {
                    className: "rt-rep-pts",
                    style: {
                      background: st.color + "22",
                      color: st.color,
                      borderColor: st.color + "66"
                    }
                  },
                  "+" + st.points + " \u5206"
                ),
                h2(
                  "span",
                  { className: "rt-ap-cum" },
                  "\u7D2F\u8BA1 " + st.cumulative + " \u5206"
                )
              ),
              open ? h2("div", { className: "rt-rep-body" }, st.items.map(card)) : null
            );
          })
        ) : data === null ? h2("div", { className: "rt-empty" }, "\u52A0\u8F7D\u4E2D\u2026") : h2(
          "div",
          { className: "rt-empty" },
          h2("div", null, "\u8FD8\u6CA1\u6709\u53EF\u4EA4\u4ED8\u7684\u6210\u679C\u3002"),
          h2(
            "div",
            { style: { marginTop: 6, fontSize: 12 } },
            '\u672C\u62A5\u544A\u53EA\u6536\u5F55"\u62FF\u5230\u4E86\u5206"\u7684\u6210\u679C\uFF1B\u6CA1\u6709\u5F97\u5206\u7684\u6F0F\u6D1E\u4E0D\u8FDB\u62A5\u544A\u3002\u62FF\u5230\u6210\u679C\u540E\u7528 redteam_score_hit \u8BB0\u5206\uFF08\u76EE\u6807\u8D44\u4EA7 + \u62FF\u5230\u7684\u4E1C\u897F\uFF09\uFF0C\u5E76\u8865 redteam_http_evidence_add \u4EE5\u4FBF\u590D\u73B0\u3002'
          )
        )
      ),
      h2(
        "div",
        { className: "rt-foot" },
        h2(
          "span",
          null,
          "\u53E3\u5F84\uFF1A\u53EA\u6536\u5F55\u5F97\u5206\u6210\u679C\uFF0C\u6BCF\u6761\u9644\u5E26\u53EF\u7C98\u8FDB Yakit Repeater \u7684\u539F\u59CB\u8BF7\u6C42"
        )
      )
    );
  }
  const FILE_KIND = {
    poc: "POC",
    exp: "EXP",
    script: "\u811A\u672C",
    wordlist: "\u5B57\u5178",
    other: "\u5176\u4ED6"
  };
  function AttackFilesTab(props) {
    const eng = props.engagement;
    const refreshKey = props.refreshKey || 0;
    const [folders, setFolders] = import_react2.default.useState([]);
    const [err, setErr] = import_react2.default.useState(null);
    const [busy, setBusy] = import_react2.default.useState(false);
    const collapse = useCollapse("files:" + eng);
    const [detail, setDetail] = import_react2.default.useState(null);
    const load = () => {
      if (!eng) return;
      setBusy(true);
      api({ op: "attackFiles", engagement: eng }).then(
        (r) => {
          setBusy(false);
          if (!r || r.ok === false) {
            setErr(r && r.error || "\u8BFB\u53D6\u5931\u8D25");
            return;
          }
          setErr(null);
          setFolders(r.items || []);
        },
        (e) => {
          setBusy(false);
          setErr(String(e && e.message || e));
        }
      );
    };
    import_react2.default.useEffect(load, [eng, refreshKey]);
    const openFile = (f) => {
      if (detail && detail.id === f.id) {
        setDetail(null);
        return;
      }
      setDetail(null);
      api({ op: "readAttackFile", engagement: eng, id: f.id }).then(
        (r) => {
          if (r && r.ok) setDetail(r);
          else setErr(r && r.error || "\u8BFB\u53D6\u5931\u8D25");
        },
        (e) => setErr(String(e && e.message || e))
      );
    };
    const rows = [];
    for (const folder of folders) {
      const fKey = "folder:" + folder.folder;
      const fileNodes = [];
      for (const f of folder.files) {
        fileNodes.push(
          h2(
            "div",
            {
              key: "a" + f.id,
              className: "rt-vrow",
              style: {
                gridTemplateColumns: "18px 1.2fr 60px 1.6fr",
                cursor: "pointer"
              },
              role: "button",
              tabIndex: 0,
              onClick: () => openFile(f),
              onKeyDown: (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openFile(f);
                }
              }
            },
            h2(
              "span",
              { className: "rt-sec-caret" },
              detail && detail.id === f.id ? "\u25BE" : "\u25B8"
            ),
            h2("span", { className: "rt-mono" }, f.name),
            h2(
              "span",
              null,
              h2(
                "span",
                { className: "rt-tag rt-tag-active" },
                FILE_KIND[f.kind] || f.kind || "\u2014"
              )
            ),
            h2(
              "span",
              {
                style: {
                  fontSize: 11.5,
                  color: "var(--dsw-alias-label-secondary)"
                },
                title: f.description || ""
              },
              f.description || "\u2014"
            )
          )
        );
        if (!detail || detail.id !== f.id) continue;
        fileNodes.push(
          h2(
            "div",
            {
              key: "ad" + f.id,
              className: "rt-vrow",
              style: { cursor: "default", gridTemplateColumns: "1fr" }
            },
            h2(
              "div",
              { className: "rt-vdetail" },
              h2(
                "div",
                { className: "rt-kv" },
                h2("b", null, "\u6548\u679C"),
                h2("span", null, detail.evidence || "\u2014")
              ),
              h2(
                "div",
                { className: "rt-kv" },
                h2("b", null, "\u8DEF\u5F84"),
                h2(
                  "span",
                  { className: "rt-mono", style: { wordBreak: "break-all" } },
                  detail.path
                )
              ),
              h2(
                "div",
                { className: "rt-kv" },
                h2("b", null, "\u8BB0\u5F55"),
                h2(
                  "span",
                  null,
                  fmt(detail.created_at) + (detail.created_by ? " \xB7 " + detail.created_by : "")
                )
              ),
              h2(
                "pre",
                {
                  className: "rt-md",
                  style: {
                    border: "1px solid var(--dsw-alias-border-l1)",
                    borderRadius: 6,
                    maxHeight: "40vh",
                    padding: "10px 12px"
                  }
                },
                detail.content || "\uFF08\u7A7A\uFF09"
              )
            )
          )
        );
      }
      rows.push(
        h2(
          Section,
          {
            key: "sec:" + folder.folder,
            tone: "folder",
            title: folder.folder + "/",
            count: folder.count + " \u4E2A\u6587\u4EF6",
            open: collapse.isOpen(fKey, true),
            onToggle: collapse.toggle(fKey, true)
          },
          fileNodes.length ? fileNodes : h2("div", { className: "rt-atest-meta" }, "\uFF08\u7A7A\uFF09")
        )
      );
    }
    const total = folders.reduce((n, f) => n + f.count, 0);
    return h2(
      "div",
      { className: "rt-main" },
      h2(
        "div",
        { className: "rt-toolbar" },
        h2("span", { style: { fontWeight: 600 } }, "\u653B\u51FB\u6587\u4EF6"),
        h2(
          "span",
          { className: "rt-tag" },
          folders.length + " \u4E2A\u76EE\u6807 / " + total + " \u4E2A\u6587\u4EF6"
        ),
        h2("div", { className: "rt-spacer" }),
        h2(
          "button",
          { className: "rt-btn", disabled: busy, onClick: load },
          busy ? "\u5237\u65B0\u4E2D\u2026" : "\u5237\u65B0"
        )
      ),
      err ? h2("div", { className: "rt-err" }, err) : null,
      h2(
        "div",
        { className: "rt-table" },
        rows,
        !folders.length ? h2(
          "div",
          { className: "rt-empty" },
          "\u6682\u65E0\u653B\u51FB\u6587\u4EF6\uFF08\u6253\u901A\u7684\u811A\u672C/POC/EXP \u4F1A\u6309\u76EE\u6807\u6587\u4EF6\u5939\u51FA\u73B0\u5728\u8FD9\u91CC\uFF09"
        ) : null
      ),
      h2(
        "div",
        { className: "rt-foot" },
        h2(
          "span",
          null,
          "\u76EE\u5F55\uFF1Aattack-files/<IP|URL\u4E3B\u673A|C\u6BB5>/ \uFF5C \u53EA\u6536\u5F55\u5B9E\u9645\u751F\u6548\u7684\u6587\u4EF6"
        )
      )
    );
  }
  const POC_KIND_LABEL = {
    poc: "POC",
    exp: "EXP",
    script: "\u811A\u672C",
    template: "\u6A21\u677F",
    payload: "\u8F7D\u8377"
  };
  const POC_SOURCE_LABEL = {
    web: "\u4E92\u8054\u7F51",
    self: "\u624B\u6413",
    manual: "\u4EBA\u5DE5",
    "nuclei-template": "nuclei \u6A21\u677F",
    kb: "\u77E5\u8BC6\u5E93"
  };
  function KnowledgeTab(props) {
    const refreshKey = props.refreshKey || 0;
    const [data, setData] = import_react2.default.useState(null);
    const [err, setErr] = import_react2.default.useState(null);
    const [busy, setBusy] = import_react2.default.useState(false);
    const [msg, setMsg] = import_react2.default.useState(null);
    const [q, setQ] = import_react2.default.useState("");
    const [kind, setKind] = import_react2.default.useState("");
    const [category, setCategory] = import_react2.default.useState("");
    const [engagement, setEngagement] = import_react2.default.useState("");
    const [assetTarget, setAssetTarget] = import_react2.default.useState("");
    const [grouped, setGrouped] = import_react2.default.useState(true);
    const [verifiedOnly, setVerifiedOnly] = import_react2.default.useState(false);
    const [openId, setOpenId] = import_react2.default.useState(null);
    const [detail, setDetail] = import_react2.default.useState(null);
    const [detailBusy, setDetailBusy] = import_react2.default.useState(false);
    const [tplOffset, setTplOffset] = import_react2.default.useState(0);
    const tplPageSize = 40;
    const query = (over) => {
      const extra = over || {};
      const offset = Object.prototype.hasOwnProperty.call(
        extra,
        "templateOffset"
      ) ? extra.templateOffset : 0;
      setTplOffset(offset);
      const params = Object.assign(
        {
          q: q.trim() || void 0,
          kind: kind || void 0,
          category: category || void 0,
          engagement: engagement || void 0,
          asset_target: assetTarget.trim() || void 0,
          verified: verifiedOnly || void 0,
          templateOffset: offset || 0,
          templateLimit: tplPageSize
        },
        extra
      );
      setBusy(true);
      setMsg(null);
      api(Object.assign({ op: "pocSearch" }, params)).then(
        (r) => {
          setBusy(false);
          if (!r || r.ok === false) {
            setErr(r && r.error || "\u8BFB\u53D6\u5931\u8D25");
            return;
          }
          setErr(null);
          setData(r);
        },
        (e) => {
          setBusy(false);
          setErr(String(e && e.message || e));
        }
      );
    };
    import_react2.default.useEffect(() => {
      query({
        q: void 0,
        kind: void 0,
        category: void 0,
        engagement: void 0,
        asset_target: void 0,
        verified: void 0
      });
    }, [refreshKey]);
    const open = (id) => {
      if (openId === id) {
        setOpenId(null);
        setDetail(null);
        return;
      }
      setOpenId(id);
      setDetail(null);
      setDetailBusy(true);
      api({ op: "pocGet", id }).then(
        (r) => {
          setDetailBusy(false);
          if (!r || r.ok === false) {
            setMsg({ err: r && r.error || "\u8BFB\u53D6\u5931\u8D25" });
            return;
          }
          setDetail(r);
        },
        (e) => {
          setDetailBusy(false);
          setMsg({ err: String(e && e.message || e) });
        }
      );
    };
    const copy = (text, label) => copyWithFeedback(text, label, (okFlag, message) => {
      setMsg(okFlag ? { ok: message } : { err: message });
    });
    const useIt = (row) => {
      api({ op: "pocUse", id: row.id, used_on: "\u63A7\u5236\u53F0\u624B\u52A8\u6807\u8BB0" }).then(
        () => {
          setMsg({ ok: "\u5DF2\u8BB0\u4E00\u6B21\u590D\u7528\uFF1A" + row.title });
          query();
        },
        (e) => setMsg({ err: String(e && e.message || e) })
      );
    };
    const stats2 = data && data.stats || {
      total: 0,
      verified: 0,
      reused: 0,
      byKind: [],
      bySource: []
    };
    const items = data && data.items || [];
    const tpl = data && data.templates || {
      dir: null,
      total: 0,
      matched: 0,
      offset: 0,
      items: [],
      byCategory: []
    };
    const tplByCat = new Map(
      (tpl.byCategory || []).map((c) => [c.code, c.n || 0])
    );
    const catShown = (c) => (c.n || 0) + (tplByCat.get(c.code) || 0);
    const tplItems = tpl.items || [];
    const tplMatched = tpl.matched != null ? tpl.matched : tpl.total;
    const tplStart = Number(tpl.offset) || 0;
    const turnTpl = (next) => {
      const offset = Math.max(0, next);
      setTplOffset(offset);
      query({ templateOffset: offset });
    };
    const card = (x) => {
      const isOpen = openId === x.id;
      const d = isOpen && detail && detail.id === x.id ? detail : null;
      return h2(
        "div",
        { key: "p" + x.id, className: "rt-kb" + (isOpen ? " open" : "") },
        h2(
          "div",
          {
            className: "rt-kb-head",
            role: "button",
            tabIndex: 0,
            "aria-expanded": isOpen ? "true" : "false",
            onClick: () => open(x.id),
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                open(x.id);
              }
            }
          },
          h2("span", { className: "rt-sec-caret" }, isOpen ? "\u25BE" : "\u25B8"),
          h2(
            "span",
            { className: "rt-kb-kind k-" + (x.kind || "poc") },
            POC_KIND_LABEL[x.kind] || x.kind || "POC"
          ),
          h2("span", { className: "rt-kb-title" }, x.title),
          x.cve ? h2("span", { className: "rt-tag rt-tag-passive" }, x.cve) : null,
          x.component ? h2("span", { className: "rt-tag" }, x.component) : null,
          x.verified === 1 ? h2("span", { className: "rt-tag rt-tag-live" }, "\u5DF2\u9A8C\u8BC1") : h2("span", { className: "rt-tag rt-tag-warn" }, "\u672A\u9A8C\u8BC1"),
          h2("div", { className: "rt-spacer" }),
          h2(
            "span",
            { className: "rt-tag" },
            POC_SOURCE_LABEL[x.source] || x.source || "\u2014"
          ),
          x.hit_count ? h2("span", { className: "rt-tag" }, "\u590D\u7528 " + x.hit_count) : null
        ),
        /* 来源行：归类 · 影响版本 · 建立时间 · 来源靶标 · 发现资产 —— 一条知识"什么时候、
             在哪个单位的哪台资产上发现的"一眼可见 */
        h2(
          "div",
          { className: "rt-kb-sub" },
          [
            x.category ? "\u5F52\u7C7B " + (POC_CAT_NAME[x.category] || x.category) : null,
            x.versions ? "\u5F71\u54CD\u7248\u672C " + x.versions : null,
            x.language || null,
            x.tags || null,
            "\u5EFA\u7ACB\u65F6\u95F4 " + fmt(x.created_at),
            x.engagement_name || x.engagement_id ? "\u6765\u6E90\u9776\u6807 " + (x.engagement_name || x.engagement_id) : null,
            x.asset_target ? "\u53D1\u73B0\u8D44\u4EA7 " + x.asset_target : null,
            x.found_by_agent ? "\u53D1\u73B0\u89D2\u8272 " + (ROLE_LABEL[x.found_by_agent] || x.found_by_agent) : null,
            x.source_url ? "\u6765\u6E90 " + x.source_url : null
          ].filter(Boolean).join(" \xB7 ")
        ),
        isOpen ? h2(
          "div",
          { className: "rt-kb-body" },
          detailBusy && !d ? h2("div", { className: "rt-empty" }, "\u8BFB\u53D6\u4E2D\u2026") : null,
          d ? h2(
            "div",
            null,
            d.usage ? h2(
              "div",
              { className: "rt-kv" },
              h2("b", null, "\u7528\u6CD5"),
              h2("span", { className: "rt-mono" }, d.usage)
            ) : null,
            d.description ? h2(
              "div",
              { className: "rt-kv" },
              h2("b", null, "\u8BF4\u660E"),
              h2("span", null, d.description)
            ) : null,
            d.verified_note ? h2(
              "div",
              { className: "rt-kv" },
              h2("b", null, "\u9A8C\u8BC1\u8BC1\u636E"),
              h2("span", null, d.verified_note)
            ) : null,
            d.used_on ? h2(
              "div",
              { className: "rt-kv" },
              h2("b", null, "\u6700\u8FD1\u4F7F\u7528"),
              h2("span", null, d.used_on)
            ) : null,
            d.path ? h2(
              "div",
              { className: "rt-kv" },
              h2("b", null, "\u843D\u76D8"),
              h2("span", { className: "rt-mono" }, d.path)
            ) : null,
            h2(
              "div",
              { className: "rt-kb-actions" },
              h2(
                "button",
                {
                  className: "rt-btn",
                  disabled: !d.content,
                  onClick: () => copy(d.content || "", "POC \u6B63\u6587")
                },
                "\u590D\u5236\u6B63\u6587"
              ),
              h2(
                "button",
                { className: "rt-btn", onClick: () => useIt(x) },
                "\u8BB0\u4E00\u6B21\u590D\u7528"
              ),
              d.source_url ? h2(
                "button",
                {
                  className: "rt-btn",
                  onClick: () => copy(d.source_url, "\u6765\u6E90\u94FE\u63A5")
                },
                "\u590D\u5236\u6765\u6E90"
              ) : null
            ),
            d.content ? h2(
              "pre",
              { className: "rt-rep-http" },
              d.content.length > 12e3 ? d.content.slice(0, 12e3) + "\n\u2026\uFF08\u5DF2\u622A\u65AD\uFF0C\u5B8C\u6574\u5185\u5BB9\u89C1\u843D\u76D8\u6587\u4EF6\uFF09" : d.content
            ) : h2(
              "div",
              { className: "rt-empty" },
              "\u8FD9\u6761\u53EA\u6709\u5143\u6570\u636E\uFF0C\u6CA1\u6709\u6B63\u6587 \u2014\u2014 \u62FF\u5230\u6B63\u6587\u540E\u7528 redteam_poc_update \u8865\u4E0A"
            )
          ) : null
        ) : null
      );
    };
    return h2(
      "div",
      { className: "rt-main" },
      h2(
        "div",
        { className: "rt-toolbar" },
        h2("span", { style: { fontWeight: 600 } }, "\u77E5\u8BC6\u5E93 \xB7 POC / EXP"),
        h2("span", { className: "rt-tag" }, stats2.total + " \u6761"),
        h2(
          "span",
          { className: "rt-tag rt-tag-live" },
          "\u5DF2\u9A8C\u8BC1 " + stats2.verified
        ),
        h2("span", { className: "rt-tag" }, "\u7D2F\u8BA1\u590D\u7528 " + (stats2.reused || 0)),
        (stats2.uncategorized || 0) > 0 && (stats2.uncategorized || 0) !== stats2.total ? h2(
          "span",
          {
            className: "rt-tag rt-tag-warn",
            title: "\u8FD9\u4E9B\u6761\u76EE\u8FD8\u6CA1\u5F52\u7C7B\uFF1A\u667A\u80FD\u4F53\u56DE\u586B\u65F6\u7528 redteam_poc_add \u7684 category \u53C2\u6570\u6807\u4E00\u4E0B"
          },
          "\u672A\u5F52\u7C7B " + stats2.uncategorized
        ) : null,
        tpl.total ? h2(
          "span",
          { className: "rt-tag rt-tag-passive" },
          "\u672C\u673A\u6A21\u677F " + tpl.total
        ) : null,
        h2("div", { className: "rt-spacer" }),
        h2(
          "button",
          {
            className: "rt-btn" + (grouped ? " rt-btn-primary" : ""),
            title: "\u6309\u5F52\u7C7B\u5206\u7EC4\u663E\u793A / \u5E73\u94FA\u663E\u793A",
            onClick: () => setGrouped(!grouped)
          },
          grouped ? "\u6309\u5F52\u7C7B\u5206\u7EC4" : "\u5E73\u94FA\u663E\u793A"
        ),
        h2(
          "button",
          { className: "rt-btn", disabled: busy, onClick: () => query() },
          busy ? "\u68C0\u7D22\u4E2D\u2026" : "\u5237\u65B0"
        )
      ),
      /* 归类总览：点一下就是按该类筛选，一眼看清"哪类武器攒了多少、哪类还是空的" */
      h2(
        "div",
        { className: "rt-kb-cats" },
        (stats2.byCategory || []).filter((c) => catShown(c) > 0 || POC_CAT_ORDER.includes(c.code)).map(
          (c) => h2(
            "span",
            {
              key: c.code,
              className: "rt-concl-i" + (category === c.code ? " on" : ""),
              title: (c.hint || POC_CAT_NAME[c.code] || c.code) + " \xB7 \u672C\u673A\u6A21\u677F " + (tplByCat.get(c.code) || 0) + " \xB7 \u77E5\u8BC6\u5E93 " + (c.n || 0) + (c.verified ? "\uFF08\u5DF2\u9A8C\u8BC1 " + c.verified + "\uFF09" : ""),
              onClick: () => {
                const next = category === c.code ? "" : c.code;
                setCategory(next);
                query({ category: next || void 0 });
              }
            },
            h2("b", null, String(catShown(c))),
            h2(
              "span",
              null,
              (POC_CAT_NAME[c.code] || c.code) + (c.verified ? "\uFF08\u5DF2\u9A8C\u8BC1 " + c.verified + "\uFF09" : "")
            )
          )
        )
      ),
      h2(
        "div",
        { className: "rt-kb-filter" },
        h2("input", {
          className: "rt-input",
          style: { flex: 1, minWidth: 140 },
          placeholder: "\u641C CVE / \u7EC4\u4EF6 / \u5173\u952E\u5B57\uFF08\u6B63\u6587\u4E5F\u4F1A\u641C\uFF09",
          value: q,
          onChange: (e) => setQ(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter") query();
          }
        }),
        h2(
          "select",
          {
            className: "rt-input",
            style: { maxWidth: 120 },
            value: category,
            onChange: (e) => {
              setCategory(e.target.value);
              query({ category: e.target.value || void 0 });
            }
          },
          h2("option", { value: "" }, "\u5168\u90E8\u5F52\u7C7B"),
          POC_CAT_ORDER.map(
            (k) => h2("option", { key: k, value: k }, POC_CAT_NAME[k])
          )
        ),
        h2(
          "select",
          {
            className: "rt-input",
            style: { maxWidth: 120 },
            value: engagement,
            onChange: (e) => {
              setEngagement(e.target.value);
              query({ engagement: e.target.value || void 0 });
            }
          },
          h2("option", { value: "" }, "\u5168\u90E8\u6765\u6E90\u9776\u6807"),
          (stats2.byEngagement || []).map(
            (e) => h2(
              "option",
              { key: e.engagement, value: e.engagement },
              e.engagement + "\uFF08" + e.n + "\uFF09"
            )
          )
        ),
        h2("input", {
          className: "rt-input",
          style: { width: 120 },
          placeholder: "\u53D1\u73B0\u8D44\u4EA7\u7B5B\u9009",
          value: assetTarget,
          onChange: (e) => setAssetTarget(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter") query();
          }
        }),
        h2(
          "select",
          {
            className: "rt-input",
            style: { maxWidth: 110 },
            value: kind,
            onChange: (e) => {
              setKind(e.target.value);
              query({ kind: e.target.value || void 0 });
            }
          },
          h2("option", { value: "" }, "\u5168\u90E8\u7C7B\u578B"),
          Object.keys(POC_KIND_LABEL).map(
            (k) => h2("option", { key: k, value: k }, POC_KIND_LABEL[k])
          )
        ),
        h2(
          "label",
          { className: "rt-kb-check" },
          h2("input", {
            type: "checkbox",
            checked: verifiedOnly,
            onChange: (e) => {
              setVerifiedOnly(e.target.checked);
              query({ verified: e.target.checked || void 0 });
            }
          }),
          "\u53EA\u770B\u5DF2\u9A8C\u8BC1"
        ),
        h2(
          "button",
          { className: "rt-btn rt-btn-primary", onClick: () => query() },
          "\u68C0\u7D22"
        )
      ),
      msg ? h2(
        "div",
        { className: msg.err ? "rt-err" : "rt-foot" },
        msg.err || msg.ok
      ) : null,
      err ? h2(
        "div",
        { className: "rt-err" },
        /engagement required|unknown op/i.test(err) ? (
          /* 老 host 还没有知识库接口：讲清怎么恢复，别让人对着 "engagement required" 发懵 */
          "\u77E5\u8BC6\u5E93\u63A5\u53E3\u7531 host \u4FA7\u63D0\u4F9B\uFF0C\u5F53\u524D\u5BBF\u4E3B\u8FD8\u662F\u65E7\u8FDB\u7A0B \u2014\u2014 \u8BF7\u5B8C\u5168\u9000\u51FA\u540E\u91CD\u65B0\u6253\u5F00\uFF08\u5B98\u65B9 exe / \u793E\u533A\u7248 / dsh web \u4EFB\u4E00\uFF09\uFF0C\u518D\u5237\u65B0\u9875\u9762\u3002"
        ) : err
      ) : null,
      !err && data && data.dbPath ? h2(
        "div",
        { className: "rt-foot", style: { marginBottom: 6, fontSize: 11 } },
        "\u77E5\u8BC6\u5E93\uFF1A" + data.dbPath + (data.root ? "\uFF08\u6839\u76EE\u5F55 " + data.root + "\uFF09" : "")
      ) : null,
      h2(
        "div",
        { className: "rt-table" },
        (() => {
          if (!grouped) return items.map(card);
          const buckets = /* @__PURE__ */ new Map();
          for (const x of items) {
            const code = POC_CAT_NAME[x.category] ? x.category : "other";
            if (!buckets.has(code)) buckets.set(code, []);
            buckets.get(code).push(x);
          }
          const order = POC_CAT_ORDER.filter((c) => buckets.has(c));
          for (const code of buckets.keys())
            if (!order.includes(code)) order.push(code);
          const out = [];
          for (const code of order) {
            const list = buckets.get(code);
            out.push(
              h2(
                "div",
                { key: "g" + code, className: "rt-kb-cat" },
                h2(
                  "span",
                  { className: "rt-kb-cat-name" },
                  POC_CAT_NAME[code] || code
                ),
                h2("span", { className: "rt-tag" }, list.length + " \u6761"),
                h2(
                  "span",
                  { className: "rt-tag rt-tag-live" },
                  "\u5DF2\u9A8C\u8BC1 " + list.filter((x) => x.verified === 1).length
                ),
                h2("span", { className: "rt-spacer" }),
                h2(
                  "span",
                  {
                    style: {
                      fontSize: 11,
                      color: "var(--dsw-alias-label-secondary)"
                    }
                  },
                  "\u6700\u8FD1\u5EFA\u7ACB " + fmt(
                    list.map((x) => x.created_at).filter(Boolean).sort().pop()
                  )
                )
              )
            );
            for (const x of list) out.push(card(x));
          }
          return out;
        })(),
        tplItems.length ? h2(
          "div",
          { className: "rt-kb-tpl" },
          h2(
            "div",
            { className: "rt-ap-sub" },
            "\u672C\u673A nuclei \u6A21\u677F \xB7 " + (tplStart + 1) + "\u2013" + (tplStart + tplItems.length) + " / " + tplMatched + "\uFF08\u76F4\u63A5 `nuclei -t <\u6A21\u677F\u8DEF\u5F84>`\uFF09"
          ),
          tplItems.map(
            (t, i) => h2(
              "div",
              { key: "t" + tplStart + "-" + i, className: "rt-kb-tpl-row" },
              h2("span", { className: "rt-tag" }, t.severity || "\u2014"),
              t.category ? h2(
                "span",
                { className: "rt-tag" },
                POC_CAT_NAME[t.category] || t.category
              ) : null,
              h2(
                "span",
                { className: "rt-mono rt-kb-tpl-path", title: t.path },
                t.path
              ),
              h2(
                "span",
                { className: "rt-kb-tpl-name", title: t.name },
                t.name || ""
              ),
              h2(
                "button",
                {
                  className: "rt-btn",
                  style: { padding: "0 6px", fontSize: 10.5 },
                  onClick: () => copy("nuclei -t " + t.path + " -u <\u76EE\u6807>", "\u6A21\u677F\u547D\u4EE4")
                },
                "\u590D\u5236\u547D\u4EE4"
              )
            )
          ),
          h2(
            "div",
            { className: "rt-kb-actions" },
            h2(
              "button",
              {
                className: "rt-btn",
                disabled: busy || tplStart <= 0,
                onClick: () => turnTpl(tplStart - tplPageSize)
              },
              "\u4E0A\u4E00\u9875"
            ),
            h2(
              "button",
              {
                className: "rt-btn",
                disabled: busy || tplStart + tplItems.length >= tplMatched,
                onClick: () => turnTpl(tplStart + tplPageSize)
              },
              "\u4E0B\u4E00\u9875"
            )
          ),
          tpl.dir ? h2(
            "div",
            { className: "rt-foot" },
            h2("span", null, "\u6A21\u677F\u76EE\u5F55\uFF1A" + tpl.dir)
          ) : null
        ) : null,
        data === null ? h2("div", { className: "rt-empty" }, "\u52A0\u8F7D\u4E2D\u2026") : null,
        data !== null && !items.length && !tplItems.length ? h2(
          "div",
          { className: "rt-empty" },
          h2(
            "div",
            null,
            q || kind || verifiedOnly ? "\u6CA1\u6709\u547D\u4E2D\uFF1A\u6362\u4E2A\u5173\u952E\u5B57\u518D\u8BD5\uFF0C\u6216\u53BB\u4E92\u8054\u7F51\u627E / \u81EA\u5DF1\u624B\u6413\u540E\u56DE\u586B\u3002" : tpl.total ? "POC/EXP \u5E93\u8FD8\u662F\u7A7A\u7684\uFF1B\u672C\u673A\u5DF2\u6709 " + tpl.total + " \u4E2A nuclei \u6A21\u677F\uFF0C\u4F46\u8FD9\u4E00\u9875\u6CA1\u6709\u5217\u51FA\u6765\u3002\u8BF7\u5B8C\u5168\u9000\u51FA\u540E\u91CD\u65B0\u6253\u5F00\u5BA2\u6237\u7AEF\u3002" : tpl.dir ? "\u77E5\u8BC6\u5E93\u8FD8\u662F\u7A7A\u7684\uFF08\u672C\u673A\u6A21\u677F\u76EE\u5F55\u5B58\u5728\u4F46\u6CA1\u6709 yaml\uFF0C\u8BF7\u8DD1 nuclei -update-templates\uFF09\u3002" : "\u77E5\u8BC6\u5E93\u8FD8\u662F\u7A7A\u7684\u3002\u672C\u673A\u4E5F\u8FD8\u6CA1\u6709 nuclei \u6A21\u677F\u5E93 \u2014\u2014 \u5728\u6F14\u7EC3\u673A\u4E0A\u8DD1 setup.sh \u6216 `nuclei -update-templates`\uFF0C\u88C5\u597D\u540E\u8FD9\u91CC\u4F1A\u51FA\u73B0\u300C\u672C\u673A\u6A21\u677F N\u300D\u3002"
          ),
          h2(
            "div",
            { style: { marginTop: 6, fontSize: 12 } },
            "\u6253 Nday/1day \u7684\u6807\u51C6\u987A\u5E8F\uFF1A\u2460 redteam_poc_search \u5148\u67E5\u8FD9\u91CC\uFF08\u987A\u5E26\u641C\u672C\u673A nuclei \u6A21\u677F\u5E93\uFF09\u2192 \u2461 \u90FD\u6CA1\u6709\u5C31\u4E92\u8054\u7F51\u641C\u7D22\uFF08web_search / GitHub / ExploitDB / \u5382\u5546\u516C\u544A\uFF09\u6216\u81EA\u5DF1\u624B\u6413 \u2192 \u2462 \u5728\u771F\u5B9E\u76EE\u6807\u4E0A\u9A8C\u8BC1\u6709\u6548\u540E redteam_poc_add \u56DE\u586B\uFF0C\u540E\u9762\u7684\u9776\u6807\u76F4\u63A5\u5C31\u80FD\u7528\u3002"
          ),
          data.dbPath ? h2(
            "div",
            {
              style: { marginTop: 6, fontSize: 11 },
              className: "rt-mono"
            },
            "\u77E5\u8BC6\u5E93\u6587\u4EF6\uFF1A" + data.dbPath
          ) : null,
          tpl.dir ? h2(
            "div",
            {
              style: { marginTop: 6, fontSize: 11 },
              className: "rt-mono"
            },
            "\u6A21\u677F\u76EE\u5F55\uFF1A" + tpl.dir
          ) : null
        ) : null
      ),
      h2(
        "div",
        { className: "rt-foot" },
        h2(
          "span",
          null,
          "\u5168\u5C40\u5171\u4EAB\uFF08\u8DE8\u9776\u6807\uFF09\uFF5C \u843D\u76D8\uFF1Apocs/<code>/ \uFF5C \u53EA\u6536\u5F55\u901A\u7528\u53EF\u590D\u7528\u7684 POC/EXP\uFF0C\u9776\u6807\u4E13\u7528\u811A\u672C\u8D70\u300C\u653B\u51FB\u6587\u4EF6\u300D"
        )
      )
    );
  }
  function EnvTab(props) {
    const refreshKey = props.refreshKey || 0;
    const [data, setData] = import_react2.default.useState(null);
    const [draft, setDraft] = import_react2.default.useState(null);
    const [err, setErr] = import_react2.default.useState(null);
    const [msg, setMsg] = import_react2.default.useState(null);
    const [busy, setBusy] = import_react2.default.useState(false);
    const [folderPath, setFolderPath] = import_react2.default.useState("");
    const applyDraftFrom = (r) => {
      const c = r && r.config || {};
      setDraft({
        platform: c.platform || "auto",
        toolkitDir: c.toolkitDir || "",
        nucleiTemplatesDir: c.nucleiTemplatesDir || "",
        binDirsText: (c.binDirs || []).join("\n"),
        tools: Object.assign({}, c.tools || {}),
        env: Object.assign(
          { FOFA_KEY: "", REDTEAM_VPS_HOST: "", REDTEAM_VPS_KEY: "" },
          c.env || {}
        ),
        notes: c.notes || ""
      });
      if (c.toolkitDir) setFolderPath(c.toolkitDir);
    };
    const load = () => {
      setBusy(true);
      setMsg(null);
      api({ op: "platformConfigGet" }).then(
        (r) => {
          setBusy(false);
          if (!r || r.ok === false) {
            setErr(r && r.error || "\u8BFB\u53D6\u5931\u8D25");
            return;
          }
          setErr(null);
          setData(r);
          applyDraftFrom(r);
        },
        (e) => {
          setBusy(false);
          setErr(String(e && e.message || e));
        }
      );
    };
    import_react2.default.useEffect(load, [refreshKey]);
    const save = () => {
      if (!draft) return;
      setBusy(true);
      setMsg(null);
      const config = {
        platform: draft.platform,
        toolkitDir: draft.toolkitDir,
        nucleiTemplatesDir: draft.nucleiTemplatesDir,
        binDirs: String(draft.binDirsText || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean),
        tools: draft.tools,
        env: draft.env,
        notes: draft.notes,
        envAdaptConfigured: true,
        envAdaptSkip: false
      };
      api({ op: "platformConfigSave", config }).then(
        (r) => {
          setBusy(false);
          if (!r || r.ok === false) {
            setMsg({ err: r && r.error || "\u4FDD\u5B58\u5931\u8D25" });
            return;
          }
          setData(r);
          setMsg({
            ok: "\u5DF2\u4FDD\u5B58\u5230 " + (r.config && r.config.path || "$DSH_HOME/redteam/config.json")
          });
          applyDraftFrom(r);
        },
        (e) => {
          setBusy(false);
          setMsg({ err: String(e && e.message || e) });
        }
      );
    };
    const assignFolder = () => {
      const dir = String(
        folderPath || draft && draft.toolkitDir || ""
      ).trim();
      if (!dir) {
        setMsg({ err: "\u8BF7\u5148\u586B\u5199\u5DE5\u5177\u6240\u5728\u6587\u4EF6\u5939\u8DEF\u5F84" });
        return;
      }
      setBusy(true);
      setMsg(null);
      api({ op: "platformAssignToolkit", dir }).then(
        (r) => {
          setBusy(false);
          if (!r || r.ok === false) {
            setMsg({ err: r && r.error || "\u81EA\u52A8\u5206\u914D\u5931\u8D25" });
            return;
          }
          setData(r);
          applyDraftFrom(r);
          setMsg({
            ok: "\u5DF2\u4ECE\u6587\u4EF6\u5939\u5206\u914D " + (r.assignedCount || 0) + " \u4E2A\u5DE5\u5177" + (r.nucleiTemplatesDir ? "\uFF0C\u5E76\u8BC6\u522B nuclei-templates" : "")
          });
        },
        (e) => {
          setBusy(false);
          setMsg({ err: String(e && e.message || e) });
        }
      );
    };
    const setTool = (id, value) => setDraft(
      (d) => d ? Object.assign({}, d, {
        tools: Object.assign({}, d.tools, { [id]: value })
      }) : d
    );
    const setEnv = (key, value) => setDraft(
      (d) => d ? Object.assign({}, d, {
        env: Object.assign({}, d.env, { [key]: value })
      }) : d
    );
    const runtime = data && data.runtime || {};
    const adapt = data && data.adapt || {};
    const tools = data && data.tools && data.tools.items || [];
    const found = tools.filter((t) => t.path).length;
    const defaultToolkit = data && data.toolkitDir || "$DSH_HOME/redteam/toolkit";
    const defaultNuclei = data && data.nucleiTemplatesDir || defaultToolkit + "/nuclei-templates";
    return h2(
      "div",
      { className: "rt-main" },
      h2(
        "div",
        { className: "rt-toolbar" },
        h2("span", { style: { fontWeight: 600 } }, "\u73AF\u5883\u9002\u914D"),
        h2(
          "span",
          { className: "rt-tag" },
          runtime.effective === "windows" ? "Windows" : "Linux/Kali"
        ),
        adapt.kali ? h2("span", { className: "rt-tag rt-tag-live" }, "Kali") : null,
        h2(
          "span",
          {
            className: "rt-tag" + (adapt.ready ? " rt-tag-live" : " rt-tag-warn")
          },
          adapt.ready ? "\u5C31\u7EEA \xB7 " + (adapt.reason || "") : "\u5F85\u914D\u7F6E"
        ),
        h2(
          "span",
          { className: "rt-tag" + (found ? " rt-tag-live" : " rt-tag-warn") },
          "\u5DE5\u5177 " + found + "/" + tools.length
        ),
        h2("div", { className: "rt-spacer" }),
        h2(
          "button",
          { className: "rt-btn", disabled: busy, onClick: load },
          busy ? "\u8BFB\u53D6\u4E2D\u2026" : "\u5237\u65B0"
        ),
        h2(
          "button",
          {
            className: "rt-btn rt-btn-primary",
            disabled: busy || !draft,
            onClick: save
          },
          "\u4FDD\u5B58"
        )
      ),
      h2(
        "div",
        { className: "rt-pane", style: { minHeight: 0 } },
        err ? h2("div", { className: "rt-err" }, err) : null,
        msg ? h2(
          "div",
          { className: msg.err ? "rt-err" : "rt-foot" },
          msg.err || msg.ok
        ) : null,
        h2(
          "div",
          {
            className: "rt-card",
            style: { margin: "0 0 8px", fontSize: 12, lineHeight: 1.6 }
          },
          adapt.message || "\u5747\u53EF\u9009\u586B\uFF1A\u7559\u7A7A\u5219\u7528\u9ED8\u8BA4\u8DEF\u5F84/\u81EA\u52A8\u67E5\u627E\u3002\u586B\u4E86\u7684\u8986\u76D6\u9ED8\u8BA4\u3002\u5BC6\u94A5\u7C7B\u53EA\u5728\u9700\u8981\u6D4B\u7ED8/\u53CD\u5F39\u65F6\u624D\u586B\u3002"
        ),
        h2(
          "div",
          {
            className: "rt-card",
            style: { margin: "0 0 8px", fontSize: 12, lineHeight: 1.6 }
          },
          h2(
            "div",
            { style: { fontWeight: 600, marginBottom: 6 } },
            "\u6574\u5305\u6587\u4EF6\u5939 \u2192 \u81EA\u52A8\u5206\u914D\u5DE5\u5177"
          ),
          h2(
            "div",
            { style: { marginBottom: 8, opacity: 0.9 } },
            "\u5DE5\u5177\u90FD\u5728\u540C\u4E00\u4E2A\u6587\u4EF6\u5939\uFF08\u542B\u5B50\u76EE\u5F55\uFF09\u65F6\uFF0C\u586B\u8DEF\u5F84\u540E\u70B9\u300C\u81EA\u52A8\u5206\u914D\u300D\uFF1A\u4F1A\u5199\u5165 toolkitDir\uFF0C\u5E76\u6309\u6587\u4EF6\u540D\u5339\u914D nmap / nuclei / fscan \u7B49\u586B\u5230\u4E0B\u65B9\u3002"
          ),
          h2(
            "div",
            { style: { display: "flex", gap: 8, alignItems: "center" } },
            h2("input", {
              className: "rt-input",
              style: { flex: 1 },
              placeholder: "\u4F8B\u5982 D:\\pentest-tools \u6216 /opt/toolkit",
              value: folderPath,
              onChange: (e) => setFolderPath(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter") assignFolder();
              }
            }),
            h2(
              "button",
              {
                className: "rt-btn rt-btn-primary",
                disabled: busy,
                onClick: assignFolder
              },
              busy ? "\u626B\u63CF\u4E2D\u2026" : "\u81EA\u52A8\u5206\u914D"
            )
          )
        ),
        data && data.hint ? h2(
          "div",
          {
            className: "rt-card",
            style: { margin: "0 0 8px", fontSize: 12, lineHeight: 1.6 }
          },
          data.hint
        ) : null,
        data && data.egress ? h2(
          "div",
          {
            className: "rt-card",
            style: { margin: "0 0 8px", fontSize: 12, lineHeight: 1.55 }
          },
          h2(
            "div",
            { style: { fontWeight: 600, marginBottom: 6 } },
            "\u51FA\u7F51\u72B6\u6001\uFF08\u501F\u9274 Z3r0 egress\uFF0C\u53EA\u8BFB\uFF09"
          ),
          h2(
            "div",
            { className: "rt-mono", style: { fontSize: 11 } },
            "HTTP_PROXY=" + (data.egress.http_proxy || "(\u7A7A)")
          ),
          h2(
            "div",
            { className: "rt-mono", style: { fontSize: 11 } },
            "HTTPS_PROXY=" + (data.egress.https_proxy || "(\u7A7A)")
          ),
          h2(
            "div",
            { className: "rt-mono", style: { fontSize: 11 } },
            "ALL_PROXY=" + (data.egress.all_proxy || "(\u7A7A)")
          ),
          h2(
            "div",
            { className: "rt-mono", style: { fontSize: 11 } },
            "NO_PROXY=" + (data.egress.no_proxy || "(\u7A7A)")
          ),
          h2(
            "div",
            { style: { marginTop: 6, opacity: 0.85 } },
            data.egress.note || ""
          )
        ) : null,
        !draft ? h2("div", { className: "rt-empty" }, "\u52A0\u8F7D\u4E2D\u2026") : h2(
          "div",
          null,
          h2(
            "div",
            { className: "rt-card" },
            h2("h4", null, "\u5E73\u53F0\u4E0E\u76EE\u5F55"),
            h2(
              "div",
              { style: { display: "grid", gap: 8 } },
              h2(
                "label",
                { style: { fontSize: 12 } },
                "\u5E73\u53F0\u6A21\u5F0F",
                h2(
                  "select",
                  {
                    className: "rt-input",
                    style: {
                      display: "block",
                      width: "100%",
                      marginTop: 4
                    },
                    value: draft.platform,
                    onChange: (e) => setDraft(
                      Object.assign({}, draft, {
                        platform: e.target.value
                      })
                    )
                  },
                  h2("option", { value: "auto" }, "auto\uFF08\u8DDF\u968F\u672C\u673A\uFF0C\u9ED8\u8BA4\uFF09"),
                  h2("option", { value: "windows" }, "windows"),
                  h2("option", { value: "linux" }, "linux")
                )
              ),
              h2(
                "label",
                { style: { fontSize: 12 } },
                "\u5DE5\u5177\u7BB1\u76EE\u5F55 toolkitDir\uFF08\u7559\u7A7A\uFF1D\u9ED8\u8BA4\uFF09",
                h2("input", {
                  className: "rt-input",
                  style: { display: "block", width: "100%", marginTop: 4 },
                  placeholder: "\u9ED8\u8BA4\uFF1A" + defaultToolkit,
                  value: draft.toolkitDir,
                  onChange: (e) => setDraft(
                    Object.assign({}, draft, {
                      toolkitDir: e.target.value
                    })
                  )
                })
              ),
              h2(
                "label",
                { style: { fontSize: 12 } },
                "nuclei \u6A21\u677F\u76EE\u5F55\uFF08\u7559\u7A7A\uFF1D\u81EA\u52A8\uFF1Atoolkit/nuclei-templates\uFF09",
                h2("input", {
                  className: "rt-input",
                  style: { display: "block", width: "100%", marginTop: 4 },
                  placeholder: "\u9ED8\u8BA4\uFF1A" + defaultNuclei,
                  value: draft.nucleiTemplatesDir,
                  onChange: (e) => setDraft(
                    Object.assign({}, draft, {
                      nucleiTemplatesDir: e.target.value
                    })
                  )
                })
              ),
              h2(
                "label",
                { style: { fontSize: 12 } },
                "\u5DE5\u5177\u641C\u7D22\u76EE\u5F55 binDirs\uFF08\u7559\u7A7A\uFF1D\u53EA\u641C toolkit + PATH\uFF1B\u6BCF\u884C\u4E00\u4E2A\uFF09",
                h2("textarea", {
                  className: "rt-input",
                  rows: 4,
                  style: {
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    fontFamily: "var(--dsw-font-mono, monospace)"
                  },
                  placeholder: "\u53EF\u9009\u3002\u4F8B\u5982\uFF1A" + String.fromCharCode(10) + "D:\\tools" + String.fromCharCode(10) + "D:\\pentest-bin",
                  value: draft.binDirsText,
                  onChange: (e) => setDraft(
                    Object.assign({}, draft, {
                      binDirsText: e.target.value
                    })
                  )
                })
              )
            )
          ),
          h2(
            "div",
            { className: "rt-card" },
            h2("h4", null, "\u5BC6\u94A5\u4E0E VPS\uFF08\u7559\u7A7A\uFF1D\u4E0D\u8986\u76D6\uFF1B\u8FDB\u7A0B\u73AF\u5883\u53D8\u91CF\u4F18\u5148\uFF09"),
            h2(
              "div",
              { style: { display: "grid", gap: 8 } },
              ["FOFA_KEY", "REDTEAM_VPS_HOST", "REDTEAM_VPS_KEY"].map(
                (k) => h2(
                  "label",
                  { key: k, style: { fontSize: 12 } },
                  k + "\uFF08\u53EF\u9009\uFF09",
                  h2("input", {
                    className: "rt-input",
                    style: {
                      display: "block",
                      width: "100%",
                      marginTop: 4
                    },
                    type: k === "FOFA_KEY" ? "password" : "text",
                    placeholder: k === "REDTEAM_VPS_KEY" ? "\u7559\u7A7A\uFF1B\u9700\u8981\u65F6\u586B\u79C1\u94A5\u7EDD\u5BF9\u8DEF\u5F84" : k === "REDTEAM_VPS_HOST" ? "\u7559\u7A7A\uFF1B\u9700\u8981\u65F6\u586B user@host" : "\u7559\u7A7A\uFF1B\u6D4B\u7ED8\u65F6\u518D\u586B",
                    value: draft.env && draft.env[k] || "",
                    onChange: (e) => setEnv(k, e.target.value)
                  })
                )
              )
            )
          ),
          h2(
            "div",
            { className: "rt-card" },
            h2("h4", null, "\u5DE5\u5177\u53EF\u6267\u884C\u6587\u4EF6\uFF08\u7559\u7A7A\uFF1D\u81EA\u52A8\u67E5\u627E\uFF09"),
            h2(
              "div",
              {
                style: {
                  fontSize: 11.5,
                  color: "var(--dsw-alias-label-secondary)",
                  marginBottom: 8
                }
              },
              "\u89E3\u6790\u987A\u5E8F\uFF1A\u672C\u8868\u7EDD\u5BF9\u8DEF\u5F84 \u2192 toolkitDir \u2192 binDirs \u2192 PATH\u3002\u7559\u7A7A\u5373\u8D70\u9ED8\u8BA4\u67E5\u627E\u3002"
            ),
            tools.map(
              (t) => h2(
                "div",
                { key: t.id, style: { marginBottom: 8 } },
                h2(
                  "div",
                  {
                    style: {
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      marginBottom: 4
                    }
                  },
                  h2(
                    "span",
                    { style: { fontWeight: 600, minWidth: 88 } },
                    t.label || t.id
                  ),
                  t.path ? h2(
                    "span",
                    { className: "rt-tag rt-tag-live", title: t.path },
                    t.source + " \xB7 \u5DF2\u627E\u5230"
                  ) : h2(
                    "span",
                    { className: "rt-tag rt-tag-warn" },
                    "\u672A\u627E\u5230\uFF08\u53EF\u7559\u7A7A\u7B49\u88C5\u597D\uFF09"
                  )
                ),
                h2("input", {
                  className: "rt-input",
                  style: { width: "100%" },
                  placeholder: "\u7559\u7A7A\u81EA\u52A8\u627E\uFF1A" + (t.names || []).slice(0, 3).join(" / "),
                  value: draft.tools && draft.tools[t.id] || "",
                  onChange: (e) => setTool(t.id, e.target.value)
                }),
                t.path ? h2(
                  "div",
                  {
                    className: "rt-mono",
                    style: {
                      fontSize: 10.5,
                      marginTop: 2,
                      opacity: 0.8
                    }
                  },
                  t.path
                ) : null
              )
            )
          ),
          h2(
            "div",
            { className: "rt-card" },
            h2("h4", null, "\u5907\u6CE8"),
            h2("textarea", {
              className: "rt-input",
              rows: 3,
              style: { width: "100%" },
              placeholder: "\u53EF\u9009\u3002\u4F8B\u5982\uFF1A\u5DE5\u5177\u6765\u81EA\u67D0\u67D0\u7EFF\u8272\u5305",
              value: draft.notes,
              onChange: (e) => setDraft(
                Object.assign({}, draft, { notes: e.target.value })
              )
            })
          ),
          h2(
            "div",
            { className: "rt-foot" },
            h2(
              "span",
              null,
              "\u914D\u7F6E\u6587\u4EF6\uFF1A" + (data && data.config && data.config.path || "$DSH_HOME/redteam/config.json") + " | \u7559\u7A7A\u5B57\u6BB5\u5168\u90E8\u8D70\u9ED8\u8BA4"
            )
          )
        )
      )
    );
  }
  function ScoreTab(props) {
    const eng = props.engagement;
    const refreshKey = props.refreshKey || 0;
    const [data, setData] = import_react2.default.useState(null);
    const [err, setErr] = import_react2.default.useState(null);
    const [busy, setBusy] = import_react2.default.useState(false);
    const [openId, setOpenId] = import_react2.default.useState(null);
    const [form, setForm] = import_react2.default.useState(null);
    const [msg, setMsg] = import_react2.default.useState(null);
    const load = () => {
      if (!eng) return;
      setBusy(true);
      api({ op: "scores", engagement: eng }).then(
        (r) => {
          setBusy(false);
          if (!r || r.ok === false) {
            setErr(r && r.error || "\u8BFB\u53D6\u5931\u8D25");
            return;
          }
          setErr(null);
          setData(r);
        },
        (e) => {
          setBusy(false);
          setErr(String(e && e.message || e));
        }
      );
    };
    import_react2.default.useEffect(load, [eng, refreshKey]);
    const startEdit = (p) => setForm({
      id: p.id,
      name: p.name,
      category: p.category || "",
      points: p.points,
      description: p.description || "",
      enabled: p.enabled,
      builtin: p.builtin === true,
      src: p.src,
      cap: p.cap,
      rule: p.rule
    });
    const startNew = () => {
      setForm({
        name: "",
        category: "",
        points: 10,
        description: "",
        enabled: true,
        builtin: false
      });
      setMsg(null);
    };
    const setField = (k, v) => setForm((f) => Object.assign({}, f, { [k]: v }));
    const save = () => {
      if (!form || !form.name) {
        setMsg({ err: "\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A" });
        return;
      }
      setBusy(true);
      setMsg(null);
      api({ op: "saveScorePoint", engagement: eng, point: form }).then(
        (r) => {
          setBusy(false);
          if (!r || r.ok === false) {
            setMsg({ err: r && r.error || "\u4FDD\u5B58\u5931\u8D25" });
            return;
          }
          if (r.overridden === false) {
            setMsg({
              err: "\u5DF2\u4FDD\u5B58\u300C\u542F\u7528/\u505C\u7528\u300D\u3002\u5206\u503C\u672A\u6539\u52A8\uFF1A\u8FD9\u662F\u968F\u300A\u5F97\u5206\u89C4\u5219\u300B\u5206\u53D1\u7684\u5185\u7F6E\u5F97\u5206\u70B9\uFF0C\u5206\u503C / \u4E0A\u9650 / \u8BA1\u5206\u53E3\u5F84\u7531\u89C4\u5219\u9501\u5B9A\uFF08\u540C\u4E00\u6761\u89C4\u5219\u7684\u4E0A\u9650\u6309\u7EC4\u5185\u6240\u6709\u5F97\u5206\u70B9\u7D2F\u8BA1\uFF0C\u5355\u72EC\u6539\u5206\u503C\u4F1A\u8BA9\u4E00\u6761\u547D\u4E2D\u5403\u6389\u6574\u7EC4\u4E0A\u9650\uFF09\u3002\u8981\u81EA\u5B9A\u4E49\u5206\u503C\u65F6\u8BF7\u300C+ \u65B0\u589E\u5F97\u5206\u70B9\u300D\u3002"
            });
          } else {
            setMsg({ ok: r.note || "\u5DF2\u4FDD\u5B58" });
          }
          setForm(null);
          load();
        },
        (e) => {
          setBusy(false);
          setMsg({ err: String(e && e.message || e) });
        }
      );
    };
    const remove = () => {
      if (!form || !form.id) {
        setForm(null);
        return;
      }
      setBusy(true);
      setMsg(null);
      api({ op: "deleteScorePoint", engagement: eng, id: form.id }).then(
        (r) => {
          setBusy(false);
          if (!r || r.ok === false) {
            setMsg({ err: r && r.error || "\u5220\u9664\u5931\u8D25" });
            return;
          }
          setMsg({ ok: "\u5DF2\u5220\u9664" });
          setForm(null);
          setOpenId(null);
          load();
        },
        (e) => {
          setBusy(false);
          setMsg({ err: String(e && e.message || e) });
        }
      );
    };
    const summary = data && data.summary || {
      achievedPoints: 0,
      pointCount: 0,
      hitPointCount: 0,
      hitCount: 0,
      selfCreatedHits: 0,
      serviceCappedHits: 0
    };
    const items = data && data.items || [];
    const groups = data && data.ruleGroups && data.ruleGroups.length ? data.ruleGroups : [
      {
        key: "all",
        name: "",
        capSum: 0,
        points: 0,
        counted: 0,
        tiers: items
      }
    ];
    const rows = [];
    for (const g of groups) {
      if (g.name) {
        rows.push(
          h2(
            "div",
            { key: "g-" + g.key, className: "rt-score-group" },
            h2("span", null, g.name),
            h2(
              "span",
              { className: "rt-sg-sub" },
              g.tiers.length + " \u9879" + (g.capSum > 0 ? " \xB7 \u5404\u9879\u4E0A\u9650\u5408\u8BA1 " + g.capSum + " \u5206\uFF08\u5404\u9879\u72EC\u7ACB\uFF0C\u4E0D\u8DE8\u9879\u7D2F\u52A0\uFF09" : "")
            ),
            h2("div", { className: "rt-spacer" }),
            g.points > 0 ? h2(
              "span",
              { className: "rt-tag rt-tag-active" },
              "+" + g.points + " \u5206"
            ) : null
          )
        );
      }
      for (const p of g.tiers) {
        const achieved = p.hits.length > 0;
        const open = openId === p.id;
        rows.push(
          h2(
            "div",
            {
              key: "sp" + p.id,
              className: "rt-score-row",
              role: "button",
              tabIndex: 0,
              onClick: () => setOpenId(open ? null : p.id),
              onKeyDown: (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpenId(open ? null : p.id);
                }
              }
            },
            h2("span", { className: "rt-sec-caret" }, open ? "\u25BE" : "\u25B8"),
            h2(
              "span",
              null,
              h2(
                "span",
                {
                  className: achieved ? "rt-pri rt-pri-high" : "rt-pri rt-pri-low",
                  style: achieved ? {} : {
                    background: "var(--dsw-alias-bg-layer-2)",
                    color: "var(--dsw-alias-label-secondary)"
                  }
                },
                p.points + "\u5206"
              )
            ),
            h2(
              "span",
              { title: p.description || "" },
              p.name,
              p.tier ? h2("span", { className: "rt-scope" }, "\u3000" + p.tier) : null
            ),
            /* 命中与上限：这一条计入几次、上限用了多少（G3 各项上限独立，到顶就不再累计） */
            h2(
              "span",
              {
                title: p.capped > 0 ? "\u5DF2\u8BA1\u5165 " + p.counted + " \u6B21\uFF0C\u53E6\u6709 " + p.capped + " \u6761\u56E0\u300C" + (p.scope_label || "\u8BA1\u5206\u53E3\u5F84") + "\u300D\u6216\u5DF2\u8FBE\u4E0A\u9650\u4E0D\u8BA1\u5206" : p.scope_label || ""
              },
              h2(
                "span",
                { className: "rt-sec-count" },
                p.hits.length > 0 ? p.counted + " \u6B21\u547D\u4E2D" : "\u672A\u547D\u4E2D"
              ),
              p.cap > 0 ? h2(
                "span",
                { className: "rt-scope" },
                "\u3000\u4E0A\u9650 " + (p.cap_used === null ? 0 : p.cap_used) + "/" + p.cap
              ) : null
            ),
            h2(
              "span",
              { style: { textAlign: "right" } },
              p.earned > 0 ? h2(
                "span",
                { className: "rt-tag rt-tag-active" },
                "+" + p.earned + " \u5206"
              ) : h2(
                "span",
                { style: { color: "var(--dsw-alias-label-secondary)" } },
                "\u2014"
              )
            )
          )
        );
        if (!open) continue;
        const hitNodes = p.hits.map(
          (hh, hi) => h2(
            "div",
            {
              key: "h" + hh.id,
              className: "rt-hit-row" + (hh.self_created ? " self-created" : "") + (hh.capped ? " service-capped" : "")
            },
            h2("span", { className: "rt-hit-idx" }, String(hi + 1)),
            h2(
              "span",
              {
                className: "rt-hit-asset",
                title: hh.target || hh.asset_ip || ""
              },
              hh.asset_ip || hh.target || "\u672A\u6307\u5B9A\u8D44\u4EA7"
            ),
            hh.self_created ? h2(
              "span",
              {
                className: "rt-tag rt-tag-warn",
                title: "\u81EA\u5DF1\u6CE8\u518C/\u81EA\u5EFA\u7684\u8D26\u53F7\u4E0D\u7B97\u5F97\u5206\u6743\u9650\uFF0C\u53EA\u4F5C\u8FC7\u7A0B\u8BB0\u5F55"
              },
              "\u81EA\u5EFA \xB7 \u4E0D\u8BA1\u5206"
            ) : null,
            hh.capped ? h2(
              "span",
              {
                className: "rt-tag rt-tag-warn",
                title: hh.capped_reason || "\u540C\u4E00\u8D44\u4EA7\u540C\u4E00\u7AEF\u53E3\u53EA\u7B97\u5206\u503C\u6700\u9AD8\u7684\u4E00\u6761\uFF0C\u8FD9\u6761\u4E0D\u8BA1\u5206"
              },
              "\u670D\u52A1\u5DF2\u62FF\u6EE1 \xB7 \u4E0D\u8BA1\u5206" + (hh.service ? "\uFF08" + hh.service + "\uFF09" : "")
            ) : null,
            hh.shot_count ? h2(
              "span",
              {
                className: "rt-tag",
                title: "\u8FD9\u6761\u547D\u4E2D\u6709\u8BC1\u636E\u622A\u56FE\uFF08\u5C55\u5F00\u5F97\u5206\u70B9\u5373\u53EF\u770B\u5230\u4EE3\u8868\u56FE\uFF09"
              },
              "\u56FE " + hh.shot_count
            ) : null,
            h2("span", { className: "rt-hit-time" }, fmt(hh.recorded_at)),
            h2(
              "button",
              {
                className: "rt-btn",
                style: { padding: "0 5px", fontSize: 10.5 },
                title: "\u590D\u5236\u8FD9\u4E00\u6761",
                onClick: (e) => {
                  e.stopPropagation();
                  copyText(
                    (hh.asset_ip || hh.target || "") + "  " + (hh.evidence || "")
                  );
                }
              },
              "\u590D\u5236"
            ),
            hh.evidence ? h2(
              "span",
              { className: "rt-hit-txt", title: hh.evidence },
              String(hh.evidence).replace(/\n+/g, " ")
            ) : h2(
              "span",
              { className: "rt-hit-txt none" },
              "\u672A\u586B\u8D26\u53F7\u5BC6\u7801/\u7ED3\u679C"
            )
          )
        );
        rows.push(
          h2(
            "div",
            {
              key: "spd" + p.id,
              className: "rt-score-row",
              style: { cursor: "default", gridTemplateColumns: "1fr" }
            },
            h2(
              "div",
              { className: "rt-score-detail" },
              p.description ? h2(
                "div",
                { className: "rt-kv" },
                h2("b", null, "\u5F97\u5206\u6761\u4EF6"),
                h2("span", null, p.description)
              ) : null,
              h2(
                "div",
                { className: "rt-kv" },
                h2("b", null, "\u72B6\u6001"),
                h2(
                  "span",
                  null,
                  (p.enabled ? "\u542F\u7528" : "\u505C\u7528") + " \xB7 " + p.points + " \u5206/\u6B21 \xB7 \u547D\u4E2D " + p.hits.length + " \u6B21 = " + p.earned + " \u5206" + (p.self_created ? "\uFF08\u53E6\u6709 " + p.self_created + " \u6B21\u81EA\u5EFA\u4E0D\u8BA1\u5206\uFF09" : "") + (p.capped ? "\uFF08\u53E6\u6709 " + p.capped + " \u6B21\u540C\u670D\u52A1\u91CD\u590D\u547D\u4E2D\u4E0D\u8BA1\u5206\uFF09" : "")
                )
              ),
              p.capped ? h2(
                "div",
                { className: "rt-kv" },
                h2("b", null, "\u670D\u52A1\u5C01\u9876"),
                h2(
                  "span",
                  null,
                  p.service_summary + "\uFF1B\u8D26\u53F7\u6743\u9650\u4E0E\u6570\u636E\u5E93\u6743\u9650\u6309\u300C\u540C\u8D44\u4EA7\u540C\u7AEF\u53E3\u300D\u53EA\u7B97\u4E00\u6B21\uFF0C\u62FF\u5230\u6700\u9AD8\u6743\u9650\u8D26\u53F7\u5373\u8BE5\u670D\u52A1\u62FF\u6EE1"
                )
              ) : null,
              p.hits.length ? h2(
                "div",
                null,
                h2(ShotStrip, {
                  eng,
                  shots: p.shots,
                  total: p.shot_total,
                  title: "\u8BC1\u636E\u622A\u56FE \xB7 " + (p.shot_total || (p.shots || []).length) + " \u5F20"
                }),
                h2(
                  "div",
                  {
                    className: "rt-section",
                    style: { padding: "6px 0 0" }
                  },
                  "\u547D\u4E2D\u8BB0\u5F55 \xB7 " + p.hits.length + "\uFF08\u53EA\u8BB0\u8D44\u4EA7\u4E0E\u8D26\u53F7\u5BC6\u7801\uFF0C\u8BE6\u7EC6\u590D\u73B0\u89C1\u62A5\u544A\uFF09"
                ),
                h2("div", { className: "rt-hits" }, hitNodes)
              ) : h2(
                "div",
                { className: "rt-kv" },
                h2("b", null, "\u547D\u4E2D\u8BB0\u5F55"),
                h2(
                  "span",
                  { style: { color: "var(--dsw-alias-label-secondary)" } },
                  "\u8FD8\u6CA1\u6709 \u2014\u2014 \u62FF\u4E0B\u6210\u679C\u540E\u7528 redteam_score_hit \u8BB0\u5206\uFF1A\u5199\u660E\u76EE\u6807\u8D44\u4EA7 + \u62FF\u5230\u7684\u8D26\u53F7\u5BC6\u7801/\u6743\u9650"
                )
              ),
              h2(
                "div",
                { className: "rt-actions" },
                h2(
                  "button",
                  {
                    className: "rt-btn",
                    onClick: (e) => {
                      e.stopPropagation();
                      startEdit(p);
                    }
                  },
                  "\u7F16\u8F91"
                )
              )
            )
          )
        );
      }
    }
    return h2(
      "div",
      { className: "rt-main" },
      h2(
        "div",
        { className: "rt-toolbar" },
        h2("span", { style: { fontWeight: 600 } }, "\u5F97\u5206\u76EE\u6807"),
        /* 只显示已拿下的总分，不显示目标分数、不显示进度条 */
        h2(
          "span",
          {
            style: {
              fontSize: 13,
              color: "var(--dsw-alias-label-secondary)",
              marginLeft: 4
            }
          },
          "\u603B\u5206"
        ),
        h2("span", { className: "rt-total" }, String(summary.achievedPoints)),
        h2(
          "span",
          {
            style: { fontSize: 13, color: "var(--dsw-alias-label-secondary)" }
          },
          "\u5206"
        ),
        h2("span", { className: "rt-tag" }, summary.pointCount + " \u4E2A\u5F97\u5206\u70B9"),
        h2(
          "span",
          { className: "rt-tag" },
          "\u547D\u4E2D " + summary.countedHits + " \u6B21"
        ),
        summary.selfCreatedHits ? h2(
          "span",
          {
            className: "rt-tag rt-tag-warn",
            title: "\u81EA\u5DF1\u6CE8\u518C/\u81EA\u5DF1\u521B\u5EFA\u7684\u8D26\u53F7\u4E0D\u7B97\u5F97\u5206\u6743\u9650\uFF0C\u53EA\u4F5C\u8FC7\u7A0B\u8BB0\u5F55\uFF08\u4E0D\u8BA1\u5206\u3001\u4E0D\u5360\u4E0A\u9650\u3001\u4E0D\u8FDB\u62A5\u544A\uFF09"
          },
          "\u81EA\u5EFA\u4E0D\u8BA1\u5206 " + summary.selfCreatedHits
        ) : null,
        summary.serviceCappedHits ? h2(
          "span",
          {
            className: "rt-tag rt-tag-warn",
            title: "\u8D26\u53F7\u6743\u9650\u4E0E\u6570\u636E\u5E93\u6743\u9650\u6309\u300C\u540C\u8D44\u4EA7\u540C\u7AEF\u53E3\u300D\u53EA\u7B97\u4E00\u6B21\uFF1A\u8BE5\u670D\u52A1\u5DF2\u62FF\u6EE1\uFF0C\u8FD9\u4E9B\u91CD\u590D\u547D\u4E2D\u4E0D\u8BA1\u5206\uFF08\u53EA\u4F5C\u7559\u75D5\uFF09"
          },
          "\u670D\u52A1\u5DF2\u62FF\u6EE1\u4E0D\u8BA1\u5206 " + summary.serviceCappedHits
        ) : null,
        h2("div", { className: "rt-spacer" }),
        h2("button", { className: "rt-btn", onClick: startNew }, "+ \u65B0\u589E\u5F97\u5206\u70B9"),
        h2(
          "button",
          { className: "rt-btn", disabled: busy, onClick: load },
          busy ? "\u5237\u65B0\u4E2D\u2026" : "\u5237\u65B0"
        )
      ),
      msg ? h2(
        "div",
        { className: msg.err ? "rt-err" : "rt-foot" },
        msg.err || msg.ok
      ) : null,
      err ? h2("div", { className: "rt-err" }, err) : null,
      form ? h2(
        "div",
        {
          className: "rt-pane",
          style: {
            flex: "none",
            borderBottom: "1px solid var(--dsw-alias-border-l1)"
          }
        },
        /* 内置得分点（builtin）：分值 / 名称 / 分类由《得分规则》锁定，输入框置灰。
         可改的只有「启用 / 停用」。这样界面上就不会再出现「改完提示已保存、刷新变回去」的困惑。 */
        form.builtin ? h2(
          "div",
          { className: "rt-hint", style: { marginBottom: 8 } },
          h2(
            "b",
            null,
            "\u5185\u7F6E\u5F97\u5206\u70B9\uFF08\u6765\u81EA\u300A\u7A81\u7834\u5165\u4FB5\u7C7B\u5F97\u5206\u89C4\u5219\uFF08\u5408\u5E76\u7248\uFF09\u300B\uFF09"
          ),
          h2(
            "div",
            { style: { marginTop: 3 } },
            "\u5206\u503C\u3001\u4E0A\u9650\u3001\u8BA1\u5206\u53E3\u5F84\u4E0E\u540D\u79F0\u7531\u89C4\u5219\u9501\u5B9A \u2014\u2014 \u540C\u4E00\u6761\u89C4\u5219\u7684\u4E0A\u9650\u6309\u7EC4\u5185\u6240\u6709\u5F97\u5206\u70B9\u7D2F\u8BA1\uFF0C\u5355\u72EC\u6539\u5206\u503C\u4F1A\u8BA9\u4E00\u6761\u547D\u4E2D\u5403\u6389\u6574\u7EC4\u4E0A\u9650\u3002\u8FD9\u91CC\u53EF\u4EE5\u6539\u300C\u542F\u7528 / \u505C\u7528\u300D\uFF1B\u8981\u81EA\u5B9A\u4E49\u5206\u503C\u65F6\u8BF7\u8FD4\u56DE\u4E0A\u4E00\u5C4F\u70B9\u300C+ \u65B0\u589E\u5F97\u5206\u70B9\u300D\u3002"
          ),
          form.src !== null && form.src !== void 0 ? h2(
            "div",
            {
              style: {
                marginTop: 3,
                color: "var(--dsw-alias-label-secondary)"
              }
            },
            "\u89C4\u5219\u539F\u6587\u5E8F\u53F7 " + form.src + (form.rule ? "\u3000\xB7\u3000\u4E0A\u9650\u5206\u7EC4 rule=" + form.rule : "") + (form.cap > 0 ? "\u3000\xB7\u3000\u4E0A\u9650 " + form.cap + " \u5206" : "\u3000\xB7\u3000\u4E0D\u8BBE\u4E0A\u9650")
          ) : null
        ) : null,
        h2(
          "div",
          { className: "rt-score-form" },
          h2("input", {
            className: "rt-input",
            placeholder: "\u540D\u79F0\uFF08\u5FC5\u586B\uFF09",
            value: form.name,
            readOnly: form.builtin === true,
            title: form.builtin ? "\u5185\u7F6E\u5F97\u5206\u70B9\u7684\u540D\u79F0\u7531\u89C4\u5219\u9501\u5B9A" : "",
            onChange: (e) => setField("name", e.target.value)
          }),
          h2("input", {
            className: "rt-input",
            placeholder: "\u5206\u7C7B\uFF0C\u5982 \u8D26\u53F7\u6743\u9650",
            value: form.category,
            readOnly: form.builtin === true,
            title: form.builtin ? "\u5185\u7F6E\u5F97\u5206\u70B9\u7684\u5206\u7C7B\u7531\u89C4\u5219\u9501\u5B9A\uFF08\u51B3\u5B9A\u5B83\u5C5E\u4E8E\u9762\u677F\u54EA\u4E00\u7EC4\uFF09" : "",
            onChange: (e) => setField("category", e.target.value)
          }),
          h2("input", {
            className: "rt-input",
            type: "number",
            placeholder: "\u5355\u6B21\u5206\u503C",
            readOnly: form.builtin === true,
            title: form.builtin ? "\u5185\u7F6E\u5F97\u5206\u70B9\u7684\u5206\u503C\u7531\u300A\u5F97\u5206\u89C4\u5219\u300B\u9501\u5B9A\uFF0C\u4E0D\u80FD\u5728\u8FD9\u91CC\u6539" : "\u8FD9\u4E00\u7C7B\u7684\u5355\u6B21\u5206\u503C\uFF1B\u6BCF\u547D\u4E2D\u4E00\u6B21\u5C31\u6309\u8FD9\u4E2A\u5206\u503C\u7D2F\u52A0\uFF08\u53D7\u8BE5\u6761\u89C4\u5219\u4E0A\u9650\u7EA6\u675F\uFF09",
            value: form.points,
            onChange: (e) => setField("points", Number(e.target.value))
          }),
          h2(
            "select",
            {
              className: "rt-input",
              value: form.enabled ? "1" : "0",
              onChange: (e) => setField("enabled", e.target.value === "1")
            },
            h2("option", { value: "1" }, "\u542F\u7528"),
            h2("option", { value: "0" }, "\u505C\u7528")
          )
        ),
        h2("input", {
          className: "rt-input",
          style: {
            width: "100%",
            marginBottom: 6,
            boxSizing: "border-box"
          },
          placeholder: "\u5F97\u5206\u6761\u4EF6\u8BF4\u660E",
          value: form.description,
          readOnly: form.builtin === true,
          title: form.builtin ? "\u5185\u7F6E\u5F97\u5206\u70B9\u7684\u6761\u6B3E\u6B63\u6587\u7531\u89C4\u5219\u9501\u5B9A" : "",
          onChange: (e) => setField("description", e.target.value)
        }),
        h2(
          "div",
          { className: "rt-actions" },
          h2(
            "button",
            {
              className: "rt-btn rt-btn-primary",
              disabled: busy,
              onClick: save
            },
            "\u4FDD\u5B58"
          ),
          form.id ? form.builtin ? h2(
            "button",
            {
              className: "rt-btn",
              disabled: true,
              title: "\u5185\u7F6E\u5F97\u5206\u70B9\u4E0D\u80FD\u5220\u9664\uFF1A\u5220\u6389\u4F1A\u8BA9\u9762\u677F\u7F3A\u4E00\u6761\u89C4\u5219\u3001\u62A5\u544A\u5C11\u4E00\u7C7B\u6210\u679C\uFF08\u4E0B\u6B21\u542F\u52A8\u8FD8\u4F1A\u81EA\u52A8\u8865\u56DE\u6765\uFF09\u3002\u8981\u8BA9\u5B83\u4E0D\u53C2\u4E0E\u8BA1\u5206\u8BF7\u6539\u7528\u300C\u505C\u7528\u300D\u3002"
            },
            "\u5220\u9664\uFF08\u5185\u7F6E\u9879\u4E0D\u53EF\u5220\uFF09"
          ) : h2(
            "button",
            { className: "rt-btn", disabled: busy, onClick: remove },
            "\u5220\u9664"
          ) : null,
          h2(
            "button",
            { className: "rt-btn", onClick: () => setForm(null) },
            "\u53D6\u6D88"
          )
        )
      ) : null,
      h2(
        "div",
        { className: "rt-table" },
        h2(
          "div",
          { className: "rt-score-row head" },
          h2("span", null, ""),
          h2("span", null, "\u5206\u503C"),
          h2("span", null, "\u5F97\u5206\u70B9\uFF08\u6309\u5206\u503C\u4ECE\u4F4E\u5230\u9AD8\uFF09"),
          h2("span", null, "\u547D\u4E2D / \u4E0A\u9650"),
          h2("span", { style: { textAlign: "right" } }, "\u5DF2\u5F97\u5206")
        ),
        rows,
        !items.length ? h2(
          "div",
          { className: "rt-empty" },
          "\u6682\u65E0\u5F97\u5206\u70B9\uFF0C\u70B9\u53F3\u4E0A\u89D2\u300C\u65B0\u589E\u5F97\u5206\u70B9\u300D"
        ) : null
      )
    );
  }
  const COLLAPSE_KEY = "rt-collapse:";
  const collapseLoad = (prefix) => {
    try {
      const raw = window.localStorage.getItem(COLLAPSE_KEY + prefix);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  };
  const collapseSave = (prefix, value) => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY + prefix, JSON.stringify(value));
    } catch (e) {
    }
  };
  function useCollapse(prefix) {
    const [state, setState] = import_react2.default.useState(() => collapseLoad(prefix));
    import_react2.default.useEffect(() => {
      setState(collapseLoad(prefix));
    }, [prefix]);
    const write = (next) => {
      collapseSave(prefix, next);
      setState(next);
    };
    const isOpen = (key, defaultOpen) => {
      const v = state[key];
      return v === void 0 ? defaultOpen !== false : v === true;
    };
    const toggle = (key, defaultOpen) => (e) => {
      if (e && e.stopPropagation) e.stopPropagation();
      write(Object.assign({}, state, { [key]: !isOpen(key, defaultOpen) }));
    };
    const setAll = (keys, open) => {
      const next = Object.assign({}, state);
      for (const k of keys) next[k] = open;
      write(next);
    };
    return { isOpen, toggle, setAll };
  }
  function Section(props) {
    const always = props.always === true;
    const open = always || props.open === true;
    const head = h2(
      "div",
      {
        className: "rt-sec t-" + (props.tone || "target") + (always ? " flat" : ""),
        role: always ? void 0 : "button",
        tabIndex: always ? void 0 : 0,
        "aria-expanded": always ? void 0 : open ? "true" : "false",
        onClick: always ? void 0 : props.onToggle,
        onKeyDown: always ? void 0 : (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (props.onToggle) props.onToggle(e);
          }
        }
      },
      h2("span", { className: "rt-sec-caret" }, always ? "\u258D" : open ? "\u25BE" : "\u25B8"),
      props.title ? h2("span", { className: "rt-sec-title" }, props.title) : null,
      props.count !== void 0 && props.count !== null ? h2("span", { className: "rt-sec-count" }, String(props.count)) : null,
      props.sub ? h2("span", { className: "rt-sec-sub" }, props.sub) : null,
      props.right ? h2("span", { className: "rt-sec-right" }, props.right) : null
    );
    return h2(
      "div",
      { className: "rt-sec-wrap" },
      head,
      open && props.children ? h2("div", { className: "rt-sec-body" }, props.children) : null
    );
  }
  function Clip(props) {
    const [open, setOpen] = import_react2.default.useState(false);
    const text = String(
      props.text === void 0 || props.text === null ? "" : props.text
    );
    if (text.trim() === "") return null;
    return h2(
      "div",
      { className: "rt-clip" + (open ? " open" : "") },
      h2(
        "div",
        { className: "rt-clip-head" },
        props.label ? h2("span", { className: "rt-clip-label" }, props.label) : null,
        h2("div", { className: "rt-spacer" }),
        h2(
          "button",
          {
            className: "rt-btn",
            style: { padding: "0 6px", fontSize: 11 },
            onClick: (e) => {
              e.stopPropagation();
              copyText(text);
            }
          },
          "\u590D\u5236"
        ),
        h2(
          "button",
          {
            className: "rt-btn",
            style: { padding: "0 6px", fontSize: 11 },
            onClick: (e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }
          },
          open ? "\u6536\u8D77" : "\u5C55\u5F00"
        )
      ),
      h2("div", { className: "rt-clip-body" }, text)
    );
  }
  const TEST_STATUS_LABEL = {
    untested: "\u672A\u6D4B\u8BD5",
    testing: "\u6D4B\u8BD5\u4E2D",
    tested: "\u5DF2\u6D4B\u8BD5",
    blocked: "\u88AB\u5C01\u7981",
    abandoned: "\u5DF2\u653E\u5F03",
    no_surface: "\u65E0\u653B\u51FB\u9762"
  };
  function TestingTab(props) {
    const eng = props.engagement;
    const refreshKey = props.refreshKey || 0;
    const [data, setData] = import_react2.default.useState(null);
    const [err, setErr] = import_react2.default.useState(null);
    const [at, setAt] = import_react2.default.useState(null);
    const [auto, setAuto] = import_react2.default.useState(true);
    const collapse = useCollapse("testing:" + eng);
    const inflight = import_react2.default.useRef(false);
    const seq = import_react2.default.useRef(0);
    const load = () => {
      if (!eng || inflight.current) return;
      inflight.current = true;
      const my = ++seq.current;
      api({ op: "activeTests", engagement: eng, limit: 20 }).then(
        (r) => {
          if (my !== seq.current) return;
          if (!r || r.ok === false) {
            setErr(r && r.error || "\u8BFB\u53D6\u5931\u8D25");
            return;
          }
          setErr(null);
          setData(r);
          setAt(/* @__PURE__ */ new Date());
        },
        (e) => {
          if (my === seq.current) setErr(String(e && e.message || e));
        }
      ).finally(() => {
        if (my === seq.current) inflight.current = false;
      });
    };
    import_react2.default.useEffect(() => {
      seq.current += 1;
      load();
    }, [eng, refreshKey]);
    import_react2.default.useEffect(() => {
      if (!eng || !auto) return void 0;
      const timer = setInterval(load, 5e3);
      return () => clearInterval(timer);
    }, [eng, auto, refreshKey]);
    const testing = data && data.testing || [];
    const recent = data && data.recent || [];
    const queue = data && data.queue || [];
    const stats2 = data && data.stats || {};
    const card = (a, past) => {
      const chips = [];
      chips.push(
        h2(
          "span",
          {
            key: "sc",
            className: "rt-scope rt-scope-" + (a.scope === "internal" ? "internal" : "external")
          },
          a.scope === "internal" ? "\u5185\u7F51" : "\u5916\u7F51"
        )
      );
      if (a.segment_cidr)
        chips.push(
          h2("span", { key: "seg", className: "rt-tag" }, a.segment_cidr)
        );
      if (a.open_ports)
        chips.push(
          h2(
            "span",
            { key: "p", className: "rt-tag rt-tag-active" },
            "\u5F00\u653E " + a.open_ports + " \u7AEF\u53E3"
          )
        );
      if (a.vulns)
        chips.push(
          h2(
            "span",
            { key: "v", className: "rt-tag rt-tag-live" },
            "\u5DF2\u786E\u8BA4\u6F0F\u6D1E " + a.vulns
          )
        );
      if (a.webshells)
        chips.push(
          h2(
            "span",
            { key: "w", className: "rt-tag rt-tag-passive" },
            "WebShell " + a.webshells
          )
        );
      if (a.tunnels)
        chips.push(
          h2(
            "span",
            { key: "t", className: "rt-tag rt-tag-passive" },
            "\u96A7\u9053 " + a.tunnels
          )
        );
      if (a.priority)
        chips.push(
          h2("span", { key: "pr", className: "rt-tag" }, "\u6613\u6253 " + a.priority)
        );
      if (a.blocked_count)
        chips.push(
          h2(
            "span",
            {
              key: "b",
              className: "rt-tag",
              style: { color: "#ef4444", borderColor: "#ef444455" }
            },
            "\u88AB\u5C01 " + a.blocked_count + " \u6B21"
          )
        );
      const noteLines = a.test_notes ? String(a.test_notes).split("\n").slice(-3).map((l) => l.length > 240 ? l.slice(0, 240) + " \u2026" : l) : [];
      return h2(
        "div",
        { key: "at" + a.id, className: "rt-atest" + (past ? " past" : "") },
        h2(
          "div",
          { className: "rt-atest-head" },
          past ? null : h2("span", { className: "rt-live-dot" }),
          h2("span", { className: "rt-atest-ip" }, a.ip),
          h2(
            "span",
            {
              className: "rt-tag " + (a.test_status === "testing" ? "rt-tag-live" : "")
            },
            TEST_STATUS_LABEL[a.test_status] || a.test_status
          ),
          h2("div", { className: "rt-spacer" }),
          h2(
            "span",
            {
              style: {
                fontSize: 11,
                color: "var(--dsw-alias-label-secondary)"
              }
            },
            fmt(a.test_updated_at) + (a.test_updated_by ? " \xB7 " + a.test_updated_by : "")
          )
        ),
        chips.length ? h2("div", null, chips) : null,
        a.test_surface ? h2(
          "div",
          { className: "rt-atest-meta" },
          "\u6D4B\u8BD5\u9762\uFF1A" + a.test_surface
        ) : null,
        a.potential ? h2("div", { className: "rt-atest-meta" }, "\u9884\u671F\u5F97\u5206\uFF1A" + a.potential) : null,
        noteLines.length ? h2(Clip, { label: "\u6D4B\u8BD5\u8BB0\u5F55", text: noteLines.join("\n") }) : null
      );
    };
    const concl = (label, value, tone) => h2(
      "span",
      { key: label, className: "rt-concl-i", style: { cursor: "default" } },
      h2("b", null, String(value || 0)),
      h2("span", null, label)
    );
    const conclusion = h2(
      "div",
      { className: "rt-concl" },
      concl("\u6D4B\u8BD5\u4E2D", stats2.testing, "live"),
      concl("\u5F85\u6D4B", stats2.untested, ""),
      concl("\u5DF2\u6D4B", stats2.tested, ""),
      concl("\u653E\u5F03", (stats2.abandoned || 0) + (stats2.blocked || 0), ""),
      concl("\u65E0\u653B\u51FB\u9762", stats2.no_surface, ""),
      h2("div", { className: "rt-spacer" }),
      at ? h2(
        "span",
        {
          style: {
            fontSize: 11,
            color: "var(--dsw-alias-label-secondary)"
          }
        },
        "\u66F4\u65B0\u4E8E " + at.toLocaleTimeString("zh-CN", { hour12: false })
      ) : null,
      h2(
        "button",
        {
          className: "rt-btn",
          style: { padding: "0 7px", fontSize: 11 },
          title: "\u5C55\u5F00\u6700\u8FD1\u52A8\u8FC7\u4E0E\u5F85\u6D4B\u961F\u5217",
          onClick: () => collapse.setAll(
            ["testing:" + eng, "recent:" + eng, "queue:" + eng],
            true
          )
        },
        "\u5168\u90E8\u5C55\u5F00"
      ),
      h2(
        "button",
        {
          className: "rt-btn",
          style: { padding: "0 7px", fontSize: 11 },
          title: "\u53EA\u7559\u6B63\u5728\u6D4B",
          onClick: () => collapse.setAll(
            ["testing:" + eng, "recent:" + eng, "queue:" + eng],
            false
          )
        },
        "\u5168\u90E8\u6536\u8D77"
      ),
      h2(
        "button",
        {
          className: "rt-btn" + (auto ? " rt-btn-primary" : ""),
          style: { padding: "0 7px", fontSize: 11 },
          title: "\u6BCF 5 \u79D2\u81EA\u52A8\u5237\u65B0",
          onClick: () => setAuto((x) => !x)
        },
        auto ? "\u5B9E\u65F6 \xB7 5s" : "\u5DF2\u6682\u505C"
      ),
      h2(
        "button",
        {
          className: "rt-btn",
          style: { padding: "0 7px", fontSize: 11 },
          onClick: load
        },
        "\u5237\u65B0"
      )
    );
    const body = [];
    body.push(
      h2(
        Section,
        {
          key: "testing",
          tone: "test",
          title: "\u6B63\u5728\u6D4B",
          count: testing.length + " \u53F0",
          sub: testing.length ? "agent \u6B63\u5728\u6253\u8FD9\u4E9B\u8D44\u4EA7" : "agent \u5F00\u59CB\u6D4B\u67D0\u53F0\u8D44\u4EA7\u540E\u4F1A\u5B9E\u65F6\u51FA\u73B0\u5728\u8FD9\u91CC",
          open: collapse.isOpen("testing:" + eng, true),
          onToggle: collapse.toggle("testing:" + eng, true)
        },
        testing.length ? testing.map((a) => card(a, false)) : h2(
          "div",
          { className: "rt-atest-meta", style: { paddingBottom: 4 } },
          "\u5F53\u524D\u6CA1\u6709\u8D44\u4EA7\u5904\u4E8E\u300C\u6D4B\u8BD5\u4E2D\u300D"
        )
      )
    );
    body.push(
      h2(
        Section,
        {
          key: "recent",
          tone: "past",
          title: "\u6700\u8FD1\u52A8\u8FC7",
          count: recent.length + " \u53F0",
          sub: "\u5DF2\u6D4B\u8FC7\u7684\u8D44\u4EA7",
          open: collapse.isOpen("recent:" + eng, false),
          onToggle: collapse.toggle("recent:" + eng, false)
        },
        recent.length ? recent.map((a) => card(a, true)) : h2("div", { className: "rt-atest-meta" }, "\u6682\u65E0")
      )
    );
    body.push(
      h2(
        Section,
        {
          key: "queue",
          tone: "queue",
          title: "\u5F85\u6D4B\u961F\u5217",
          count: (data ? data.untested || 0 : 0) + " \u53F0",
          sub: "\u6309\u6613\u6253\u6027\u4E0E\u7AEF\u53E3\u6570\u6392\u51FA\u5148\u6253\u54EA\u51E0\u53F0",
          open: collapse.isOpen("queue:" + eng, false),
          onToggle: collapse.toggle("queue:" + eng, false)
        },
        queue.length ? queue.map((a) => card(a, true)).concat([
          h2(
            "div",
            {
              key: "queueHint",
              className: "rt-atest-meta",
              style: { paddingTop: 4 }
            },
            "\u5B8C\u6574\u6E05\u5355\uFF08\u542B\u7B5B\u9009\u4E0E\u6392\u5E8F\uFF09\u89C1\u300C\u8D44\u4EA7\u6D4B\u7ED8\u300D\u9875"
          )
        ]) : h2("div", { className: "rt-atest-meta" }, "\u6CA1\u6709\u5F85\u6D4B\u8D44\u4EA7")
      )
    );
    return h2(
      "div",
      { className: "rt-main" },
      conclusion,
      err ? h2("div", { className: "rt-err" }, err) : null,
      data === null && !err ? h2("div", { className: "rt-empty" }, "\u52A0\u8F7D\u4E2D\u2026") : null,
      h2(
        "div",
        { className: "rt-body", style: { overflow: "auto" } },
        h2("div", { style: { padding: "6px 12px 14px" } }, body)
      )
    );
  }
  function SessionTab(props) {
    const eng = props.engagement;
    const refreshKey = props.refreshKey || 0;
    const [data, setData] = import_react2.default.useState(null);
    const [err, setErr] = import_react2.default.useState(null);
    const [busy, setBusy] = import_react2.default.useState(false);
    const [msg, setMsg] = import_react2.default.useState(null);
    const [copied, setCopied] = import_react2.default.useState(null);
    const load = () => {
      if (!eng) return;
      api({ op: "sessions", engagement: eng }).then(
        (r) => {
          if (!r || r.ok === false) {
            setErr(r && r.error || "\u8BFB\u53D6\u5931\u8D25");
            return;
          }
          setErr(null);
          setData(r);
        },
        (e) => setErr(String(e && e.message || e))
      );
    };
    import_react2.default.useEffect(load, [eng, refreshKey]);
    const probe = () => {
      setBusy(true);
      setMsg(null);
      api({ op: "probeSessions", engagement: eng, timeoutMs: 6e3 }).then(
        (r) => {
          setBusy(false);
          if (!r || r.ok === false) {
            setMsg({ err: r && r.error || "\u68C0\u6D4B\u5931\u8D25" });
            load();
            return;
          }
          const on = (r.webshells || []).filter(
            (x) => x.status === "online"
          ).length;
          const act = (r.tunnels || []).filter(
            (x) => x.status === "active"
          ).length;
          setMsg({
            ok: "\u68C0\u6D4B\u5B8C\u6210\uFF1AWebShell \u5728\u7EBF " + on + "/" + (r.webshells || []).length + "\uFF0C\u96A7\u9053\u53EF\u7528 " + act + "/" + (r.tunnels || []).length
          });
          load();
        },
        (e) => {
          setBusy(false);
          setMsg({ err: String(e && e.message || e) });
        }
      );
    };
    const copy = (key, text) => copyWithFeedback(text, text, (okFlag, message) => {
      if (!okFlag) {
        setMsg({ err: message });
        return;
      }
      setCopied(key);
      setTimeout(() => setCopied((c) => c === key ? null : c), 1500);
    });
    const markTunnel = (t, status) => {
      setMsg(null);
      api({
        op: "updateTunnel",
        engagement: eng,
        id: t.id,
        patch: { status, check_note: "\u754C\u9762\u624B\u52A8\u6807\u8BB0" }
      }).then(
        () => load(),
        (e) => setMsg({ err: String(e && e.message || e) })
      );
    };
    const markShell = (w, status) => {
      setMsg(null);
      api({
        op: "updateWebshell",
        engagement: eng,
        id: w.id,
        patch: { status, check_note: "\u754C\u9762\u624B\u52A8\u6807\u8BB0" }
      }).then(
        () => load(),
        (e) => setMsg({ err: String(e && e.message || e) })
      );
    };
    const sessCollapse = useCollapse("sessions:" + eng);
    const totals = data && data.totals || {};
    const shells = data && data.webshells || [];
    const tunnels = data && data.tunnels || [];
    const statusDot = (s) => h2("span", {
      className: s === "online" || s === "active" ? "rt-dot-on" : s === "unknown" || !s ? "rt-dot-unk" : "rt-dot-off"
    });
    const fact = (label, value) => h2(
      "div",
      { className: "rt-sess-fact" },
      h2("b", null, label),
      h2("span", null, value)
    );
    const isEncryptedShell = (t) => /behinder|godzilla|冰蝎|哥斯拉/i.test(String(t || ""));
    const isSuo5 = (t) => /suo5/i.test(String(t || ""));
    const hint = (key, title, detail) => h2(
      "div",
      { key, className: "rt-hint" },
      h2("b", null, title),
      h2(
        "details",
        { className: "rt-sess-fold", style: { marginTop: 3 } },
        h2("summary", null, "\u600E\u4E48\u505A\uFF08\u70B9\u51FB\u5C55\u5F00\uFF09"),
        h2("div", { style: { marginTop: 4 } }, detail)
      )
    );
    const hints = [];
    const badShells = shells.filter((w) => !isEncryptedShell(w.shell_type));
    const legitTunnels = tunnels.filter((t) => t.legit === true);
    if (badShells.length > 0) {
      hints.push(
        hint(
          "h1",
          "\u6709 " + badShells.length + " \u4E2A\u5165\u53E3\u4E0D\u662F\u51B0\u874E\u9A6C/\u54E5\u65AF\u62C9\u9A6C\uFF08\u7528\u6237\u8FDE\u4E0D\u4E0A\uFF0C\u4E0D\u7B97\u53EF\u4EA4\u4ED8\u5165\u53E3\uFF09",
          "\u7528\u6280\u80FD webshell-toolkit \u91CD\u65B0\u4E0A\u4F20\u51B0\u874E\u9A6C\uFF08behinder\uFF09\u6216\u54E5\u65AF\u62C9\u9A6C\uFF08godzilla\uFF09\uFF0C\u5E76\u628A shell_type + pass_key \u5199\u8FDB redteam_webshell_add\u3002\u53EA\u4F5C\u4E34\u65F6\u4E2D\u8F6C\u7684\u53EF\u5728\u5907\u6CE8\u91CC\u5199\u660E\u3002"
        )
      );
    }
    if (tunnels.length > 0 && legitTunnels.length === 0) {
      hints.push(
        hint(
          "h3",
          "\u73B0\u6709 " + tunnels.length + ' \u6761\u901A\u9053\u90FD\u4E0D\u7B97"\u8DE8\u8D8A\u9776\u6807\u8FB9\u754C"\uFF08\u4E0D\u7B97\u8FB9\u754C/\u5185\u7F51\u7A81\u7834\uFF09',
          "\u81EA\u5DF1\u7684 VPS / \u81EA\u5EFA\u670D\u52A1\u5668\u4E0A\u5F00\u7684 socks5\u3001frp\u3001\u4EE3\u7406\u4E0D\u7B97\u96A7\u9053\u3002\u5FC5\u987B\u662F\u76EE\u6807\u4FA7\u53D1\u8D77\u7684\u901A\u9053\uFF1A\u76EE\u6807\u53CD\u5F39 shell \u5230\u6211\u65B9\u3001\u76EE\u6807\u4E0A\u8DD1 frp/Stowaway \u5BA2\u6237\u7AEF\u3001\u6216\u7ECF\u76EE\u6807 WebShell \u5EFA\u7684 suo5/HTTP \u96A7\u9053\uFF1B\u767B\u8BB0\u65F6\u7528 entry_kind \u8BF4\u660E\u3002"
        )
      );
    }
    const activeSuo5 = tunnels.filter(
      (t) => isSuo5(t.kind) && t.status === "active"
    );
    if (shells.length > 0 && activeSuo5.length === 0) {
      hints.push(
        hint(
          "h2",
          "\u8FD8\u6CA1\u6709\u53EF\u7528\u7684 suo5 \u96A7\u9053\uFF08\u6253\u8FDB\u5185\u7F51\u7684\u6807\u51C6\u901A\u9053\uFF09",
          "\u7528\u6280\u80FD suo5-tunnel \u901A\u8FC7\u4E0A\u9762\u7684 WebShell \u5EFA socks5 \u96A7\u9053\uFF0C\u518D redteam_tunnel_add\uFF08kind=suo5\u3001listen=127.0.0.1:1080\u3001entry=WebShell URL\u3001reach=\u53EF\u8FBE\u7F51\u6BB5\uFF09\u767B\u8BB0\uFF0C\u6700\u540E\u70B9\u300C\u68C0\u6D4B\u8FDE\u901A\u6027\u300D\u786E\u8BA4 status=active\u3002"
        )
      );
    }
    const shellCards = shells.map(
      (w) => h2(
        "div",
        { key: "w" + w.id, className: "rt-sess" },
        h2(
          "div",
          { className: "rt-sess-head" },
          statusDot(w.status),
          h2("span", { className: "rt-sess-title" }, w.url),
          h2(
            "span",
            { className: "rt-tag rt-tag-active" },
            w.shell_type || "webshell"
          ),
          isEncryptedShell(w.shell_type) ? null : h2("span", { className: "rt-tag rt-tag-warn" }, "\u7528\u6237\u8FDE\u4E0D\u4E0A"),
          w.privilege ? h2("span", { className: "rt-tag" }, w.privilege) : null,
          h2("div", { className: "rt-spacer" }),
          copied === "cmd" + w.id ? h2(
            "span",
            { className: "rt-tag", style: { color: "#10b981" } },
            "\u5DF2\u590D\u5236"
          ) : h2(
            "button",
            {
              className: "rt-btn",
              style: { padding: "0 6px", fontSize: 11 },
              onClick: () => copy("cmd" + w.id, 'curl -s "' + w.url + '"')
            },
            "\u590D\u5236 URL"
          ),
          h2(
            "button",
            {
              className: "rt-btn",
              style: { padding: "0 6px", fontSize: 11 },
              onClick: () => markShell(w, "offline")
            },
            "\u6807\u8BB0\u5931\u6548"
          )
        ),
        h2(
          "div",
          { className: "rt-sess-facts" },
          fact(
            "\u7C7B\u578B",
            isEncryptedShell(w.shell_type) ? "\u52A0\u5BC6\u9A6C\uFF08\u51B0\u874E/\u54E5\u65AF\u62C9\uFF0C\u7528\u6237\u53EF\u76F4\u8FDE\uFF09" : "\u975E\u52A0\u5BC6\u9A6C \u2014\u2014 \u7528\u6237\u8FDE\u4E0D\u4E0A\uFF0C\u4EC5\u53EF\u4F5C\u4E34\u65F6\u4E2D\u8F6C"
          ),
          w.pass_key ? fact("\u8FDE\u63A5\u53E3\u4EE4", h2("span", { className: "rt-mono" }, w.pass_key)) : null,
          w.asset_ip ? fact("\u6240\u5728\u8D44\u4EA7", w.asset_ip) : null,
          w.privilege ? fact("\u6743\u9650", w.privilege) : null,
          w.secret_ref ? fact(
            "\u51ED\u636E\u5F15\u7528",
            h2("span", { className: "rt-mono" }, w.secret_ref)
          ) : null,
          fact(
            "\u6700\u540E\u68C0\u6D4B",
            (w.last_check ? fmt(w.last_check) : "\u672A\u68C0\u6D4B") + (w.latency_ms !== null && w.latency_ms !== void 0 ? "\uFF08" + w.latency_ms + "ms\uFF09" : "")
          ),
          w.check_note ? fact("\u68C0\u6D4B\u8BF4\u660E", w.check_note) : null,
          w.note ? fact("\u5907\u6CE8", w.note) : null
        )
      )
    );
    const tunnelCards = tunnels.map((t) => {
      const proxy = t.listen ? "socks5://" + t.listen : "";
      const gogoCmd = t.listen ? "./gogo -i <\u5185\u7F51CIDR> -m ss --ping -p top2,win,db --proxy " + proxy : "";
      const fscanCmd = t.listen ? "./fscan -h <\u5185\u7F51CIDR> -np -nobr -nopoc -socks5 " + t.listen + " -o intranet.txt" : "";
      return h2(
        "div",
        { key: "t" + t.id, className: "rt-sess" },
        h2(
          "div",
          { className: "rt-sess-head" },
          statusDot(t.status),
          h2(
            "span",
            { className: "rt-sess-title" },
            t.listen || "(\u672A\u586B\u76D1\u542C\u5730\u5740)"
          ),
          h2("span", { className: "rt-tag rt-tag-passive" }, t.kind || "tunnel"),
          isSuo5(t.kind) ? null : h2(
            "span",
            { className: "rt-tag rt-tag-warn" },
            "\u975E suo5 \u6807\u51C6\u901A\u9053"
          ),
          /* 只有跨越靶标边界的通道才算突破凭证（自己 VPS/自建服务器上开的不算） */
          t.legit === true ? h2(
            "span",
            {
              className: "rt-tag rt-tag-live",
              title: t.entry_kind_label || ""
            },
            "\u76EE\u6807\u4FA7\u901A\u9053"
          ) : t.legit === false ? h2(
            "span",
            {
              className: "rt-tag rt-tag-warn",
              title: "\u53EA\u5728\u81EA\u5DF1 VPS/\u81EA\u5EFA\u670D\u52A1\u5668\u4E0A\u5F00\u7684\u901A\u9053\uFF0C\u6CA1\u6709\u78B0\u5230\u76EE\u6807 \u2014\u2014 \u4E0D\u7B97\u8FB9\u754C\u7A81\u7834/\u5185\u7F51\u7A81\u7834"
            },
            "\u4E0D\u7B97\u7A81\u7834"
          ) : h2(
            "span",
            {
              className: "rt-tag",
              title: "\u672A\u58F0\u660E entry_kind\uFF1A\u8BF7\u8BF4\u660E\u76EE\u6807\u4FA7\u7684\u90A3\u4E00\u7AEF\u662F\u4EC0\u4E48\uFF08target-outbound / target-http / target-agent\uFF09"
            },
            "\u5F85\u786E\u8BA4"
          ),
          t.reach ? h2("span", { className: "rt-tag" }, "\u53EF\u8FBE " + t.reach) : null,
          h2("div", { className: "rt-spacer" }),
          h2(
            "button",
            {
              className: "rt-btn",
              style: { padding: "0 6px", fontSize: 11 },
              onClick: () => copy("sock" + t.id, t.listen || "")
            },
            copied === "sock" + t.id ? "\u5DF2\u590D\u5236" : "\u590D\u5236\u5730\u5740"
          ),
          t.status === "active" ? h2(
            "button",
            {
              className: "rt-btn",
              style: { padding: "0 6px", fontSize: 11 },
              onClick: () => markTunnel(t, "down")
            },
            "\u6807\u8BB0\u5931\u6548"
          ) : h2(
            "button",
            {
              className: "rt-btn",
              style: { padding: "0 6px", fontSize: 11 },
              onClick: () => markTunnel(t, "active")
            },
            "\u6807\u8BB0\u53EF\u7528"
          )
        ),
        h2(
          "div",
          { className: "rt-sess-facts" },
          fact("\u76EE\u6807\u4FA7\u5165\u53E3", t.entry || "\u672A\u767B\u8BB0"),
          fact(
            "\u8DE8\u8D8A\u8FB9\u754C",
            t.legit === true ? h2(
              "span",
              { className: "rt-tag rt-tag-live" },
              t.entry_kind_label || t.entry_kind || "\u5DF2\u786E\u8BA4\u76EE\u6807\u4FA7"
            ) : t.legit === false ? h2(
              "span",
              { className: "rt-tag rt-tag-warn" },
              "\u4E0D\u7B97\u7A81\u7834\uFF08\u53EA\u5728\u81EA\u5DF1 VPS \u4E0A\u5F00\u4EE3\u7406\uFF09"
            ) : h2(
              "span",
              { className: "rt-tag" },
              "\u672A\u58F0\u660E entry_kind\uFF0C\u5F85\u786E\u8BA4"
            )
          ),
          t.reach ? fact("\u53EF\u8FBE\u7F51\u6BB5", t.reach) : null,
          t.asset_ip ? fact("\u6240\u5728\u8D44\u4EA7", t.asset_ip) : null,
          fact(
            "\u6700\u540E\u68C0\u6D4B",
            (t.last_check ? fmt(t.last_check) : "\u672A\u68C0\u6D4B") + (t.latency_ms !== null && t.latency_ms !== void 0 ? "\uFF08" + t.latency_ms + "ms\uFF09" : "")
          ),
          t.check_note ? fact("\u68C0\u6D4B\u8BF4\u660E", t.check_note) : null,
          t.note ? fact("\u5907\u6CE8", t.note) : null
        ),
        /* 命令默认折叠：卡片首要信息是"这条通道能不能用、通向哪"，命令按需展开 */
        t.command ? h2(
          "details",
          { className: "rt-sess-fold" },
          h2("summary", null, "\u5EFA\u7ACB\u547D\u4EE4\uFF08\u70B9\u51FB\u5C55\u5F00 / \u590D\u5236\uFF09"),
          h2(
            "div",
            Object.assign(
              { className: "rt-code", title: "\u70B9\u51FB\u590D\u5236" },
              clickable(() => copy("c" + t.id, t.command), {
                label: "\u590D\u5236\u547D\u4EE4"
              })
            ),
            copied === "c" + t.id ? "\u5DF2\u590D\u5236" : t.command
          )
        ) : null,
        t.status === "active" && t.listen ? h2(
          "details",
          { className: "rt-sess-fold" },
          h2("summary", null, "\u8D70\u8FD9\u6761\u96A7\u9053\u626B\u63CF\uFF08gogo / fscan \u547D\u4EE4\uFF09"),
          h2(
            "div",
            { className: "rt-sess-cmd" },
            h2(
              "div",
              Object.assign(
                { className: "rt-code", title: "\u70B9\u51FB\u590D\u5236" },
                clickable(() => copy("g" + t.id, gogoCmd), {
                  label: "\u590D\u5236 gogo \u547D\u4EE4"
                })
              ),
              copied === "g" + t.id ? "\u5DF2\u590D\u5236" : gogoCmd
            ),
            h2(
              "div",
              Object.assign(
                {
                  className: "rt-code",
                  style: { display: "block", marginTop: 3 },
                  title: "\u70B9\u51FB\u590D\u5236"
                },
                clickable(() => copy("f" + t.id, fscanCmd), {
                  label: "\u590D\u5236 fscan \u547D\u4EE4"
                })
              ),
              copied === "f" + t.id ? "\u5DF2\u590D\u5236" : fscanCmd
            )
          )
        ) : null
      );
    });
    return h2(
      "div",
      { className: "rt-main" },
      h2(
        "div",
        { className: "rt-toolbar" },
        h2("span", { style: { fontWeight: 600 } }, "\u4F1A\u8BDD\u4E0E\u5165\u53E3"),
        h2(
          "span",
          { className: "rt-tag" },
          "WebShell " + (totals.webshellsOnline || 0) + "/" + (totals.webshells || 0) + " \u5728\u7EBF"
        ),
        h2(
          "span",
          { className: "rt-tag" },
          "\u96A7\u9053 " + (totals.tunnelsActive || 0) + "/" + (totals.tunnels || 0) + " \u53EF\u7528"
        ),
        h2("span", { className: "rt-tag" }, "\u51ED\u636E " + (totals.credentials || 0)),
        h2("span", { className: "rt-tag" }, "\u8BBF\u95EE\u4F1A\u8BDD " + (totals.access || 0)),
        h2("div", { className: "rt-spacer" }),
        h2(
          "button",
          {
            className: "rt-btn rt-btn-primary",
            disabled: busy,
            onClick: probe
          },
          busy ? "\u68C0\u6D4B\u4E2D\u2026" : "\u68C0\u6D4B\u8FDE\u901A\u6027"
        ),
        h2("button", { className: "rt-btn", onClick: load }, "\u5237\u65B0")
      ),
      msg ? h2(
        "div",
        { className: msg.err ? "rt-err" : "rt-foot" },
        msg.err || msg.ok
      ) : null,
      err ? h2("div", { className: "rt-err" }, err) : null,
      h2(
        "div",
        { className: "rt-body", style: { overflow: "auto" } },
        !shells.length && !tunnels.length ? h2(
          "div",
          { className: "rt-empty" },
          h2("div", null, "\u8FD8\u6CA1\u6709\u767B\u8BB0\u4EFB\u4F55 WebShell \u6216\u96A7\u9053\u3002"),
          h2(
            "div",
            { style: { marginTop: 6, fontSize: 12 } },
            "\u62FF\u5230 WebShell \u7528 redteam_webshell_add\uFF1B\u5EFA\u597D\u96A7\u9053\u7528 redteam_tunnel_add\uFF08suo5 / socks5 / ssh -R\uFF09\uFF1B\u4E4B\u540E\u667A\u80FD\u4F53\u7528 redteam_sessions \u5C31\u80FD\u770B\u5230\u3002"
          )
        ) : null,
        hints.length ? h2("div", { style: { padding: "8px 10px 0" } }, hints) : null,
        h2(
          Section,
          {
            key: "webshells",
            tone: "queue",
            title: "WebShell",
            count: (totals.webshellsOnline || 0) + "/" + (totals.webshells || 0) + " \u5728\u7EBF",
            sub: "\u5DF2\u4E0A\u7EBF\u7684\u53EF\u63A7\u5165\u53E3",
            open: sessCollapse.isOpen("shells", true),
            onToggle: sessCollapse.toggle("shells", true)
          },
          shells.length ? h2(
            "div",
            { className: "rt-sess-grid", style: { padding: 0 } },
            shellCards
          ) : h2(
            "div",
            { className: "rt-atest-meta" },
            "\u6682\u65E0\uFF08\u62FF\u5230 WebShell \u540E\u7528 redteam_webshell_add \u767B\u8BB0\uFF09"
          )
        ),
        h2(
          Section,
          {
            key: "tunnels",
            tone: "test",
            title: "\u5185\u7F51\u96A7\u9053",
            count: (totals.tunnelsActive || 0) + "/" + (totals.tunnels || 0) + " \u53EF\u7528",
            sub: "\u53EF\u76F4\u63A5\u7ED9\u626B\u63CF\u5668\u5F53\u4EE3\u7406\u7528",
            open: sessCollapse.isOpen("tunnels", true),
            onToggle: sessCollapse.toggle("tunnels", true)
          },
          tunnels.length ? h2(
            "div",
            { className: "rt-sess-grid", style: { padding: 0 } },
            tunnelCards
          ) : h2(
            "div",
            { className: "rt-atest-meta" },
            "\u6682\u65E0\uFF08\u5EFA\u597D\u96A7\u9053\u540E\u7528 redteam_tunnel_add \u767B\u8BB0\uFF09"
          )
        )
      )
    );
  }
  class RtBoundary extends import_react2.default.Component {
    constructor(props) {
      super(props);
      this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
      return { error };
    }
    componentDidCatch(error) {
      try {
        console.error("[redteam-ui] \u9875\u9762\u6E32\u67D3\u51FA\u9519:", error);
      } catch (e) {
      }
    }
    render() {
      if (this.state.error) {
        const msg = this.state.error && this.state.error.message ? this.state.error.message : String(this.state.error);
        return h2(
          "div",
          { className: "rt-pane" },
          h2("div", { className: "rt-err" }, "\u8BE5\u9875\u9762\u6E32\u67D3\u51FA\u9519\uFF1A" + msg),
          h2(
            "button",
            {
              className: "rt-btn",
              onClick: () => {
                this.setState({ error: null });
                setUI({ tab: "assets" });
              }
            },
            "\u56DE\u5230\u8D44\u4EA7\u6D4B\u7ED8"
          )
        );
      }
      return this.props.children;
    }
  }
  function AgentsTab(props) {
    const eng = props.engagement;
    const refreshKey = props.refreshKey || 0;
    const [roles, setRoles] = import_react2.default.useState(null);
    const [err, setErr] = import_react2.default.useState(null);
    const [concurrency, setConcurrency] = import_react2.default.useState(null);
    const [busy, setBusy] = import_react2.default.useState(false);
    const load = () => {
      setBusy(true);
      api({
        op: eng ? "prompts" : "bootstrap",
        engagement: eng || void 0
      }).then(
        (r) => {
          setBusy(false);
          if (!r || r.ok === false) {
            setErr(r && r.error || "\u8BFB\u53D6\u5931\u8D25");
            return;
          }
          setErr(null);
          if (r.roles) setRoles(r.roles);
        },
        (e) => {
          setBusy(false);
          setErr(String(e && e.message || e));
        }
      );
      api({ op: "agentsStatus", engagement: eng || void 0 }).then(
        (r) => {
          if (r && r.ok !== false) setConcurrency(r);
        },
        () => {
        }
      );
    };
    import_react2.default.useEffect(load, [eng, refreshKey]);
    const used = concurrency ? concurrency.used : null;
    const max = concurrency ? concurrency.max : 3;
    return h2(
      "div",
      { className: "rt-main" },
      h2(
        "div",
        { className: "rt-toolbar" },
        h2("span", { style: { fontWeight: 600 } }, "\u4F5C\u6218\u667A\u80FD\u4F53"),
        h2("span", { className: "rt-tag rt-tag-passive" }, "\u5E76\u53D1\u4E0A\u9650 " + max),
        used === null ? h2("span", { className: "rt-tag" }, "\u5360\u7528\u672A\u77E5") : h2(
          "span",
          {
            className: "rt-tag" + (used >= max ? " rt-tag-warn" : " rt-tag-live")
          },
          "\u5728\u8DD1 " + used + " / \u5269\u4F59 " + Math.max(max - used, 0)
        ),
        h2("div", { className: "rt-spacer" }),
        h2(
          "button",
          { className: "rt-btn", disabled: busy, onClick: load },
          busy ? "\u8BFB\u53D6\u4E2D\u2026" : "\u5237\u65B0"
        )
      ),
      h2(
        "div",
        { className: "rt-pane" },
        err ? h2("div", { className: "rt-err" }, err) : null,
        h2(
          "div",
          { className: "rt-card" },
          h2("h4", null, "\u5E76\u53D1\u89C4\u5219\uFF08\u786C\u7EA6\u675F\uFF09"),
          h2(
            "div",
            { style: { fontSize: 12, lineHeight: 1.7 } },
            "\xB7 \u540C\u4E00\u9776\u6807**\u540C\u65F6\u6700\u591A " + max + " \u4E2A\u6267\u884C\u667A\u80FD\u4F53**\uFF1B\u4E3B\u4F1A\u8BDD\u6D3E\u6D3B\u524D\u7528 `redteam_agent_slot` \u5360\u4F4D\uFF0C\u6EE1\u4E86\u76F4\u63A5\u62D2\u7EDD\u3002",
            h2("br"),
            "\xB7 **\u9ED8\u8BA4\u4E00\u4E2A\u4E00\u4E2A\u6D3E\u3001\u6309\u987A\u5E8F\u63A8\u8FDB**\uFF1B\u53EA\u6709\u786E\u5B9E\u4E92\u4E0D\u4F9D\u8D56\u7684\u6D3B\u624D\u5E76\u884C\u3002",
            h2("br"),
            "\xB7 \u6BCF\u4E2A\u4F1A\u8BDD\u6709**\u81EA\u5DF1\u7684\u9776\u6807\u7ED1\u5B9A**\uFF1A\u591A\u4F1A\u8BDD\u5E76\u884C\u4E0D\u4F1A\u628A\u62A5\u544A\u5199\u4E32\uFF08\u5B50\u667A\u80FD\u4F53\u7EE7\u627F\u7236\u4F1A\u8BDD\u7684\u9776\u6807\uFF09\u3002"
          )
        ),
        h2(
          "div",
          { className: "rt-card" },
          h2("h4", null, "\u516D\u4E2A\u89D2\u8272"),
          h2(
            "div",
            { style: { fontSize: 12, lineHeight: 1.8 } },
            "\u2460 \u4FE1\u606F\u6536\u96C6 `recon` \u2014\u2014 \u53EA\u6536\u96C6\u8D44\u4EA7\uFF0C\u628A\u5355\u4F4D\u8D44\u4EA7\u6536\u96C6\u5B8C\u6574\uFF08\u542B\u8FB9\u7F18\u4E0E\u672A\u5907\u6848\u8D44\u4EA7\uFF09",
            h2("br"),
            "\u2461 \u8D44\u4EA7\u68B3\u7406 `assess` \u2014\u2014 \u4E00\u6761\u4E00\u6761\u8FC7\uFF0C\u8BC4\u6613\u6253\u6027\u5E76\u5168\u90E8\u843D\u5E93",
            h2("br"),
            "\u2462 \u6F0F\u6D1E\u53D1\u73B0 `vuln-scan` \u2014\u2014 \u5148\u67E5\u5E93\u53BB\u91CD \u2192 Nday/1day \u4F18\u5148 \u2192 \u63A5\u53E3\u672A\u6388\u6743\u63A2\u6D4B",
            h2("br"),
            "\u2463 \u6F0F\u6D1E\u5229\u7528 `exploit` \u2014\u2014 \u5148\u62FF\u670D\u52A1\u5668\u6743\u9650\uFF08\u51B0\u874E/\u54E5\u65AF\u62C9\u9A6C\uFF09+ \u5EFA suo5 \u96A7\u9053\uFF0C\u518D\u6253\u5176\u5B83\u5F97\u5206\u9879",
            h2("br"),
            "\u2464 \u5185\u7F51\u6E17\u900F `internal` \u2014\u2014 \u8D70\u96A7\u9053\uFF0C\u4F9D\u6B21\u62C9\u8D77 \u2460\u2461\u2462\u2463 \u505A\u5185\u7F51",
            h2("br"),
            "\u2465 \u4E3B\u4F1A\u8BDD `plan` \u2014\u2014 \u53EA\u505A\u8BA1\u5212\u3001\u6D3E\u6D3B\u3001\u6C47\u603B\u3001\u6C47\u62A5\uFF0C\u4E0D\u52A8\u624B"
          )
        ),
        h2(ConcurrencyCard, { concurrency, onSaved: load }),
        h2(
          "div",
          { className: "rt-card" },
          h2("h4", null, "\u89D2\u8272\u63D0\u793A\u8BCD\uFF08\u6309\u9776\u6807\u5B58\uFF0C\u53EF\u5728\u8FD9\u91CC\u7F16\u8F91\uFF09"),
          h2(
            "div",
            {
              style: {
                fontSize: 11.5,
                color: "var(--dsw-alias-label-secondary)",
                marginBottom: 6
              }
            },
            "\u300C\u667A\u80FD\u4F53\u63D0\u793A\u8BCD\u300D\u5DF2\u5E76\u5165\u672C\u9875\uFF1B\u4E0B\u9762\u662F\u5B8C\u6574\u7F16\u8F91\u5668\uFF08\u6539\u5B8C\u70B9\u4FDD\u5B58\uFF0C\u53EA\u5F71\u54CD\u5F53\u524D\u9776\u6807\uFF09\u3002"
          ),
          h2(PromptsTab, { engagement: eng, refreshKey })
        )
      )
    );
  }
  function ConcurrencyCard(props) {
    const info = props.concurrency || {};
    const [draft, setDraft] = import_react2.default.useState("");
    const [busy, setBusy] = import_react2.default.useState(false);
    const [msg, setMsg] = import_react2.default.useState(null);
    import_react2.default.useEffect(() => {
      if (info.max) setDraft(String(info.max));
    }, [info.max]);
    const limit = info.limit || 10;
    const used = typeof info.used === "number" ? info.used : null;
    const source = info.source === "settings" ? "\u9762\u677F\u4E2D\u8BBE\u7F6E" : info.source === "env" ? "\u73AF\u5883\u53D8\u91CF REDTEAM_MAX_AGENTS" : "\u9ED8\u8BA4\u503C";
    const n = Number(draft);
    const invalid = !Number.isFinite(n) || Math.floor(n) !== n || n < 1 || n > limit;
    const save = () => {
      if (invalid) return;
      setBusy(true);
      setMsg(null);
      api({ op: "setAgentsMax", max: n }).then(
        (r) => {
          setBusy(false);
          if (!r || r.ok === false) {
            setMsg({ err: r && r.error || "\u4FDD\u5B58\u5931\u8D25" });
            return;
          }
          setMsg({
            ok: "\u5DF2\u4FDD\u5B58\uFF1A\u5E76\u53D1\u4E0A\u9650 " + r.max + "\uFF08\u7ACB\u5373\u751F\u6548\uFF0C\u4E0D\u7528\u91CD\u542F\uFF09"
          });
          if (props.onSaved) props.onSaved();
        },
        (e) => {
          setBusy(false);
          setMsg({ err: String(e && e.message || e) });
        }
      );
    };
    return h2(
      "div",
      { className: "rt-card" },
      h2("h4", null, "\u5E76\u53D1\u6570\u91CF"),
      h2(
        "div",
        { style: { fontSize: 12, lineHeight: 1.8, marginBottom: 8 } },
        "\u540C\u4E00\u9776\u6807**\u540C\u65F6\u6700\u591A\u51E0\u4E2A\u6267\u884C\u667A\u80FD\u4F53**\u3002\u5F53\u524D\u751F\u6548\uFF1A**" + (info.max || "?") + "**" + (used === null ? "" : "\uFF08\u5728\u8DD1 " + used + "\uFF0C\u5269\u4F59 " + Math.max((info.max || 0) - used, 0) + "\uFF09") + "\uFF0C\u6765\u6E90\uFF1A" + source + "\u3002\u6539\u5B8C**\u7ACB\u5373\u751F\u6548**\uFF0C\u4E0D\u7528\u91CD\u542F\u3002"
      ),
      h2(
        "div",
        {
          style: {
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap"
          }
        },
        h2("input", {
          className: "rt-input",
          style: { width: 90 },
          type: "number",
          min: 1,
          max: limit,
          value: draft,
          onChange: (e) => setDraft(e.target.value)
        }),
        h2(
          "span",
          {
            style: {
              fontSize: 11.5,
              color: "var(--dsw-alias-label-secondary)"
            }
          },
          "\u8303\u56F4 1 \u2013 " + limit
        ),
        h2(
          "button",
          {
            className: "rt-btn rt-btn-primary",
            disabled: busy || invalid,
            onClick: save
          },
          busy ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58"
        ),
        msg && msg.err ? h2(
          "span",
          { style: { fontSize: 12, color: "var(--rt-danger, #d33)" } },
          msg.err
        ) : null,
        msg && msg.ok ? h2(
          "span",
          {
            style: {
              fontSize: 12,
              color: "var(--dsw-alias-label-secondary)"
            }
          },
          msg.ok
        ) : null
      ),
      h2(
        "div",
        { className: "rt-note", style: { marginTop: 8 } },
        "\u26A0\uFE0F \u8C03\u5927\u4E0D\u7B49\u4E8E\u66F4\u5FEB\uFF1A**\u540C\u4E00\u4E2A\u6A21\u578B API Key \u7684\u5E76\u53D1/\u901F\u7387\u4E0A\u9650\u662F\u5171\u4EAB\u7684**\uFF0C\u540C\u65F6\u6D3E\u592A\u591A\u4F1A\u4E92\u76F8\u6324\u5360\uFF0C\u8868\u73B0\u4E3A\u6392\u961F\u7B49\u5F85\u3001\u8D85\u65F6\u3001\u8FD4\u56DE\u88AB\u622A\u65AD\u751A\u81F3\u9650\u6D41\u62A5\u9519 \u2014\u2014 \u53CD\u800C\u8BA9\u6D4B\u8BD5\u7ED3\u679C\u4E0D\u7A33\u5B9A\uFF08\u6F0F\u6D4B\u3001\u534A\u9014\u800C\u5E9F\uFF09\u3002\u5EFA\u8BAE\u4ECE 2\u20133 \u5F00\u59CB\uFF0C\u53EA\u6709\u5728\u786E\u8BA4 Key \u7684\u989D\u5EA6\u8DB3\u591F\u3001\u4EFB\u52A1\u4E4B\u95F4\u786E\u5B9E\u4E92\u4E0D\u4F9D\u8D56\u65F6\u624D\u8C03\u5927\u3002"
      )
    );
  }
  function VersionBar(props) {
    const [info, setInfo] = import_react2.default.useState(null);
    const [err, setErr] = import_react2.default.useState(null);
    const [busy, setBusy] = import_react2.default.useState(false);
    const [open, setOpen] = import_react2.default.useState(false);
    const [msg, setMsg] = import_react2.default.useState(null);
    const [countdown, setCountdown] = import_react2.default.useState(0);
    const countdownRef = import_react2.default.useRef(null);
    const clearCountdown = import_react2.default.useCallback(() => {
      if (countdownRef.current) {
        try {
          clearInterval(countdownRef.current);
        } catch {
        }
      }
      countdownRef.current = null;
    }, []);
    import_react2.default.useEffect(() => () => clearCountdown(), [clearCountdown]);
    const closeModal = import_react2.default.useCallback(() => {
      clearCountdown();
      setCountdown(0);
      setOpen(false);
    }, [clearCountdown]);
    const check = (silent) => {
      if (!silent) setBusy(true);
      api({ op: "updateCheck" }).then(
        (r) => {
          setBusy(false);
          if (!r || r.ok === false) {
            if (!silent) setErr(r && r.error || "\u68C0\u67E5\u66F4\u65B0\u5931\u8D25");
            api({ op: "version" }).then(
              (v) => {
                if (v && v.ok !== false) setInfo(v);
              },
              () => {
              }
            );
            return;
          }
          setErr(null);
          setInfo(r);
        },
        (e) => {
          setBusy(false);
          if (!silent) setErr(String(e && e.message || e));
          api({ op: "version" }).then(
            (v) => {
              if (v && v.ok !== false) setInfo(v);
            },
            () => {
            }
          );
        }
      );
    };
    import_react2.default.useEffect(() => {
      check(true);
    }, []);
    const apply2 = () => {
      setBusy(true);
      setMsg(null);
      api({
        op: "updateApply",
        target: info && info.latest || void 0
      }).then(
        (r) => {
          setBusy(false);
          if (!r || r.ok === false) {
            setMsg({ err: r && r.error || "\u66F4\u65B0\u5931\u8D25" });
            return;
          }
          setMsg({
            ok: "\u5DF2\u5B89\u88C5 " + (r.installed || "") + "\uFF0C\u6B63\u5728\u91CD\u542F\u5F53\u524D\u5BBF\u4E3B\u2026"
          });
          setCountdown(6);
          clearCountdown();
          countdownRef.current = setInterval(() => {
            setCountdown((n) => {
              if (n <= 1) {
                clearCountdown();
                window.location.reload();
                return 0;
              }
              return n - 1;
            });
          }, 1e3);
        },
        (e) => {
          setBusy(false);
          setMsg({ err: String(e && e.message || e) });
        }
      );
    };
    const current = info && info.current ? info.current : info && info.plugin ? info.plugin.version : null;
    const latest = info && info.latest ? info.latest : null;
    const hasNew = !!(info && info.updateAvailable);
    const blockers = info && info.blockers || [];
    const notes = info && info.notes || [];
    const mode = info && info.install ? info.install.mode : null;
    return h2(
      "span",
      { style: { display: "inline-flex", alignItems: "center", gap: 6 } },
      h2(
        "span",
        {
          className: "rt-tag" + (hasNew ? " rt-tag-warn" : ""),
          title: "\u5F53\u524D\u7248\u672C " + (current || "\u672A\u77E5") + (latest ? "\n\u6700\u65B0\u7248\u672C " + latest : "") + (mode === "dev" ? "\n\u5B89\u88C5\u65B9\u5F0F\uFF1A\u5F00\u53D1\u6001\uFF08\u6E90\u7801\u8F6F\u94FE\uFF09" : mode === "package" ? "\n\u5B89\u88C5\u65B9\u5F0F\uFF1A\u5305\u5B89\u88C5" : "") + (info && info.check_error ? "\n\u68C0\u67E5\u5931\u8D25\uFF1A" + info.check_error : "")
        },
        "v" + (current || "?")
      ),
      hasNew ? h2(
        "button",
        {
          className: "rt-btn rt-btn-primary",
          disabled: busy,
          onClick: () => {
            setOpen(true);
            setMsg(null);
          },
          title: "\u53D1\u73B0\u65B0\u7248\u672C " + latest + "\uFF1A\u70B9\u51FB\u67E5\u770B\u5E76\u4E00\u952E\u66F4\u65B0\uFF08\u4F1A\u91CD\u542F\u5F53\u524D\u5BBF\u4E3B\uFF09"
        },
        busy ? "\u68C0\u67E5\u4E2D\u2026" : "\u6709\u65B0\u7248\u672C v" + latest
      ) : h2(
        "button",
        {
          className: "rt-btn",
          disabled: busy,
          onClick: () => check(false),
          title: "\u91CD\u65B0\u68C0\u67E5 npm \u4E0A\u7684\u6700\u65B0\u7248\u672C"
        },
        busy ? "\u68C0\u67E5\u4E2D\u2026" : "\u68C0\u67E5\u66F4\u65B0"
      ),
      open ? h2(
        "div",
        {
          className: "rt-modal",
          "aria-hidden": "true",
          onClick: closeModal
        },
        h2(
          "div",
          {
            className: "rt-modal-box",
            onClick: (e) => e.stopPropagation()
          },
          h2("h4", { style: { marginTop: 0 } }, "\u66F4\u65B0 RedTeam \u6A21\u5F0F"),
          h2(
            "div",
            { className: "rt-kv" },
            h2("b", null, "\u5F53\u524D\u7248\u672C"),
            h2("span", null, current || "\u672A\u77E5")
          ),
          h2(
            "div",
            { className: "rt-kv" },
            h2("b", null, "\u6700\u65B0\u7248\u672C"),
            h2("span", null, latest || "\u672A\u77E5")
          ),
          h2(
            "div",
            { className: "rt-kv" },
            h2("b", null, "\u5B89\u88C5\u65B9\u5F0F"),
            h2(
              "span",
              null,
              mode === "dev" ? "\u5F00\u53D1\u6001\uFF08\u6E90\u7801\u8F6F\u94FE\uFF09" : mode === "package" ? "\u5305\u5B89\u88C5\uFF08" + (info.install && info.install.packageManager || "npm") + "\uFF09" : "\u672A\u77E5"
            )
          ),
          info && info.install && info.install.dir ? h2(
            "div",
            { className: "rt-kv" },
            h2("b", null, "\u5B89\u88C5\u4F4D\u7F6E"),
            h2("span", { className: "rt-mono" }, info.install.dir)
          ) : null,
          blockers.length ? h2(
            "div",
            { className: "rt-hint" },
            h2(
              "div",
              { style: { fontWeight: 600, marginBottom: 4 } },
              "\u73B0\u5728\u4E0D\u80FD\u66F4\u65B0\uFF1A"
            ),
            blockers.map(
              (b, i) => h2("div", { key: "b" + i }, "\xB7 " + b)
            )
          ) : null,
          notes.length ? h2(
            "div",
            { className: "rt-foot", style: { padding: "4px 0" } },
            notes.map((n, i) => h2("div", { key: "n" + i }, n))
          ) : null,
          h2(
            "div",
            {
              style: {
                fontSize: 12,
                color: "var(--dsw-alias-label-secondary)",
                margin: "8px 0"
              }
            },
            "\u66F4\u65B0\u8FC7\u7A0B\uFF1A\u5B89\u88C5\u65B0\u7248\u672C \u2192 \u81EA\u52A8\u91CD\u542F\u5F53\u524D\u5BBF\u4E3B\uFF08\u5B98\u65B9 exe / \u793E\u533A\u7248 / dsh web\uFF1B\u5F53\u524D\u9875\u9762\u4F1A\u65AD\u5F00\uFF0C\u7EA6 5\u201310 \u79D2\u540E\u81EA\u52A8\u5237\u65B0\uFF09\u3002\u91CD\u542F\u524D\u4F1A\u68C0\u67E5\u6709\u6CA1\u6709\u667A\u80FD\u4F53\u5728\u8DD1\uFF0C\u6709\u5C31\u62E6\u4F4F\u4E0D\u52A8\u3002"
          ),
          msg ? h2(
            "div",
            { className: msg.err ? "rt-err" : "rt-foot" },
            msg.err || msg.ok
          ) : null,
          countdown > 0 ? h2(
            "div",
            { className: "rt-foot" },
            "\u5BBF\u4E3B\u6B63\u5728\u91CD\u542F\uFF0C" + countdown + " \u79D2\u540E\u81EA\u52A8\u5237\u65B0\u9875\u9762\u2026"
          ) : null,
          h2(
            "div",
            {
              style: {
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 10
              }
            },
            h2(
              "button",
              { className: "rt-btn", onClick: closeModal },
              "\u5173\u95ED"
            ),
            h2(
              "button",
              {
                className: "rt-btn rt-btn-primary",
                disabled: busy || blockers.length > 0 || mode === "dev",
                title: mode === "dev" ? "\u5F00\u53D1\u6001\u5B89\u88C5\u8BF7\u7528\u4ED3\u5E93\u6D41\u7A0B\u5347\u7EA7" : blockers.length ? "\u5148\u89E3\u51B3\u4E0A\u9762\u7684\u963B\u585E\u9879" : "\u5B89\u88C5\u5E76\u91CD\u542F",
                onClick: apply2
              },
              busy ? "\u66F4\u65B0\u4E2D\u2026" : "\u4E00\u952E\u66F4\u65B0\u5E76\u91CD\u542F"
            )
          )
        )
      ) : null
    );
  }
  const UNREAD_KEY = "rt-unread:";
  const loadUnread = (eng) => {
    try {
      const raw = window.localStorage.getItem(UNREAD_KEY + eng);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (e) {
      return null;
    }
  };
  const saveUnread = (eng, value) => {
    try {
      window.localStorage.setItem(UNREAD_KEY + eng, JSON.stringify(value));
    } catch (e) {
    }
  };
  const digestHasNew = (prev, cur) => {
    if (!cur) return false;
    if (!prev) return true;
    const pc = Number(prev.count || 0);
    const cc = Number(cur.count || 0);
    if (cc > pc) return true;
    const pa = prev.at || "";
    const ca = cur.at || "";
    return ca !== "" && ca !== pa && ca > pa;
  };
  const RT_GEOM_KEY = "rt-dock-geom-v1";
  function clampRtGeom(g) {
    const vw = typeof window !== "undefined" && window.innerWidth || 1280;
    const vh = typeof window !== "undefined" && window.innerHeight || 800;
    const w = Math.min(
      Math.max(320, Number(g && g.w) || 620),
      Math.max(320, vw)
    );
    const h3 = Math.min(
      Math.max(240, Number(g && g.h) || 520),
      Math.max(240, vh)
    );
    const x = Math.min(Math.max(0, Number(g && g.x) || 0), Math.max(0, vw - w));
    const y = Math.min(Math.max(0, Number(g && g.y) || 0), Math.max(0, vh - h3));
    return { x, y, w, h: h3 };
  }
  function defaultRtGeom() {
    const vw = typeof window !== "undefined" && window.innerWidth || 1280;
    const vh = typeof window !== "undefined" && window.innerHeight || 800;
    let w = 620;
    try {
      const saved = Number(window.localStorage.getItem("rt-dock-width"));
      if (Number.isFinite(saved) && saved >= 320 && saved <= 1200) w = saved;
    } catch (e) {
    }
    const h3 = Math.max(240, Math.min(640, vh - 24));
    return clampRtGeom({ x: Math.max(0, vw - w - 12), y: 12, w, h: h3 });
  }
  function loadRtGeom() {
    try {
      const raw = JSON.parse(
        window.localStorage.getItem(RT_GEOM_KEY) || "null"
      );
      if (raw && typeof raw === "object") return clampRtGeom(raw);
    } catch (e) {
    }
    return defaultRtGeom();
  }
  function Panel(props) {
    const embedded = !!(props && props.embedded);
    const st = useUI();
    const [engagements, setEngagements] = import_react2.default.useState([]);
    const [eng, setEng] = import_react2.default.useState(null);
    const [snapshot, setSnapshot] = import_react2.default.useState(null);
    const [err, setErr] = import_react2.default.useState(null);
    const [newName, setNewName] = import_react2.default.useState("");
    const [newMode, setNewMode] = import_react2.default.useState("redteam");
    const [newScope, setNewScope] = import_react2.default.useState("");
    const [newExclude, setNewExclude] = import_react2.default.useState("");
    const [geom, setGeom] = import_react2.default.useState(loadRtGeom);
    const [creating, setCreating] = import_react2.default.useState(false);
    const [refreshKey, setRefreshKey] = import_react2.default.useState(0);
    const [digest, setDigest] = import_react2.default.useState(null);
    const [seen, setSeen] = import_react2.default.useState(null);
    import_react2.default.useEffect(() => {
      if (embedded) return void 0;
      try {
        window.localStorage.setItem(RT_GEOM_KEY, JSON.stringify(geom));
      } catch (e) {
      }
    }, [geom, embedded]);
    import_react2.default.useEffect(() => {
      if (embedded) return void 0;
      const onResize = () => setGeom((g) => clampRtGeom(g));
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, [embedded]);
    const loadSnapshot = (id) => {
      if (!id) {
        setSnapshot(null);
        return;
      }
      api({ op: "snapshot", engagement: id }).then(
        (r) => {
          if (!r || r.ok === false) {
            setErr(r && r.error || "\u52A0\u8F7D\u5931\u8D25");
            return;
          }
          setErr(null);
          setSnapshot(r);
        },
        (e) => setErr(String(e && e.message || e))
      );
    };
    const refreshList = (selectId) => {
      api({ op: "bootstrap" }).then(
        (b) => {
          setEngagements(b && b.engagements || []);
          if (selectId) {
            setEng(selectId);
            loadSnapshot(selectId);
          }
        },
        () => {
        }
      );
    };
    import_react2.default.useEffect(() => {
      api({ op: "bootstrap" }).then(
        (r) => {
          if (!r || r.ok === false) {
            setErr(r && r.error || "\u65E0\u6CD5\u8FDE\u63A5\u8D44\u4EA7\u5E93");
            return;
          }
          setEngagements(r.engagements || []);
          const id = r.current || r.engagements && r.engagements[0] && r.engagements[0].id || null;
          if (id) {
            setEng(id);
            loadSnapshot(id);
          }
        },
        (e) => setErr(String(e && e.message || e))
      );
    }, []);
    const newModeNeedsScope = isScopedAssessmentMode(newMode);
    const hasNewScope = newScope.split(/[\r\n,]+/).some((value) => value.trim());
    const openEngagement = (nameArg) => {
      const name = String(nameArg || newName).trim();
      if (!name || newModeNeedsScope && !hasNewScope) return;
      setCreating(true);
      const scope = newScope.split(/[\r\n,]+/).map((value) => value.trim()).filter(Boolean);
      const exclude = newExclude.split(/[\r\n,]+/).map((value) => value.trim()).filter(Boolean);
      api({
        op: "openEngagement",
        name,
        assessment_mode: newMode,
        ...scope.length || newModeNeedsScope ? { scope } : {},
        exclude
      }).then(
        (r) => {
          setCreating(false);
          if (!r || r.ok === false) {
            setErr(r && r.error || "\u521B\u5EFA\u5931\u8D25");
            return;
          }
          setNewName("");
          refreshList(r.engagement && r.engagement.id);
        },
        (e) => {
          setCreating(false);
          setErr(String(e && e.message || e));
        }
      );
    };
    const refreshAll = () => {
      setRefreshKey((k) => k + 1);
      api({ op: "bootstrap" }).then(
        (b) => {
          setEngagements(b && b.engagements || []);
          if (eng) loadSnapshot(eng);
        },
        () => {
          if (eng) loadSnapshot(eng);
        }
      );
    };
    const trackPointer = (e, move) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const up = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    };
    const startDrag = (e) => {
      if (e.target && e.target.closest && e.target.closest("button,a,input,select,textarea,label"))
        return;
      const sx = e.clientX;
      const sy = e.clientY;
      const ox = geom.x;
      const oy = geom.y;
      trackPointer(
        e,
        (ev) => setGeom(
          (g) => clampRtGeom({
            x: ox + (ev.clientX - sx),
            y: oy + (ev.clientY - sy),
            w: g.w,
            h: g.h
          })
        )
      );
    };
    const startResizeLeft = (e) => {
      const sx = e.clientX;
      const ox = geom.x;
      const ow = geom.w;
      trackPointer(e, (ev) => {
        const dx = ev.clientX - sx;
        setGeom((g) => clampRtGeom({ x: ox + dx, y: g.y, w: ow - dx, h: g.h }));
      });
    };
    const startResizeRight = (e) => {
      const sx = e.clientX;
      const ow = geom.w;
      trackPointer(
        e,
        (ev) => setGeom(
          (g) => clampRtGeom({ x: g.x, y: g.y, w: ow + (ev.clientX - sx), h: g.h })
        )
      );
    };
    const startResizeBottom = (e) => {
      const sy = e.clientY;
      const oh = geom.h;
      trackPointer(
        e,
        (ev) => setGeom(
          (g) => clampRtGeom({ x: g.x, y: g.y, w: g.w, h: oh + (ev.clientY - sy) })
        )
      );
    };
    const startResizeCorner = (e) => {
      const sx = e.clientX;
      const sy = e.clientY;
      const ow = geom.w;
      const oh = geom.h;
      trackPointer(
        e,
        (ev) => setGeom(
          (g) => clampRtGeom({
            x: g.x,
            y: g.y,
            w: ow + (ev.clientX - sx),
            h: oh + (ev.clientY - sy)
          })
        )
      );
    };
    import_react2.default.useEffect(() => {
      if (!eng) {
        setDigest(null);
        setSeen(null);
        return void 0;
      }
      setSeen(loadUnread(eng));
      let alive = true;
      let digestInflight = false;
      const tick = () => {
        if (digestInflight)
          return;
        digestInflight = true;
        api({ op: "consoleDigest", engagement: eng }).then(
          (r) => {
            if (alive && r && r.ok !== false && r.sections)
              setDigest(r.sections);
          },
          () => {
          }
        ).finally(() => {
          digestInflight = false;
        });
      };
      tick();
      const timer = window.setInterval(tick, 25e3);
      return () => {
        alive = false;
        window.clearInterval(timer);
      };
    }, [eng, refreshKey]);
    const markTabSeen = import_react2.default.useCallback(
      (tab) => {
        if (!eng) return;
        setSeen((prev) => {
          const base = prev || (() => {
            const fresh = {};
            for (const [k, v] of Object.entries(digest || {}))
              fresh[k] = { count: Number(v.count || 0), at: v.at || null };
            return fresh;
          })();
          const next = Object.assign({}, base);
          const cur = digest && digest[tab];
          if (cur)
            next[tab] = { count: Number(cur.count || 0), at: cur.at || null };
          saveUnread(eng, next);
          return next;
        });
      },
      [eng, digest]
    );
    const unreadOf = (tab) => {
      if (!eng || !digest) return false;
      if (!seen) return false;
      return digestHasNew(seen[tab], digest[tab]);
    };
    const stats2 = snapshot && snapshot.stats || {};
    const currentMode = engagements.find((item) => item.id === eng)?.assessment_mode || "redteam";
    const isSrc2 = currentMode === "src";
    const isPentest = currentMode === "pentest";
    const tabs = assessmentTabsForMode(currentMode, [
      ["assets", "\u8D44\u4EA7\u6D4B\u7ED8"],
      ["evidence", "\u5185\u7F6E\u8BC4\u4F30"],
      ["env", "\u73AF\u5883\u9002\u914D"],
      ["agents", "\u667A\u80FD\u4F53"],
      ["sessions", "\u4F1A\u8BDD\u96A7\u9053"],
      ["findings", isSrc2 ? "\u6F0F\u6D1E\u53D1\u73B0" : isPentest ? "\u6E17\u900F\u53D1\u73B0" : "\u6F0F\u6D1E\u6218\u679C"],
      ["chain", "\u653B\u51FB\u94FE"],
      ["scores", "\u5F97\u5206\u76EE\u6807"],
      ["report", "\u62A5\u544A"],
      ["knowledge", "\u77E5\u8BC6\u5E93"],
      ["skills", "\u6280\u80FD\u5E93"]
    ]);
    const activeTab = isScopedAssessmentMode(currentMode) && !tabs.some((item) => item[0] === st.tab) ? "assets" : st.tab;
    import_react2.default.useEffect(() => {
      if (activeTab !== st.tab) setUI({ tab: activeTab });
    }, [activeTab, st.tab]);
    const full = isFullWindow();
    const openFull = () => {
      try {
        window.open(
          window.location.href.split("#")[0] + "#redteam-full",
          "_blank",
          "noopener"
        );
      } catch (e) {
        setErr("\u65E0\u6CD5\u6253\u5F00\u65B0\u7A97\u53E3\uFF1A" + (e && e.message || e));
      }
    };
    const exitFull = () => {
      try {
        window.close();
      } catch (e) {
      }
      try {
        if (window.location.hash) {
          window.location.hash = "";
          window.location.reload();
        }
      } catch (e) {
      }
    };
    import_react2.default.useEffect(() => {
      if (!full) return void 0;
      const onKey = (e) => {
        if (e.key === "Escape") exitFull();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [full]);
    let body;
    if (err) body = h2("div", { className: "rt-err" }, err);
    else if (activeTab === "evidence")
      body = h2(AssessmentTab, { engagement: eng, api });
    else if (activeTab === "knowledge")
      body = h2(KnowledgeTab, { refreshKey });
    else if (activeTab === "env") body = h2(EnvTab, { refreshKey });
    else if (activeTab === "skills")
      body = h2(SkillsTab, { refreshKey });
    else if (activeTab === "agents" || activeTab === "prompts")
      body = isSrc2 ? h2(
        "div",
        { className: "rt-pane" },
        h2(
          "div",
          { className: "rt-card" },
          h2("h4", null, "SRC \u53D1\u73B0\u4E0E\u590D\u6838"),
          h2(
            "p",
            null,
            "\u5148\u6574\u7406\u660E\u786E\u8303\u56F4\u5185\u8D44\u4EA7\u548C\u5DF2\u6709\u8BC1\u636E\uFF0C\u901A\u8FC7\u9879\u76EE\u5185\u7F6E\u8BC4\u4F30\u6838\u5FC3\u9A8C\u8BC1\u5019\u9009\u3002\u76F4\u63A5\u8BC1\u636E\u786E\u8BA4\u540E\u505C\u6B62\u8BE5\u76EE\u6807\u7684\u540E\u7EED\u8BF7\u6C42\uFF0C\u6574\u7406\u62A5\u544A\u4E0E\u4FEE\u590D\u5EFA\u8BAE\u3002"
          ),
          h2(
            "p",
            null,
            "SRC \u9884\u8BBE\u63D0\u4F9B\u53D1\u73B0\u3001\u8BC1\u636E\u548C\u62A5\u544A\u5DE5\u5177\uFF1B\u9879\u76EE\u6A21\u5F0F\u548C\u8303\u56F4\u5728\u521B\u5EFA\u65F6\u56FA\u5B9A\u3002"
          )
        )
      ) : h2(AgentsTab, { engagement: eng, refreshKey });
    else if (!eng) {
      body = h2(
        "div",
        { className: "rt-pane" },
        h2(
          "div",
          { className: "rt-card" },
          h2("h4", null, "\u8FD8\u6CA1\u6709\u9776\u6807"),
          h2(
            "div",
            {
              style: {
                fontSize: 12,
                color: "var(--dsw-alias-label-secondary)",
                marginBottom: 8
              }
            },
            "\u521B\u5EFA\u7EA2\u961F\u3001SRC \u6216\u6E17\u900F\u9776\u6807\u3002SRC \u4E0E\u6E17\u900F\u6A21\u5F0F\u5FC5\u987B\u5728\u660E\u786E\u6388\u6743\u8303\u56F4\u5185\u5DE5\u4F5C\u3002"
          ),
          h2(
            "select",
            {
              className: "rt-input",
              value: newMode,
              onChange: (event) => setNewMode(event.target.value)
            },
            assessmentModeOptions.map(
              (option) => h2("option", { key: option[0], value: option[0] }, option[1])
            )
          ),
          h2("textarea", {
            className: "rt-textarea",
            rows: 3,
            value: newScope,
            placeholder: "\u660E\u786E\u6388\u6743\u8303\u56F4\uFF0C\u6BCF\u884C\u4E00\u9879 URL / \u57DF\u540D / IP / CIDR\uFF1BSRC \u4E0E\u6E17\u900F\u6A21\u5F0F\u5FC5\u586B",
            onChange: (event) => setNewScope(event.target.value)
          }),
          newModeNeedsScope ? h2("textarea", {
            className: "rt-textarea",
            rows: 2,
            value: newExclude,
            placeholder: "\u6392\u9664\u8303\u56F4\uFF0C\u6BCF\u884C\u4E00\u9879\uFF1B\u6CA1\u6709\u6392\u9664\u9879\u65F6\u4E5F\u53EF\u7559\u7A7A",
            onChange: (event) => setNewExclude(event.target.value)
          }) : null,
          newMode === "pentest" ? h2(
            "p",
            {
              style: {
                fontSize: 12,
                color: "var(--dsw-alias-label-secondary)"
              }
            },
            "\u6E17\u900F\u6A21\u5F0F\u4F7F\u7528\u968F\u63D2\u4EF6\u63D0\u4F9B\u7684\u5185\u7F6E\u8BC4\u4F30\u6838\u5FC3\u548C\u9884\u8BBE\uFF0C\u65E0\u9700\u9009\u62E9\u5916\u90E8\u9879\u76EE\u3002"
          ) : null,
          h2(
            "div",
            { style: { display: "flex", gap: 8 } },
            h2("input", {
              className: "rt-input",
              style: { flex: 1 },
              placeholder: "\u4F8B\u5982\uFF1A\u793A\u4F8B\u79D1\u6280\u6709\u9650\u516C\u53F8",
              value: newName,
              onChange: (e) => setNewName(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter") openEngagement();
              }
            }),
            h2(
              "button",
              {
                className: "rt-btn rt-btn-primary",
                disabled: creating || !newName.trim() || newModeNeedsScope && !hasNewScope,
                onClick: () => openEngagement()
              },
              creating ? "\u521B\u5EFA\u4E2D\u2026" : "\u521B\u5EFA\u9776\u6807"
            )
          )
        )
      );
    } else if (activeTab === "assets")
      body = h2(AssetsTab, {
        engagement: eng,
        snapshot,
        refreshKey,
        onRefresh: refreshAll,
        onData: () => loadSnapshot(eng)
      });
    else if (activeTab === "testing")
      body = h2(AssetsTab, {
        engagement: eng,
        snapshot,
        refreshKey,
        onRefresh: refreshAll,
        onData: () => loadSnapshot(eng)
      });
    else if (activeTab === "sessions")
      body = h2(SessionTab, { engagement: eng, refreshKey });
    else if (activeTab === "findings")
      body = h2(FindingsTab, {
        engagement: eng,
        refreshKey,
        assessmentMode: currentMode
      });
    else if (activeTab === "chain")
      body = h2(ChainTab, { engagement: eng, refreshKey });
    else if (activeTab === "report")
      body = isPentest ? h2(PentestReport, { engagement: eng, api }) : h2(AssessmentReportHub, {
        engagement: eng,
        api,
        src: isSrc2,
        detail: isSrc2 ? SrcDiscoveryReport : ReportTab,
        detailProps: { refreshKey }
      });
    else if (activeTab === "attackfiles")
      body = h2(FindingsTab, { engagement: eng, refreshKey });
    else if (activeTab === "scores")
      body = h2(ScoreTab, { engagement: eng, refreshKey });
    else body = h2("div", { className: "rt-empty" }, "\u672A\u77E5\u9875\u7B7E");
    const shellProps = full ? { className: "rt-full", style: { display: "flex" } } : embedded ? {
      className: "rt-dock rt-embedded",
      "data-open": "1",
      style: { width: "100%", display: "flex" }
    } : {
      className: "rt-dock",
      "data-open": st.open ? "1" : "0",
      style: {
        left: geom.x + "px",
        top: geom.y + "px",
        right: "auto",
        bottom: "auto",
        width: geom.w + "px",
        height: geom.h + "px",
        display: st.open ? "flex" : "none"
      }
    };
    return h2(
      "div",
      shellProps,
      full || embedded ? null : h2("div", {
        className: "rt-grip",
        title: "\u62D6\u52A8\u8C03\u6574\u5BBD\u5EA6",
        onMouseDown: startResizeLeft
      }),
      full || embedded ? null : h2("div", {
        className: "rt-resize-r",
        title: "\u62D6\u52A8\u8C03\u6574\u5BBD\u5EA6",
        onMouseDown: startResizeRight
      }),
      full || embedded ? null : h2("div", {
        className: "rt-resize-b",
        title: "\u62D6\u52A8\u8C03\u6574\u9AD8\u5EA6",
        onMouseDown: startResizeBottom
      }),
      full || embedded ? null : h2("div", {
        className: "rt-resize-c",
        title: "\u62D6\u52A8\u8C03\u6574\u5927\u5C0F",
        onMouseDown: startResizeCorner
      }),
      h2(
        "div",
        {
          className: "rt-head",
          onMouseDown: full || embedded ? void 0 : startDrag,
          title: full || embedded ? void 0 : "\u6309\u4F4F\u62D6\u52A8\u9762\u677F"
        },
        embedded ? null : h2(
          "div",
          { className: "rt-title" },
          h2("span", { className: "rt-dot" }),
          full ? "\u6F14\u7EC3\u53F0 \xB7 \u5168\u9762\u6D4F\u89C8" : "\u6F14\u7EC3\u53F0",
          full ? h2(
            "span",
            { className: "rt-tag", style: { marginLeft: 6 } },
            "\u72EC\u7ACB\u7A97\u53E3"
          ) : null
        ),
        h2(
          "select",
          {
            className: "rt-input rt-eng-select",
            style: {
              maxWidth: embedded ? "100%" : "170px",
              minWidth: embedded ? "160px" : void 0,
              flex: embedded ? "1 1 200px" : void 0
            },
            value: eng || "",
            onChange: (e) => {
              setEng(e.target.value);
              loadSnapshot(e.target.value);
              api({
                op: "activateEngagement",
                engagement: e.target.value
              }).catch(() => {
              });
            }
          },
          h2(
            "option",
            { value: "", disabled: true },
            engagements.length ? "\u9009\u62E9\u9776\u6807" : "\u6682\u65E0\u9776\u6807"
          ),
          engagements.map(
            (x) => h2(
              "option",
              { key: x.id, value: x.id },
              assessmentModeLabel(x.assessment_mode) + (x.name || x.id || "\u672A\u547D\u540D")
            )
          )
        ),
        isSrc2 ? h2("span", { className: "rt-tag" }, "\u76F4\u63A5\u8BC1\u636E\u5373\u505C\u6B62") : isPentest ? h2("span", { className: "rt-tag" }, "\u5185\u7F6E\u8BC4\u4F30 \xB7 \u5B8C\u6574\u62A5\u544A") : null,
        h2(
          "button",
          {
            className: "rt-btn",
            onClick: () => {
              setEng(null);
              setSnapshot(null);
              setErr(null);
              setUI({ tab: "assets" });
            }
          },
          "\u65B0\u5EFA\u9776\u6807"
        ),
        h2("div", { className: "rt-spacer" }),
        embedded ? null : h2(VersionBar, null),
        full ? h2(
          "button",
          {
            className: "rt-btn",
            title: "\u56DE\u5230\u5E26\u4FA7\u680F\u7684\u666E\u901A\u754C\u9762\uFF08\u6216\u6309 Esc\uFF09",
            onClick: exitFull
          },
          "\u9000\u51FA\u5168\u9762\u6D4F\u89C8"
        ) : null,
        embedded ? null : h2(
          "button",
          {
            className: "rt-btn",
            title: "\u5237\u65B0\u540D\u518C\u3001\u5FEB\u7167\u4E0E\u5F53\u524D\u9875\u9762\u6570\u636E",
            onClick: refreshAll
          },
          "\u5237\u65B0"
        ),
        full || embedded ? null : h2(
          "button",
          {
            className: "rt-btn",
            title: "\u5728\u65B0\u6D4F\u89C8\u5668\u7A97\u53E3\u6253\u5F00\u5B8C\u6574\u63A7\u5236\u53F0",
            onClick: openFull
          },
          "\u5168\u9762\u6D4F\u89C8"
        ),
        full || embedded ? null : h2(
          "button",
          {
            className: "rt-btn",
            title: "\u6536\u8D77\u9762\u677F",
            onClick: () => setUI({ open: false })
          },
          "\u6536\u8D77"
        )
      ),
      /* 页签栏用标准 tablist/tab 角色：读屏软件据此播报「第几个页签、是否选中」。
           键盘用户 Tab 进来后可用 Enter/Space 切换（由 clickable 提供）。 */
      h2(
        "div",
        { className: "rt-tabs", role: "tablist" },
        tabs.map((t) => {
          const activate = () => {
            markTabSeen(t[0]);
            setUI({ tab: t[0] });
            setRefreshKey((k) => k + 1);
          };
          return h2(
            "div",
            Object.assign({}, clickable(activate, { label: t[1] }), {
              key: t[0],
              className: "rt-tab" + (activeTab === t[0] ? " on" : ""),
              role: "tab",
              "aria-selected": activeTab === t[0] ? "true" : "false",
              title: unreadOf(t[0]) ? t[1] + "\uFF1A\u6709\u65B0\u5185\u5BB9\uFF0C\u70B9\u5F00\u770B\u8FC7\u7EA2\u70B9\u5C31\u4F1A\u6D88\u5931" : t[1]
            }),
            t[1],
            unreadOf(t[0]) ? (
              /* 红点是纯视觉信息，给读屏软件一个文字替代 */
              h2("span", { className: "rt-tab-dot", "aria-label": "\u6709\u65B0\u5185\u5BB9" })
            ) : null
          );
        })
      ),
      h2(
        "div",
        { className: "rt-body", key: "body-" + activeTab },
        h2(RtBoundary, { key: activeTab }, body)
      ),
      h2(
        "div",
        { className: "rt-foot" },
        h2("span", null, "C \u6BB5 " + (stats2.segments || 0)),
        h2(
          "span",
          null,
          "\u8D44\u4EA7 " + (stats2.assets || 0) + "\uFF08\u5B58\u6D3B " + (stats2.liveAssets || 0) + "\uFF09"
        ),
        h2("span", null, "\u7AEF\u53E3 " + (stats2.openPorts || 0)),
        h2("span", null, "\u6307\u7EB9 " + (stats2.fingerprints || 0)),
        h2("span", null, "\u6F0F\u6D1E " + (stats2.vulns || 0)),
        h2(
          "span",
          null,
          "\u88AB\u52A8/\u4E3B\u52A8 " + (stats2.passiveSignals || 0) + "/" + (stats2.activeSignals || 0)
        ),
        h2("div", { className: "rt-spacer" }),
        full ? h2("span", null, "\u6309 Esc \u6216\u70B9\u53F3\u4E0A\u89D2\u300C\u9000\u51FA\u5168\u9762\u6D4F\u89C8\u300D\u56DE\u5230\u5E26\u4FA7\u680F\u7684\u754C\u9762") : null,
        h2(
          "span",
          null,
          "SQLite \xB7 " + (snapshot && snapshot.engagement ? snapshot.engagement.name : "")
        )
      )
    );
  }
  function SidebarButton(props) {
    const st = useUI();
    return h2(
      "button",
      {
        className: "rt-icon-btn" + (st.open ? " on" : ""),
        title: "RedTeam \u63A7\u5236\u53F0\uFF08\u5E38\u9A7B\u53F3\u4FA7\u680F\uFF09",
        onClick: () => setUI({ open: !st.open })
      },
      h2("span", { style: { fontSize: 14 } }, "\u26E8"),
      props.wide ? h2("span", null, "RedTeam") : null
    );
  }
  function HeaderButton() {
    const st = useUI();
    return h2(
      "button",
      {
        className: "rt-hbtn" + (st.open ? " on" : ""),
        title: "RedTeam \u63A7\u5236\u53F0\uFF08\u5E38\u9A7B\u53F3\u4FA7\u680F\uFF09",
        onClick: () => setUI({ open: !st.open })
      },
      "\u26E8 RedTeam"
    );
  }
  function FullButton(props) {
    const open = () => {
      try {
        window.open(
          window.location.href.split("#")[0] + "#redteam-full",
          "_blank",
          "noopener"
        );
      } catch {
      }
    };
    return h2(
      "button",
      {
        className: "rt-icon-btn",
        title: "\u5168\u9762\u6D4F\u89C8\uFF1A\u5728\u65B0\u7A97\u53E3\u6253\u5F00\u5B8C\u6574\u63A7\u5236\u53F0\uFF08\u5F53\u524D\u7A97\u53E3\u4E0D\u53D7\u5F71\u54CD\uFF1B\u65B0\u7A97\u53E3\u5185\u6309 Esc \u9000\u51FA\uFF09",
        onClick: open
      },
      h2("span", { style: { fontSize: 14 } }, "\u26F6"),
      props.wide ? h2("span", null, "\u5168\u9762\u6D4F\u89C8") : null
    );
  }
  const inject2 = ["slots"];
  function applyDrillParts() {
    return {
      CSS,
      Panel,
      setUI,
      useUI,
      isFullWindow,
      setDockWidth,
      SidebarButton,
      HeaderButton,
      FullButton,
      FindingsTab
    };
  }
  exports.inject = inject2;
  return applyDrillParts();
})();

// src/community/redteam-standalone.js
var inject = ["slots"];
function apply(ctx) {
  const style = document.createElement("style");
  style.textContent = __dshPurgeDrill.CSS;
  document.head.append(style);
  __dshPurgeDrill.setUI({ open: __dshPurgeDrill.isFullWindow() });
  ctx.effect(() => () => style.remove());
  ctx.slots.inject(
    "shell.overlay",
    () => ctx.slots.register(
      { name: "shell.overlay", id: "redteam-console", order: 50 },
      () => import_react3.default.createElement(__dshPurgeDrill.Panel)
    )
  );
  for (const [id, order, label, Component] of [
    ["redteam-toggle", 50, "RedTeam", __dshPurgeDrill.SidebarButton],
    ["redteam-full", 51, "\u5168\u9762\u6D4F\u89C8", __dshPurgeDrill.FullButton]
  ])
    ctx.slots.inject(
      "sidebar.footer.action",
      () => ctx.slots.register(
        { name: "sidebar.footer.action", id, order, label },
        (props) => import_react3.default.createElement(Component, props)
      )
    );
  ctx.slots.inject(
    "conversation.session.header.utilities",
    () => ctx.slots.register(
      {
        name: "conversation.session.header.utilities",
        id: "redteam-header-toggle",
        order: 50,
        label: "RedTeam"
      },
      () => import_react3.default.createElement(__dshPurgeDrill.HeaderButton)
    )
  );
}

return module.exports;
}});})();
