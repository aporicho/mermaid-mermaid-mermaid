const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let nodePty = null;
try {
  nodePty = require("node-pty");
} catch {
  nodePty = null;
}

function createTerminalManager({ send }) {
  const sessions = new Map();

  return {
    listShells: terminalShellOptions,
    open(request = {}) {
      if (!nodePty) {
        return {
          status: "unsupported",
          message: "Electron 终端依赖 node-pty 未加载。"
        };
      }

      const shell = resolveTerminalShell(request.shellId);
      if (!shell.available) {
        return {
          status: "unsupported",
          message: `当前系统不可用 shell：${shell.label}`
        };
      }

      const sessionId = `term_${crypto.randomUUID()}`;
      const cwd = resolveTerminalCwd(request.cwd);
      const size = terminalSize(request.cols, request.rows);
      const ptyProcess = nodePty.spawn(shell.program, shell.args, {
        name: "xterm-256color",
        cols: size.cols,
        rows: size.rows,
        cwd,
        env: {
          ...process.env,
          TERM: process.env.TERM || "xterm-256color",
          COLORTERM: process.env.COLORTERM || "truecolor"
        }
      });

      const dataDisposable = ptyProcess.onData((data) => {
        send("terminal:data", { sessionId, data });
      });
      const exitDisposable = ptyProcess.onExit((event) => {
        const session = sessions.get(sessionId);
        session?.dataDisposable?.dispose?.();
        session?.exitDisposable?.dispose?.();
        sessions.delete(sessionId);
        send("terminal:exit", {
          sessionId,
          exitCode: typeof event.exitCode === "number" ? event.exitCode : null
        });
      });

      sessions.set(sessionId, {
        ptyProcess,
        dataDisposable,
        exitDisposable
      });

      return {
        status: "opened",
        session: {
          sessionId,
          cwd,
          shellId: shell.id,
          shellLabel: shell.label,
          shell: commandLabel(shell)
        }
      };
    },
    write(sessionId, data) {
      const session = sessions.get(sessionId);
      if (!session) return;
      session.ptyProcess.write(String(data || ""));
    },
    resize(sessionId, cols, rows) {
      const session = sessions.get(sessionId);
      if (!session) return;
      const size = terminalSize(cols, rows);
      session.ptyProcess.resize(size.cols, size.rows);
    },
    close(sessionId) {
      const session = sessions.get(sessionId);
      if (!session) return;
      sessions.delete(sessionId);
      session.dataDisposable?.dispose?.();
      session.exitDisposable?.dispose?.();
      session.ptyProcess.kill();
    },
    closeAll() {
      for (const sessionId of Array.from(sessions.keys())) {
        this.close(sessionId);
      }
    }
  };
}

function terminalShellOptions() {
  return terminalShellSpecs().map((shell) => ({
    id: shell.id,
    label: shell.label,
    command: commandLabel(shell),
    available: shell.available
  }));
}

function resolveTerminalShell(shellId) {
  const shells = terminalShellSpecs();
  const requested = typeof shellId === "string" && shellId ? shellId : "default";
  return shells.find((shell) => shell.id === requested) || shells.find((shell) => shell.id === "default") || shells[0];
}

function terminalShellSpecs() {
  const defaultProgram = defaultTerminalShell();
  const shells = [
    shellSpec("default", "默认", defaultProgram, [])
  ];

  if (process.platform === "win32") {
    shells.push(
      shellSpec("powershell", "PowerShell", "powershell.exe", ["-NoLogo"]),
      shellSpec("pwsh", "PowerShell 7", "pwsh.exe", ["-NoLogo"]),
      shellSpec("cmd", "CMD", "cmd.exe", []),
      shellSpec("wsl", "WSL", "wsl.exe", [])
    );
  } else {
    shells.push(
      shellSpec("bash", "Bash", "bash", []),
      shellSpec("zsh", "Zsh", "zsh", []),
      shellSpec("sh", "sh", "sh", [])
    );
  }

  return shells;
}

function shellSpec(id, label, program, args) {
  return {
    id,
    label,
    program,
    args,
    available: commandExists(program)
  };
}

function defaultTerminalShell() {
  if (process.platform === "win32") {
    return process.env.ComSpec || "powershell.exe";
  }
  return process.env.SHELL || "sh";
}

function resolveTerminalCwd(cwd) {
  if (typeof cwd === "string" && cwd && isDirectory(cwd)) {
    try {
      return fs.realpathSync(cwd);
    } catch {
      return cwd;
    }
  }
  try {
    const currentWorkingDirectory = process.cwd();
    if (isDirectory(currentWorkingDirectory)) return fs.realpathSync(currentWorkingDirectory);
  } catch {
    // The launch directory may have been removed after the app started.
  }
  return os.homedir();
}

function commandExists(program) {
  if (!program) return false;
  if (path.isAbsolute(program) || program.includes("/") || program.includes("\\")) {
    return isFile(program);
  }

  const pathExt = process.platform === "win32" ? (process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";") : [""];
  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    for (const extension of pathExt) {
      if (isFile(path.join(dir, extension && !program.toLowerCase().endsWith(extension.toLowerCase()) ? `${program}${extension}` : program))) {
        return true;
      }
    }
  }

  if (process.platform === "win32") {
    return [
      path.join(process.env.SystemRoot || "C:\\Windows", "System32", program),
      path.join(process.env.SystemRoot || "C:\\Windows", "SysWOW64", program),
      path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", program)
    ].some(isFile);
  }

  return ["/bin", "/usr/bin", "/usr/local/bin"].some((dir) => isFile(path.join(dir, program)));
}

function terminalSize(cols, rows) {
  return {
    cols: clamp(Math.round(Number(cols) || 80), 20, 240),
    rows: clamp(Math.round(Number(rows) || 24), 4, 80)
  };
}

function commandLabel(shell) {
  return [shell.program, ...shell.args].join(" ");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isDirectory(value) {
  try {
    return fs.statSync(value).isDirectory();
  } catch {
    return false;
  }
}

function isFile(value) {
  try {
    return fs.statSync(value).isFile();
  } catch {
    return false;
  }
}

module.exports = {
  createTerminalManager,
  resolveTerminalCwd,
  terminalShellOptions
};
