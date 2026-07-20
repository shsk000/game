import { useState } from 'react';
import { formatYen } from '../utils/format';
import * as storage from '../utils/storage';

/**
 * /admin/econ = お金デバッグツール（dev 専用・v0.22）。
 *
 * 本編ゲームとは別レンダリングなので live な store は触れない。
 * localStorage のセーブ（storage.Persisted）を直接読み書きし、
 * **ゲームのタブをリロードすると反映される**。セーブが無ければ defaults を土台にする。
 */

const PANEL: React.CSSProperties = {
  padding: 20,
  fontFamily: 'monospace',
  color: '#dce8f2',
  maxWidth: 560,
};

const QUICK_ADDS = [
  { label: '+¥100万', amount: 1_000_000 },
  { label: '+¥1000万', amount: 10_000_000 },
  { label: '+¥1億', amount: 100_000_000 },
  { label: '+¥10億', amount: 1_000_000_000 },
];

const btnStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: '#1d5fa8',
  color: '#fff',
  border: '1px solid #0a1420',
  borderRadius: 3,
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 13,
};

export const AdminEcon = () => {
  // 現在のセーブを読む（無ければ defaults を土台に）
  const [funds, setFunds] = useState<number>(() => {
    const p = storage.load() ?? storage.defaults();
    return p.funds;
  });
  const [customInput, setCustomInput] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  // セーブを load→編集→save する共通処理（他フィールドは維持）
  const writeFunds = (nextFunds: number) => {
    const p = storage.load() ?? storage.defaults();
    const clamped = Math.max(0, Math.round(nextFunds));
    storage.save({ ...p, funds: clamped });
    setFunds(clamped);
    setMessage(
      `資金を ${formatYen(clamped)} にしました。ゲームのタブをリロードすると反映されます。`,
    );
  };

  const customAmount = Number(customInput.replace(/[,¥\s]/g, ''));
  const customValid = Number.isFinite(customAmount) && customAmount !== 0;

  return (
    <div style={PANEL}>
      <h2 style={{ color: '#fff', fontSize: 16, margin: '0 0 4px' }}>💰 お金デバッグ</h2>
      <p style={{ fontSize: 12, color: '#8fa6bd', margin: '0 0 8px' }}>
        localStorage のセーブを直接編集します。変更後は<strong>ゲームのタブをリロード</strong>
        してください。
      </p>
      <p style={{ fontSize: 12, color: '#e0a050', margin: '0 0 16px' }}>
        ⚠ ゲームを別タブで開いたままだと自動保存（5秒毎）で上書きされます。
        <strong>ゲームのタブを閉じてから</strong>ここで編集し、あとでゲームを開き直すのが確実です。
      </p>

      <div style={{ fontSize: 14, marginBottom: 16 }}>
        現在の資金：<strong style={{ color: '#f0c020' }}>{formatYen(funds)}</strong>
      </div>

      <div style={{ marginBottom: 8, fontSize: 12, color: '#8fa6bd' }}>クイック追加</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {QUICK_ADDS.map((q) => (
          <button
            key={q.amount}
            type="button"
            style={btnStyle}
            onClick={() => writeFunds(funds + q.amount)}
          >
            {q.label}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 8, fontSize: 12, color: '#8fa6bd' }}>金額を指定（円）</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          inputMode="numeric"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder="例: 5000000"
          style={{
            padding: '6px 10px',
            background: '#0f1d2e',
            color: '#fff',
            border: '1px solid #2a3f52',
            borderRadius: 3,
            fontFamily: 'monospace',
            fontSize: 13,
            width: 160,
          }}
        />
        <button
          type="button"
          style={{ ...btnStyle, opacity: customValid ? 1 : 0.45 }}
          disabled={!customValid}
          onClick={() => writeFunds(funds + customAmount)}
        >
          追加
        </button>
        <button
          type="button"
          style={{ ...btnStyle, background: '#7a4', opacity: customValid ? 1 : 0.45 }}
          disabled={!customValid}
          onClick={() => writeFunds(customAmount)}
        >
          この額にセット
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          style={{ ...btnStyle, background: '#a33' }}
          onClick={() => writeFunds(storage.defaults().funds)}
        >
          初期資金（¥500万）に戻す
        </button>
      </div>

      {message && <p style={{ marginTop: 16, fontSize: 12, color: '#8fe6a0' }}>{message}</p>}
    </div>
  );
};
