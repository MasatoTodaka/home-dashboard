import { useState } from 'react';
import { sendDeviceCommand } from '../../api';
import AddButtonArea from './CustomButtonForms';

// turnOn が単体で有効なリモコン種別 (エアコンは温度・モード指定の setAll が必要なため対象外)
const IR_ONOFF_TYPES = ['Light', 'TV', 'IPTV/Streamer', 'Set Top Box', 'DVD', 'Speaker', 'Fan', 'Others'];

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

export default function DeviceCard({
  device,
  displayName,
  editMode,
  hidden,
  customButtons,
  onToggleHidden,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onAddCustomButton,
  onRemoveCustomButton,
  onRename,
}) {
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
