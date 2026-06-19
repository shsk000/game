import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { OfficeLayoutTool } from './components/OfficeLayoutTool.tsx';
import { WorkstationTuner } from './components/WorkstationTuner.tsx';
import './styles/global.css';

// dev 専用：?tuner=ワークステーション調整 / ?layout=オフィス配置
const params = new URLSearchParams(window.location.search);
const dev = params.has('tuner') ? <WorkstationTuner /> : params.has('layout') ? <OfficeLayoutTool /> : null;

createRoot(document.getElementById('root')!).render(
  <StrictMode>{dev ?? <App />}</StrictMode>,
);
