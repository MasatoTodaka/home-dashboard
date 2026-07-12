import { useState } from 'react';
import { fetchDevices, sendDeviceCommand } from '../api';
import { usePolling } from '../usePolling';
import {
  loadDeviceSettings,
  saveOrder,
  toggleHidden,
  addCustomButton,
  removeCustomButton,
  setDisplayName,
  applyOrder,
} from '../deviceSettings';

// turnOn が単体で有効なリモコン種別 (エアコンは温度・モード指定の setAll が必要なため対象外)
const IR_ONOFF_TYPES = ['Light', 'TV', 'IPTV/Streamer', 'Set Top Box', 'DVD', 'Speaker', 'Fan', 'Others'];

const AC_MODE_LABEL = { 1: '自動', 2: '冷房', 3: '除湿', 4: '送風', 5: '暖房' };

function AcPresetForm({ onAdd }) {
  const [temp, setTemp] = useState(26);
  const [mode, setMode] = useState(2);
  const [fan, setFan] = useState(1);
  const [power, setPower] = useState('on');

  function submit() {
    const parameter = `${temp},${mode},${fan},${power}`;
    const label = power === 'off' ? '電源OFF' : `${temp}℃ ${AC_MODE_LABEL[mode]}`;
    onAdd({ label, command: 'setAll', parameter });
  }

  return (
    <div className="custom-button-form">
      <div className="form-row">
        <label>
          温度
          <input type="number" min="16" max="30" value={temp} onChange={(e) => setTemp(e.target.value)} />
        </label>
        <label>
          モード
          <select value={mode} onChange={(e) => setMode(Number(e.target.value))}>
            <option value={1}>自動</option>
            <option value={2}>冷房</option>
            <option value={3}>除湿</option>
            <option value={4}>送風</option>
            <option value={5}>暖房</option>
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>
          風量
          <select value={fan} onChange={(e) => setFan(Number(e.target.value))}>
            <option value={1}>自動</option>
            <option value={2}>弱</option>
            <option value={3}>中</option>
            <option value={4}>強</option>
          </select>
        </label>
        <label>
          電源
          <select value={power} onChange={(e) => setPower(e.target.value)}>
            <option value="on">ON</option>
            <option value="off">OFF</option>
          </select>
        </label>
      </div>
      <button type="button" onClick={submit}>このボタンを追加</button>
    </div>
  );
}

function CustomButtonForm({ onAdd }) {
  const [label, setLabel] = useState('');
  const [command, setCommand] = useState('turnOn');
  const [parameter, setParameter] = useState('default');

  function submit() {
    if (!label.trim()) return;
    onAdd({ label: label.trim(), command: command.trim() || 'turnOn', parameter: parameter.trim() || 'default' });
    setLabel('');
  }

  return (
    <div className="custom-button-form">
      <input placeholder="ボタン名 (例: 就寝)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <input placeholder="コマンド (例: turnOn)" value={command} onChange={(e) => setCommand(e.target.value)} />
      <input placeholder="パラメータ (例: default)" value={parameter} onChange={(e) => setParameter(e.target.value)} />
      <button type="button" onClick={submit}>追加</button>
    </div>
  );
}

function EditControls({ hidden, onToggleHidden, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) {
  return (
    <div className="edit-controls">
      <button type="button" onClick={onMoveUp} disabled={!canMoveUp}>▲</button>
      <button type="button" onClick={onMoveDown} disabled={!canMoveDown}>▼</button>
      <label className="hide-toggle">
        <input type="checkbox" checked={!hidden} onChange={onToggleHidden} />
        表示
      </label>
    </div>
  );
}

function CustomButtonRow({ buttons, deviceId, editMode, onRemove }) {
  if (buttons.length === 0) return null;
  return (
    <div className="custom-button-row">
      {buttons.map((btn) => (
        <div className="custom-button-wrap" key={btn.id}>
          <button
            type="button"
            className="ir-button custom"
            onClick={() => sendDeviceCommand(deviceId, btn.command, btn.parameter)}
          >
            {btn.label}
          </button>
          {editMode && (
            <button type="button" className="remove-custom" onClick={() => onRemove(btn.id)}>
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function AddButtonArea({ device, onAdd }) {
  const [showForm, setShowForm] = useState(false);

  if (!showForm) {
    return (
      <button type="button" className="add-custom-toggle" onClick={() => setShowForm(true)}>
        + ボタン追加
      </button>
    );
  }

  const handleAdd = (btn) => {
    onAdd(btn);
    setShowForm(false);
  };

  return device.deviceType === 'Air Conditioner' ? (
    <AcPresetForm onAdd={handleAdd} />
  ) : (
    <CustomButtonForm onAdd={handleAdd} />
  );
}

function DeviceNameField({ displayName, onRename }) {
  return (
    <div
      className="device-name device-name-editable"
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onRename(e.currentTarget.textContent)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    >
      {displayName}
    </div>
  );
}

function DeviceCard({ device, displayName, editMode, hidden, customButtons, onToggleHidden, onMoveUp, onMoveDown, canMoveUp, canMoveDown, onAddCustomButton, onRemoveCustomButton, onRename }) {
  const [pending, setPending] = useState(false);
  const status = device.status;
  const hasPowerToggle = status && (status.power === 'on' || status.power === 'off');
  const supportsIrOnOff = device.isInfrared && IR_ONOFF_TYPES.includes(device.deviceType);

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
    <div className={`device-card ${hidden ? 'hidden-device' : ''} ${status?.power === 'on' ? 'on' : ''}`}>
      {editMode && (
        <EditControls
          hidden={hidden}
          onToggleHidden={onToggleHidden}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
        />
      )}
      {editMode ? (
        <DeviceNameField displayName={displayName} onRename={onRename} />
      ) : (
        <div className="device-name">{displayName}</div>
      )}
      <div className="device-type">
        {device.deviceType}
        {device.isInfrared ? ' (赤外線)' : ''}
      </div>

      {!device.isInfrared && (
        <div className="device-status">
          {hasPowerToggle && (
            <button type="button" className={`ir-button toggle ${status.power}`} disabled={pending} onClick={() => send(status.power === 'on' ? 'turnOff' : 'turnOn')}>
              {status.power === 'on' ? 'ON' : 'OFF'}
            </button>
          )}
          {status?.temperature !== undefined && <span>🌡 {status.temperature}°C</span>}
          {status?.humidity !== undefined && <span>💧 {status.humidity}%</span>}
          {status?.slidePosition !== undefined && <span>開閉 {status.slidePosition}%</span>}
          {status?.battery !== undefined && <span>🔋 {status.battery}%</span>}
          {!status && <span className="muted">状態なし</span>}
        </div>
      )}

      {device.isInfrared && (
        <div className="ir-buttons">
          {supportsIrOnOff && (
            <button type="button" className="ir-button on" disabled={pending} onClick={() => send('turnOn')}>
              ON
            </button>
          )}
          <button type="button" className="ir-button off" disabled={pending} onClick={() => send('turnOff')}>
            OFF
          </button>
        </div>
      )}

      <CustomButtonRow buttons={customButtons} deviceId={device.deviceId} editMode={editMode} onRemove={onRemoveCustomButton} />

      {editMode && <AddButtonArea device={device} onAdd={onAddCustomButton} />}

      {pending && <div className="device-pending">送信中...</div>}
    </div>
  );
}

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
