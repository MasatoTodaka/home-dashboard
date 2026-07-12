import { Router } from 'express';
import { DAVClient } from 'tsdav';
import ical from 'node-ical';
import { cached } from '../lib/cache.js';

const router = Router();

let clientPromise = null;

function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const client = new DAVClient({
        serverUrl: 'https://caldav.icloud.com',
        credentials: {
          username: process.env.ICLOUD_APPLE_ID,
          password: process.env.ICLOUD_APP_PASSWORD,
        },
        authMethod: 'Basic',
        defaultAccountType: 'caldav',
      });
      await client.login();
      return client;
    })().catch((err) => {
      // ログイン失敗をキャッシュし続けると復旧後もずっと失敗するため、次回呼び出しで再試行させる
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

router.get('/', async (req, res) => {
  try {
    if (!process.env.ICLOUD_APPLE_ID || !process.env.ICLOUD_APP_PASSWORD) {
      return res.status(500).json({ error: 'ICLOUD_APPLE_ID / ICLOUD_APP_PASSWORD is not set' });
    }

    const events = await cached('calendar:events', 5 * 60 * 1000, async () => {
      const client = await getClient();
      const calendars = await client.fetchCalendars();

      const allowedNames = (process.env.ICLOUD_CALENDAR_NAMES ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const targetCalendars = allowedNames.length
        ? calendars.filter((c) => allowedNames.includes(c.displayName))
        : calendars;

      const now = new Date();
      // 当月末までを取得範囲とする
      const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const objectsByCalendar = await Promise.all(
        targetCalendars.map((calendar) =>
          client.fetchCalendarObjects({
            calendar,
            timeRange: {
              start: now.toISOString(),
              end: rangeEnd.toISOString(),
            },
          })
        )
      );

      const flatEvents = [];
      for (const objects of objectsByCalendar) {
        for (const obj of objects) {
          if (!obj.data) continue;
          const parsed = ical.sync.parseICS(obj.data);
          for (const item of Object.values(parsed)) {
            if (item.type !== 'VEVENT') continue;
            flatEvents.push({
              id: item.uid,
              title: item.summary ?? '(タイトルなし)',
              start: item.start,
              end: item.end,
              allDay: item.datetype === 'date',
              location: item.location ?? null,
            });
          }
        }
      }

      flatEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
      return flatEvents.filter((e) => new Date(e.end ?? e.start) >= now);
    });

    res.json(events);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
