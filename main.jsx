import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker manually (Vite PWA plugin disabled services)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .catch(err => console.log('SW registration failed', err));
  });
}

// Prime audio on first user interaction (same as original)
let audioPrimed = false;
const primeAudio = () => {
  if (audioPrimed) return;
  const appSound = document.getElementById('app-sound');
  const taskSound = document.getElementById('task-sound');
  if (appSound) {
    appSound.volume = 0;
    appSound.play().then(() => { appSound.pause(); appSound.currentTime = 0; appSound.volume = 1.0; }).catch(()=>{});
  }
  if (taskSound) {
    taskSound.volume = 0;
    taskSound.play().then(() => { taskSound.pause(); taskSound.currentTime = 0; taskSound.volume = 1.0; }).catch(()=>{});
  }
  audioPrimed = true;
};
window.addEventListener('click', primeAudio, { once: true });
window.addEventListener('touchstart', primeAudio, { once: true });
