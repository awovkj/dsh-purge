// WSL Kali bridge: Windows hosts should expose Linux tools through wsl.exe,
// while an unrelated WSL distro must not be mistaken for Kali.
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectKali, resolveTool } from "../lib/redteam/platform-config.js";

function fakeExec(cmd, args) {
  assert.equal(cmd, "wsl.exe");
  if (args[0] === "-l") return "Ubuntu\r\nkali-linux\r\n";
  if (args.includes("/etc/os-release")) return 'ID=kali\nNAME="Kali GNU/Linux"\n';
  if (args.includes("bash")) return "nmap=/usr/bin/nmap\nhttpx=/usr/bin/httpx-toolkit\n";
  return "";
}

test("detectKali recognizes a configured WSL Kali distro", () => {
  const found = detectKali({
    platform: "win32",
    config: { wslDistribution: "kali-linux" },
    exec: fakeExec,
  });
  assert.equal(found.kali, true);
  assert.equal(found.wsl, true);
  assert.equal(found.distribution, "kali-linux");
});

test("detectKali does not call an unrelated WSL distro Kali", () => {
  const found = detectKali({
    platform: "win32",
    config: { wslDistribution: "ubuntu" },
    exec: (cmd, args) => {
      if (args[0] === "-l") return "Ubuntu\n";
      if (args.includes("/etc/os-release")) return 'ID=ubuntu\nNAME="Ubuntu"\n';
      return "";
    },
  });
  assert.equal(found.kali, false);
});

test("resolveTool returns a wsl.exe command instead of a Windows path", () => {
  const tool = resolveTool("nmap", {
    config: { wslDistribution: "kali-linux" },
    exec: fakeExec,
  });
  assert.equal(tool.source, "wsl");
  assert.equal(tool.path, "/usr/bin/nmap");
  assert.equal(tool.command, "wsl.exe -d kali-linux -- /usr/bin/nmap");
});

test("explicit Linux paths are checked inside the selected Kali distribution", () => {
  const calls = [];
  const tool = resolveTool("nmap", {
    config: { platform: "windows", wslDistribution: "kali-linux", tools: { nmap: "/opt/fixture/nmap" } },
    exec: (command, arguments_, options) => {
      calls.push({ command, arguments_, options });
      return fakeExec(command, arguments_);
    },
  });
  assert.equal(tool.source, "wsl");
  assert.equal(tool.path, "/opt/fixture/nmap");
  assert.deepEqual(tool.argv, ["-d", "kali-linux", "--", "/opt/fixture/nmap"]);
  assert(calls.some(call => call.arguments_.includes("test") && call.arguments_.includes("-x")
    && call.arguments_.at(-1) === "/opt/fixture/nmap" && call.options.windowsHide === true));
  const missing = resolveTool("nmap", {
    config: { platform: "windows", wslDistribution: "kali-linux", tools: { nmap: "/opt/fixture/missing" } },
    exec: (command, arguments_) => {
      if (arguments_.includes("test")) throw new Error("fixture file absent");
      return fakeExec(command, arguments_);
    },
  });
  assert.equal(missing.source, "missing");
  assert.equal(missing.path, null);
});
