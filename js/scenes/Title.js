import { CONFIG } from '../config.js';
import { TEXTS } from '../texts.js';
import { makeTextures, NEON } from '../art.js';
import { makeButton } from '../objects/Button.js';
import { addBackdrop } from '../objects/Backdrop.js';
import { getBest } from '../records.js';
import { formatTime } from '../util.js';

// 시작 화면
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    makeTextures(this);
    const w = CONFIG.width;
    const h = CONFIG.height;
    const font = CONFIG.font;

    // 배경: 대표 그림(keyart.png)이 있으면 그걸로, 없으면 밤 네온 골목
    addBackdrop(this, 'raw-keyart', 0.35);

    const top = Math.max(60, h * 0.12);
    this.add.text(w / 2, top, TEXTS.titleLine1, {
      fontFamily: font, fontSize: '30px', color: NEON.pink, fontStyle: 'bold',
      stroke: '#120e24', strokeThickness: 6,
    }).setOrigin(0.5).setShadow(0, 0, NEON.pink, 12, true, true);
    this.add.text(w / 2, top + 42, TEXTS.titleLine2, {
      fontFamily: font, fontSize: '24px', color: NEON.cyan, fontStyle: 'bold',
      stroke: '#120e24', strokeThickness: 5,
    }).setOrigin(0.5).setShadow(0, 0, NEON.cyan, 10, true, true);

    // 시바견 여행자와 포카포카 밴
    const artY = top + 140;
    const player = this.add.sprite(w / 2 - 75, artY, 'player-side', 0).setOrigin(0.5, 1);
    player.setScale(84 / player.height);
    if (!this.anims.exists('title-walk')) {
      this.anims.create({
        key: 'title-walk',
        frames: [1, 0, 2, 0].map((frame) => ({ key: 'player-side', frame })),
        frameRate: 8,
        repeat: -1,
      });
    }
    player.play('title-walk');
    const van = this.add.image(w / 2 + 55, artY, 'van-open').setOrigin(0.5, 1);
    van.setScale(130 / van.width);
    this.tweens.add({ targets: player, y: artY - 3, duration: 250, yoyo: true, repeat: -1 });

    this.add.text(w / 2, artY + 40, TEXTS.titleLead, {
      fontFamily: font, fontSize: '17px', color: '#fff6e6', align: 'center', fontStyle: 'bold',
      lineSpacing: 6,
    }).setOrigin(0.5);

    // 스탬프 5개 미리보기
    for (let i = 0; i < 5; i++) {
      this.add.image(w / 2 + (i - 2) * 46, artY + 100, `stamp-${i + 1}`).setDisplaySize(36, 36);
    }

    const howY = artY + 140;
    const howH = TEXTS.howTo.length * 22 + 20;
    this.add.rectangle(w / 2, howY - 6 + howH / 2, 300, howH, 0x1a1430, 0.85).setStrokeStyle(2, 0x3ff3ff, 0.8);
    TEXTS.howTo.forEach((line, i) => {
      this.add.text(w / 2 - 134, howY + i * 22 + 5, `・${line}`, {
        fontFamily: font, fontSize: '13px', color: '#e8e0ff',
      });
    });

    const btnY = Math.min(h - 80, howY + howH + 40);
    makeButton(this, w / 2, btnY, 220, 56, TEXTS.start, {
      color: 0xff3fa4,
      fontSize: 22,
      onClick: () => this.scene.start('Game'),
    });

    const best = getBest();
    if (best) {
      this.add.text(w / 2, btnY + 50, TEXTS.bestRecord(formatTime(best)), {
        fontFamily: font, fontSize: '15px', color: NEON.yellow, fontStyle: 'bold',
      }).setOrigin(0.5);
    }

    this.input.keyboard.once('keydown-ENTER', () => this.scene.start('Game'));
  }
}
