const DEFAULT_IDLE_TIMEOUT_MS = 15 * 60_000;

function createPiAgentLifecycle({ onChange, onExpire, idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS }) {
  let status = "starting";
  let foreground = false;
  let timer = null;
  let disposed = false;

  function snapshot() {
    return { status, foreground };
  }

  function setStatus(next, details = {}) {
    if (disposed || status === next) return;
    status = next;
    schedule();
    onChange({ ...snapshot(), ...details });
  }

  function setForeground(next) {
    if (disposed || foreground === Boolean(next)) return;
    foreground = Boolean(next);
    schedule();
    onChange(snapshot());
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (disposed || foreground || status !== "idle") return;
    timer = setTimeout(() => {
      timer = null;
      if (!disposed && !foreground && status === "idle") onExpire();
    }, idleTimeoutMs);
    timer.unref?.();
  }

  function dispose() {
    disposed = true;
    if (timer) clearTimeout(timer);
    timer = null;
  }

  return { snapshot, setStatus, setForeground, dispose };
}

module.exports = { DEFAULT_IDLE_TIMEOUT_MS, createPiAgentLifecycle };
