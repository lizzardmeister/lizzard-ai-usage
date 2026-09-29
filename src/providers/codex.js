const fs = require('node:fs');
const path = require('node:path');
const { AppServerClient } = require('../appServerClient');
const { formatUsage } = require('../usage');

class CodexSource {
  constructor(vscode, onChanged) {
    this.id = 'codex';
    this.label = 'Codex';
    this.vscode = vscode;
    this.onChanged = onChanged;
    this.client = null;
  }

  isAvailable() {
    const configured = this.vscode.workspace.getConfiguration('aiUsage').get('codexPath', '').trim();
    return Boolean(configured || this.vscode.extensions.getExtension('openai.chatgpt'));
  }

  executable() {
    const configured = this.vscode.workspace.getConfiguration('aiUsage').get('codexPath', '').trim();
    if (configured) return configured;

    const extension = this.vscode.extensions.getExtension('openai.chatgpt');
    const platform = { win32: 'windows', linux: 'linux', darwin: 'macos' }[process.platform];
    const arch = { x64: 'x86_64', arm64: 'aarch64' }[process.arch];
    if (extension && platform && arch) {
      const filename = process.platform === 'win32' ? 'codex.exe' : 'codex';
      const candidate = path.join(extension.extensionPath, 'bin', `${platform}-${arch}`, filename);
      if (fs.existsSync(candidate)) return candidate;
    }
    return 'codex';
  }

  // Codex has no documented public signal for which chat is focused.
  // A source can add isActiveChat() when it has a supported integration.

  async readUsage() {
    if (!this.client) {
      const client = new AppServerClient(this.executable());
      this.client = client;
      client.on('updated', this.onChanged);
      client.on('disconnected', () => {
        if (this.client === client) this.client = null;
      });
    }
    const result = await this.client.readRateLimits();
    return formatUsage(result);
  }

  reset() {
    this.client?.dispose();
    this.client = null;
  }

  dispose() {
    this.reset();
  }
}

module.exports = { CodexSource };
