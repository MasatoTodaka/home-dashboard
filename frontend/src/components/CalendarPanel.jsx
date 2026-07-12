import { fetchCalendarEvents } from '../api';
import { usePolling } from '../usePolling';

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

export default function CalendarPanel() {
  const { data, error } = usePolling(fetchCalendarEvents, 5 * 60 * 1000);

  return (
    <div className="panel calendar-panel">
      <h2>予定</h2>
      {error && <p className="error">取得エラー: {error}</p>}
      {!data && !error && <p>読み込み中...</p>}
      {data && data.length === 0 && <p className="muted">今月の予定はありません</p>}
      {data && data.length > 0 && (
        <ul className="event-list">
          {data.map((event) => (
            <li key={event.id} className="event-item">
              <span className="event-date-bar">{formatEventTime(event)}</span>
              <span className="event-title-bar">{event.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
