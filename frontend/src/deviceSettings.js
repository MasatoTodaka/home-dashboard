const STORAGE_KEY = 'home-dashboard:device-settings';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { hiddenDeviceIds: [], order: [], customButtons: {} };
    const parsed = JSON.parse(raw);
    return {
      hiddenDeviceIds: parsed.hiddenDeviceIds ?? [],
      order: parsed.order ?? [],
      customButtons: parsed.customButtons ?? {},
    };
  } catch {
    return { hiddenDeviceIds: [], order: [], customButtons: {} };
  }
}

function save(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function loadDeviceSettings() {
  return load();
}

export function saveOrder(orderedIds) {
  const settings = load();
  const next = { ...settings, order: orderedIds };
  save(next);
  return next;
}

export function toggleHidden(deviceId) {
  const settings = load();
  const hidden = new Set(settings.hiddenDeviceIds);
  if (hidden.has(deviceId)) hidden.delete(deviceId);
  else hidden.add(deviceId);
  const next = { ...settings, hiddenDeviceIds: [...hidden] };
  save(next);
  return next;
}

export function addCustomButton(deviceId, button) {
  const settings = load();
  const list = settings.customButtons[deviceId] ?? [];
  const next = {
    ...settings,
    customButtons: {
      ...settings.customButtons,
      [deviceId]: [...list, { id: crypto.randomUUID(), ...button }],
    },
  };
  save(next);
  return next;
}

export function removeCustomButton(deviceId, buttonId) {
  const settings = load();
  const list = (settings.customButtons[deviceId] ?? []).filter((b) => b.id !== buttonId);
  const next = {
    ...settings,
    customButtons: { ...settings.customButtons, [deviceId]: list },
  };
  save(next);
  return next;
}

// devices を settings.order の順に並べ替える。order未登録のデバイスは末尾にAPI順で残す
export function applyOrder(devices, order) {
  if (order.length === 0) return devices;
  const byId = new Map(devices.map((d) => [d.deviceId, d]));
  const ordered = order.map((id) => byId.get(id)).filter(Boolean);
  const remaining = devices.filter((d) => !order.includes(d.deviceId));
  return [...ordered, ...remaining];
}
