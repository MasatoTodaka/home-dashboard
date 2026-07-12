const store = new Map();

export async function cached(key, ttlMs, fetcher) {
  const hit = store.get(key);
  const now = Date.now();
  if (hit && hit.expiresAt > now) {
    return hit.value;
  }
  try {
    const value = await fetcher();
    store.set(key, { value, expiresAt: now + ttlMs });
    return value;
  } catch (err) {
    // 上流API障害時は、期限切れでも直近の成功値があればそれを返す
    // (常時表示ダッシュボードでは古いデータの方がエラー表示よりまし)
    if (hit) {
      return hit.value;
    }
    throw err;
  }
}
