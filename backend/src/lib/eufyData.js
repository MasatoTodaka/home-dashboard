import { getEufySession, invalidateEufySession } from './eufyAuth.js';
import { cached } from './cache.js';

const API_BASE_URL = 'https://api.eufylife.com';

async function fetchDeviceData({ retry = true } = {}) {
  const session = await getEufySession();
  const resp = await fetch(`${API_BASE_URL}/v1/device/data`, {
    headers: {
      Accept: '*/*',
      Uid: session.userId,
      Token: session.accessToken,
      'User-Agent': 'Eufylife-iOS-3.3.7-281',
    },
  });

  // トークン失効時は1回だけ再ログインしてリトライする
  if (resp.status === 401 && retry) {
    invalidateEufySession();
    return fetchDeviceData({ retry: false });
  }

  const json = await resp.json();
  if (!resp.ok || (json?.res_code !== undefined && json.res_code !== 1)) {
    throw new Error(json?.message ?? `Eufy API error (${resp.status})`);
  }
  return Array.isArray(json) ? json : (json.data ?? []);
}

function normalizeRecord(record) {
  const customerId = record.customer_id;
  const scale = record.scale_data;
  if (!customerId || !scale) return null;

  const updatedAtSec = record.update_time ?? record.create_time ?? null;
  return {
    customerId,
    updatedAtSec,
    updatedAt: updatedAtSec ? new Date(updatedAtSec * 1000).toISOString() : null,
    // weightはデシグラム(1/10g)単位で返るためkgに変換
    weight: typeof scale.weight === 'number' ? Math.round((scale.weight / 10) * 100) / 100 : null,
    bodyFat: scale.body_fat ?? null,
    muscleMass: scale.muscle_mass ?? null,
    bmi: scale.bmi ?? null,
    waterPercentage: scale.water ?? null,
    boneMass: scale.bone_mass ?? null,
    bmr: scale.bmr ?? null,
    bodyAge: scale.body_age ?? null,
    visceralFat: scale.visceral_fat ?? null,
  };
}

// 体重計の測定履歴を古い順に全件返す(Google Sheetsへの追記など、全件を扱いたい用途向け)
export async function getAllMeasurements() {
  return cached('eufy:measurements', 5 * 60 * 1000, async () => {
    const records = await fetchDeviceData();
    return records
      .map(normalizeRecord)
      .filter(Boolean)
      .sort((a, b) => (a.updatedAtSec ?? 0) - (b.updatedAtSec ?? 0));
  });
}

// 体重計を使った人(customer)ごとに最新の測定値を1件ずつ返す
export async function getLatestWeights() {
  const measurements = await getAllMeasurements();
  const byCustomer = new Map();

  for (const m of measurements) {
    const existing = byCustomer.get(m.customerId);
    if (!existing || (existing.updatedAtSec ?? 0) < (m.updatedAtSec ?? 0)) {
      byCustomer.set(m.customerId, m);
    }
  }

  return [...byCustomer.values()].sort((a, b) => (b.updatedAtSec ?? 0) - (a.updatedAtSec ?? 0));
}
