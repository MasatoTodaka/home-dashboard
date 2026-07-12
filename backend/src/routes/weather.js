import { Router } from 'express';
import { cached } from '../lib/cache.js';

const router = Router();

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

router.get('/', async (req, res) => {
  try {
    const lat = process.env.WEATHER_LAT;
    const lon = process.env.WEATHER_LON;
    if (!lat || !lon) {
      return res.status(500).json({ error: 'WEATHER_LAT / WEATHER_LON is not set' });
    }

    const data = await cached('weather', 10 * 60 * 1000, async () => {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', lat);
      url.searchParams.set('longitude', lon);
      url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,weather_code');
      url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max');
      url.searchParams.set('timezone', 'Asia/Tokyo');
      url.searchParams.set('forecast_days', '3');

      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Open-Meteo error: ${resp.status}`);
      const json = await resp.json();

      return {
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
      };
    });

    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
