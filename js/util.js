import { CONFIG } from './config.js';

// 밀리초 → "2:13.4" (분:초.0.1초)
export function formatTime(ms) {
  const tenths = Math.floor(ms / 100);
  const min = Math.floor(tenths / 600);
  const sec = Math.floor((tenths % 600) / 10);
  return `${min}:${String(sec).padStart(2, '0')}.${tenths % 10}`;
}

// 밀리초 → "2分13.4秒" (공유 문구용)
export function formatTimeJa(ms) {
  const tenths = Math.floor(ms / 100);
  const min = Math.floor(tenths / 600);
  const sec = `${Math.floor((tenths % 600) / 10)}.${tenths % 10}`;
  return min ? `${min}分${sec}秒` : `${sec}秒`;
}

// 360 기준 좌표로 만든 화면을 실제 그리는 배율(CONFIG.res)만큼 키워 보여 줌
export function fitCamera(scene) {
  scene.cameras.main.setZoom(CONFIG.res).centerOn(CONFIG.width / 2, CONFIG.height / 2);
}
