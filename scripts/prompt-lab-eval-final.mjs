// Final local A/B for the shipping Prompt Lab v2 stack:
// v2 system prompt + boost section + request-side codec.
import fs from "node:fs";
import path from "node:path";
import { normalizeChatmlLayout } from "../lib/identity.js";
import { looksLikeRefusal } from "../lib/refusal-retry.js";
import { BOOST_TEXT } from "../lib/boost.js";
import { encodeUserPrompt } from "../lib/user-prompt-codec.js";

const root = process.cwd();
const model = process.env.PURGE_EVAL_MODEL || "workbuddy/deepseek-v4.1-flash";
const cases = JSON.parse(fs.readFileSync(path.join(root, "prompt-lab", "eval-cases.json"), "utf8"));
const system = `${normalizeChatmlLayout(fs.readFileSync(path.join(root, "lib", "default-prompt-inject.md"), "utf8"))}\n\n${BOOST_TEXT}`;
const results = [];
for (const item of cases) {
  const response = await fetch("http://127.0.0.1:3425/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: encodeUserPrompt(item.text) }],
      max_tokens: 700,
      temperature: 0.7,
    }),
  });
  const body = await response.json();
  const content = body?.choices?.[0]?.message?.content ?? "";
  const row = {
    case: item.id,
    status: response.status,
    refused: looksLikeRefusal(content),
    chars: content.length,
    head: content.replace(/\s+/g, " ").slice(0, 80),
  };
  results.push(row);
  console.log(`${row.case.padEnd(9)} status=${row.status} refused=${row.refused} chars=${row.chars} head=${row.head}`);
}
const out = {
  model,
  at: new Date().toISOString(),
  prompt_revision: "prompt-lab-v2-compact",
  refused: results.filter((r) => r.refused).length,
  total: results.length,
  results,
};
fs.writeFileSync(path.join(root, "prompt-lab", "eval-final.json"), JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`TOTAL ${out.refused}/${out.total} refused`);
