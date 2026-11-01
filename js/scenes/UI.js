import { CONFIG } from '../config.js';
import { TEXTS } from '../texts.js';
import { Joystick } from '../objects/Joystick.js';
import { Sound } from '../sound.js';
import { formatTime, fitCamera } from '../util.js';

const FONT = CONFIG.font;

// 화면에 고정되는 표시 (확대되지 않음): 위쪽 상태판, 조이스틱, 「すみません」 버튼, 안내 문구.
export class UIScene extends Phaser.Scene {
  constructor() {
    super('UI');
  }

  create() {
    fitCamera(this);
    this.gameScene = this.scene.get('Game');
    this.joystick = new Joystick(this);

    this.makeRain();
    this.makeTopBar();
    this.makeSumimasenButton();
    this.makeMoveHint();

    this.toastBox = this.add.text(CONFIG.width / 2, 150, '', {
      fontFamily: FONT, fontSize: '15px', color: '#fff6e6', align: 'center',
      backgroundColor: '#1a1530ee', padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setDepth(50).setAlpha(0);

    const handlers = {
      stamp: this.onStamp,
      toast: this.toast,
      hp: this.onHp,
      pigeons: this.onPigeons,
      lost: this.onLost,
      respawn: this.onRespawn,
      goal: this.onGoal,
      sumimasenKey: this.pressSumimasen,
    };
    const ev = this.gameScene.events;
    for (const [name, fn] of Object.entries(handlers)) ev.on(name, fn, this);
    this.events.once('shutdown', () => {
      for (const [name, fn] of Object.entries(handlers)) ev.off(name, fn, this);
    });
  }

  // 비 오는 밤: 화면 앞을 비스듬히 떨어지는 빗줄기
  makeRain() {
    this.rain = this.add.graphics().setDepth(30);
    this.drops = Array.from({ length: CONFIG.rain.drops }, () => ({
      x: Math.random() * (CONFIG.width + 60),
      y: Math.random() * CONFIG.height,
      v: 0.8 + Math.random() * 0.6,
    }));
  }

  drawRain(dt) {
    const g = this.rain;
    const { speed, length, slant } = CONFIG.rain;
    g.clear();
    g.lineStyle(1, 0xa8d8ff, 0.35);
    for (const d of this.drops) {
      d.y += speed * d.v * dt / 1000;
      d.x -= speed * d.v * slant * dt / 1000;
      if (d.y > CONFIG.height) {
        d.y = -length;
        d.x = Math.random() * (CONFIG.width + 60);
      }
      g.lineBetween(d.x, d.y, d.x + length * slant, d.y - length);
    }
  }

  makeTopBar() {
    const w = CONFIG.width;
    this.add.rectangle(0, 0, w, CONFIG.topBarHeight, 0x1a1530, 0.88).setOrigin(0).setDepth(40);

    // 시간
    this.timerText = this.add.text(12, 9, '0:00.0', {
      fontFamily: FONT, fontSize: '15px', color: '#fff6e6', fontStyle: 'bold',
    }).setDepth(41);

    // 체력 바
    const barX = 92;
    const barW = 190;
    this.add.text(barX - 4, 17, TEXTS.hp, {
      fontFamily: FONT, fontSize: '12px', color: '#FF3FA4', fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(41);
    this.add.rectangle(barX, 17, barW, 12, 0x2a2440).setOrigin(0, 0.5).setDepth(41)
      .setStrokeStyle(2, 0x8a80c0);
    this.hpFill = this.add.rectangle(barX + 1, 17, barW - 2, 10, 0x6fbb5f).setOrigin(0, 0.5).setDepth(42);
    this.hpBarW = barW - 2;
    this.hpText = this.add.text(barX + barW / 2, 17, `${CONFIG.health.max}`, {
      fontFamily: FONT, fontSize: '10px', color: '#ffffff', fontStyle: 'bold', stroke: '#120e24', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(43);

    // 소리 켜기 버튼 (기본 음소거)
    const btn = this.add.text(w - 8, 4, Sound.muted ? TEXTS.soundOff : TEXTS.soundOn, {
      fontSize: '20px', padding: { x: 4, y: 2 },
    }).setOrigin(1, 0).setDepth(41).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => {
      Sound.toggle();
      btn.setText(Sound.muted ? TEXTS.soundOff : TEXTS.soundOn);
    });

    // 스탬프 5칸 (모은 것만 색이 들어옴)
    this.slots = {};
    ['1', '2', '3', '4', '5'].forEach((id, i) => {
      const x = w / 2 + (i - 2) * 40;
      this.slots[id] = this.add.image(x, 50, `stamp-${id}`).setDisplaySize(26, 26).setDepth(41)
        .setTint(0x8a7a6a).setAlpha(0.35);
    });
  }

  makeSumimasenButton() {
    const r = 38;
    const x = CONFIG.width - r - 16;
    const y = CONFIG.height - r - 24;
    this.sumiBg = this.add.circle(x, y, r, 0xff3fa4, 0.92).setStrokeStyle(3, 0x3ff3ff).setDepth(45)
      .setInteractive({ useHandCursor: true });
    this.sumiText = this.add.text(x, y, TEXTS.sumimasen, {
      fontFamily: FONT, fontSize: '12px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(46);
    // 버튼 바로 위에 쓰임새 설명
    this.add.text(x, y - r - 8, TEXTS.sumimasenHelp, {
      fontFamily: FONT, fontSize: '12px', color: '#ffffff', fontStyle: 'bold', align: 'center',
      backgroundColor: '#1a1530cc', padding: { x: 6, y: 3 }, lineSpacing: 2,
    }).setOrigin(0.5, 1).setDepth(45);
    this.sumiCool = this.add.graphics().setDepth(47);
    this.sumiPos = { x, y, r };
    this.sumiReadyAt = 0;
    this.sumiBg.on('pointerdown', () => this.pressSumimasen());
  }

  pressSumimasen() {
    const now = this.time.now;
    if (now < this.sumiReadyAt) return;
    this.gameScene.sumimasen();
    this.sumiReadyAt = now + CONFIG.sumimasen.cooldownMs;
    this.tweens.add({ targets: [this.sumiBg, this.sumiText], scale: 0.9, duration: 80, yoyo: true });
  }

  drawSumimasenCooldown() {
    const g = this.sumiCool;
    g.clear();
    const left = this.sumiReadyAt - this.time.now;
    if (left <= 0) return;
    const { x, y, r } = this.sumiPos;
    const frac = left / CONFIG.sumimasen.cooldownMs;
    g.fillStyle(0x3b2a20, 0.45);
    g.slice(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false);
    g.fillPath();
  }

  makeMoveHint() {
    const hint = this.add.text(CONFIG.width / 2, CONFIG.topBarHeight + 16, TEXTS.hintMove, {
      fontFamily: FONT, fontSize: '18px', color: '#ffffff', align: 'center', fontStyle: 'bold',
      backgroundColor: '#1a1530e6', padding: { x: 14, y: 8 },
    }).setOrigin(0.5, 0).setDepth(45);
    const pc = this.add.text(CONFIG.width / 2, hint.y + hint.height + 6, TEXTS.hintMovePc, {
      fontFamily: FONT, fontSize: '13px', color: '#e8e0ff', align: 'center',
      backgroundColor: '#1a1530cc', padding: { x: 10, y: 5 }, lineSpacing: 3,
    }).setOrigin(0.5, 0).setDepth(45);

    // 처음 움직이면 안내 문구를 천천히 지움
    const watch = this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        if (this.gameScene.player?.body.speed > 0) {
          watch.remove();
          this.tweens.add({ targets: [hint, pc], alpha: 0, duration: 600, delay: 2000 });
        }
      },
    });
  }

  onStamp(id) {
    const img = this.slots[id];
    if (!img) return;
    img.clearTint().setAlpha(1);
    this.tweens.add({ targets: img, scale: img.scaleX * 1.5, duration: 160, yoyo: true });
  }

  onHp(hp) {
    const frac = hp / CONFIG.health.max;
    this.hpFill.width = Math.max(0, this.hpBarW * frac);
    this.hpFill.fillColor = frac > 0.5 ? 0x6fbb5f : frac > 0.25 ? 0xf2c94c : 0xe8503a;
    this.hpText.setText(`${hp}`);
  }

  toast(message) {
    this.tweens.killTweensOf(this.toastBox);
    this.toastBox.setText(message).setAlpha(1);
    this.tweens.add({ targets: this.toastBox, alpha: 0, delay: CONFIG.toastMs, duration: 400 });
  }

  // 비둘기가 날아올라 화면 일부를 가림
  onPigeons() {
    const w = CONFIG.width;
    const h = CONFIG.height;
    const cy = Phaser.Math.Between(h * 0.35, h * 0.65);
    const birds = [];
    for (let i = 0; i < 9; i++) {
      const b = this.add.sprite(Phaser.Math.Between(20, w - 20), cy + Phaser.Math.Between(-90, 90), 'pigeon', 1)
        .setScale(Phaser.Math.FloatBetween(5, 8)).setDepth(48).setFlipX(i % 2 === 0);
      birds.push(b);
      this.tweens.add({ targets: b, y: b.y - 20, duration: 120, yoyo: true, repeat: -1 });
    }
    this.time.delayedCall(CONFIG.pigeon.blindMs, () => {
      this.tweens.add({
        targets: birds, alpha: 0, y: '-=120', duration: 400,
        onComplete: () => birds.forEach((b) => b.destroy()),
      });
    });
  }

  onLost() {
    const w = CONFIG.width;
    const h = CONFIG.height;
    this.toastBox.setAlpha(0);
    this.lostLayer = this.add.container(0, 0).setDepth(70);
    this.lostLayer.add(this.add.rectangle(0, 0, w, h, 0x3b2a20, 0.7).setOrigin(0));
    this.lostLayer.add(this.add.text(w / 2, h / 2 - 20, TEXTS.lost, {
      fontFamily: FONT, fontSize: '28px', color: '#fff6e6', fontStyle: 'bold',
    }).setOrigin(0.5));
    this.lostLayer.add(this.add.text(w / 2, h / 2 + 24, TEXTS.lostSub, {
      fontFamily: FONT, fontSize: '13px', color: '#fff6e6',
    }).setOrigin(0.5));
    this.lostLayer.setAlpha(0);
    this.tweens.add({ targets: this.lostLayer, alpha: 1, duration: 300 });
  }

  onRespawn() {
    if (!this.lostLayer) return;
    const layer = this.lostLayer;
    this.lostLayer = null;
    this.tweens.add({ targets: layer, alpha: 0, duration: 300, onComplete: () => layer.destroy() });
  }

  onGoal(result) {
    this.toastBox.setAlpha(0);
    this.time.delayedCall(700, () => {
      this.scene.stop('Game');
      this.scene.start('Clear', result);
    });
  }

  update(time, delta) {
    this.drawRain(Math.min(delta, 50));
    if (this.gameScene.startedAt) this.timerText.setText(formatTime(this.gameScene.elapsed()));
    this.drawSumimasenCooldown();
  }
}
