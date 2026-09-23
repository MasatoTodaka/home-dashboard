import { useEffect, useRef } from 'react';
import { fetchDevices } from './api';
import { usePolling } from './usePolling';

// Fully Kiosk Browser の JavaScript Interface (PLUS) が有効なときだけ window.fully が存在する。
// Chrome 等で開いた場合は何もしない
const fully = typeof window !== 'undefined' ? window.fully : undefined;
const canSetBrightness = typeof fully?.setScreenBrightness === 'function';
// 本体の照度センサーを読めるならそれを使い、読めなければ SwitchBot ハブ2の照度で代用する
const hasTabletSensor = canSetBrightness && typeof fully?.getSensorValue === 'function';

// 画面の明るさの範囲 (Fully は 0〜255)
const BRIGHTNESS_MIN = 0;
const BRIGHTNESS_MAX = 255;

// 本体の照度センサー (Android の Sensor.TYPE_LIGHT、単位は lux)
const SENSOR_TYPE_LIGHT = 5;
const LUX_DARK = 1; // これ以下は最小
const LUX_BRIGHT = 300; // これ以上は最大 (照明を点けた室内がおおよそ100〜300lux)
const SENSOR_INTERVAL_MS = 5 * 1000;
// ちらつき防止: 読み取り値をならし、この段階数以上変わったときだけ明るさを変える
const SMOOTHING = 0.3;
const MIN_STEP = 8;
// OS側で明るさを変えられても戻せるよう、変化がなくてもこの間隔で設定し直す
const REAPPLY_MS = 60 * 1000;

// ハブ2の照度 (1〜20)
const HUB_LIGHT_MIN = 1;
const HUB_LIGHT_MAX = 20;

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
    const lux = Number(fully.getSensorValue(SENSOR_TYPE_LIGHT));
    return Number.isFinite(lux) && lux >= 0 ? lux : null;
  } catch {
    return null;
  }
}

function hub2LightLevel(devices) {
  const level = devices?.find((d) => d.deviceType === 'Hub 2')?.status?.lightLevel;
  return typeof level === 'number' ? level : null;
}

function setBrightness(level) {
  try {
    fully.setScreenBrightness(level);
  } catch (err) {
    console.warn('画面の明るさを変更できませんでした:', err);
  }
}

// 部屋の明るさに合わせて画面の明るさを変える。朝モード中は部屋の明るさに関係なく最大
export function useFullyBrightness(morning) {
  // 本体センサー: 数秒ごとに読んで反映する
  const smoothedLux = useRef(null);
  const last = useRef({ level: null, at: 0 });

  useEffect(() => {
    if (!hasTabletSensor) return undefined;

    function tick() {
      const lux = readTabletLux();
      if (lux !== null) {
        smoothedLux.current =
          smoothedLux.current === null ? lux : smoothedLux.current + SMOOTHING * (lux - smoothedLux.current);
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
  }, [morning]);

  // ハブ2 (本体センサーが使えない場合のみ): クラウドから1分ごとに取得して反映する
  const { data: devices } = usePolling(
    () => (canSetBrightness && !hasTabletSensor ? fetchDevices() : Promise.resolve(null)),
    60 * 1000
  );
  const hubLevel = hub2LightLevel(devices);

  // devices を依存に入れ、値が同じでも取得のたびに設定し直す (OS側で明るさが変えられても戻すため)
  useEffect(() => {
    if (!canSetBrightness || hasTabletSensor) return;
    const level = morning ? BRIGHTNESS_MAX : hubLevel === null ? null : brightnessForHubLevel(hubLevel);
    if (level !== null) setBrightness(level);
  }, [morning, hubLevel, devices]);
}
