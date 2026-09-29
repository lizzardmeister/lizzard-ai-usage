const assert = require('node:assert/strict');
const test = require('node:test');
const { resolveSource } = require('../src/sourceResolver');

const source = (id, active = false) => ({
  id,
  isAvailable: () => true,
  isActiveChat: async () => active
});

test('uses the only available source', async () => {
  const codex = source('codex');
  assert.equal(await resolveSource([codex]), codex);
});

test('uses a supported active chat signal when several sources exist', async () => {
  const codex = source('codex');
  const other = source('other', true);
  assert.equal(await resolveSource([codex, other]), other);
});

test('respects manual selection and does not guess among several sources', async () => {
  const codex = source('codex');
  const other = source('other');
  assert.equal(await resolveSource([codex, other], 'codex'), codex);
  assert.equal(await resolveSource([codex, other]), null);
});

test('waits for asynchronous source availability', async () => {
  const unavailable = { id: 'unavailable', isAvailable: async () => false };
  const copilot = { id: 'copilot', isAvailable: async () => true };
  assert.equal(await resolveSource([unavailable, copilot]), copilot);
});
