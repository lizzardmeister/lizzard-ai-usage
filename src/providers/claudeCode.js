const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { remainingDurationLabel } = require('../usage');

function percent(value) {
  if (!Number.isFinite(value)) return null;
  return String(Math.round(value * 100) / 100);
}

function claudeWindows(snapshot, now) {
  const limits = snapshot?.rate_limits;
  return [
    { name: '5h', value: limits?.five_hour },
    { name: '1sem', value: limits?.seven_day }
  ].filter(({ value }) => Number.isFinite(value?.used_percentage) &&
    Number.isFinite(value?.resets_at) && value.resets_at * 1000 > now);
}

function formatClaudeUsage(snapshot, now = Date.now()) {
  const windows = claudeWindows(snapshot, now);
  if (!windows.length) {
    return {
      text: 'Claude Code: sem dados',
      tooltip: 'Abra uma sessão Claude Code e aguarde a primeira resposta para receber os limites de 5h e da semana.'
    };
  }

  const parts = windows.map(({ value }) =>
    `${percent(value.used_percentage)}/100% (${remainingDurationLabel({ resetsAt: value.resets_at }, now)})`
  );
  const details = windows.map(({ name, value }) =>
    `${name}: ${percent(value.used_percentage)}/100% usado; renova em ${new Date(value.resets_at * 1000).toLocaleString('pt-BR')}`
  );
  const observed = Number.isFinite(snapshot.capturedAt)
    ? `Última informação recebida do Claude Code: ${new Date(snapshot.capturedAt).toLocaleString('pt-BR')}.`
    : 'Informação recebida do Claude Code.';
  return { text: `Claude Code: ${parts.join(' · ')}`, tooltip: `${details.join('\n')}\n${observed}` };
}

class ClaudeCodeSource {
  constructor(vscode, storageUri, options = {}) {
    this.id = 'claude-code';
    this.label = 'Claude Code';
    this.vscode = vscode;
    this.storageUri = storageUri;
    this.readFile = options.readFile || fs.promises.readFile;
    this.existsSync = options.existsSync || fs.existsSync;
    this.now = options.now || Date.now;
  }

  get snapshotPath() {
    return path.join(this.storageUri.fsPath, 'claude-rate-limits.json');
  }

  isAvailable() {
    return Boolean(this.vscode.extensions.getExtension('anthropic.claude-code') || this.existsSync(this.snapshotPath));
  }

  async readUsage() {
    let snapshot;
    try {
      snapshot = JSON.parse(await this.readFile(this.snapshotPath, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Execute “AI Usage: Configurar Claude Code” e aguarde uma resposta do Claude Code.');
      }
      throw error;
    }
    return formatClaudeUsage(snapshot, this.now());
  }

  async configure() {
    const capturePath = path.join(this.storageUri.fsPath, 'claude-statusline-capture.js');
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    await fs.promises.mkdir(this.storageUri.fsPath, { recursive: true });
    await fs.promises.copyFile(path.join(__dirname, 'claudeStatuslineCapture.js'), capturePath);

    const quote = (value) => process.platform === 'win32'
      ? `"${value}"`
      : `'${value.replaceAll("'", "'\\''")}'`;
    const command = `node ${quote(capturePath)} ${quote(this.snapshotPath)}`;
    let settings = {};
    try {
      settings = JSON.parse(await fs.promises.readFile(settingsPath, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    if (settings.statusLine && settings.statusLine.command !== command) {
      await this.vscode.env.clipboard.writeText(command);
      this.vscode.window.showWarningMessage(
        'O Claude Code já tem uma statusLine. O comando do AI Usage foi copiado; integre-o à sua configuração atual para preservar o comportamento existente.'
      );
      return;
    }

    settings.statusLine = { ...settings.statusLine, type: 'command', command };
    await fs.promises.mkdir(path.dirname(settingsPath), { recursive: true });
    await fs.promises.writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
    this.vscode.window.showInformationMessage('Claude Code configurado. Após a próxima resposta, os limites aparecerão no AI Usage.');
  }

  dispose() {}
}

module.exports = { ClaudeCodeSource, formatClaudeUsage };
