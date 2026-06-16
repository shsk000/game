import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { WorkstationTuner } from './components/WorkstationTuner.tsx';
import './styles/global.css';

// dev 専用：?tuner でワークステーション配置調整ツールを表示
const isTuner = new URLSearchParams(window.location.search).has('tuner');

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isTuner ? <WorkstationTuner /> : <App />}</StrictMode>,
);
