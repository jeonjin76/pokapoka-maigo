import { CONFIG } from '../config.js';
import { TEXTS } from '../texts.js';
import { makeTextures, NEON } from '../art.js';
import { makeButton } from '../objects/Button.js';
import { addBackdrop } from '../objects/Backdrop.js';
import { getBest } from '../records.js';
import { formatTime, fitCamera } from '../util.js';

// 시작 화면
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    fitCamera(this);
    makeTextures(this);
    const w = CONFIG.width;
    const h = CONFIG.height;
    const font = CONFIG.font;

    // 배경: 대표 그림(keyart.png)이 있으면 그걸로, 없으면 밤 네온 골목
    addBackdrop(this, 'raw-keyart', 0.35);

    // 아래에서부터 자리 잡기: 스타트 버튼(과 자기 베스트)은 화면 아래, 설명 상자는 그 위 남는 칸에 맞춤
    const best = getBest();
    const bottomBtn = h - (best ? 74 : 52);
    const NEEDED = 446; // 제목~스타트 버튼까지 꼭 필요한 높이
    const spare = Math.max(0, bottomBtn - 48 - NEEDED); // 남는 세로 공간은 위·가운데·아래로 나눔
    const top = 48 + spare * 0.3;
    const btnY = bottomBtn - spare * 0.3;
    this.add.text(w / 2, top, TEXTS.titleLine1, {
      fontFamily: font, fontSize: '30px', color: NEON.pink, fontStyle: 'bold',
      stroke: '#120e24', strokeThickness: 6,
    }).setOrigin(0.5).setShadow(0, 0, NEON.pink, 12, true, true);
    this.add.text(w / 2, top + 42, TEXTS.titleLine2, {
      fontFamily: font, fontSize: '24px', color: NEON.cyan, fontStyle: 'bold',
      stroke: '#120e24', strokeThickness: 5,
    }).setOrigin(0.5).setShadow(0, 0, NEON.cyan, 10, true, true);

    // 시바견 여행자와 포카포카 밴
    const artY = top + 118;
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

    const lead = this.add.text(w / 2, artY + 14, TEXTS.titleLead, {
      fontFamily: font, fontSize: '17px', color: '#fff6e6', align: 'center', fontStyle: 'bold',
      lineSpacing: 5,
    }).setOrigin(0.5, 0);

    // 스탬프 5개 미리보기
    const stampY = lead.y + lead.height + 26;
    for (let i = 0; i < 5; i++) {
      this.add.image(w / 2 + (i - 2) * 46, stampY, `stamp-${i + 1}`).setDisplaySize(34, 34);
    }

    // 놀이 방법 상자: 스탬프 줄과 스타트 버튼 사이 칸에 맞춰 줄 간격을 정함 (겹치지 않게)
    const howTop = stampY + 28;
    const howBottom = btnY - 28 - 14;
    const lines = TEXTS.howTo.length;
    const lineH = Phaser.Math.Clamp((howBottom - howTop - 16) / lines, 19, 28);
    const howH = lines * lineH + 16;
    const boxW = 332;
    this.add.rectangle(w / 2, howTop + howH / 2, boxW, howH, 0x1a1430, 0.9).setStrokeStyle(2, 0x3ff3ff, 0.8);
    TEXTS.howTo.forEach((line, i) => {
      this.add.text(w / 2 - boxW / 2 + 12, howTop + 8 + i * lineH + lineH / 2, `・${line}`, {
        fontFamily: font, fontSize: '15px', color: '#f2ecff',
      }).setOrigin(0, 0.5);
    });

    makeButton(this, w / 2, btnY, 220, 56, TEXTS.start, {
      color: 0xff3fa4,
      fontSize: 22,
      onClick: () => this.scene.start('Game'),
    });

    if (best) {
      this.add.text(w / 2, btnY + 46, TEXTS.bestRecord(formatTime(best)), {
        fontFamily: font, fontSize: '15px', color: NEON.yellow, fontStyle: 'bold',
      }).setOrigin(0.5);
    }

    this.input.keyboard.once('keydown-ENTER', () => this.scene.start('Game'));
  }
}
