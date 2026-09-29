// Claude Code sends this documented statusLine input on stdin. Store only quota fields.
const fs = require('node:fs');

const outputPath = process.argv[2];
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
  if (input.length > 1024 * 1024) process.stdin.destroy();
});
process.stdin.on('end', () => {
  let statusText = 'AI Usage ativo';
  try {
    const limits = JSON.parse(input).rate_limits;
    if (limits && (limits.five_hour || limits.seven_day)) {
      const snapshot = {
        capturedAt: Date.now(),
        rate_limits: {
          five_hour: limits.five_hour,
          seven_day: limits.seven_day
        }
      };
      const temporaryPath = `${outputPath}.${process.pid}.tmp`;
      fs.writeFileSync(temporaryPath, JSON.stringify(snapshot), { mode: 0o600 });
      fs.renameSync(temporaryPath, outputPath);
      const windows = [
        ['5h', limits.five_hour],
        ['7d', limits.seven_day]
      ].filter(([, value]) => Number.isFinite(value?.used_percentage));
      if (windows.length) {
        statusText = windows.map(([label, value]) => `${label}: ${value.used_percentage}%`).join(' · ');
      }
    }
  } catch {
    // Keep Claude Code's status line working if quota data is unavailable.
  }
  process.stdout.write(statusText);
});
