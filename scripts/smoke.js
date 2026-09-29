const { AppServerClient } = require('../src/appServerClient');
const { formatUsage } = require('../src/usage');

async function main() {
  const client = new AppServerClient(process.argv[2] || 'codex');
  try {
    const result = await client.readRateLimits();
    console.log(formatUsage(result).text);
    console.log('Campos recebidos:', Object.keys(result || {}).join(', '));
  } finally {
    client.dispose();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
