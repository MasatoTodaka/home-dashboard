import { useEffect, useState } from 'react';

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

export default function Clock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const dateText = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 (${WEEKDAYS_JA[now.getDay()]})`;

  return (
    <div className="panel clock-panel">
      <div className="clock-time">{hh}:{mm}</div>
      <div className="clock-date">{dateText}</div>
    </div>
  );
}
