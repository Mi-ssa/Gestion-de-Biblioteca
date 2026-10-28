import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  scheduleToastLifecycle,
  TOAST_DURATION_MS,
  TOAST_EXIT_DURATION_MS,
} from '../src/utils/toast-lifecycle.js';

function createFakeTimers() {
  let now = 0;
  let nextId = 0;
  const jobs = new Map();
  return {
    timers: {
      setTimeout(callback, delay) {
        const id = ++nextId;
        jobs.set(id, { callback, at: now + delay });
        return id;
      },
      clearTimeout(id) {
        jobs.delete(id);
      },
    },
    get now() {
      return now;
    },
    advanceTo(target) {
      while (true) {
        const next = [...jobs.entries()]
          .filter(([, job]) => job.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, job] = next;
        jobs.delete(id);
        now = job.at;
        job.callback();
      }
      now = target;
    },
  };
}

test('auto-dismisses after six seconds including the exit animation', () => {
  const fake = createFakeTimers();
  const events = [];
  scheduleToastLifecycle({
    onLeaving: () => events.push(['leaving', fake.now]),
    onDismiss: () => events.push(['dismissed', fake.now]),
    timers: fake.timers,
  });
  fake.advanceTo(TOAST_DURATION_MS - TOAST_EXIT_DURATION_MS);
  assert.deepEqual(events, [['leaving', TOAST_DURATION_MS - TOAST_EXIT_DURATION_MS]]);
  fake.advanceTo(TOAST_DURATION_MS);
  assert.deepEqual(events, [
    ['leaving', TOAST_DURATION_MS - TOAST_EXIT_DURATION_MS],
    ['dismissed', TOAST_DURATION_MS],
  ]);
});

test('manual dismissal starts the exit animation and removes the toast', () => {
  const fake = createFakeTimers();
  const events = [];
  const toast = scheduleToastLifecycle({
    onLeaving: () => events.push('leaving'),
    onDismiss: () => events.push('dismissed'),
    timers: fake.timers,
  });

  toast.dismiss();
  toast.dismiss();
  assert.deepEqual(events, ['leaving']);
  fake.advanceTo(TOAST_EXIT_DURATION_MS);
  assert.deepEqual(events, ['leaving', 'dismissed']);
});

test('cancelling a toast lifecycle prevents pending auto-dismiss callbacks', () => {
  const fake = createFakeTimers();
  let dismissed = false;
  const toast = scheduleToastLifecycle({
    onLeaving: () => {},
    onDismiss: () => { dismissed = true; },
    timers: fake.timers,
  });

  toast.cancel();
  fake.advanceTo(TOAST_DURATION_MS);
  assert.equal(dismissed, false);
});
