async function resolveSource(sources, preference = 'auto') {
  const availability = await Promise.all(sources.map(async (source) => Boolean(await source.isAvailable())));
  const available = sources.filter((_, index) => availability[index]);
  if (preference !== 'auto') {
    return available.find((source) => source.id === preference) || null;
  }

  for (const source of available) {
    if (typeof source.isActiveChat === 'function') {
      try {
        if (await source.isActiveChat()) return source;
      } catch {
        // One unavailable detector must not hide the other sources.
      }
    }
  }
  return available.length === 1 ? available[0] : null;
}

module.exports = { resolveSource };
