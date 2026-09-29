const { spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');
const readline = require('node:readline');

class AppServerClient extends EventEmitter {
  constructor(executable = 'codex', options = {}) {
    super();
    this.executable = executable;
    this.spawnProcess = options.spawnProcess || spawn;
    this.timeoutMs = options.timeoutMs || 10000;
    this.nextId = 1;
    this.pending = new Map();
    this.process = null;
    this.reader = null;
    this.startPromise = null;
    this.disposed = false;
  }

  async connect() {
    if (this.disposed) throw new Error('Client is disposed');
    if (!this.startPromise) {
      this.startPromise = this.start().catch((error) => {
        this.dispose();
        throw error;
      });
    }
    return this.startPromise;
  }

  async start() {
    const child = this.spawnProcess(this.executable, ['app-server'], {
      stdio: ['pipe', 'pipe', 'ignore'],
      windowsHide: true
    });
    this.process = child;
    this.reader = readline.createInterface({ input: child.stdout });
    this.reader.on('line', (line) => this.handleLine(line));
    child.on('error', (error) => this.handleDisconnect(error));
    child.on('exit', (code) => this.handleDisconnect(new Error(`Codex app-server exited (${code})`)));

    await this.request('initialize', {
      clientInfo: {
        name: 'codex_usage_status',
        title: 'Codex Usage Status',
        version: '0.1.0'
      }
    });
    this.send({ method: 'initialized', params: {} });
  }

  send(message) {
    if (!this.process || !this.process.stdin.writable) {
      throw new Error('Codex app-server is unavailable');
    }
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  request(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      try {
        this.send({ id, method, ...(params === undefined ? {} : { params }) });
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message.id !== undefined && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      clearTimeout(pending.timeout);
      if (message.error) {
        pending.reject(new Error(message.error.message || 'Codex request failed'));
      } else {
        pending.resolve(message.result);
      }
    } else if (message.method === 'account/rateLimits/updated' || message.method === 'account/updated') {
      this.emit('updated');
    }
  }

  handleDisconnect(error) {
    if (!this.process) return;
    this.process = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
    this.emit('disconnected', error);
  }

  async readRateLimits() {
    await this.connect();
    return this.request('account/rateLimits/read');
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const child = this.process;
    this.handleDisconnect(new Error('Client closed'));
    this.reader?.close();
    child?.kill();
    this.removeAllListeners();
  }
}

module.exports = { AppServerClient };
