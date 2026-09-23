// ごみの種類ごとの表示名と色。市の表記は長いものがあるので短くする
const GARBAGE_STYLES = {
  可燃ごみ: { label: '可燃ごみ', className: 'burnable' },
  プラスチック製容器包装: { label: 'プラ容器', className: 'plastic' },
  不燃ごみ: { label: '不燃ごみ', className: 'nonburnable' },
  '空き缶・金属類': { label: '缶・金属', className: 'metal' },
  ペットボトル: { label: 'ペットボトル', className: 'pet' },
  町内回収資源: { label: '町内回収資源', className: 'resource' },
};

export function garbageStyle(name) {
  return GARBAGE_STYLES[name] ?? { label: name, className: 'other' };
}

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// 予定リストに混ぜるのは「今日(出す締切まで)」と「明日」の収集日だけ。
// 予定パネルは表示行数が限られるので、先の分まで入れると本来の予定が押し出されてしまう
export function upcomingGarbageDays(data, now = new Date()) {
  if (!data?.days) return [];

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  let todayDeadline = null;
  if (data.deadline) {
    const [h, m] = data.deadline.split(':').map(Number);
    todayDeadline = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m);
  }

  return data.days
    .map((day) => ({ ...day, start: parseLocalDate(day.date) }))
    .filter(({ start }) => {
      if (start.getTime() === today.getTime()) return !todayDeadline || now < todayDeadline;
      return start.getTime() === tomorrow.getTime();
    });
}
