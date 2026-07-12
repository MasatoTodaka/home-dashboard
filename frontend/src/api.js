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

export const fetchWeather = () => get('/weather');
export const fetchCalendarEvents = () => get('/calendar');
export const fetchDevices = () => get('/switchbot/devices');
export const sendDeviceCommand = (deviceId, command, parameter = 'default') =>
  post(`/switchbot/devices/${deviceId}/commands`, { command, parameter });
