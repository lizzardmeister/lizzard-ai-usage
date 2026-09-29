const assert = require('node:assert/strict');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { formatCopilotUsage } = require('../src/providers/githubCopilot');
const { formatClaudeUsage } = require('../src/providers/claudeCode');

test('formats Copilot credits against the configured allowance', () => {
  const formatted = formatCopilotUsage(
    { usageItems: [{ grossQuantity: 1234 }] },
    3200,
    new Date('2026-09-29T12:00:00Z')
  );
  assert.equal(formatted.text, 'Copilot: 1234/3200 cr');
  assert.match(formatted.tooltip, /Próximo ciclo: 01\/10\/2026/);
});

test('formats Claude five-hour and weekly subscription windows', () => {
  const now = Date.UTC(2026, 8, 29, 12);
  const formatted = formatClaudeUsage({
    capturedAt: now,
    rate_limits: {
      five_hour: { used_percentage: 38.47, resets_at: (now + 209 * 60000) / 1000 },
      seven_day: { used_percentage: 10.45, resets_at: (now + 2 * 86400000) / 1000 }
    }
  }, now);
  assert.equal(formatted.text, 'Claude Code: 38.47/100% (3h29min) · 10.45/100% (2d)');
  assert.match(formatted.tooltip, /Última informação recebida/);
});

test('does not show expired Claude windows as current usage', () => {
  const now = Date.UTC(2026, 8, 29, 12);
  const formatted = formatClaudeUsage({
    rate_limits: { five_hour: { used_percentage: 90, resets_at: (now - 60000) / 1000 } }
  }, now);
  assert.equal(formatted.text, 'Claude Code: sem dados');
});

test('Claude statusLine capture stores quota fields without session data', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'ai-usage-claude-'));
  try {
    const outputPath = path.join(directory, 'limits.json');
    const input = {
      session_id: 'private-session',
      transcript_path: '/private/transcript',
      rate_limits: {
        five_hour: { used_percentage: 38.47, resets_at: 1800000000 },
        seven_day: { used_percentage: 10.45, resets_at: 1800000000 }
      }
    };
    const capture = spawnSync(process.execPath, [path.join(__dirname, '../src/providers/claudeStatuslineCapture.js'), outputPath], {
      input: JSON.stringify(input),
      encoding: 'utf8'
    });
    assert.equal(capture.status, 0);
    const saved = JSON.parse(readFileSync(outputPath, 'utf8'));
    assert.deepEqual(saved.rate_limits, input.rate_limits);
    assert.equal(saved.session_id, undefined);
    assert.equal(saved.transcript_path, undefined);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
