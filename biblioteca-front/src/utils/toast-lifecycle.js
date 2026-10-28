export const TOAST_DURATION_MS = 6000;
export const TOAST_EXIT_DURATION_MS = 180;

export function scheduleToastLifecycle({ onLeaving, onDismiss, timers = globalThis }) {
  let removeTimer;
  let closing = false;
  const leaveTimer = timers.setTimeout(dismiss, TOAST_DURATION_MS - TOAST_EXIT_DURATION_MS);

  function dismiss() {
    if (closing) return;
    closing = true;
    timers.clearTimeout(leaveTimer);
    onLeaving();
    removeTimer = timers.setTimeout(onDismiss, TOAST_EXIT_DURATION_MS);
  }

  return {
    dismiss,
    cancel() {
      timers.clearTimeout(leaveTimer);
      if (removeTimer !== undefined) timers.clearTimeout(removeTimer);
    },
  };
}
