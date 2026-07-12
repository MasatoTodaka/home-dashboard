import { useState } from 'react';
import { fetchDevices } from '../api';
import { usePolling } from '../usePolling';
import DeviceCard from './devices/DeviceCard';
import {
  loadDeviceSettings,
  saveOrder,
  toggleHidden,
  addCustomButton,
  removeCustomButton,
  setDisplayName,
  applyOrder,
} from '../deviceSettings';

export default function DevicesPanel() {
  const { data, error } = usePolling(fetchDevices, 30 * 1000);
  const [settings, setSettings] = useState(loadDeviceSettings);
  const [editMode, setEditMode] = useState(false);

  if (!data) {
    return (
      <div className="panel devices-panel">
        <h2>デバイス</h2>
        {error && <p className="error">取得エラー: {error}</p>}
        {!error && <p>読み込み中...</p>}
      </div>
    );
  }

  const ordered = applyOrder(data, settings.order);
  const visibleList = editMode ? ordered : ordered.filter((d) => !settings.hiddenDeviceIds.includes(d.deviceId));

  function handleMove(deviceId, direction) {
    const ids = ordered.map((d) => d.deviceId);
    const index = ids.indexOf(deviceId);
    const swapWith = index + direction;
    if (index < 0 || swapWith < 0 || swapWith >= ids.length) return;
    [ids[index], ids[swapWith]] = [ids[swapWith], ids[index]];
    setSettings(saveOrder(ids));
  }

  return (
    <div className="panel devices-panel">
      <div className="devices-header">
        <h2>デバイス</h2>
        <button type="button" className="edit-toggle-button" onClick={() => setEditMode((v) => !v)}>
          {editMode ? '完了' : '編集'}
        </button>
      </div>
      {error && <p className="error">取得エラー: {error}</p>}
      {visibleList.length === 0 && <p className="muted">デバイスが見つかりません</p>}
      {visibleList.length > 0 && (
        <div className="device-grid">
          {visibleList.map((device, i) => (
            <DeviceCard
              key={device.deviceId}
              device={device}
              displayName={settings.displayNames[device.deviceId] ?? device.deviceName}
              editMode={editMode}
              hidden={settings.hiddenDeviceIds.includes(device.deviceId)}
              customButtons={settings.customButtons[device.deviceId] ?? []}
              onToggleHidden={() => setSettings(toggleHidden(device.deviceId))}
              onMoveUp={() => handleMove(device.deviceId, -1)}
              onMoveDown={() => handleMove(device.deviceId, 1)}
              canMoveUp={i > 0}
              canMoveDown={i < visibleList.length - 1}
              onAddCustomButton={(btn) => setSettings(addCustomButton(device.deviceId, btn))}
              onRemoveCustomButton={(buttonId) => setSettings(removeCustomButton(device.deviceId, buttonId))}
              onRename={(name) => setSettings(setDisplayName(device.deviceId, name))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
