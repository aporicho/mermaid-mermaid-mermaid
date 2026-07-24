function createEmbeddedBrowserTitlebarHotZone({ webContents, initialHeight = 0, send }) {
  let height = normalizeTitlebarHotZoneHeight(initialHeight);
  let inside = false;

  const emit = (nextInside) => {
    if (nextInside === inside) return;
    inside = nextInside;
    send(inside);
  };
  const onBeforeMouseEvent = (event, mouse) => {
    const nextInside = mouseInsideTitlebarHotZone(mouse, height);
    if (nextInside) event.preventDefault();
    emit(nextInside);
  };

  webContents.on("before-mouse-event", onBeforeMouseEvent);
  return {
    setHeight(value) {
      height = normalizeTitlebarHotZoneHeight(value);
      if (height === 0) emit(false);
    },
    reset() {
      emit(false);
    },
    dispose() {
      webContents.removeListener("before-mouse-event", onBeforeMouseEvent);
      emit(false);
    }
  };
}

function mouseInsideTitlebarHotZone(mouse, height) {
  if (height <= 0 || mouse?.type === "mouseLeave") return false;
  return Number.isFinite(mouse?.y) && mouse.y >= 0 && mouse.y < height;
}

function normalizeTitlebarHotZoneHeight(value) {
  return Math.max(0, Number.isFinite(value) ? Math.ceil(value) : 0);
}

module.exports = {
  createEmbeddedBrowserTitlebarHotZone,
  mouseInsideTitlebarHotZone,
  normalizeTitlebarHotZoneHeight
};
