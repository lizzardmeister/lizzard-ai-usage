const vscode = require('vscode');
const { CodexSource } = require('./providers/codex');
const { ClaudeCodeSource } = require('./providers/claudeCode');
const { GitHubCopilotSource } = require('./providers/githubCopilot');
const { resolveSource } = require('./sourceResolver');

let sources = [];
let timer;
let status;
let statusName;
let statusGear;
let context;
let refreshId = 0;

function setIndicator(label, usage, tooltip, command = 'aiUsage.refresh') {
  statusName.text = `${label}:`;
  statusName.tooltip = label;
  status.text = usage;
  status.tooltip = tooltip;
  status.command = command;
}

async function refresh() {
  const currentId = ++refreshId;
  const preference = context.globalState.get('preferredSource', 'auto');
  const source = await resolveSource(sources, preference);
  if (currentId !== refreshId) return;

  if (!source) {
    setIndicator(
      'AI Usage',
      'selecione fonte',
      'Clique para escolher a fonte de IA.',
      'aiUsage.selectSource'
    );
    return;
  }

  try {
    const display = await source.readUsage();
    if (currentId !== refreshId) return;
    const separator = display.text.indexOf(':');
    const usage = separator === -1 ? display.text : display.text.slice(separator + 1).trim();
    setIndicator(source.label, usage, `${source.label}\n${display.tooltip}\nClique para atualizar.`);
  } catch (error) {
    if (currentId !== refreshId) return;
    setIndicator(source.label, 'indisponível', `Não foi possível ler o uso de ${source.label}: ${error.message}\nClique para atualizar.`);
  }
}

async function configure() {
  const choices = [
    { label: 'Selecionar fonte de IA', command: 'aiUsage.selectSource' },
    { label: 'Configurar Claude Code', command: 'aiUsage.configureClaudeCode' },
    { label: 'Definir token do GitHub Copilot', command: 'aiUsage.setGitHubCopilotToken' },
    { label: 'Remover token do GitHub Copilot', command: 'aiUsage.clearGitHubCopilotToken' },
    { label: 'Definir créditos mensais do Copilot', command: 'aiUsage.setCopilotMonthlyCredits' },
    { label: 'Definir caminho do Codex CLI', command: 'aiUsage.setCodexPath' },
    { label: 'Definir intervalo de atualização', command: 'aiUsage.setRefreshInterval' }
  ];
  const selected = await vscode.window.showQuickPick(choices, { placeHolder: 'Configurar AI Usage' });
  if (selected) await vscode.commands.executeCommand(selected.command);
}

async function selectSource() {
  const availability = await Promise.all(sources.map(async (source) => Boolean(await source.isAvailable())));
  const choices = [
    { label: 'Automático', description: 'Usar detecção quando o provedor oferecer suporte', id: 'auto' },
    ...sources.filter((_, index) => availability[index]).map((source) => ({ label: source.label, id: source.id }))
  ];
  const selected = await vscode.window.showQuickPick(choices, { placeHolder: 'Fonte do indicador de uso' });
  if (!selected) return;
  await context.globalState.update('preferredSource', selected.id);
  void refresh();
}

async function setSecret(secretKey, prompt) {
  const value = await vscode.window.showInputBox({ prompt, password: true, ignoreFocusOut: true });
  if (!value) return;
  await context.secrets.store(secretKey, value.trim());
  void refresh();
}

async function clearSecret(secretKey, label) {
  await context.secrets.delete(secretKey);
  vscode.window.showInformationMessage(`${label} removido do armazenamento secreto do VS Code.`);
  void refresh();
}

async function setCopilotMonthlyCredits() {
  const current = vscode.workspace.getConfiguration('aiUsage').get('copilotMonthlyCredits', 0);
  const value = await vscode.window.showInputBox({
    prompt: 'Franquia mensal de créditos de IA mostrada no seu plano GitHub Copilot',
    value: current > 0 ? String(current) : '',
    validateInput: (input) => Number.isFinite(Number(input)) && Number(input) > 0
      ? undefined
      : 'Informe um número maior que zero.'
  });
  if (value === undefined) return;
  await vscode.workspace.getConfiguration('aiUsage').update(
    'copilotMonthlyCredits', Number(value), vscode.ConfigurationTarget.Global
  );
}

async function setCodexPath() {
  const current = vscode.workspace.getConfiguration('aiUsage').get('codexPath', '');
  const value = await vscode.window.showInputBox({
    prompt: 'Caminho do executável Codex CLI. Deixe vazio para detectar automaticamente.',
    value: current,
    ignoreFocusOut: true
  });
  if (value === undefined) return;
  await vscode.workspace.getConfiguration('aiUsage').update(
    'codexPath', value.trim(), vscode.ConfigurationTarget.Global
  );
}

async function setRefreshInterval() {
  const current = vscode.workspace.getConfiguration('aiUsage').get('refreshIntervalSeconds', 600);
  const value = await vscode.window.showInputBox({
    prompt: 'Intervalo de atualização automática, em segundos (mínimo de 30).',
    value: String(current),
    validateInput: (input) => Number.isInteger(Number(input)) && Number(input) >= 30
      ? undefined
      : 'Informe um número inteiro de pelo menos 30.'
  });
  if (value === undefined) return;
  await vscode.workspace.getConfiguration('aiUsage').update(
    'refreshIntervalSeconds', Number(value), vscode.ConfigurationTarget.Global
  );
}

function scheduleRefresh() {
  clearInterval(timer);
  const seconds = vscode.workspace.getConfiguration('aiUsage').get('refreshIntervalSeconds', 600);
  timer = setInterval(() => void refresh(), Math.max(30, seconds) * 1000);
}

function activate(extensionContext) {
  context = extensionContext;
  statusName = vscode.window.createStatusBarItem('aiUsage.source', vscode.StatusBarAlignment.Right, -1000);
  statusName.name = 'AI Usage: fonte';
  statusName.text = 'AI Usage:';
  statusName.tooltip = 'Fonte de IA exibida';
  statusName.show();

  statusGear = vscode.window.createStatusBarItem('aiUsage.settings', vscode.StatusBarAlignment.Right, -1002);
  statusGear.name = 'AI Usage: configuração';
  statusGear.text = '$(gear)';
  statusGear.tooltip = 'Configurar AI Usage';
  statusGear.command = 'aiUsage.configure';
  statusGear.show();

  status = vscode.window.createStatusBarItem('aiUsage.usage', vscode.StatusBarAlignment.Right, -1001);
  status.name = 'AI Usage: dados';
  status.text = 'carregando';
  status.tooltip = 'Lendo limites de uso...';
  status.command = 'aiUsage.refresh';
  status.show();
  context.subscriptions.push(statusName, statusGear, status);

  sources = [
    new CodexSource(vscode, () => void refresh()),
    new GitHubCopilotSource(vscode, context.secrets),
    new ClaudeCodeSource(vscode, context.globalStorageUri)
  ];
  context.subscriptions.push(vscode.commands.registerCommand('aiUsage.refresh', refresh));
  context.subscriptions.push(vscode.commands.registerCommand('aiUsage.configure', configure));
  context.subscriptions.push(vscode.commands.registerCommand('aiUsage.selectSource', selectSource));
  context.subscriptions.push(vscode.commands.registerCommand('aiUsage.setCodexPath', setCodexPath));
  context.subscriptions.push(vscode.commands.registerCommand('aiUsage.setRefreshInterval', setRefreshInterval));
  context.subscriptions.push(vscode.commands.registerCommand('aiUsage.setGitHubCopilotToken', () =>
    setSecret('aiUsage.githubCopilotToken', 'Token GitHub com a permissão Plan: Read')
  ));
  context.subscriptions.push(vscode.commands.registerCommand('aiUsage.clearGitHubCopilotToken', () =>
    clearSecret('aiUsage.githubCopilotToken', 'Token GitHub Copilot')
  ));
  context.subscriptions.push(vscode.commands.registerCommand('aiUsage.setCopilotMonthlyCredits', setCopilotMonthlyCredits));
  context.subscriptions.push(vscode.commands.registerCommand('aiUsage.configureClaudeCode', async () => {
    try {
      await sources.find((source) => source.id === 'claude-code').configure();
    } catch (error) {
      vscode.window.showErrorMessage(`Não foi possível configurar o Claude Code: ${error.message}`);
    }
  }));
  context.subscriptions.push(vscode.extensions.onDidChange(() => void refresh()));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('aiUsage.codexPath')) {
      sources.find((source) => source.id === 'codex')?.reset();
      void refresh();
    }
    if (event.affectsConfiguration('aiUsage.copilotMonthlyCredits')) void refresh();
    if (event.affectsConfiguration('aiUsage.refreshIntervalSeconds')) scheduleRefresh();
  }));

  scheduleRefresh();
  void refresh();
}

function deactivate() {
  clearInterval(timer);
  sources.forEach((source) => source.dispose());
}

module.exports = { activate, deactivate };
