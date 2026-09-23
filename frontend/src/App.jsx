import { useEffect, useState } from 'react';
import Clock from './components/Clock';
import WeatherPanel from './components/WeatherPanel';
import CalendarPanel from './components/CalendarPanel';
import DevicesPanel from './components/DevicesPanel';
import MorningView from './components/MorningView';
import { isMorningTime } from './morning';
import { useWakeLock } from './useWakeLock';
import { useFullyBrightness } from './useFullyBrightness';
import './App.css';

// URLに ?mode=morning / ?mode=normal を付けると時刻に関係なくそのモードで表示する (確認用)
const FORCED_MODE = new URLSearchParams(window.location.search).get('mode');

function dateKey(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function App() {
  useWakeLock();
  const [now, setNow] = useState(new Date());
  // 「通常表示へ」を押した日は、その日の朝モードを出さない
  const [dismissedOn, setDismissedOn] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  const morning = FORCED_MODE
    ? FORCED_MODE === 'morning'
    : isMorningTime(now) && dismissedOn !== dateKey(now);

  // 明るさは「通常表示へ」で朝モードを閉じても、朝の時間帯は最大のままにする
  useFullyBrightness(FORCED_MODE ? FORCED_MODE === 'morning' : isMorningTime(now));

  if (morning) {
    return <MorningView now={now} onDismiss={() => setDismissedOn(dateKey(now))} />;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-top">
        <Clock />
        <WeatherPanel />
      </div>
      <div className="dashboard-bottom">
        <CalendarPanel />
        <DevicesPanel />
      </div>
    </div>
  );
}

export default App;
