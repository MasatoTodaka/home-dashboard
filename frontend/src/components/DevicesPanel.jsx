import { useState } from 'react';
import { fetchDevices, sendDeviceCommand } from '../api';
import { usePolling } from '../usePolling';

// turnOn が単体で有効なリモコン種別 (エアコンは温度・モード指定の setAll が必要なため対象外)
const IR_ONOFF_TYPES = ['Light', 'TV', 'IPTV/Streamer', 'Set Top Box', 'DVD', 'Speaker', 'Fan', 'Others'];

function DeviceCard({ device }) {
  const [pending, setPending] = useState(false);
  const status = device.status;
  const hasPowerToggle = status && (status.power === 'on' || status.power === 'off');

  async function toggle() {
    if (!hasPowerToggle || pending) return;
    setPending(true);
    try {
      await sendDeviceCommand(device.deviceId, status.power === 'on' ? 'turnOff' : 'turnOn');
    } catch (err) {
      console.error(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={`device-card ${hasPowerToggle ? 'clickable' : ''} ${status?.power === 'on' ? 'on' : ''}`}
      onClick={toggle}>
      <div className="device-name">{device.deviceName}</div>
      <div className="device-type">{device.deviceType}</div>
      <div className="device-status">
        {hasPowerToggle && <span className={`badge ${status.power}`}>{status.power === 'on' ? 'ON' : 'OFF'}</span>}
        {status?.temperature !== undefined && <span>🌡 {status.temperature}°C</span>}
        {status?.humidity !== undefined && <span>💧 {status.humidity}%</span>}
        {status?.slidePosition !== undefined && <span>開閉 {status.slidePosition}%</span>}
        {status?.battery !== undefined && <span>🔋 {status.battery}%</span>}
        {!status && <span className="muted">状態なし</span>}
      </div>
      {pending && <div className="device-pending">送信中...</div>}
    </div>
  );
}

function InfraredDeviceCard({ device }) {
  const [pending, setPending] = useState(false);
  const supportsOn = IR_ONOFF_TYPES.includes(device.deviceType);

  async function send(command) {
    if (pending) return;
    setPending(true);
    try {
      await sendDeviceCommand(device.deviceId, command);
    } catch (err) {
      console.error(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="device-card">
      <div className="device-name">{device.deviceName}</div>
      <div className="device-type">{device.deviceType} (赤外線)</div>
      <div className="ir-buttons">
        {supportsOn && (
          <button type="button" className="ir-button on" disabled={pending} onClick={() => send('turnOn')}>
            ON
          </button>
        )}
        <button type="button" className="ir-button off" disabled={pending} onClick={() => send('turnOff')}>
          OFF
        </button>
      </div>
      {pending && <div className="device-pending">送信中...</div>}
    </div>
  );
}

export default function DevicesPanel() {
  const { data, error } = usePolling(fetchDevices, 30 * 1000);

  return (
    <div className="panel devices-panel">
      <h2>デバイス</h2>
      {error && <p className="error">取得エラー: {error}</p>}
      {!data && !error && <p>読み込み中...</p>}
      {data && data.length === 0 && <p className="muted">デバイスが見つかりません</p>}
      {data && data.length > 0 && (
        <div className="device-grid">
          {data.map((device) =>
            device.isInfrared ? (
              <InfraredDeviceCard key={device.deviceId} device={device} />
            ) : (
              <DeviceCard key={device.deviceId} device={device} />
            )
          )}
        </div>
      )}
    </div>
  );
}
