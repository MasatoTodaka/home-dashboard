async function get(path) {
  const res = await fetch(`/api${path}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed: ${path}`);
  return json;
}

async function post(path, body) {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed: ${path}`);
  return json;
}

// 天気はバックエンド経由ではなくブラウザから直接取得する (理由は weather.js)
export { fetchWeather } from './weather';
export const fetchCalendarEvents = () => get('/calendar');
export const fetchGarbage = () => get('/garbage');
export const fetchDevices = () => get('/switchbot/devices');
export const sendDeviceCommand = (deviceId, command, parameter = 'default') =>
  post(`/switchbot/devices/${deviceId}/commands`, { command, parameter });
