import { CONFIG } from '../config.js';

// 둥근 사각형 버튼. 공유·복사·새 창 열기는 손을 뗄 때(pointerup) 실행해야 휴대폰에서 막히지 않음.
export function makeButton(scene, x, y, w, h, label, { color = 0xe8803a, textColor = '#ffffff', fontSize = 15, onClick } = {}) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.12);
  g.fillRoundedRect(x - w / 2, y - h / 2 + 3, w, h, h / 2.4);
  g.fillStyle(color, 1);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, h / 2.4);
  const text = scene.add.text(x, y, label, {
    fontFamily: CONFIG.font, fontSize: `${fontSize}px`, color: textColor, fontStyle: 'bold',
  }).setOrigin(0.5);
  const zone = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
  zone.on('pointerdown', () => {
    g.setAlpha(0.75);
    text.setAlpha(0.75);
  });
  zone.on('pointerout', () => {
    g.setAlpha(1);
    text.setAlpha(1);
  });
  zone.on('pointerup', () => {
    g.setAlpha(1);
    text.setAlpha(1);
    if (onClick) onClick();
  });
  return { g, text, zone };
}
