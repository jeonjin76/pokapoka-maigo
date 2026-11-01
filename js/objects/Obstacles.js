import { CONFIG } from '../config.js';
import { TEXTS } from '../texts.js';
import { NPC_COUNT, ART } from '../art.js';
import { Sound } from '../sound.js';

// 방해물 5종 + 行列. 모두 쓰러뜨리는 적이 아니라 피하거나 비켜 가는 귀여운 방해꾼.
// 각 클래스는 update(now, dt) 를 가지고, Game 장면이 매 프레임 불러 준다.
// obstacles.png 가 들어오면 사람들 그림이 자동으로 바뀐다 (art.js의 person-*).

const SIZE = () => CONFIG.tile;
const CELL = () => CONFIG.tile * CONFIG.cellTiles; // 맵 글자 한 칸
const PERSON_HEIGHT = 26; // 동네 사람 키 (시바견 28픽셀과 비슷하게)

export function makeNpcAnims(scene) {
  if (scene.anims.exists('npc0-walk-down')) return;
  for (let i = 0; i < NPC_COUNT; i++) {
    for (const dir of ['down', 'up', 'side']) {
      scene.anims.create({
        key: `npc${i}-walk-${dir}`,
        frames: [1, 0, 2, 0].map((frame) => ({ key: `npc${i}-${dir}`, frame })),
        frameRate: 6,
        repeat: -1,
      });
    }
  }
  if (ART.obstacles) {
    for (const kind of ['tour', 'flyer', 'crowd']) {
      scene.anims.create({
        key: `person-${kind}-walk`,
        frames: [1, 0, 2, 0].map((frame) => ({ key: `person-${kind}`, frame })),
        frameRate: 6,
        repeat: -1,
      });
    }
  }
}

// 동네 사람 하나. kind: 'tour' | 'flyer' | 'crowd'. 진짜 그림이 없으면 색만 다른 임시 그림.
function makePerson(game, kind, x, y, npc, dir = 'down', physics = false) {
  const key = ART.obstacles ? `person-${kind}` : `npc${npc}-${dir}`;
  const sprite = physics ? game.physics.add.sprite(x, y, key, 0) : game.add.sprite(x, y, key, 0);
  sprite.setScale(PERSON_HEIGHT / sprite.height).setDepth(10);
  sprite.skin = ART.obstacles
    ? { tex: () => `person-${kind}`, anim: () => `person-${kind}-walk` }
    : { tex: (d) => `npc${npc}-${d}`, anim: (d) => `npc${npc}-walk-${d}` };
  if (physics) {
    // 발 쪽만 부딪히게 (그림 크기와 상관없이 비율로)
    const w = sprite.width;
    const h = sprite.height;
    sprite.body.setSize(w * 0.7, h * 0.3).setOffset(w * 0.15, h * 0.65);
  }
  return sprite;
}

// 속도(vx, vy)에 맞춰 걷는 모습을 바꿈
function faceWalk(sprite, vx, vy) {
  if (Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01) {
    sprite.anims.stop();
    sprite.setFrame(0);
    return;
  }
  if (Math.abs(vx) > Math.abs(vy)) {
    sprite.setFlipX(vx < 0);
    sprite.anims.play(sprite.skin.anim('side'), true);
  } else {
    sprite.setFlipX(false);
    sprite.anims.play(sprite.skin.anim(vy > 0 ? 'down' : 'up'), true);
  }
}

// 단체 관광객 한 사람이 차지하는 사각형 (플레이어를 밀지 않게 미리 확인용)
function feetRect(x, y) {
  return new Phaser.Geom.Rectangle(x - 12, y - 12, 24, 26);
}

function playerRect(player) {
  const b = player.body;
  return new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height);
}

// ── 団体ツアー: 골목을 왔다 갔다 하며 길을 막음 ─────────────
export class Tour {
  constructor(game, x, y, seed) {
    this.game = game;
    const size = SIZE();
    const tx = Math.floor(x / size);
    const ty = Math.floor(y / size);
    const run = (dx, dy) => {
      let n = 0;
      while (n < 40 && game.isOpenTile(tx + dx * (n + 1), ty + dy * (n + 1))) n++;
      return n;
    };
    const [l, r, u, d] = [run(-1, 0), run(1, 0), run(0, -1), run(0, 1)];
    this.axis = l + r >= u + d ? 'x' : 'y';
    const fixed = this.axis === 'x' ? y : x;
    this.fixed = fixed;
    this.min = this.axis === 'x' ? (tx - l + 0.5) * size : (ty - u + 0.5) * size;
    this.max = this.axis === 'x' ? (tx + r + 0.5) * size : (ty + d + 0.5) * size;
    this.s = (this.axis === 'x' ? x : y) - this.min; // 왕복 길 위의 위치
    this.yielding = false;

    this.members = [];
    for (let i = 0; i <= CONFIG.tour.members; i++) {
      const sprite = makePerson(game, 'tour', x, y, (seed + i) % NPC_COUNT, 'down', true);
      sprite.body.setImmovable(true).setAllowGravity(false);
      // 몸 전체로 막음 (발만 막으면 두 줄 사이 틈으로 빠져나감)
      sprite.body.setSize(sprite.width * 0.9, sprite.height * 0.95).setOffset(sprite.width * 0.05, sprite.height * 0.05);
      game.physics.add.collider(game.player, sprite, () => game.bumpPerson(), () => !this.yielding);
      this.members.push(sprite);
    }
    this.flag = game.add.image(x, y, 'flag').setScale(2).setDepth(11);
    this.place(this.s);
  }

  // 왕복 길 위치 s → 실제 좌표와 방향
  pos(s) {
    const len = this.max - this.min;
    if (len <= 0) return { v: this.min, dir: 0 };
    const m = ((s % (2 * len)) + 2 * len) % (2 * len);
    return m <= len ? { v: this.min + m, dir: 1 } : { v: this.min + 2 * len - m, dir: -1 };
  }

  // 두 사람씩 나란히 줄지어 걸음 (넓은 골목도 옆으로 빠져나갈 틈이 없게)
  memberXY(s, i) {
    const p = this.pos(s - Math.floor(i / 2) * CONFIG.tour.gap);
    const side = (i % 2 ? 1 : -1) * CONFIG.tour.side;
    return this.axis === 'x'
      ? { x: p.v, y: this.fixed + side, vx: p.dir, vy: 0 }
      : { x: this.fixed + side, y: p.v, vx: 0, vy: p.dir };
  }

  place(s, moving = false) {
    this.members.forEach((m, i) => {
      const p = this.memberXY(s, i);
      m.body.reset(p.x, p.y);
      faceWalk(m, moving ? p.vx : 0, moving ? p.vy : 0);
    });
    const g = this.members[0];
    this.flag.setPosition(g.x + 10, g.y - 20);
  }

  overlapsPlayer(s) {
    const pr = playerRect(this.game.player);
    return this.members.some((_, i) => {
      const p = this.memberXY(s, i);
      return Phaser.Geom.Intersects.RectangleToRectangle(feetRect(p.x, p.y), pr);
    });
  }

  nearPlayer(range) {
    const c = this.game.player.body.center;
    return this.members.some((m) => Phaser.Math.Distance.Between(m.x, m.y, c.x, c.y) < range);
  }

  trySumimasen(now) {
    if (!this.nearPlayer(CONFIG.sumimasen.range)) return false;
    this.yielding = true;
    this.yieldUntil = now + CONFIG.sumimasen.yieldMs;
    this.members.forEach((m) => m.setAlpha(0.5));
    this.game.say(this.members[0].x, this.members[0].y - 22, TEXTS.tourYield, 1200);
    return true;
  }

  update(now, dt) {
    if (this.yielding) {
      // 플레이어가 아직 사이에 있으면 계속 비켜 줌
      if (now > this.yieldUntil && !this.overlapsPlayer(this.s)) {
        this.yielding = false;
        this.members.forEach((m) => m.setAlpha(1));
      } else {
        this.place(this.s, false);
        return;
      }
    }
    const next = this.s + (CONFIG.tour.speed * dt) / 1000;
    if (this.overlapsPlayer(next)) {
      this.place(this.s, false); // 앞에 사람이 있으면 기다림 (밀지 않음)
      return;
    }
    this.s = next;
    this.place(this.s, true);
  }
}

// ── チラシ配り: 가까이 가면 다가와 붙잡음 ────────────────
export class Flyer {
  constructor(game, x, y, seed) {
    this.game = game;
    this.home = { x, y };
    this.sprite = makePerson(game, 'flyer', x, y, seed % NPC_COUNT, 'down', true);
    game.physics.add.collider(this.sprite, game.layer);
    this.paper = game.add.rectangle(x, y, 7, 9, 0xffffff).setStrokeStyle(1, 0x9a9aa8).setDepth(11);
    this.state = 'idle';
  }

  moveToward(tx, ty) {
    const s = this.sprite;
    const a = Phaser.Math.Angle.Between(s.x, s.y, tx, ty);
    s.setVelocity(Math.cos(a) * CONFIG.flyer.speed, Math.sin(a) * CONFIG.flyer.speed);
  }

  update(now) {
    const s = this.sprite;
    const c = this.game.player.body.center;
    const dPlayer = Phaser.Math.Distance.Between(s.x, s.y + 8, c.x, c.y);
    const dHome = Phaser.Math.Distance.Between(s.x, s.y, this.home.x, this.home.y);
    const cfg = CONFIG.flyer;

    if (this.state === 'rest' && now > this.restUntil) this.state = 'return';
    if (this.state === 'idle' && dPlayer < cfg.notice && !this.game.isBusy()) this.state = 'chase';

    if (this.state === 'chase') {
      if (dHome > cfg.leash || dPlayer > cfg.notice * 1.5) {
        this.state = 'return';
      } else if (dPlayer < 20) {
        this.game.bumpPerson();
        this.game.holdPlayer(cfg.holdMs);
        this.game.say(s.x, s.y - 22, TEXTS.flyerSay, cfg.holdMs);
        Sound.play('locked');
        this.state = 'rest';
        this.restUntil = now + cfg.restMs;
        s.setVelocity(0, 0);
      } else {
        this.moveToward(c.x, c.y - 8);
      }
    }
    if (this.state === 'return') {
      if (dHome < 3) {
        s.setVelocity(0, 0);
        this.state = 'idle';
      } else {
        this.moveToward(this.home.x, this.home.y);
      }
    }
    if (this.state === 'idle' || this.state === 'rest') s.setVelocity(0, 0);

    faceWalk(s, s.body.velocity.x, s.body.velocity.y);
    this.paper.setPosition(s.x + (s.flipX ? -10 : 10), s.y + 4);
  }
}

// ── 爆走デリバリー: 큰길을 빠르게 지나감 ─────────────────
export class BikeLane {
  constructor(game, y, dir) {
    this.game = game;
    this.y = y;
    this.dir = dir;
    this.bikes = [];
    this.nextAt = game.time.now + Phaser.Math.Between(500, CONFIG.bike.maxGapMs);
  }

  spawn() {
    const g = this.game;
    const x = this.dir > 0 ? -40 : g.worldW + 40;
    const bike = g.physics.add.image(x, this.y - 4, 'bike').setDepth(12).setFlipX(this.dir < 0);
    bike.setScale(46 / bike.width);
    const w = bike.width;
    const h = bike.height;
    bike.body.setSize(w * 0.75, h * 0.45).setOffset(w * 0.125, h * 0.5);
    bike.setVelocityX(this.dir * CONFIG.bike.speed);
    this.bikes.push(bike);
  }

  update(now) {
    if (now > this.nextAt) {
      this.spawn();
      this.nextAt = now + Phaser.Math.Between(CONFIG.bike.minGapMs, CONFIG.bike.maxGapMs);
    }
    const g = this.game;
    this.bikes = this.bikes.filter((b) => {
      if (b.x < -80 || b.x > g.worldW + 80) {
        b.destroy();
        return false;
      }
      if (g.physics.overlap(b, g.player)) g.hitByBike();
      return true;
    });
  }
}

// ── ハトの群れ: 빨리 지나가면 날아올라 화면을 가림 ───────────
export class Pigeons {
  constructor(game, x, y) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.birds = [[-10, -4], [8, -8], [2, 8]].map(([dx, dy]) => {
      const b = game.add.sprite(x + dx, y + dy, 'pigeon', 0).setDepth(9);
      b.setScale(18 / b.height);
      b.home = { x: x + dx, y: y + dy };
      return b;
    });
    this.sit();
  }

  sit() {
    this.state = 'sit';
    this.birds.forEach((b, i) => {
      this.game.tweens.killTweensOf(b);
      b.setPosition(b.home.x, b.home.y).setAlpha(1).setFrame(0).setFlipX(i % 2 === 1);
      this.game.tweens.add({ targets: b, y: b.home.y + 2, duration: 300 + i * 90, yoyo: true, repeat: -1 });
    });
  }

  fly(now) {
    this.state = 'gone';
    this.returnAt = now + CONFIG.pigeon.returnMs;
    this.birds.forEach((b) => {
      this.game.tweens.killTweensOf(b);
      b.setFrame(1);
      const a = Phaser.Math.FloatBetween(-Math.PI * 0.9, -Math.PI * 0.1);
      this.game.tweens.add({
        targets: b, x: b.x + Math.cos(a) * 130, y: b.y + Math.sin(a) * 130, alpha: 0, duration: 900,
      });
    });
    this.game.events.emit('pigeons');
  }

  update(now) {
    const p = this.game.player;
    const c = p.body.center;
    const d = Phaser.Math.Distance.Between(this.x, this.y, c.x, c.y);
    if (this.state === 'sit') {
      const fast = p.body.speed > CONFIG.player.speed * CONFIG.pigeon.calmSpeed;
      if (d < CONFIG.pigeon.range && fast) this.fly(now);
    } else if (now > this.returnAt && d > 120) {
      this.sit();
    }
  }
}

// ── 人だかり: 버스킹 구경꾼. 근처는 느려짐 ────────────────
export class Crowd {
  constructor(game, x, y, seed) {
    this.x = x;
    this.y = y;
    this.sprite = makePerson(game, 'crowd', x, y, seed % NPC_COUNT, 'up').setDepth(9);
    if (!ART.obstacles) this.sprite.setTexture(`npc${seed % NPC_COUNT}-up`, 0);
    game.tweens.add({
      targets: this.sprite, y: y - 3, duration: 260 + (seed % 4) * 40, yoyo: true, repeat: -1,
      delay: (seed % 5) * 70,
    });
  }

  contains(px, py) {
    return Phaser.Math.Distance.Between(this.x, this.y + 6, px, py) < CONFIG.crowd.range;
  }
}

// ── 길 가는 사람: 골목을 오가는 보통 사람. 부딪혀도 체력은 그대로 ─────
// 갈림길마다 갈 길을 고르고, 진행 방향의 오른쪽으로 비켜 걸어서 마주 오는 사람과 엇갈림.
// 플레이어를 밀지 않음: 앞을 막으면 멈췄다가, 오래 막으면 돌아감.
const DIRS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

export class Walker {
  constructor(game, cx, cy, seed) {
    const cfg = CONFIG.walker;
    this.game = game;
    this.cx = cx; // 지금 향하는 글자 칸
    this.cy = cy;
    this.dir = null;
    this.speed = Phaser.Math.Between(cfg.speedMin, cfg.speedMax);
    this.lane = Phaser.Math.Between(4, cfg.side);
    this.waited = 0;
    const p = this.cellXY(cx, cy, null);
    this.x = p.x;
    this.y = p.y;
    this.sprite = makePerson(game, 'crowd', p.x, p.y, seed % NPC_COUNT, 'down', true);
    this.sprite.body.setImmovable(true);
    game.physics.add.collider(game.player, this.sprite);
    this.pickNext();
  }

  // 글자 칸 가운데에서 진행 방향 오른쪽으로 lane만큼 비킨 자리
  cellXY(cx, cy, dir) {
    const cell = CELL();
    const x = (cx + 0.5) * cell;
    const y = (cy + 0.5) * cell;
    if (!dir) return { x, y };
    return dir.x ? { x, y: y + this.lane * dir.x } : { x: x - this.lane * dir.y, y };
  }

  goTo(dir) {
    this.dir = dir;
    this.cx += dir.x;
    this.cy += dir.y;
    this.target = this.cellXY(this.cx, this.cy, dir);
  }

  // 다음 칸 고르기: 되돌아가지 않고, 곧은 길이면 그대로 가는 일이 많게
  pickNext() {
    const g = this.game;
    const open = DIRS.filter((d) => g.isWalkCell(this.cx + d.x, this.cy + d.y));
    const back = (d) => this.dir && d.x === -this.dir.x && d.y === -this.dir.y;
    const ahead = open.filter((d) => !back(d));
    const choices = ahead.length ? ahead : open;
    if (!choices.length) {
      this.dir = null;
      return;
    }
    const straight = this.dir && choices.find((d) => d.x === this.dir.x && d.y === this.dir.y);
    this.goTo(straight && Math.random() < 0.6 ? straight : Phaser.Utils.Array.GetRandom(choices));
  }

  turnBack() {
    const d = this.dir;
    this.cx -= d.x;
    this.cy -= d.y;
    this.goTo({ x: -d.x, y: -d.y });
  }

  // 발 자리 (플레이어를 밀지 않게 미리 확인용)
  blocksPlayer(x, y) {
    const feet = new Phaser.Geom.Rectangle(x - 10, y + 1, 20, 12);
    return Phaser.Geom.Intersects.RectangleToRectangle(feet, playerRect(this.game.player));
  }

  update(dt) {
    const s = this.sprite;
    if (!this.dir) return;
    const step = (this.speed * dt) / 1000;
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const d = Math.hypot(dx, dy);
    const arrive = d <= step;
    const nx = arrive ? this.target.x : this.x + (dx / d) * step;
    const ny = arrive ? this.target.y : this.y + (dy / d) * step;
    if (this.blocksPlayer(nx, ny)) {
      this.waited += dt;
      if (this.waited > CONFIG.walker.waitMs) {
        this.waited = 0;
        this.turnBack();
      }
      faceWalk(s, 0, 0);
      return;
    }
    this.waited = 0;
    this.x = nx;
    this.y = ny;
    s.body.reset(nx, ny);
    faceWalk(s, dx, dy);
    if (arrive) this.pickNext();
  }
}

// ── 行列: 줄 서서 막고 있다가 일정 시간마다 흩어져 길이 열림 ─────
export class Queue {
  constructor(game, tiles, seed) {
    this.game = game;
    this.zones = [];
    this.people = [];
    this.closed = true;
    this.bumpAt = -Infinity;
    const size = CELL();
    let n = seed;
    for (const t of tiles) {
      const zone = game.add.zone(t.x, t.y, size, size);
      game.physics.add.existing(zone, true);
      game.physics.add.collider(game.player, zone, () => this.bump(), () => this.closed);
      this.zones.push(zone);
      for (const dx of [-22, -8, 8, 22]) { // 골목 폭을 꽉 채워 줄 섬
        const sp = makePerson(game, 'crowd', t.x + dx, t.y - 4, n++ % NPC_COUNT, 'up');
        sp.home = { x: sp.x, y: sp.y };
        sp.side = dx;
        this.people.push(sp);
      }
    }
    const cx = tiles.reduce((a, t) => a + t.x, 0) / tiles.length;
    const cy = tiles.reduce((a, t) => a + t.y, 0) / tiles.length;
    this.center = { x: cx, y: cy };
    this.label = game.add.text(cx, cy - 30, '', {
      fontFamily: CONFIG.font, fontSize: '11px', color: '#ffffff', backgroundColor: '#1a1530dd',
      padding: { x: 4, y: 2 }, resolution: 4,
    }).setOrigin(0.5).setDepth(20).setVisible(false);
    this.t0 = game.time.now + seed * 700; // 행렬마다 박자를 조금씩 다르게
  }

  bump() {
    this.game.bumpPerson();
    const now = this.game.time.now;
    if (now - this.bumpAt < 3000) return;
    this.bumpAt = now;
    this.game.events.emit('toast', TEXTS.queueBlocked);
  }

  setClosed(closed) {
    this.closed = closed;
    this.people.forEach((p) => {
      this.game.tweens.killTweensOf(p);
      this.game.tweens.add({
        targets: p,
        x: closed ? p.home.x : p.home.x + Math.sign(p.side) * 14,
        alpha: closed ? 1 : 0.25,
        duration: 350,
      });
    });
  }

  // 「すみません」: 줄 선 사람들이 잠깐 비켜 줌
  trySumimasen(now) {
    if (!this.closed) return false;
    const c = this.game.player.body.center;
    if (Phaser.Math.Distance.Between(c.x, c.y, this.center.x, this.center.y) > CONFIG.sumimasen.range) return false;
    this.yieldUntil = now + CONFIG.queue.yieldMs;
    this.setClosed(false);
    this.game.say(this.center.x, this.center.y - 24, TEXTS.queueYield, 1200);
    return true;
  }

  overlapsPlayer() {
    const pr = playerRect(this.game.player);
    return this.zones.some((z) => Phaser.Geom.Intersects.RectangleToRectangle(z.getBounds(), pr));
  }

  update(now) {
    const { closedMs, openMs } = CONFIG.queue;
    const t = (((now - this.t0) % (closedMs + openMs)) + closedMs + openMs) % (closedMs + openMs);
    const wantClosed = t < closedMs && !(now < this.yieldUntil);
    if (wantClosed !== this.closed) {
      // 닫힐 때 플레이어가 줄 한가운데 있으면 지나갈 때까지 기다림
      if (!(wantClosed && this.overlapsPlayer())) this.setClosed(wantClosed);
    }
    const c = this.game.player.body.center;
    const near = Phaser.Math.Distance.Between(c.x, c.y, this.center.x, this.center.y) < CONFIG.queue.noticeRange;
    if (this.closed && near) {
      this.label.setText(TEXTS.queueWait(Math.ceil((closedMs - t) / 1000))).setVisible(true);
    } else {
      this.label.setVisible(false);
    }
  }
}
