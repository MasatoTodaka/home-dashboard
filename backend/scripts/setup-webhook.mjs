import 'dotenv/config';
import { buildSwitchBotHeaders } from '../src/lib/switchbotAuth.js';

const BASE_URL = 'https://api.switch-bot.com/v1.1';
const webhookUrl = process.argv[2];

if (!webhookUrl) {
  console.error('使い方: node scripts/setup-webhook.mjs https://<your-app>.onrender.com/api/switchbot/webhook');
  process.exit(1);
}

async function call(path, body) {
  const resp = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: buildSwitchBotHeaders(),
    body: JSON.stringify(body),
  });
  const json = await resp.json();
  return json;
}

const existing = await call('/webhook/queryWebhook', { action: 'queryUrl' });
console.log('現在登録済みのWebhook:', existing);

const registeredUrls = existing.body?.urls ?? [];

if (registeredUrls.includes(webhookUrl)) {
  console.log('既にこのURLは登録済みです。有効化のみ行います。');
  const result = await call('/webhook/updateWebhook', {
    action: 'updateWebhook',
    config: { url: webhookUrl, enable: true },
  });
  console.log(result);
} else if (registeredUrls.length > 0) {
  console.log('別のURLが登録されているため削除してから登録し直します。');
  for (const url of registeredUrls) {
    console.log(await call('/webhook/deleteWebhook', { action: 'deleteWebhook', url }));
  }
  const result = await call('/webhook/setupWebhook', {
    action: 'setupWebhook',
    url: webhookUrl,
    deviceList: 'ALL',
  });
  console.log(result);
} else {
  const result = await call('/webhook/setupWebhook', {
    action: 'setupWebhook',
    url: webhookUrl,
    deviceList: 'ALL',
  });
  console.log(result);
}
