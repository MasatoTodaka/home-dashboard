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

  // create_timeが実際に測定した時刻。update_timeは体重計内部に溜まったデータが
  // まとめてクラウドへ同期された時刻でしかなく、アプリを久しぶりに開くと
  // 何日分もの過去データが同じupdate_timeになって届く(=測定時刻として使うと誤った重複に見える)
  const measuredAtSec = record.create_time ?? record.update_time ?? null;
  return {
    customerId,
    measuredAtSec,
    measuredAt: measuredAtSec ? new Date(measuredAtSec * 1000).toISOString() : null,
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

// ごく稀に、体重計がBIA(体組成)測定を安定させる過程で同一の計測を
// 数十秒差で2件別レコードとしてアップロードすることがある。同じcustomerの
// 記録が実測定時刻(create_time)ベースでこの秒数以内に連続する場合は、
// 後続を同一計測の重複とみなして間引く
const DEDUP_WINDOW_SEC = 120;

function dedupeMeasurements(measurements) {
  const lastKeptByCustomer = new Map();
  const result = [];

  for (const m of measurements) {
    const last = lastKeptByCustomer.get(m.customerId);
    if (last && m.measuredAtSec != null && last.measuredAtSec != null && m.measuredAtSec - last.measuredAtSec < DEDUP_WINDOW_SEC) {
      continue;
    }
    result.push(m);
    lastKeptByCustomer.set(m.customerId, m);
  }

  return result;
}

// 体重計の測定履歴を古い順に全件返す(Google Sheetsへの追記など、全件を扱いたい用途向け)
export async function getAllMeasurements() {
  return cached('eufy:measurements', 5 * 60 * 1000, async () => {
    const records = await fetchDeviceData();
    const measurements = records
      .map(normalizeRecord)
      .filter(Boolean)
      .sort((a, b) => (a.measuredAtSec ?? 0) - (b.measuredAtSec ?? 0));
    return dedupeMeasurements(measurements);
  });
}

// 体重計を使った人(customer)ごとに最新の測定値を1件ずつ返す
export async function getLatestWeights() {
  const measurements = await getAllMeasurements();
  const byCustomer = new Map();

  for (const m of measurements) {
    const existing = byCustomer.get(m.customerId);
    if (!existing || (existing.measuredAtSec ?? 0) < (m.measuredAtSec ?? 0)) {
      byCustomer.set(m.customerId, m);
    }
  }

  return [...byCustomer.values()].sort((a, b) => (b.measuredAtSec ?? 0) - (a.measuredAtSec ?? 0));
}
