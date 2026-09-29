const assert = require('node:assert/strict');
const test = require('node:test');
const { formatUsage } = require('../src/usage');

test('shows used percentages for the Codex quota windows', () => {
  const now = Date.UTC(2026, 0, 1, 12, 0, 0);
  const result = {
    rateLimitsByLimitId: {
      codex: {
        primary: { usedPercent: 38.47, windowDurationMins: 300, resetsAt: (now + 209 * 60000) / 1000 },
        secondary: { usedPercent: 10.45, windowDurationMins: 10080, resetsAt: (now + 2 * 86400000) / 1000 }
      }
    }
  };
  const formatted = formatUsage(result, 'pt-BR', now);
  assert.equal(formatted.text, 'Codex: 38.47/100% (3h29min) · 10.45/100% (2d)');
  assert.match(formatted.tooltip, /38.47\/100% usado/);
  assert.match(formatted.tooltip, /10.45\/100% usado/);
  assert.match(formatted.tooltip, /restam 3h29min/);
  assert.match(formatted.tooltip, /restam 2d/);
});

test('falls back to the single bucket and handles missing data', () => {
  assert.equal(formatUsage({ rateLimits: { primary: { usedPercent: 101, windowDurationMins: 15 } } }).text,
    'Codex: 100/100% (15min)');
  assert.equal(formatUsage({ rateLimits: { primary: { usedPercent: 25, windowDurationMins: 15 } } }).text,
    'Codex: 25/100% (15min)');
  assert.equal(formatUsage({ rateLimits: { primary: { usedPercent: 38.4, windowDurationMins: 15 } } }).text,
    'Codex: 38.4/100% (15min)');
  assert.equal(formatUsage({}).text, 'Codex: sem dados');
});
