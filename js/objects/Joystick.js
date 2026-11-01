import { CONFIG } from '../config.js';

// 화면 아무 곳이나 누르고 끌면 나타나는 가상 조이스틱.
// value 는 { x, y } (-1~1). 손을 떼면 0.
export class Joystick {
  constructor(scene) {
    this.scene = scene;
    this.value = { x: 0, y: 0 };
    this.pointerId = null;
    this.origin = new Phaser.Math.Vector2();

    this.base = scene.add.circle(0, 0, CONFIG.joystick.radius, 0xffffff, 0.25)
      .setStrokeStyle(2, 0xffffff, 0.6).setVisible(false).setDepth(100);
    this.thumb = scene.add.circle(0, 0, 18, 0xffffff, 0.7).setVisible(false).setDepth(101);

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
  }

  onDown(pointer, over) {
    // 버튼 위를 누른 경우는 조이스틱이 아님
    if (this.pointerId !== null || (over && over.length)) return;
    this.pointerId = pointer.id;
    const px = pointer.x / CONFIG.res;
    const py = pointer.y / CONFIG.res;
    this.origin.set(px, py);
    this.base.setPosition(px, py).setVisible(true);
    this.thumb.setPosition(px, py).setVisible(true);
  }

  onMove(pointer) {
    if (pointer.id !== this.pointerId) return;
    const r = CONFIG.joystick.radius;
    const dx = pointer.x / CONFIG.res - this.origin.x;
    const dy = pointer.y / CONFIG.res - this.origin.y;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, r);
    const nx = len ? dx / len : 0;
    const ny = len ? dy / len : 0;
    this.thumb.setPosition(this.origin.x + nx * clamped, this.origin.y + ny * clamped);

    const strength = clamped / r;
    // 속도는 두 단계뿐: 살짝 끌면 천천히, 그 이상은 늘 같은 속도 (들쭉날쭉하지 않게)
    const { deadzone, slowBelow, slowScale } = CONFIG.joystick;
    if (strength < deadzone) {
      this.value = { x: 0, y: 0 };
    } else {
      const k = strength < slowBelow ? slowScale : 1;
      this.value = { x: nx * k, y: ny * k };
    }
  }

  onUp(pointer) {
    if (pointer.id !== this.pointerId) return;
    this.reset();
  }

  // 연출 등으로 장면이 멈췄다 돌아올 때, 눌린 채로 남지 않게
  reset() {
    this.pointerId = null;
    this.value = { x: 0, y: 0 };
    this.base.setVisible(false);
    this.thumb.setVisible(false);
  }
}
