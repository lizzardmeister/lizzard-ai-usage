function usedPercent(window) {
  if (!window || !Number.isFinite(window.usedPercent)) return null;
  return Math.max(0, Math.min(100, window.usedPercent));
}

function formatPercent(value) {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}

function durationLabel(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'limite';
  if (minutes % 10080 === 0) return `${minutes / 10080}sem`;
  if (minutes % 1440 === 0) return `${minutes / 1440}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}min`;
}

function remainingDurationLabel(window, now) {
  if (!Number.isFinite(window?.resetsAt)) return durationLabel(window?.windowDurationMins);

  const remainingMinutes = Math.max(0, Math.floor((window.resetsAt * 1000 - now) / 60000));
  if (remainingMinutes === 0) return 'agora';

  const days = Math.floor(remainingMinutes / 1440);
  const hours = Math.floor((remainingMinutes % 1440) / 60);
  const minutes = remainingMinutes % 60;
  if (days) return hours ? `${days}d${hours}h` : `${days}d`;
  if (hours) return minutes ? `${hours}h${minutes}min` : `${hours}h`;
  return `${minutes}min`;
}

function windowsFor(result) {
  const bucket = result?.rateLimitsByLimitId?.codex || result?.rateLimits;
  if (!bucket) return [];
  return [bucket.primary, bucket.secondary].filter((window) => usedPercent(window) !== null);
}

function formatUsage(result, locale = 'pt-BR', now = Date.now()) {
  const windows = windowsFor(result);
  if (!windows.length) {
    return { text: 'Codex: sem dados', tooltip: 'O Codex não retornou limites de uso. Use “AI Usage: Refresh” para atualizar.' };
  }

  const parts = windows.map((window) => `${formatPercent(usedPercent(window))}/100% (${remainingDurationLabel(window, now)})`);
  const details = windows.map((window) => {
    const reset = Number.isFinite(window.resetsAt)
      ? new Date(window.resetsAt * 1000).toLocaleString(locale)
      : 'desconhecido';
    return `${durationLabel(window.windowDurationMins)}: ${formatPercent(usedPercent(window))}/100% usado; restam ${remainingDurationLabel(window, now)}; renova em ${reset}`;
  });

  return {
    text: `Codex: ${parts.join(' · ')}`,
    tooltip: `Limites de uso do Codex\n${details.join('\n')}`
  };
}

module.exports = { formatUsage, usedPercent, durationLabel, remainingDurationLabel };
