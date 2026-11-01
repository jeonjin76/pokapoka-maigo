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

// 글자가 깨지지 않게, 실제 화면 화소 수에 가깝게 크게 그린 뒤 화면에 맞춤 (1~3배).
// 장면들은 그대로 360 기준 좌표를 쓰고, 카메라가 이 배율만큼 키워서 보여 준다 (js/util.js fitCamera).
const fitWidth = Math.min(window.innerWidth, window.innerHeight * CONFIG.width / CONFIG.height);
CONFIG.res = Phaser.Math.Clamp(Math.round((window.devicePixelRatio || 1) * fitWidth / CONFIG.width), 1, 3);

// 모든 글자를 배율에 맞춰 선명하게 (각자 resolution을 정한 글자는 그대로)
const factory = Phaser.GameObjects.GameObjectFactory.prototype;
const addText = factory.text;
factory.text = function (x, y, text, style = {}) {
  return addText.call(this, x, y, text, { resolution: CONFIG.res, ...style });
};

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: CONFIG.width * CONFIG.res,
  height: CONFIG.height * CONFIG.res,
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
