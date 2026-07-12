import { Router } from 'express';
import { buildSwitchBotHeaders } from '../lib/switchbotAuth.js';
import { cached } from '../lib/cache.js';
import { saveWebhookReading, getWebhookReading } from '../lib/webhookCache.js';

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
      const { deviceList, infraredRemoteList } = await switchbotFetch('/devices');

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

      // 赤外線リモコン(ハブ経由で学習させた家電)は状態取得APIが存在しないため
      // status は常に null。deviceType は remoteType から補う
      const infraredDevices = (infraredRemoteList ?? []).map((device) => ({
        ...device,
        deviceType: device.remoteType,
        isInfrared: true,
        status: null,
      }));

      return [...withStatus, ...infraredDevices];
    });

    // Hub 2/3 はポーリングAPIだと温湿度が0固定で返ることがあるため、
    // Webhookで受け取った最新の実測値があればそちらで上書きする
    const merged = data.map((device) => {
      const reading = getWebhookReading(device.deviceId);
      if (!reading || !device.status) return device;
      const { updatedAt, ...fields } = reading;
      return { ...device, status: { ...device.status, ...fields } };
    });

    res.json(merged);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// SwitchBotからのWebhook通知 (setupWebhookで登録したURLに届く)
router.post('/webhook', (req, res) => {
  res.sendStatus(200); // まず即座に応答する (SwitchBot側の仕様)

  const context = req.body?.context;
  if (!context?.deviceMac) return;

  const reading = {};
  if (typeof context.temperature === 'number') reading.temperature = context.temperature;
  if (typeof context.humidity === 'number') reading.humidity = context.humidity;
  if (typeof context.lightLevel === 'number') reading.lightLevel = context.lightLevel;
  if (typeof context.power === 'string') reading.power = context.power;
  if (typeof context.battery === 'number') reading.battery = context.battery;

  if (Object.keys(reading).length > 0) {
    saveWebhookReading(context.deviceMac, reading);
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
