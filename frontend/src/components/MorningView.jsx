import { fetchCalendarEvents, fetchGarbage, fetchWeather } from '../api';
import { usePolling } from '../usePolling';
import { garbageStyle, upcomingGarbageDays } from '../garbage';
import { MORNING_SETTINGS, formatRainSpans, isRainHour, judgeBike, rainSpans } from '../morning';
import Clock from './Clock';

const BIKE_LABELS = {
  ok: { icon: '◎', text: 'バイクで行ける' },
  caution: { icon: '△', text: 'バイクは注意' },
  ng: { icon: '×', text: 'バイクはやめておこう' },
};

function BikeCard({ weather, now }) {
  const judgement = weather?.hourly ? judgeBike(weather.hourly, now) : null;

  return (
    <div className="panel morning-bike">
      <h2>バイク</h2>
      {!judgement && <p className="muted">読み込み中...</p>}
      {judgement && (
        <>
          <div className={`bike-verdict ${judgement.level}`}>
            <span className="bike-verdict-icon">{BIKE_LABELS[judgement.level].icon}</span>
            <span>{BIKE_LABELS[judgement.level].text}</span>
          </div>
          <ul className="bike-reasons">
            {judgement.reasons.map((r) => (
              <li key={r.text} className={r.level}>
                {r.text}
              </li>
            ))}
          </ul>
          <p className="muted bike-range">
            {judgement.fromHour}時〜{judgement.toHour}時の予報で判定
          </p>
        </>
      )}
    </div>
  );
}

function RainChart({ weather, now }) {
  const { chartStartHour, chartEndHour } = MORNING_SETTINGS;
  const hours = (weather?.hourly ?? []).filter((h) => h.hour >= chartStartHour && h.hour <= chartEndHour);
  const currentHour = now.getHours();
  const upcoming = hours.filter((h) => h.hour >= currentHour);
  const spans = rainSpans(upcoming, chartStartHour, chartEndHour);
  // 数値ラベルは「これからの時間で最も降水確率が高い1本」にだけ付ける
  const peak = upcoming.reduce(
    (best, h) => (h.precipitationProbability > (best?.precipitationProbability ?? 0) ? h : best),
    null
  );

  return (
    <div className="panel morning-rain">
      <div className="morning-rain-header">
        <h2>今日の雨</h2>
        <span className="morning-rain-summary">
          {weather ? (spans.length ? `${formatRainSpans(spans)} に雨の可能性` : '雨の心配はなさそう') : ''}
        </span>
      </div>
      {hours.length > 0 && (
        <div className="rain-chart" role="img" aria-label="1時間ごとの降水確率">
          {hours.map((h) => (
            <div key={h.time} className={`rain-col${h.hour < currentHour ? ' past' : ''}`}>
              <div className="rain-bar-area">
                {h === peak && (
                  <span className="rain-peak-label" style={{ bottom: `calc(${h.precipitationProbability}% + 4px)` }}>
                    {h.precipitationProbability}%
                  </span>
                )}
                <div
                  className={`rain-bar${isRainHour(h) ? ' rainy' : ''}`}
                  style={{ height: `${h.precipitationProbability}%` }}
                />
              </div>
              <span className={`rain-hour${h.hour === currentHour ? ' now' : ''}`}>
                {h.hour === currentHour ? '今' : h.hour}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GarbageCard({ now }) {
  const { data, error } = usePolling(fetchGarbage, 5 * 60 * 1000);
  const next = upcomingGarbageDays(data, now)[0];
  const isToday = next && next.start.getDate() === now.getDate();

  return (
    <div className="panel morning-garbage">
      <h2>ごみ出し</h2>
      {error && <p className="muted">収集日を取得できませんでした</p>}
      {data && !next && <p className="morning-big-text muted">今日・明日はなし</p>}
      {next && (
        <>
          <div className="morning-garbage-when">
            {isToday ? '今日' : '明日'}
            {data.deadline && <span className="muted"> {data.deadline}まで</span>}
          </div>
          <div className="morning-garbage-items">
            {next.items.map((name) => {
              const { label, className } = garbageStyle(name);
              return (
                <span key={name} className={`garbage-chip ${className}`}>
                  {label}
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function formatTime(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function TodayEvents({ now }) {
  const { data, error } = usePolling(fetchCalendarEvents, 5 * 60 * 1000);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const events = (data ?? []).filter((e) => new Date(e.start) < endOfToday);

  return (
    <div className="panel morning-events">
      <h2>今日の予定</h2>
      {error && <p className="error">取得エラー: {error}</p>}
      {data && events.length === 0 && <p className="muted">予定はありません</p>}
      <ul className="morning-event-list">
        {events.map((e) => (
          <li key={e.id}>
            <span className="morning-event-time">{e.allDay ? '終日' : formatTime(new Date(e.start))}</span>
            <span>{e.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MorningView({ now, onDismiss }) {
  const { data: weather } = usePolling(fetchWeather, 10 * 60 * 1000);

  return (
    <div className="dashboard morning">
      <button type="button" className="morning-dismiss" onClick={onDismiss}>
        通常表示へ
      </button>
      <div className="dashboard-top">
        <Clock />
        <BikeCard weather={weather} now={now} />
      </div>
      <RainChart weather={weather} now={now} />
      <div className="dashboard-bottom">
        <GarbageCard now={now} />
        <TodayEvents now={now} />
      </div>
    </div>
  );
}
