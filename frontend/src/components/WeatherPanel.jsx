import { fetchWeather } from '../api';
import { usePolling } from '../usePolling';

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

function formatDay(dateStr, index) {
  if (index === 0) return '今日';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS_JA[d.getDay()]})`;
}

export default function WeatherPanel() {
  const { data, error } = usePolling(fetchWeather, 10 * 60 * 1000);

  return (
    <div className="panel weather-panel">
      <h2>{data?.location ? `${data.location}の天気` : '天気'}</h2>
      {error && <p className="error">取得エラー: {error}</p>}
      {!data && !error && <p>読み込み中...</p>}
      {data && (
        <>
          <div className="weather-current">
            <span className="weather-temp">{Math.round(data.current.temperature)}°C</span>
            <span className="weather-text">{data.current.weatherText}</span>
            <span className="weather-humidity">湿度 {data.current.humidity}%</span>
          </div>
          <div className="weather-daily">
            {data.daily.map((d, i) => (
              <div className="weather-day" key={d.date}>
                <div className="weather-day-label">{formatDay(d.date, i)}</div>
                <div className="weather-day-text">{d.weatherText}</div>
                <div className="weather-day-temp">
                  <span className="temp-max">{Math.round(d.tempMax)}°</span>
                  {' / '}
                  <span className="temp-min">{Math.round(d.tempMin)}°</span>
                </div>
                <div className="weather-day-pop">☂ {d.precipitationProbability}%</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
