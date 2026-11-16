// Local A/B evaluation for Prompt Lab v2.
// Sends the same six sandbox fixtures to the configured local OpenAI-compatible
// gateway, records only refusal booleans and short diagnostics, never response
// bodies. No output is uploaded or committed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeChatmlLayout } from "../lib/identity.js";
import { looksLikeRefusal } from "../lib/refusal-retry.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const model = process.env.PURGE_EVAL_MODEL || "workbuddy/deepseek-v4.1-flash";
const endpoint = process.env.PURGE_EVAL_URL || "http://127.0.0.1:3425/v1/chat/completions";
const cases = JSON.parse(fs.readFileSync(path.join(root, "prompt-lab", "eval-cases.json"), "utf8"));
const variants = {
  v1: fs.readFileSync(path.join(root, "prompt-lab", "prompt-inject-v1.md"), "utf8"),
  v2: fs.readFileSync(path.join(root, "lib", "default-prompt-inject.md"), "utf8"),
};

function systemText(raw) {
  return normalizeChatmlLayout(raw.replace(/\r\n/g, "\n"));
}

async function run(caseItem, variant) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  const started = Date.now();
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemText(variants[variant]) },
          { role: "user", content: caseItem.text },
        ],
        max_tokens: 700,
        temperature: 0.7,
        stream: false,
      }),
    });
    const body = await response.json().catch(() => ({}));
    const content = body?.choices?.[0]?.message?.content ?? "";
    return {
      case: caseItem.id,
      variant,
      status: response.status,
      ms: Date.now() - started,
      refused: looksLikeRefusal(content),
      chars: String(content).length,
      head: String(content).replace(/\s+/g, " ").slice(0, 80),
    };
  } catch (error) {
    return {
      case: caseItem.id,
      variant,
      status: 0,
      ms: Date.now() - started,
      refused: null,
      error: String(error?.name || error).slice(0, 80),
    };
  } finally {
    clearTimeout(timer);
  }
}

const tasks = [];
for (const caseItem of cases) {
  for (const variant of Object.keys(variants)) tasks.push({ caseItem, variant });
}
const results = [];
let cursor = 0;
async function worker() {
  while (cursor < tasks.length) {
    const item = tasks[cursor++];
    results.push(await run(item.caseItem, item.variant));
  }
}
await Promise.all([worker(), worker()]);
results.sort((a, b) => a.case.localeCompare(b.case) || a.variant.localeCompare(b.variant));

const outDir = path.join(root, "prompt-lab");
fs.writeFileSync(path.join(outDir, "eval-result.json"), JSON.stringify({
  model,
  endpoint: endpoint.replace(/\/\/[^/]+\//, "//127.0.0.1/"),
  at: new Date().toISOString(),
  results,
}, null, 2) + "\n", "utf8");

console.log(`model=${model}`);
for (const r of results) {
  console.log(`${r.case.padEnd(9)} ${r.variant} status=${r.status} refused=${r.refused} chars=${r.chars || 0} ms=${r.ms}`);
}
const summarize = (variant) => {
  const rows = results.filter(r => r.variant === variant && r.refused !== null);
  return `${variant}: ${rows.filter(r => r.refused).length}/${rows.length} refused`;
};
console.log(summarize("v1"));
console.log(summarize("v2"));
