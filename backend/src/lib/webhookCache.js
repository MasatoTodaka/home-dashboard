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
