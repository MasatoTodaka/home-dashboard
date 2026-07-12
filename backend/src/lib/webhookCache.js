const store = new Map();

function normalizeId(id) {
  return String(id ?? '').replace(/:/g, '').toUpperCase();
}

export function saveWebhookReading(deviceMac, reading) {
  store.set(normalizeId(deviceMac), { ...reading, updatedAt: Date.now() });
}

export function getWebhookReading(deviceId) {
  return store.get(normalizeId(deviceId));
}

// 直近のWebhook受信履歴 (診断用)。インメモリなので再起動で消える
const recentEvents = [];
const MAX_RECENT = 50;

export function recordWebhookEvent(event) {
  recentEvents.unshift({ receivedAt: new Date().toISOString(), ...event });
  if (recentEvents.length > MAX_RECENT) recentEvents.pop();
}

export function getRecentWebhookEvents() {
  return recentEvents;
}
