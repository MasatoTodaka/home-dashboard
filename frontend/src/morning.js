// 朝モードの設定。start/end 以外の時間は「時」(0〜23)
export const MORNING_SETTINGS = {
  // 朝モードを表示する時間帯 ("H:MM" 形式。start 〜 end の手前まで)
  start: '6:00',
  end: '7:30',
  // バイク判定の対象にする時間帯 (出かけてから帰るまで)
  outingStartHour: 7,
  outingEndHour: 21,
  // 雨の時間帯グラフに並べる範囲
  chartStartHour: 6,
  chartEndHour: 23,
};

// 1時間ごとの予報で「雨の時間」とみなす基準
const RAIN_PROBABILITY = 50; // %
const RAIN_PRECIPITATION = 0.3; // mm/h

// バイク判定のしきい値
const BIKE = {
  ngProbability: 70, // %
  ngPrecipitation: 1, // mm/h
  cautionProbability: 40,
  cautionPrecipitation: 0.1,
  ngGust: 15, // m/s
  cautionGust: 10,
  ngMinTemp: 0, // °C 以下で路面凍結のおそれ
  cautionMinTemp: 5,
  cautionMaxTemp: 35,
};

const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const THUNDER_CODES = new Set([95, 96, 99]);

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function isMorningTime(now) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= toMinutes(MORNING_SETTINGS.start) && minutes < toMinutes(MORNING_SETTINGS.end);
}

export function isRainHour(h) {
  return h.precipitationProbability >= RAIN_PROBABILITY || h.precipitation >= RAIN_PRECIPITATION;
}

// 連続する雨の時間をまとめて [{ from: 15, to: 18, maxProbability: 84 }] (to は終了時刻=最後の時間+1)
export function rainSpans(hourly, fromHour, toHour) {
  const spans = [];
  for (const h of hourly) {
    if (h.hour < fromHour || h.hour > toHour || !isRainHour(h)) continue;
    const last = spans.at(-1);
    if (last && last.to === h.hour) {
      last.to = h.hour + 1;
      last.maxProbability = Math.max(last.maxProbability, h.precipitationProbability);
    } else {
      spans.push({ from: h.hour, to: h.hour + 1, maxProbability: h.precipitationProbability });
    }
  }
  return spans;
}

export function formatRainSpans(spans) {
  return spans.map((s) => `${s.from}時〜${s.to}時 (最大${s.maxProbability}%)`).join('、');
}

const LEVEL_ORDER = { ok: 0, caution: 1, ng: 2 };

// 今日のこれから (出かける〜帰る時間帯) の予報からバイクで行けるかを判定する
export function judgeBike(hourly, now) {
  const { outingStartHour, outingEndHour } = MORNING_SETTINGS;
  const fromHour = Math.max(outingStartHour, now.getHours());
  let hours = hourly.filter((h) => h.hour >= fromHour && h.hour <= outingEndHour);
  // 帰宅時間を過ぎていたら判定対象がなくなるので、時間帯全体で判定する
  if (hours.length === 0) hours = hourly.filter((h) => h.hour >= outingStartHour && h.hour <= outingEndHour);
  if (hours.length === 0) return null;

  const maxProbability = Math.max(...hours.map((h) => h.precipitationProbability));
  const maxPrecipitation = Math.max(...hours.map((h) => h.precipitation));
  const maxGust = Math.max(...hours.map((h) => h.windGusts));
  const minTemp = Math.min(...hours.map((h) => h.temperature));
  const maxTemp = Math.max(...hours.map((h) => h.temperature));

  const reasons = [];
  const add = (level, text) => reasons.push({ level, text });

  const spans = rainSpans(hours, 0, 23);
  if (hours.some((h) => SNOW_CODES.has(h.weatherCode))) add('ng', '雪の予報');
  if (hours.some((h) => THUNDER_CODES.has(h.weatherCode))) add('ng', '雷雨の予報');
  if (maxProbability >= BIKE.ngProbability || maxPrecipitation >= BIKE.ngPrecipitation) {
    add('ng', spans.length ? `雨 ${formatRainSpans(spans)}` : `雨の可能性 最大${maxProbability}%`);
  } else if (maxProbability >= BIKE.cautionProbability || maxPrecipitation >= BIKE.cautionPrecipitation) {
    add('caution', `にわか雨の可能性 最大${maxProbability}%`);
  }
  if (maxGust >= BIKE.ngGust) add('ng', `突風 最大${Math.round(maxGust)}m/s`);
  else if (maxGust >= BIKE.cautionGust) add('caution', `風が強め 最大${Math.round(maxGust)}m/s`);
  if (minTemp <= BIKE.ngMinTemp) add('ng', `路面凍結のおそれ (最低${Math.round(minTemp)}°C)`);
  else if (minTemp <= BIKE.cautionMinTemp) add('caution', `冷え込む (最低${Math.round(minTemp)}°C) 防寒を`);
  if (maxTemp >= BIKE.cautionMaxTemp) add('caution', `猛暑 (最高${Math.round(maxTemp)}°C) 熱中症に注意`);

  const level = reasons.reduce((worst, r) => (LEVEL_ORDER[r.level] > LEVEL_ORDER[worst] ? r.level : worst), 'ok');
  if (reasons.length === 0) {
    add('ok', `雨・風の心配なし (${Math.round(minTemp)}〜${Math.round(maxTemp)}°C)`);
  }

  return { level, reasons, fromHour: hours[0].hour, toHour: outingEndHour };
}
