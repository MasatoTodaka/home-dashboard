import { useState } from 'react';

const AC_MODE_LABEL = { 1: '自動', 2: '冷房', 3: '除湿', 4: '送風', 5: '暖房' };

// エアコン専用: 温度・モード・風量・電源を選んで setAll コマンドのボタンを作る
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

// 汎用: ボタン名・コマンド・パラメータを自由入力で作る
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

export default function AddButtonArea({ device, onAdd }) {
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
