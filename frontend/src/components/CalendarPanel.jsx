import { fetchCalendarEvents } from '../api';
import { usePolling } from '../usePolling';

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

function formatEventTime(event) {
  const start = new Date(event.start);
  if (event.allDay) {
    return `${start.getMonth() + 1}/${start.getDate()}(${WEEKDAYS_JA[start.getDay()]}) 終日`;
  }
  const hh = String(start.getHours()).padStart(2, '0');
  const mm = String(start.getMinutes()).padStart(2, '0');
  return `${start.getMonth() + 1}/${start.getDate()}(${WEEKDAYS_JA[start.getDay()]}) ${hh}:${mm}`;
}

export default function CalendarPanel() {
  const { data, error } = usePolling(fetchCalendarEvents, 5 * 60 * 1000);

  return (
    <div className="panel calendar-panel">
      <h2>予定</h2>
      {error && <p className="error">取得エラー: {error}</p>}
      {!data && !error && <p>読み込み中...</p>}
      {data && data.length === 0 && <p className="muted">今後7日間の予定はありません</p>}
      {data && data.length > 0 && (
        <ul className="event-list">
          {data.slice(0, 8).map((event) => (
            <li key={event.id} className="event-item">
              <span className="event-time">{formatEventTime(event)}</span>
              <span className="event-title">{event.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
