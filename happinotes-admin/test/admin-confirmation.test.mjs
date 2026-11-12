import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createConfirmationController } from '../lib/admin-confirmation.ts';

const options = { title: 'Delete content?', description: 'This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' };

test('an action waits for explicit confirmation and runs only once', async () => {
  const controller = createConfirmationController();
  let calls = 0;
  const action = (async () => { if (await controller.request(options)) calls++; })();
  await Promise.resolve();
  assert.equal(calls, 0);
  assert.equal(controller.getSnapshot().isOpen, true);
  controller.settle(controller.getSnapshot().id, true);
  controller.settle(controller.getSnapshot().id, true);
  await action;
  assert.equal(calls, 1);
  assert.equal(controller.getSnapshot().isOpen, false);
});

test('cancel, escape, and navigation cancellation leave the action unapplied', async () => {
  const controller = createConfirmationController();
  let calls = 0;
  const action = (async () => { if (await controller.request(options)) calls++; })();
  controller.cancel();
  await action;
  assert.equal(calls, 0);
  const next = controller.request({ ...options, title: 'Upload file?' });
  controller.settle(controller.getSnapshot().id, true);
  assert.equal(await next, true);
});

test('repeated clicks cannot replace the pending decision or approve a second action', async () => {
  const controller = createConfirmationController();
  const first = controller.request(options);
  const duplicate = controller.request({ ...options, title: 'Publish prices?' });
  assert.equal(await duplicate, false);
  assert.equal(controller.getSnapshot().title, options.title);
  controller.settle(controller.getSnapshot().id, true);
  assert.equal(await first, true);
});

test('dialog subscribers update on open and close, with copy retained during exit', async () => {
  const controller = createConfirmationController();
  const snapshots = [];
  const unsubscribe = controller.subscribe(() => snapshots.push(controller.getSnapshot()));
  const decision = controller.request(options);
  controller.cancel();
  await decision;
  assert.deepEqual(snapshots.map((snapshot) => snapshot.isOpen), [true, false]);
  assert.equal(snapshots[1].description, options.description);
  unsubscribe();
  controller.settle(controller.getSnapshot().id, true);
  assert.equal(snapshots.length, 2);
});

test('a late close or confirm from an old modal cannot settle a newer request', async () => {
  const controller = createConfirmationController();
  const first = controller.request(options);
  const firstId = controller.getSnapshot().id;
  controller.settle(firstId, true);
  assert.equal(await first, true);

  let secondResolved = false;
  const second = controller.request({ ...options, title: 'Upload file?' })
    .then((result) => { secondResolved = true; return result; });
  const secondId = controller.getSnapshot().id;
  assert.notEqual(firstId, secondId);
  controller.settle(firstId, false);
  controller.settle(firstId, true);
  await Promise.resolve();
  assert.equal(secondResolved, false);
  assert.equal(controller.getSnapshot().isOpen, true);
  controller.settle(secondId, false);
  assert.equal(await second, false);
});

test('navigation cancellation invalidates callbacks from the previous page', async () => {
  const controller = createConfirmationController();
  const first = controller.request(options);
  const oldId = controller.getSnapshot().id;
  controller.cancel();
  assert.equal(await first, false);
  const next = controller.request({ ...options, title: 'Save book?' });
  controller.settle(oldId, true);
  assert.equal(controller.getSnapshot().isOpen, true);
  controller.cancel();
  assert.equal(await next, false);
});
