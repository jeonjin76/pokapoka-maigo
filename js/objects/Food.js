import { CONFIG } from '../config.js';

// 포장마차·가판대. 가까이 가면 먹고, 30초 뒤 다시 생긴다.
export class FoodStall {
  constructor(game, x, y, type) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.type = type;
    this.cart = game.add.image(x, y, 'cart').setScale(2).setDepth(7);
    this.icon = game.add.image(x, y - 18, `food-${type}`).setDisplaySize(22, 22).setDepth(8);
    this.iconScale = this.icon.scaleX;
    game.tweens.add({ targets: this.icon, y: y - 22, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.available = true;
  }

  update(now) {
    if (!this.available) {
      if (now > this.respawnAt) {
        this.available = true;
        this.icon.setVisible(true).setScale(0);
        this.game.tweens.add({ targets: this.icon, scale: this.iconScale, duration: 300, ease: 'Back.out' });
      }
      return;
    }
    const c = this.game.player.body.center;
    if (Phaser.Math.Distance.Between(this.x, this.y, c.x, c.y) < CONFIG.food.range) {
      this.available = false;
      this.respawnAt = now + CONFIG.food.respawnMs;
      this.icon.setVisible(false);
      this.game.eat(this.type, this.x, this.y);
    }
  }
}
