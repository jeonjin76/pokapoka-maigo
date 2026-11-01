import { CONFIG } from '../config.js';
import { TEXTS } from '../texts.js';
import { BOSS_ANIMALS, NEON } from '../art.js';
import { Sound } from '../sound.js';
import { addBackdrop } from '../objects/Backdrop.js';

// 스탬프 획득 연출 (약 3~4초, 터치하면 닫힘). 눈높이 일러스트 화면.
//   1) 사장님이 「いらっしゃい！」  2) 아래에서 스탬프 카드가 올라옴
//   3) 위에서 도장이 내려와 「ドン！」  4) 「スタンプ n/5 ゲット！」 + 다음 장소 힌트
// data: { id, count, total, collected: [id...], hint }
export class StampEventScene extends Phaser.Scene {
  constructor() {
    super('StampEvent');
  }

  create(data) {
    const w = CONFIG.width;
    const h = CONFIG.height;
    const font = CONFIG.font;
    this.closed = false;

    // 배경: 네온 골목 그림(bg_alley.png)이 있으면 그걸로, 없으면 밤거리 + 네온 불빛
    addBackdrop(this, 'raw-bg_alley', 0.45);

    // 사장님
    const animal = BOSS_ANIMALS[Number(data.id) - 1];
    const bossY = h * 0.43;
    const boss = this.add.image(w + 160, bossY, `boss-${animal}`).setOrigin(0.5, 1);
    boss.setScale(Math.min(210 / boss.width, 230 / boss.height));
    this.tweens.add({ targets: boss, x: w / 2, duration: 380, ease: 'Back.out' });
    this.tweens.add({ targets: boss, y: bossY - 4, duration: 500, yoyo: true, repeat: -1, delay: 400, ease: 'Sine.inOut' });

    const info = TEXTS.bosses[data.id];
    this.add.text(w / 2, bossY + 12, info.name, {
      fontFamily: font, fontSize: '13px', color: '#120e24', fontStyle: 'bold',
      backgroundColor: NEON.yellow, padding: { x: 10, y: 3 },
    }).setOrigin(0.5);

    this.bubble = this.add.text(w / 2, bossY - boss.displayHeight - 8, info.hello, {
      fontFamily: font, fontSize: '16px', color: '#2a1e30', fontStyle: 'bold', align: 'center',
      backgroundColor: '#ffffff', padding: { x: 12, y: 8 }, lineSpacing: 4,
    }).setOrigin(0.5, 1).setScale(0);
    this.tweens.add({ targets: this.bubble, scale: 1, duration: 220, delay: 300, ease: 'Back.out' });

    // 스탬프 카드
    const cardY = h * 0.76;
    const cardW = w - 40;
    const card = this.add.container(w / 2, h + 120);
    const bgCard = this.add.rectangle(0, 0, cardW, 124, 0xfff6e6).setStrokeStyle(4, 0xff3fa4);
    const title = this.add.text(0, -44, TEXTS.stampCardTitle, {
      fontFamily: font, fontSize: '14px', color: NEON.pink, fontStyle: 'bold',
    }).setOrigin(0.5);
    card.add([bgCard, title]);
    const slotX = (i) => (i - 2) * ((cardW - 76) / 4);
    const slotSize = 46;
    for (let i = 0; i < data.total; i++) {
      const id = String(i + 1);
      card.add(this.add.circle(slotX(i), 12, slotSize / 2, 0xe9d3b0).setStrokeStyle(2, 0xc9a77a));
      if (data.collected.includes(id) && id !== String(data.id)) {
        card.add(this.add.image(slotX(i), 12, `stamp-${id}`).setDisplaySize(slotSize - 6, slotSize - 6));
      }
    }
    this.tweens.add({ targets: card, y: cardY, duration: 400, delay: 450, ease: 'Cubic.out' });

    // 도장 「ドン！」 (카드 안에서 움직여야 칸과 딱 맞음)
    const idx = Number(data.id) - 1;
    const target = { x: slotX(idx), y: 12 };
    const stamp = this.add.image(target.x, -cardY - 60, `stamp-${data.id}`).setDisplaySize(84, 84).setVisible(false);
    card.add(stamp);
    this.time.delayedCall(1050, () => {
      stamp.setVisible(true);
      this.tweens.add({
        targets: stamp, y: target.y, displayWidth: slotSize - 6, displayHeight: slotSize - 6,
        duration: 260, ease: 'Quad.in',
        onComplete: () => {
          Sound.play('stamp');
          this.cameras.main.shake(160, 0.01);
          this.tweens.add({ targets: card, x: w / 2 + 6, duration: 50, yoyo: true, repeat: 3 });
          const don = this.add.text(w / 2 + target.x, cardY - 30, TEXTS.don, {
            fontFamily: font, fontSize: '34px', color: NEON.pink, fontStyle: 'bold',
            stroke: '#ffffff', strokeThickness: 6,
          }).setOrigin(0.5).setScale(0.3);
          this.tweens.add({ targets: don, scale: 1, duration: 180, ease: 'Back.out' });
          this.tweens.add({ targets: don, alpha: 0, y: don.y - 16, delay: 700, duration: 300 });
        },
      });
    });

    // 몇 개째 + 다음 장소 힌트
    this.time.delayedCall(1700, () => {
      const count = this.add.text(w / 2, cardY - 84, TEXTS.stampCount(data.count, data.total), {
        fontFamily: font, fontSize: '22px', color: NEON.yellow, fontStyle: 'bold',
        stroke: '#120e24', strokeThickness: 6,
      }).setOrigin(0.5).setScale(0);
      this.tweens.add({ targets: count, scale: 1, duration: 220, ease: 'Back.out' });
      this.bubble.setText(data.hint);
    });

    this.add.text(w / 2, h - 18, TEXTS.tapToSkip, {
      fontFamily: font, fontSize: '11px', color: '#c8c0e0',
    }).setOrigin(0.5);

    this.time.delayedCall(CONFIG.stampEvent.autoCloseMs, () => this.close());
    this.input.once('pointerup', () => this.close());
    this.input.keyboard.once('keydown', () => this.close());
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.cameras.main.fadeOut(180, 18, 14, 36);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.get('Game').onStampEventDone();
      this.scene.stop();
    });
  }
}
