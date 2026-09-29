const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const readline = require('node:readline');
const { AppServerClient } = require('../src/appServerClient');

test('initializes app-server, reads rate limits, and observes updates', async () => {
  const process = new EventEmitter();
  process.stdin = new PassThrough();
  process.stdout = new PassThrough();
  process.kill = () => process.emit('exit', 0);
  const sent = [];
  const input = readline.createInterface({ input: process.stdin });
  input.on('line', (line) => {
    const message = JSON.parse(line);
    sent.push(message);
    if (message.method === 'initialize') {
      process.stdout.write(`${JSON.stringify({ id: message.id, result: {} })}\n`);
    } else if (message.method === 'account/rateLimits/read') {
      process.stdout.write(`${JSON.stringify({ id: message.id, result: { rateLimits: { primary: { usedPercent: 25 } } } })}\n`);
    }
  });

  const client = new AppServerClient('codex', {
    spawnProcess: (binary, args) => {
      assert.equal(binary, 'codex');
      assert.deepEqual(args, ['app-server']);
      return process;
    },
    timeoutMs: 1000
  });
  let updates = 0;
  client.on('updated', () => updates++);
  const result = await client.readRateLimits();
  assert.equal(result.rateLimits.primary.usedPercent, 25);
  assert.deepEqual(sent.map((message) => message.method), [
    'initialize', 'initialized', 'account/rateLimits/read'
  ]);
  process.stdout.write('{"method":"account/rateLimits/updated"}\n');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(updates, 1);
  client.dispose();
  input.close();
});

test('reports a missing executable', async () => {
  const process = new EventEmitter();
  process.stdin = new PassThrough();
  process.stdout = new PassThrough();
  process.kill = () => {};
  const client = new AppServerClient('missing', {
    spawnProcess: () => {
      queueMicrotask(() => process.emit('error', new Error('ENOENT')));
      return process;
    },
    timeoutMs: 1000
  });
  await assert.rejects(client.readRateLimits(), /ENOENT/);
});
