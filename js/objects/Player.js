import { CONFIG } from '../config.js';

// 시바견 여행자. move(x, y)에 -1~1 방향값을 넣으면 걷는다.
// 그림 크기(임시 16px, 진짜 28px)와 상관없이 (x, y)가 발밑이 되도록 맞춘다.
export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player-down', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const w = this.width;
    const h = this.height;
    this.setOrigin(0.5, (h - 4) / h);
    this.body.setSize(14, 8).setOffset((w - 14) / 2, h - 8); // 발 쪽만 부딪히게 (골목 한 칸 = 32픽셀)
    this.setCollideWorldBounds(true);
    this.setDepth(10);
    this.facing = 'down';
    this.speedScale = 1; // 인파(느려짐)·바나나우유(빨라짐) 배율
    Player.makeAnims(scene);
  }

  static makeAnims(scene) {
    if (scene.anims.exists('walk-down')) return;
    for (const dir of ['down', 'up', 'side']) {
      scene.anims.create({
        key: `walk-${dir}`,
        frames: [1, 0, 2, 0].map((frame) => ({ key: `player-${dir}`, frame })),
        frameRate: CONFIG.player.walkFps,
        repeat: -1,
      });
    }
  }

  move(dx, dy) {
    const len = Math.hypot(dx, dy);
    if (len < 0.01) {
      this.setVelocity(0, 0);
      this.anims.stop();
      this.setTexture(`player-${this.facing === 'left' || this.facing === 'right' ? 'side' : this.facing}`, 0);
      return;
    }
    // 대각선이 더 빠르지 않게 길이 1로 맞춤 (조이스틱을 덜 밀면 천천히)
    const k = Math.min(len, 1) / len;
    const speed = CONFIG.player.speed * this.speedScale;
    this.setVelocity(dx * k * speed, dy * k * speed);

    if (Math.abs(dx) > Math.abs(dy)) {
      this.facing = dx > 0 ? 'right' : 'left';
      this.setFlipX(dx < 0);
      this.anims.play('walk-side', true);
    } else {
      this.facing = dy > 0 ? 'down' : 'up';
      this.setFlipX(false);
      this.anims.play(`walk-${this.facing}`, true);
    }
  }
}
