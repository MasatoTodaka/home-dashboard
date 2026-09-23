import { Router } from 'express';
import { cached } from '../lib/cache.js';

const router = Router();

async function fetchLocationName(lat, lon) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', lat);
  url.searchParams.set('lon', lon);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('accept-language', 'ja');

  const resp = await fetch(url, { headers: { 'User-Agent': 'home-dashboard (personal use)' } });
  if (!resp.ok) throw new Error(`reverse geocoding error: ${resp.status}`);
  const json = await resp.json();
  const addr = json.address ?? {};
  return addr.city ?? addr.town ?? addr.village ?? addr.county ?? '自宅';
}

// 天気予報そのものはブラウザから Open-Meteo に直接取りに行く。
// Render無料プランは外向きIPを多数のサービスと共有しており、IP単位のレート制限(429)に巻き込まれるため。
// サーバーは自宅の座標と地名だけを返す
router.get('/config', async (req, res) => {
  const lat = process.env.WEATHER_LAT;
  const lon = process.env.WEATHER_LON;
  if (!lat || !lon) {
    return res.status(500).json({ error: 'WEATHER_LAT / WEATHER_LON is not set' });
  }

  // 地名は変わらないので長め(24時間)にキャッシュする。取れなくても天気表示は続けられるので null で返す
  const location = await cached('weather:location', 24 * 60 * 60 * 1000, () => fetchLocationName(lat, lon)).catch(
    () => null
  );

  res.json({ latitude: Number(lat), longitude: Number(lon), location });
});

export default router;
