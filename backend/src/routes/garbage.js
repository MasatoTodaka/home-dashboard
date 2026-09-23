import { Router } from 'express';
import { cached } from '../lib/cache.js';

const router = Router();

// 一宮市公式サイトの「ごみ（収集業務課）」ページ。ここから年度ごとのカレンダー一覧 → 連区ページを辿る
const INDEX_URL = 'https://www.city.ichinomiya.aichi.jp/kankyou/shuushuugyoumu/1043991/1043992/index.html';

// 市のサイトはデフォルトのUser-Agentだと弾かれることがあるため、ブラウザ相当を名乗る
async function fetchHtml(url) {
  const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (home-dashboard personal use)' } });
  if (!resp.ok) throw new Error(`一宮市サイト error: ${resp.status} ${url}`);
  return resp.text();
}

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function findLinks(html, baseUrl) {
  return [...html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, href, text]) => ({
    url: new URL(href, baseUrl).toString(),
    text: stripTags(text),
  }));
}

// 年度ごとのカレンダーページ (例: 「ごみ出しカレンダー・…（2026年4月～2027年3月）」) を探し、
// その中から指定した連区のページURLを返す。年度更新時にURLが変わっても追従できるようにするため
async function findRenkuPages(renku) {
  const indexHtml = await fetchHtml(INDEX_URL);
  const yearPages = findLinks(indexHtml, INDEX_URL).filter((l) => /ごみ出しカレンダー.*\d{4}年4月/.test(l.text));
  if (yearPages.length === 0) throw new Error('年度別ごみ出しカレンダーのページが見つかりません');

  const renkuPages = [];
  for (const yearPage of yearPages) {
    const html = await fetchHtml(yearPage.url);
    // リンク文字列は「[大和町連区]　ごみ・資源の地区別収集日」の形式
    const link = findLinks(html, yearPage.url).find((l) => l.text.includes(`[${renku}]`));
    if (link) renkuPages.push(link.url);
  }
  if (renkuPages.length === 0) throw new Error(`「${renku}」のページが見つかりません`);
  return renkuPages;
}

// 連区ページは <h2>2026年9月</h2> の後に <li>可燃ごみ(毎週火・金曜日)<br>1日、4日、…</li> が並ぶ構造。
// 祝日・年末年始の振替が反映済みの実日付なので、曜日ルールから計算せずそのまま使う
function parseRenkuPage(html, area) {
  const collections = [];
  const deadline = html.match(/朝(\d{1,2})時(\d{1,2})分まで/);

  for (const section of html.split(/<h2[^>]*>/).slice(1)) {
    const month = section.match(/^\s*(\d{4})年(\d{1,2})月\s*<\/h2>/);
    if (!month) continue;
    const [, year, mon] = month;

    for (const [, li] of section.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
      const [label, days] = li.split(/<br\s*\/?>/i).map(stripTags);
      if (!label || !days) continue;

      // 「町内回収資源 尾西線北側」のように地域で分かれる品目は、自宅の地域のものだけ残す
      let name = label.replace(/[(（].*?[)）]/g, '').trim();
      if (name.startsWith('町内回収資源')) {
        const itemArea = name.replace('町内回収資源', '').trim();
        if (area && itemArea && itemArea !== area) continue;
        name = '町内回収資源';
      }

      for (const [, day] of days.matchAll(/(\d{1,2})日/g)) {
        const date = `${year}-${mon.padStart(2, '0')}-${day.padStart(2, '0')}`;
        collections.push({ date, name });
      }
    }
  }

  return {
    deadline: deadline ? `${deadline[1]}:${deadline[2]}` : null,
    collections,
  };
}

function todayInTokyo() {
  // en-CA ロケールは YYYY-MM-DD 形式で出力される
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
}

router.get('/', async (req, res) => {
  try {
    const renku = process.env.ICHINOMIYA_GOMI_RENKU;
    const area = process.env.ICHINOMIYA_GOMI_AREA || null;
    if (!renku) {
      return res.status(500).json({ error: 'ICHINOMIYA_GOMI_RENKU is not set' });
    }

    // 収集日は年度単位でしか変わらないので半日キャッシュで十分
    const data = await cached('garbage', 12 * 60 * 60 * 1000, async () => {
      const pages = await findRenkuPages(renku);
      const parsed = await Promise.all(pages.map(async (url) => parseRenkuPage(await fetchHtml(url), area)));
      const collections = parsed.flatMap((p) => p.collections);
      if (collections.length === 0) throw new Error('収集日を1件も読み取れませんでした (ページ構成が変わった可能性)');
      return {
        sourceUrls: pages,
        deadline: parsed.find((p) => p.deadline)?.deadline ?? null,
        collections,
      };
    });

    // 同じ日の品目を1件にまとめ、今日以降の直近31回分だけ返す
    const today = todayInTokyo();
    const byDate = new Map();
    for (const { date, name } of data.collections) {
      if (date < today) continue;
      if (!byDate.has(date)) byDate.set(date, new Set());
      byDate.get(date).add(name);
    }
    const days = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 31)
      .map(([date, names]) => ({ date, items: [...names] }));

    res.json({ renku, area, deadline: data.deadline, sourceUrls: data.sourceUrls, days });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
