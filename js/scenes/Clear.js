import { CONFIG } from '../config.js';
import { TEXTS } from '../texts.js';
import { makeButton } from '../objects/Button.js';
import { addBackdrop } from '../objects/Backdrop.js';
import { NEON } from '../art.js';
import { submitTime } from '../records.js';
import { formatTime, fitCamera } from '../util.js';
import { drawResultCard, shareX, shareThreads, saveImage, copyText } from '../share.js';

// 클리어 화면: 기록, 결과 카드, 할인 코드, 공유, 예약 버튼
export class ClearScene extends Phaser.Scene {
  constructor() {
    super('Clear');
  }

  create(result) {
    fitCamera(this);
    const { ms, hp } = result;
    const w = CONFIG.width;
    const h = CONFIG.height;
    const font = CONFIG.font;
    const { isBest } = submitTime(ms);

    addBackdrop(this, 'raw-bg_alley', 0.6);
    this.cameras.main.fadeIn(400);

    // 아래쪽 버튼 영역 높이를 먼저 잡고, 남는 높이로 카드 크기를 정함
    const bottomH = 96 + 46 + 46 + 56 + 16;
    const topH = 112;
    const card = Phaser.Math.Clamp(h - topH - bottomH - 24, 100, 210);
    const gap = Math.max(0, (h - topH - bottomH - card - 24) / 4);

    let y = 34 + gap / 2;
    this.add.text(w / 2, y, TEXTS.clearTitle, {
      fontFamily: font, fontSize: '30px', color: NEON.pink, fontStyle: 'bold',
      stroke: '#120e24', strokeThickness: 5,
    }).setOrigin(0.5).setShadow(0, 0, NEON.pink, 12, true, true);
    y += 38;
    this.add.text(w / 2, y, TEXTS.clearTime(formatTime(ms)), {
      fontFamily: font, fontSize: '19px', color: '#fff6e6', fontStyle: 'bold',
    }).setOrigin(0.5);
    y += 26;
    this.add.text(w / 2, y, isBest ? `${TEXTS.clearHp(hp)}　${TEXTS.newBest}` : TEXTS.clearHp(hp), {
      fontFamily: font, fontSize: '14px', color: isBest ? NEON.yellow : '#d8d0f0', fontStyle: 'bold',
    }).setOrigin(0.5);

    // 결과 카드
    this.cardCanvas = drawResultCard(this, { ms, hp });
    if (this.textures.exists('result-card')) this.textures.remove('result-card');
    this.textures.addCanvas('result-card', this.cardCanvas)
      .setFilter(Phaser.Textures.FilterMode.LINEAR); // 크게 그린 카드를 줄여 보일 때 매끄럽게
    y += 14 + gap;
    this.add.image(w / 2, y + card / 2, 'result-card').setDisplaySize(card, card);
    y += card + gap + 6;

    // 할인 코드
    const boxH = 90;
    this.add.rectangle(w / 2, y + boxH / 2, w - 32, boxH, 0xfff6e6).setStrokeStyle(3, 0xff3fa4);
    this.add.text(w / 2, y + 14, TEXTS.couponTitle(CONFIG.coupon.amount), {
      fontFamily: font, fontSize: '13px', color: '#e0287f', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(w / 2 - 50, y + 41, CONFIG.coupon.code, {
      fontFamily: 'Consolas, Menlo, monospace', fontSize: '22px', color: '#3b2a20', fontStyle: 'bold',
    }).setOrigin(0.5);
    makeButton(this, w / 2 + 102, y + 41, 76, 32, TEXTS.copy, {
      fontSize: 14,
      onClick: async () => {
        if (await copyText(CONFIG.coupon.code)) this.toast(TEXTS.copied);
      },
    });
    this.add.text(w / 2, y + 71, TEXTS.couponNote(CONFIG.coupon.until), {
      fontFamily: font, fontSize: '10px', color: '#7a6a5a', align: 'center',
    }).setOrigin(0.5);
    y += boxH + 12;

    // 공유
    const half = (w - 40) / 2;
    makeButton(this, 16 + half / 2, y + 20, half, 40, TEXTS.shareThreads, {
      color: 0xf4f2fb, textColor: '#120e24', fontSize: 14, onClick: () => shareThreads(ms),
    });
    makeButton(this, w - 16 - half / 2, y + 20, half, 40, TEXTS.shareX, {
      color: 0xf4f2fb, textColor: '#120e24', fontSize: 14, onClick: () => shareX(ms),
    });
    y += 46;
    makeButton(this, 16 + half / 2, y + 20, half, 40, TEXTS.saveImage, {
      color: 0x2f8fa8, fontSize: 14, onClick: () => saveImage(this.cardCanvas),
    });
    makeButton(this, w - 16 - half / 2, y + 20, half, 40, TEXTS.playAgain, {
      color: 0x5a4a8a, fontSize: 14, onClick: () => this.scene.start('Title'),
    });
    y += 46;

    // 예약
    makeButton(this, w / 2, y + 26, w - 32, 50, TEXTS.reserve, {
      color: 0xff8a3d, fontSize: 18,
      onClick: () => {
        if (CONFIG.links.reserve) window.open(CONFIG.links.reserve, '_blank', 'noopener');
        else this.toast(TEXTS.reserveSoon);
      },
    });

    this.toastBox = this.add.text(w / 2, h / 2, '', {
      fontFamily: font, fontSize: '15px', color: '#ffffff', backgroundColor: '#3b2a20dd',
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setDepth(10).setAlpha(0);
  }

  toast(message) {
    this.tweens.killTweensOf(this.toastBox);
    this.toastBox.setText(message).setAlpha(1);
    this.tweens.add({ targets: this.toastBox, alpha: 0, delay: 1400, duration: 400 });
  }
}
