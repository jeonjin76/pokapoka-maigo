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
