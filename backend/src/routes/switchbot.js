import { Router } from 'express';
import { buildSwitchBotHeaders } from '../lib/switchbotAuth.js';
import { cached } from '../lib/cache.js';

const router = Router();
const BASE_URL = 'https://api.switch-bot.com/v1.1';

async function switchbotFetch(path, options = {}) {
  const resp = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...buildSwitchBotHeaders(), ...(options.headers ?? {}) },
  });
  const json = await resp.json();
  if (!resp.ok || json.statusCode !== 100) {
    throw new Error(json.message ?? `SwitchBot API error (${resp.status})`);
  }
  return json.body;
}

// デバイス一覧 + それぞれの状態をまとめて返す
router.get('/devices', async (req, res) => {
  try {
    const data = await cached('switchbot:devices', 60 * 1000, async () => {
      const { deviceList } = await switchbotFetch('/devices');

      const withStatus = await Promise.all(
        deviceList.map(async (device) => {
          try {
            const status = await switchbotFetch(`/devices/${device.deviceId}/status`);
            return { ...device, status };
          } catch {
            // Hub や一部の赤外線デバイスなど status を取得できない機種は device 情報のみ返す
            return { ...device, status: null };
          }
        })
      );

      return withStatus;
    });

    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// デバイスへのコマンド送信 (例: { "command": "turnOn" })
router.post('/devices/:deviceId/commands', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { command, parameter = 'default', commandType = 'command' } = req.body;
    if (!command) {
      return res.status(400).json({ error: 'command is required' });
    }

    const result = await switchbotFetch(`/devices/${deviceId}/commands`, {
      method: 'POST',
      body: JSON.stringify({ command, parameter, commandType }),
    });

    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
