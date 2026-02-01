#!/usr/bin/env node
const { spawnSync } = require("child_process");
const path = require("path");

const agentDir = path.join(__dirname, "..", "agent");
const isWindows = process.platform === "win32";

function run(command, args) {
  return spawnSync(command, args, {
    cwd: agentDir,
    stdio: "inherit",
    shell: false,
  });
}

function tryUv() {
  const result = run("uv", ["sync"]);
  if (result.error && result.error.code === "ENOENT") {
    return false;
  }
  if (result.status != null) {
    process.exitCode = result.status;
  }
  if (result.error && result.error.code !== "ENOENT") {
    console.error(`[agent] Failed to run 'uv sync': ${result.error.message}`);
    process.exitCode = 1;
  }
  return true;
}

function runPip() {
  const candidates = isWindows ? ["python", "py"] : ["python3", "python"];
  for (const command of candidates) {
    const result = run(command, ["-m", "pip", "install", "-e", "."]);
    if (result.error && result.error.code === "ENOENT") {
      continue;
    }
    if (result.error) {
      console.error(`[agent] Failed to run '${command} -m pip install -e .': ${result.error.message}`);
      process.exitCode = 1;
      return;
    }
    process.exitCode = result.status ?? 0;
    return;
  }

  console.error("[agent] Neither 'uv' nor Python with pip is available. Install uv (https://docs.astral.sh/uv/) or ensure Python is on PATH.");
  process.exitCode = 1;
}

if (!tryUv()) {
  console.warn("[agent] 'uv' not found. Falling back to 'pip install -e .' inside agent/.");
  runPip();
}
