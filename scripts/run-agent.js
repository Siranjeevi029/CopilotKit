#!/usr/bin/env node
const { spawn, spawnSync } = require("child_process");
const path = require("path");

const agentDir = path.join(__dirname, "..", "agent");
const installScript = path.join(__dirname, "install-agent.js");
const isWindows = process.platform === "win32";
let activeChild = null;

function forwardSignals(child) {
  activeChild = child;
}

process.on("SIGINT", () => {
  if (activeChild) {
    activeChild.kill("SIGINT");
  }
});

process.on("SIGTERM", () => {
  if (activeChild) {
    activeChild.kill("SIGTERM");
  }
});

function runProcess(command, args, { onMissing } = {}) {
  let missingHandled = false;
  const child = spawn(command, args, {
    cwd: agentDir,
    stdio: "inherit",
    shell: false,
  });

  forwardSignals(child);

  child.once("error", (error) => {
    if (error.code === "ENOENT" && typeof onMissing === "function") {
      missingHandled = true;
      onMissing();
      return;
    }
    console.error(`[agent] Failed to run '${command}': ${error.message}`);
    process.exitCode = 1;
  });

  child.once("exit", (code, signal) => {
    if (missingHandled) {
      return;
    }
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exitCode = code ?? 0;
  });

  return child;
}

function runPython() {
  const candidates = isWindows ? ["python", "py"] : ["python3", "python"];

  function attempt(index) {
    if (index >= candidates.length) {
      console.error("[agent] No Python interpreter found. Install Python 3.9+ or add it to PATH.");
      process.exitCode = 1;
      return;
    }

    const command = candidates[index];
    const child = spawn(command, ["main.py"], {
      cwd: agentDir,
      stdio: "inherit",
      shell: false,
    });

    forwardSignals(child);

    child.once("error", (error) => {
      if (error.code === "ENOENT") {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[agent] '${command}' not found, trying next Python candidate.`);
        }
        attempt(index + 1);
        return;
      }
      console.error(`[agent] Failed to run '${command}': ${error.message}`);
      process.exitCode = 1;
    });

    child.once("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      process.exitCode = code ?? 0;
    });
  }

  console.warn("[agent] Falling back to Python (uv not available).");

  if (process.env.COPILOTKIT_AGENT_SKIP_INSTALL !== "1") {
    const installResult = spawnSync(process.execPath, [installScript], {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
      shell: false,
    });

    if (installResult.status && installResult.status !== 0) {
      process.exitCode = installResult.status;
      return;
    }
  }

  attempt(0);
}

runProcess("uv", ["run", "dev"], { onMissing: runPython });
