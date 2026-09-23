import { useEffect, useRef, useState } from 'react';
import { fetchDevices } from './api';

// Fully Kiosk Browser の JavaScript Interface (PLUS) が有効なときだけ window.fully が存在する。
// Chrome 等で開いた場合は何もしない
const fully = typeof window !== 'undefined' ? window.fully : undefined;
export const canSetBrightness = typeof fully?.setScreenBrightness === 'function';
const hasSensorApi = canSetBrightness && typeof fully?.getSensorValue === 'function';

// 画面の明るさの範囲 (Fully は 0〜255)
const BRIGHTNESS_MIN = 0;
const BRIGHTNESS_MAX = 255;

// 本体の照度センサー (Android の Sensor.TYPE_LIGHT、単位は lux)
const SENSOR_TYPE_LIGHT = 5;
const LUX_DARK = 1; // これ以下は最小
const LUX_BRIGHT = 300; // これ以上は最大 (照明を点けた室内がおおよそ100〜300lux)
const SENSOR_INTERVAL_MS = 5 * 1000;
// 起動してからこの回数続けてセンサー値が読めなければ、本体センサーは使えないとみなしてハブ2に切り替える
const SENSOR_GIVE_UP_READS = 6;
// ちらつき防止: 読み取り値をならし、この段階数以上変わったときだけ明るさを変える
const SMOOTHING = 0.3;
const MIN_STEP = 8;
// OS側で明るさを変えられても戻せるよう、変化がなくてもこの間隔で設定し直す
const REAPPLY_MS = 60 * 1000;

// ハブ2の照度 (1〜20)。クラウド経由なので1分ごとに取得する
const HUB_LIGHT_MIN = 1;
const HUB_LIGHT_MAX = 20;
const HUB_INTERVAL_MS = 60 * 1000;

// 確認用表示 (?debug=brightness) が読む現在の状態
export const brightnessDiagnostics = {
  source: null, // 'tablet' | 'hub'
  rawSensorValue: null,
  smoothedLux: null,
  invalidReads: 0,
  hubLightLevel: null,
  lastLevel: null,
  lastAppliedAt: null,
  lastError: null,
};

function clamp01(x) {
  return Math.min(Math.max(x, 0), 1);
}

function toBrightness(ratio) {
  return Math.round(BRIGHTNESS_MIN + clamp01(ratio) * (BRIGHTNESS_MAX - BRIGHTNESS_MIN));
}

// 人の目の感じ方に合わせ、lux は対数で明るさに割り当てる
function brightnessForLux(lux) {
  if (lux <= LUX_DARK) return BRIGHTNESS_MIN;
  return toBrightness(Math.log(lux / LUX_DARK) / Math.log(LUX_BRIGHT / LUX_DARK));
}

function brightnessForHubLevel(level) {
  return toBrightness((level - HUB_LIGHT_MIN) / (HUB_LIGHT_MAX - HUB_LIGHT_MIN));
}

function readTabletLux() {
  try {
    const raw = fully.getSensorValue(SENSOR_TYPE_LIGHT);
    brightnessDiagnostics.rawSensorValue = raw;
    const lux = Number(raw);
    return Number.isFinite(lux) && lux >= 0 ? lux : null;
  } catch (err) {
    brightnessDiagnostics.lastError = `getSensorValue: ${err.message ?? err}`;
    return null;
  }
}

function hub2LightLevel(devices) {
  const level = devices?.find((d) => d.deviceType === 'Hub 2')?.status?.lightLevel;
  return typeof level === 'number' ? level : null;
}

export function setBrightness(level) {
  try {
    fully.setScreenBrightness(level);
    brightnessDiagnostics.lastLevel = level;
    brightnessDiagnostics.lastAppliedAt = new Date();
  } catch (err) {
    brightnessDiagnostics.lastError = `setScreenBrightness: ${err.message ?? err}`;
    console.warn('画面の明るさを変更できませんでした:', err);
  }
}

// 部屋の明るさに合わせて画面の明るさを変える。朝モード中は部屋の明るさに関係なく最大。
// 本体の照度センサーを優先し、読めなければ SwitchBot ハブ2の照度に切り替える
export function useFullyBrightness(morning) {
  const [source, setSource] = useState(hasSensorApi ? 'tablet' : canSetBrightness ? 'hub' : null);
  brightnessDiagnostics.source = source;

  const smoothedLux = useRef(null);
  const invalidReads = useRef(0);
  const last = useRef({ level: null, at: 0 });

  useEffect(() => {
    if (source !== 'tablet') return undefined;

    function tick() {
      const lux = readTabletLux();
      if (lux === null) {
        invalidReads.current += 1;
        brightnessDiagnostics.invalidReads = invalidReads.current;
        // 一度も読めないまま規定回数に達したら、このセンサーは使えないとみなす
        if (smoothedLux.current === null && invalidReads.current >= SENSOR_GIVE_UP_READS) {
          setSource('hub');
          return;
        }
      } else {
        smoothedLux.current =
          smoothedLux.current === null ? lux : smoothedLux.current + SMOOTHING * (lux - smoothedLux.current);
        brightnessDiagnostics.smoothedLux = smoothedLux.current;
      }

      // センサー値がまだ取れないうちは明るさを変えない (朝モードは値に関係なく最大)
      let level = null;
      if (morning) level = BRIGHTNESS_MAX;
      else if (smoothedLux.current !== null) level = brightnessForLux(smoothedLux.current);
      if (level === null) return;

      const now = Date.now();
      const changed = last.current.level === null || Math.abs(level - last.current.level) >= MIN_STEP;
      // 最大・最小の端は小さな差でも合わせる (真っ暗な部屋で少しだけ明るいまま、を防ぐ)
      const reachedEdge = (level === BRIGHTNESS_MIN || level === BRIGHTNESS_MAX) && level !== last.current.level;
      if (changed || reachedEdge || now - last.current.at >= REAPPLY_MS) {
        setBrightness(level);
        last.current = { level, at: now };
      }
    }

    tick();
    const id = setInterval(tick, SENSOR_INTERVAL_MS);
    return () => clearInterval(id);
  }, [source, morning]);

  // 値が同じでも取得のたびに設定し直す (OS側で明るさが変えられても戻すため)
  useEffect(() => {
    if (source !== 'hub') return undefined;
    let cancelled = false;

    async function run() {
      try {
        const level = hub2LightLevel(await fetchDevices());
        if (cancelled) return;
        brightnessDiagnostics.hubLightLevel = level;
        if (morning) setBrightness(BRIGHTNESS_MAX);
        else if (level !== null) setBrightness(brightnessForHubLevel(level));
      } catch (err) {
        brightnessDiagnostics.lastError = `ハブ2の取得: ${err.message ?? err}`;
      }
    }

    run();
    const id = setInterval(run, HUB_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [source, morning]);
}
