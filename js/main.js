import { CONFIG } from './config.js';
import { BootScene } from './scenes/Boot.js';
import { TitleScene } from './scenes/Title.js';
import { GameScene } from './scenes/Game.js';
import { UIScene } from './scenes/UI.js';
import { ClearScene } from './scenes/Clear.js';
import { StampEventScene } from './scenes/StampEvent.js';

// 세로가 긴 휴대폰에서도 위아래 빈 띠가 없도록, 가로 360 기준으로 세로 길이를 화면 비율에 맞춤
const aspect = window.innerHeight / window.innerWidth;
CONFIG.height = Math.round(Phaser.Math.Clamp(CONFIG.width * aspect, 560, 800));

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: CONFIG.width,
  height: CONFIG.height,
  backgroundColor: CONFIG.colors.background,
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 3 },
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [BootScene, TitleScene, GameScene, UIScene, StampEventScene, ClearScene],
});
