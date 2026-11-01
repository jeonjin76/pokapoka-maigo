import { CONFIG } from './config.js';
import { TEXTS } from './texts.js';
import { formatTime, formatTimeJa } from './util.js';

export function gameUrl() {
  return CONFIG.links.game || `${location.origin}${location.pathname}`;
}

// 결과 카드 이미지 (1080×1080 캔버스)
export function drawResultCard(scene, { ms, hp }) {
  const S = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  const font = (px, weight = 'bold') => `${weight} ${px}px ${CONFIG.font}`;
  const src = (key) => scene.textures.get(key).getSourceImage();

  ctx.fillStyle = '#f6d9a8';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#fff6e6';
  ctx.strokeStyle = '#d9775a';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.roundRect(50, 50, S - 100, S - 100, 48);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d9602a';
  ctx.font = font(56);
  ctx.fillText(TEXTS.cardTitle, S / 2, 150);

  ctx.fillStyle = '#3b2a20';
  ctx.font = font(100);
  TEXTS.cardEscape(formatTimeJa(ms)).split('\n').forEach((line, i) => {
    ctx.fillText(line, S / 2, 310 + i * 125);
  });

  // 스탬프 5개
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < 5; i++) {
    ctx.drawImage(src(`stamp-${i + 1}`), S / 2 - 330 + i * 140 - 56, 520, 112, 112);
  }

  ctx.fillStyle = '#5a3a24';
  ctx.font = font(46, 'normal');
  ctx.fillText(TEXTS.cardDetail(formatTime(ms), hp), S / 2, 700);

  // 여행자와 밴
  ctx.drawImage(src('player-down'), 0, 0, 16, 16, 230, 760, 160, 160);
  const van = src('van-open');
  const vw = 300;
  ctx.drawImage(van, 560, 940 - (vw * van.height) / van.width, vw, (vw * van.height) / van.width);

  ctx.fillStyle = '#9a7a5a';
  ctx.font = font(30, 'normal');
  ctx.fillText(gameUrl(), S / 2, 985);
  return canvas;
}

export function shareX(ms) {
  const text = TEXTS.shareText(formatTimeJa(ms));
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(gameUrl())}`;
  window.open(url, '_blank', 'noopener');
}

export function shareThreads(ms) {
  const text = `${TEXTS.shareText(formatTimeJa(ms))} ${gameUrl()}`;
  window.open(`https://www.threads.net/intent/post?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

// 휴대폰은 공유 시트(사진 저장 가능), 아니면 파일로 내려받기
export function saveImage(canvas) {
  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], TEXTS.imageFileName, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch {
        // 취소하면 아무것도 안 함
        return;
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = TEXTS.imageFileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 옛날 방식 (clipboard API가 막힌 경우)
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
