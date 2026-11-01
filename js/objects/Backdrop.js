import { CONFIG } from '../config.js';
import { NEON } from '../art.js';

// 눈높이 화면(시작·스탬프 연출·클리어) 배경.
// 그림(keyart.png / bg_alley.png)이 있으면 화면을 꽉 채우고, 없으면 남색 밤거리 + 네온 불빛.
export function addBackdrop(scene, rawKey, dim = 0.45) {
  const w = CONFIG.width;
  const h = CONFIG.height;
  if (scene.textures.exists(rawKey)) {
    const bg = scene.add.image(w / 2, h / 2, rawKey);
    bg.setScale(Math.max(w / bg.width, h / bg.height));
    scene.add.rectangle(0, 0, w, h, 0x120e24, dim).setOrigin(0);
    return;
  }
  scene.add.rectangle(0, 0, w, h, 0x120e24).setOrigin(0);
  // 멀리 보이는 네온 간판 불빛
  const lights = [
    [NEON.pink, 0.15, 0.16, 80], [NEON.cyan, 0.85, 0.28, 90], [NEON.yellow, 0.2, 0.55, 70],
    [NEON.purple, 0.82, 0.7, 90], [NEON.orange, 0.3, 0.9, 70],
  ];
  for (const [c, fx, fy, r] of lights) {
    const color = Phaser.Display.Color.HexStringToColor(c).color;
    scene.add.circle(w * fx, h * fy, r, color, 0.13);
    scene.add.circle(w * fx, h * fy, r * 0.45, color, 0.12);
  }
  // 세로 네온 간판 실루엣
  [[0.06, 0.08, NEON.pink], [0.93, 0.18, NEON.cyan], [0.9, 0.52, NEON.yellow]].forEach(([fx, fy, c]) => {
    const color = Phaser.Display.Color.HexStringToColor(c).color;
    scene.add.rectangle(w * fx, h * fy, 18, 90, 0x1a1430).setOrigin(0.5, 0).setStrokeStyle(2, color, 0.7);
  });
}
