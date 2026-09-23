import { useEffect, useState } from 'react';
import { brightnessDiagnostics, canSetBrightness, setBrightness } from '../useFullyBrightness';

// URLに ?debug=brightness を付けたときだけ出す、明るさ自動調整の確認用表示
const fully = window.fully;

function call(fn, ...args) {
  if (typeof fully?.[fn] !== 'function') return '(関数なし)';
  try {
    return String(fully[fn](...args));
  } catch (err) {
    return `エラー: ${err.message ?? err}`;
  }
}

function fmt(v) {
  if (v === null || v === undefined) return '-';
  if (v instanceof Date) return v.toLocaleTimeString();
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(1);
  return String(v);
}

export default function BrightnessDebug() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const d = brightnessDiagnostics;
  const rows = [
    ['window.fully', fully ? 'あり' : 'なし (JavaScript Interface が無効)'],
    ['setScreenBrightness', canSetBrightness ? 'あり' : 'なし'],
    ['getSensorValue', typeof fully?.getSensorValue === 'function' ? 'あり' : 'なし'],
    ['使用中の照度', d.source === 'tablet' ? '本体センサー' : d.source === 'hub' ? 'ハブ2' : '-'],
    ['センサー生値 (type 5)', fmt(d.rawSensorValue)],
    ['センサー (ならし後 lux)', fmt(d.smoothedLux)],
    ['読めなかった回数', fmt(d.invalidReads)],
    ['ハブ2 照度 (1〜20)', fmt(d.hubLightLevel)],
    ['最後に設定した明るさ', `${fmt(d.lastLevel)} (${fmt(d.lastAppliedAt)})`],
    ['getScreenBrightness()', call('getScreenBrightness')],
    ['最後のエラー', fmt(d.lastError)],
  ];

  return (
    <div className="brightness-debug">
      <table>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th>{k}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <details>
        <summary>getSensorInfo()</summary>
        <pre>{call('getSensorInfo')}</pre>
      </details>
      <div className="brightness-debug-buttons">
        {[10, 128, 255].map((level) => (
          <button key={level} type="button" disabled={!canSetBrightness} onClick={() => setBrightness(level)}>
            明るさ {level}
          </button>
        ))}
      </div>
    </div>
  );
}
