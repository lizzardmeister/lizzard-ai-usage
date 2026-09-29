const GITHUB_API_VERSION = '2026-03-10';

function number(value) {
  return Number.isFinite(value) ? value : 0;
}

function formatNumber(value) {
  return String(Math.round(value * 100) / 100);
}

function nextMonthLabel(now) {
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return reset.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function formatCopilotUsage(creditReport, monthlyCredits, now = new Date()) {
  const credits = (creditReport.usageItems || []).reduce((total, item) => total + number(item.grossQuantity), 0);
  const total = Number.isFinite(monthlyCredits) && monthlyCredits > 0 ? formatNumber(monthlyCredits) : '?';
  const text = `Copilot: ${formatNumber(credits)}/${total} cr`;
  const reset = nextMonthLabel(now);
  const detail = [
    'Créditos mensais do GitHub Copilot',
    `Créditos de IA consumidos: ${formatNumber(credits)}`,
    `Franquia configurada: ${total} créditos`,
    `Próximo ciclo: ${reset}`,
    'O total é configurado no AI Usage; a API de consumo não informa a franquia do plano.'
  ].join('\n');
  return { text, tooltip: detail };
}

class GitHubCopilotSource {
  constructor(vscode, secrets, options = {}) {
    this.id = 'github-copilot';
    this.label = 'GitHub Copilot';
    this.vscode = vscode;
    this.secrets = secrets;
    this.fetch = options.fetch || globalThis.fetch;
    this.now = options.now || (() => new Date());
    this.secretKey = 'aiUsage.githubCopilotToken';
  }

  async isAvailable() {
    return Boolean(
      this.vscode.extensions.getExtension('github.copilot-chat') &&
      await this.secrets.get(this.secretKey)
    );
  }

  async request(url, token) {
    const response = await this.fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': GITHUB_API_VERSION
      }
    });
    if (!response.ok) {
      throw new Error(`GitHub respondeu ${response.status}`);
    }
    return response.json();
  }

  async readUsage() {
    const token = await this.secrets.get(this.secretKey);
    if (!token) throw new Error('Configure um token GitHub com a permissão Plan: Read.');

    const now = this.now();
    const account = await this.request('https://api.github.com/user', token);
    const base = `https://api.github.com/users/${encodeURIComponent(account.login)}/settings/billing`;
    const query = new URLSearchParams({
      year: String(now.getUTCFullYear()),
      month: String(now.getUTCMonth() + 1)
    });
    const creditReport = await this.request(`${base}/ai_credit/usage?${query}`, token);
    const monthlyCredits = this.vscode.workspace.getConfiguration('aiUsage').get('copilotMonthlyCredits', 0);
    return formatCopilotUsage(creditReport, monthlyCredits, now);
  }

  dispose() {}
}

module.exports = { GitHubCopilotSource, formatCopilotUsage };
