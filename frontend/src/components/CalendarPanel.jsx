import { fetchCalendarEvents, fetchGarbage } from '../api';
import { usePolling } from '../usePolling';
import { garbageStyle, upcomingGarbageDays } from '../garbage';

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

function formatDate(d) {
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS_JA[d.getDay()]})`;
}

function formatTime(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatEventTime(event) {
  const start = new Date(event.start);
  const rawEnd = event.end ? new Date(event.end) : start;
  // 終日予定のDTENDは翌日00:00を指す(排他的)ため、実際の最終日にするには1日引く
  const end = event.allDay ? new Date(rawEnd.getTime() - 24 * 60 * 60 * 1000) : rawEnd;
  const multiDay = !isSameDay(start, end);

  if (event.allDay) {
    return multiDay ? `${formatDate(start)}〜${formatDate(end)} 終日` : `${formatDate(start)} 終日`;
  }

  return multiDay
    ? `${formatDate(start)} ${formatTime(start)}〜${formatDate(end)} ${formatTime(end)}`
    : `${formatDate(start)} ${formatTime(start)}`;
}

function GarbageRow({ day, deadline }) {
  return (
    <li className="event-item garbage-item">
      <span className="event-date-bar">
        <span>{formatDate(day.start)}</span>
        {deadline && <span className="garbage-deadline">{deadline}まで</span>}
      </span>
      <span className="event-title-bar garbage-title">
        {day.items.map((name) => {
          const { label, className } = garbageStyle(name);
          return (
            <span key={name} className={`garbage-chip ${className}`}>
              {label}
            </span>
          );
        })}
      </span>
    </li>
  );
}

export default function CalendarPanel() {
  const { data, error } = usePolling(fetchCalendarEvents, 5 * 60 * 1000);
  // ごみ収集日の取得失敗は予定の表示を妨げないよう、エラー表示せず単に出さない
  const { data: garbage } = usePolling(fetchGarbage, 5 * 60 * 1000);

  // ごみの日は日付のみなので、その日の0時として予定と時系列で並べる (同時刻なら先頭)
  const rows = [
    ...upcomingGarbageDays(garbage).map((day) => ({ key: `garbage-${day.date}`, start: day.start, day })),
    ...(data ?? []).map((event) => ({ key: event.id, start: new Date(event.start), event })),
  ].sort((a, b) => a.start - b.start);

  return (
    <div className="panel calendar-panel">
      <h2>予定</h2>
      {error && <p className="error">取得エラー: {error}</p>}
      {!data && !error && <p>読み込み中...</p>}
      {data && rows.length === 0 && <p className="muted">今月の予定はありません</p>}
      {rows.length > 0 && (
        <ul className="event-list">
          {rows.map((row) =>
            row.day ? (
              <GarbageRow key={row.key} day={row.day} deadline={garbage.deadline} />
            ) : (
              <li key={row.key} className="event-item">
                <span className="event-date-bar">{formatEventTime(row.event)}</span>
                <span className="event-title-bar">{row.event.title}</span>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
