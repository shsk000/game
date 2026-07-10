import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { OfficeLayoutTool } from './components/OfficeLayoutTool.tsx';
import { WorkstationTuner } from './components/WorkstationTuner.tsx';
import { bootGameStore } from './state/boot.ts';
import './styles/global.css';

// 起動時副作用（セーブ読込・オフライン収益・自動保存・window.__gs）はここで1回だけ配線する。
// ?seed=NN があれば乱数を seed 固定にする（e2e 決定化）。render の外で同期実行。
bootGameStore();

// dev 専用：?tuner=物体エディタ（セル内の置き方／全物体）/ ?layout=オフィス配置（どのセルか）
const params = new URLSearchParams(window.location.search);
const dev = params.has('tuner') ? (
  <WorkstationTuner />
) : params.has('layout') ? (
  <OfficeLayoutTool />
) : null;

createRoot(document.getElementById('root')!).render(<StrictMode>{dev ?? <App />}</StrictMode>);
