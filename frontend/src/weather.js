// 天気予報はブラウザから Open-Meteo に直接取りに行く (CORS対応済み、APIキー不要)。
// Render無料プランの共有IPだと他サービスと合算でレート制限(429)に掛かるため、自宅回線から取得する。
// 自宅の座標と地名だけはバックエンド (/api/weather/config) から受け取る

const WEATHER_CODE_JA = {
  0: '快晴', 1: '晴れ', 2: '一部曇り', 3: '曇り',
  45: '霧', 48: '霧氷',
  51: '弱い霧雨', 53: '霧雨', 55: '強い霧雨',
  61: '弱い雨', 63: '雨', 65: '強い雨',
  71: '弱い雪', 73: '雪', 75: '強い雪', 77: '雪粒',
  80: 'にわか雨(弱)', 81: 'にわか雨', 82: 'にわか雨(強)',
  85: 'にわか雪(弱)', 86: 'にわか雪(強)',
  95: '雷雨', 96: '雷雨(雹弱)', 99: '雷雨(雹強)',
};

let configPromise = null;

function getConfig() {
  if (!configPromise) {
    configPromise = fetch('/api/weather/config')
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Request failed: /weather/config');
        return json;
      })
      .catch((err) => {
        // 失敗を覚えたままにすると復旧後も取れないため、次回呼び出しで再試行させる
        configPromise = null;
        throw err;
      });
  }
  return configPromise;
}

export async function fetchWeather() {
  const { latitude, longitude, location } = await getConfig();

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', latitude);
  url.searchParams.set('longitude', longitude);
  url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,weather_code');
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max');
  // 朝モードの雨の時間帯・バイク判定用
  url.searchParams.set(
    'hourly',
    'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m'
  );
  url.searchParams.set('wind_speed_unit', 'ms');
  url.searchParams.set('timezone', 'Asia/Tokyo');
  url.searchParams.set('forecast_days', '3');

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Open-Meteo error: ${resp.status}`);
  const json = await resp.json();

  return {
    location,
    current: {
      temperature: json.current.temperature_2m,
      humidity: json.current.relative_humidity_2m,
      weatherCode: json.current.weather_code,
      weatherText: WEATHER_CODE_JA[json.current.weather_code] ?? '不明',
    },
    daily: json.daily.time.map((date, i) => ({
      date,
      weatherCode: json.daily.weather_code[i],
      weatherText: WEATHER_CODE_JA[json.daily.weather_code[i]] ?? '不明',
      tempMax: json.daily.temperature_2m_max[i],
      tempMin: json.daily.temperature_2m_min[i],
      precipitationProbability: json.daily.precipitation_probability_max[i],
    })),
    // 今日の分だけ返す (時刻は Asia/Tokyo の "YYYY-MM-DDTHH:00")
    hourly: json.hourly.time
      .map((time, i) => ({
        time,
        hour: Number(time.slice(11, 13)),
        temperature: json.hourly.temperature_2m[i],
        precipitationProbability: json.hourly.precipitation_probability[i],
        precipitation: json.hourly.precipitation[i],
        weatherCode: json.hourly.weather_code[i],
        windSpeed: json.hourly.wind_speed_10m[i],
        windGusts: json.hourly.wind_gusts_10m[i],
      }))
      .filter((h) => h.time.startsWith(json.daily.time[0])),
  };
}
