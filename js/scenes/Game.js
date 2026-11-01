import { CONFIG } from '../config.js';
import { TEXTS } from '../texts.js';
import { makeTextures, TILE, ROOF_COLORS, BLOCKING_TILES, NEON } from '../art.js';
import { MAP, SHOPS, STATION_SIGN, STAMP_SHOPS, LANDMARKS, GATE_SIGN } from '../map.js';
import { Player } from '../objects/Player.js';
import { Tour, Flyer, BikeLane, Pigeons, Crowd, Queue, Walker, makeNpcAnims } from '../objects/Obstacles.js';
import { FoodStall } from '../objects/Food.js';
import { Sound } from '../sound.js';

const SOLID_CHARS = '#TEU';
const STAMP_IDS = ['1', '2', '3', '4', '5'];
const FOOD_CHARS = 'thobm';
const NEON_RED = '#ff5a7a';
const GATE_RISE = 48; // 홍익대 정문이 맵 위쪽 끝보다 솟아오른 높이 (픽셀)
const KOREAN_FONT = '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';

// 좌표로 정해지는 의사 난수 (매번 같은 결과 → 간판·색이 새로고침해도 그대로)
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// 게임 본편 (월드). 화면 위 표시·조이스틱은 UI 장면이 맡는다.
// UI 장면에는 이벤트로 알림:
//   'stamp'(id, 모은 개수)  'toast'(문구)  'hp'(체력)  'pigeons'()
//   'lost'()  'respawn'()  'goal'({ ms, hp })
export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    makeTextures(this);
    makeNpcAnims(this);

    const size = CONFIG.tile;
    const k = CONFIG.cellTiles; // 맵 글자 한 칸 = k×k 타일
    const cell = size * k;
    const rows = MAP.length * k;
    const cols = MAP[0].length * k;
    const charAt = (x, y) => (MAP[y] && MAP[y][x]) || '#'; // 글자 칸 좌표
    this.charAt = charAt;
    const tileChar = (tx, ty) => charAt(Math.floor(tx / k), Math.floor(ty / k)); // 타일 좌표
    const isSolid = (tx, ty) => SOLID_CHARS.includes(tileChar(tx, ty));
    const isRoad = (tx, ty) => ty >= 0 && ty < rows && '=D'.includes(tileChar(tx, ty));

    // 물건 자리 모으기 (글자 칸 가운데)
    const spots = {};
    const things = [];
    MAP.forEach((line, y) => [...line].forEach((ch, x) => {
      const pos = { x: (x + 0.5) * cell, y: (y + 0.5) * cell };
      if ('P12345V'.includes(ch)) spots[ch] = pos;
      else if ('GKDHCX'.includes(ch) || FOOD_CHARS.includes(ch)) things.push({ ch, ...pos });
    }));

    // 글자 격자 → 타일 번호
    const data = [];
    const facades = [];
    for (let y = 0; y < rows; y++) {
      const row = [];
      for (let x = 0; x < cols; x++) {
        const ch = tileChar(x, y);
        if (ch === '#') {
          if (!isSolid(x, y + 1) && y + 1 < rows) facades.push({ x, y }); // 가게 앞면은 아래에서 정함
          row.push(TILE.ROOF + (hash(Math.floor(x / 3), Math.floor(y / 3)) % ROOF_COLORS));
        } else if (ch === 'U') {
          row.push(TILE.ROOF); // 위에 정문 그림을 얹음
        } else if (ch === 'T') {
          row.push(TILE.TREE);
        } else if (ch === 'E') {
          row.push(TILE.STATION);
        } else if (ch === '=' || ch === 'D') {
          // 큰길 한가운데 줄에만 노란 점선
          let up = 0;
          let down = 0;
          while (isRoad(x, y - up - 1)) up++;
          while (isRoad(x, y + down + 1)) down++;
          const middle = up > 0 && (down === up || down - up === 1);
          row.push(middle && x % 2 === 0 ? TILE.ROAD_LINE : TILE.ROAD);
        } else if (ch === 'R' || (ch !== '.' && (charAt(Math.floor(x / k) - 1, Math.floor(y / k)) === 'R'
          || charAt(Math.floor(x / k) + 1, Math.floor(y / k)) === 'R'))) {
          row.push(TILE.RED_ROAD); // 레드로드 위 물건 자리도 빨간 바닥으로
        } else {
          row.push(TILE.ALLEY);
        }
      }
      data.push(row);
    }

    // 가게 정하기: 앞면 한 덩어리(최대 3칸) = 가게 하나
    const shops = this.planShops(facades, spots);
    for (const shop of shops) {
      for (const t of shop.tiles) data[t.y][t.x] = TILE.FACADE + shop.index;
    }

    const map = this.make.tilemap({ data, tileWidth: size, tileHeight: size });
    const tiles = map.addTilesetImage('tiles');
    this.layer = map.createLayer(0, tiles, 0, 0);
    this.layer.setCollision(BLOCKING_TILES);

    this.addSigns(shops, tileChar);
    this.addLandmarks();
    this.addGate();
    this.cameras.main.setBackgroundColor('#120e24');

    this.worldW = cols * size;
    this.worldH = rows * size;
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);

    const start = spots.P || { x: cell * 1.5, y: cell * 1.5 };
    this.player = new Player(this, start.x, start.y);
    this.physics.add.collider(this.player, this.layer);

    this.addStamps(spots);
    this.addVan(spots.V);
    this.addThings(things);
    this.addWalkers(start);

    this.arrow = this.add.image(0, 0, 'arrow').setScale(2).setDepth(20).setVisible(false);

    const cam = this.cameras.main;
    cam.setZoom(CONFIG.zoom * CONFIG.res); // 실제로 그리는 배율(res)만큼 더 키움
    // 위쪽 상태판에 맵 윗줄이 가리지 않도록 그만큼 위로 더 스크롤되게
    const topPad = CONFIG.topBarHeight / CONFIG.zoom + GATE_RISE + 8; // 맵 위로 솟은 정문까지 보이게
    cam.setBounds(0, -topPad, this.worldW, this.worldH + topPad);
    cam.startFollow(this.player, true, 0.15, 0.15);
    cam.setRoundPixels(true);

    this.keys = this.input.keyboard.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,SHIFT,SPACE');
    this.keys.SPACE.on('down', () => this.events.emit('sumimasenKey'));

    this.startedAt = Date.now();
    this.finishedAt = null;
    this.lastProgressAt = this.time.now;
    this.lockedMsgAt = -Infinity;
    this.finished = false;
    this.lostState = false;
    this.checkpoint = { ...start };
    this.hp = CONFIG.health.max;
    this.walkMs = 0;
    this.heldUntil = 0;
    this.invincibleUntil = 0;
    this.bumpReadyAt = 0;
    this.speedUpUntil = 0;

    this.scene.launch('UI');
    this.ui = this.scene.get('UI');
  }

  elapsed() {
    return (this.finishedAt || Date.now()) - this.startedAt;
  }

  isOpenTile(tx, ty) {
    const t = this.layer.getTileAt(tx, ty);
    return !!t && !t.collides;
  }

  // 붙잡힘·迷子 화면·골인 중이면 true
  isBusy() {
    return this.finished || this.lostState || this.time.now < this.heldUntil;
  }

  addThings(things) {
    this.tours = [];
    this.flyers = [];
    this.lanes = [];
    this.pigeons = [];
    this.crowd = [];
    this.queues = [];
    this.stalls = [];
    let seed = 0;
    const queueTiles = [];
    for (const t of things) {
      seed++;
      if (t.ch === 'G') this.tours.push(new Tour(this, t.x, t.y, seed));
      else if (t.ch === 'K') this.flyers.push(new Flyer(this, t.x, t.y, seed));
      else if (t.ch === 'D') this.lanes.push(new BikeLane(this, t.y, t.x < this.worldW / 2 ? 1 : -1));
      else if (t.ch === 'H') this.pigeons.push(new Pigeons(this, t.x, t.y));
      else if (t.ch === 'C') this.crowd.push(new Crowd(this, t.x, t.y, seed));
      else if (t.ch === 'X') queueTiles.push(t);
      else this.stalls.push(new FoodStall(this, t.x, t.y, t.ch));
    }
    // 붙어 있는 X 칸끼리 한 줄(행렬)로 묶음
    const left = new Set(queueTiles);
    while (left.size) {
      const first = left.values().next().value;
      left.delete(first);
      const group = [first];
      for (let i = 0; i < group.length; i++) {
        for (const o of [...left]) {
          if (Math.abs(o.x - group[i].x) + Math.abs(o.y - group[i].y) <= CONFIG.tile * CONFIG.cellTiles) {
            left.delete(o);
            group.push(o);
          }
        }
      }
      this.queues.push(new Queue(this, group, this.queues.length));
    }
  }

  // 길 가는 사람이 다닐 수 있는 글자 칸 (골목·레드로드·물건 자리. 큰길·행렬·밴·건물은 빼고)
  isWalkCell(cx, cy) {
    const ch = this.charAt(cx, cy);
    return !(SOLID_CHARS + '=DXV').includes(ch);
  }

  // 길 가는 보통 사람들을 골목 여기저기에 흩어 놓음 (출발 지점 바로 옆은 빼고)
  addWalkers(start) {
    this.walkers = [];
    const cell = CONFIG.tile * CONFIG.cellTiles;
    const sx = Math.floor(start.x / cell);
    const sy = Math.floor(start.y / cell);
    const cells = [];
    MAP.forEach((line, y) => [...line].forEach((ch, x) => {
      if ('.R'.includes(ch) && Math.abs(x - sx) + Math.abs(y - sy) > 2) cells.push({ x, y });
    }));
    Phaser.Utils.Array.Shuffle(cells);
    cells.slice(0, CONFIG.walker.count).forEach((c, i) => this.walkers.push(new Walker(this, c.x, c.y, i)));
  }

  addStamps(spots) {
    this.stamps = [];
    this.collected = new Set();
    for (const id of STAMP_IDS) {
      const pos = spots[id];
      if (!pos) continue;
      const img = this.add.image(pos.x, pos.y, `stamp-${id}`).setDisplaySize(26, 26).setDepth(8);
      this.tweens.add({ targets: img, y: pos.y - 5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.stamps.push({ id, x: pos.x, y: pos.y, img });
    }
  }

  addVan(pos) {
    if (!pos) return;
    // 밴은 V 칸에서 오른쪽으로 조금 걸쳐 서 있음
    const van = this.physics.add.staticImage(pos.x + CONFIG.tile / 2, pos.y - 2, 'van').setDepth(9);
    const w = 96; // 그림 크기와 상관없이 맵에서는 가로 96픽셀 (시바견의 3배쯤)
    van.setDisplaySize(w, (w * van.height) / van.width);
    van.refreshBody();
    van.body.setSize(84, 20).setOffset((van.displayWidth - 84) / 2, van.displayHeight - 24);
    this.van = van;
    this.physics.add.collider(this.player, van);
    // 차 옆면 흰 판에 「ポカポカ」 (그림이 아니라 코드로 얹는 글자)
    this.add.text(van.x + 3, van.y + van.displayHeight * 0.1, TEXTS.vanLabel, {
      fontFamily: CONFIG.font, fontSize: '11px', fontStyle: 'bold', color: '#ff6a2a', resolution: 4,
    }).setOrigin(0.5).setDepth(9);
    // 문이 열리면 반짝반짝
    this.vanGlow = this.add.circle(van.x, van.y, 60, 0xffd23f, 0).setDepth(8).setBlendMode('ADD');
  }

  // 머리 위 말풍선
  say(x, y, text, ms = 1200) {
    const t = this.add.text(x, y, text, {
      fontFamily: CONFIG.font, fontSize: '11px', color: '#3b2a20', backgroundColor: '#ffffffee',
      padding: { x: 5, y: 3 }, resolution: 4,
    }).setOrigin(0.5, 1).setDepth(30);
    this.tweens.add({ targets: t, y: y - 6, duration: 200 });
    this.time.delayedCall(ms, () => t.destroy());
  }

  floatText(x, y, text, color) {
    const t = this.add.text(x, y, text, {
      fontFamily: CONFIG.font, fontSize: '13px', fontStyle: 'bold', color, stroke: '#ffffff',
      strokeThickness: 3, resolution: 4,
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: t, y: y - 28, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  // 플레이어 머리 위 높이
  headY() {
    return this.player.y - this.player.displayHeight + 4;
  }

  // 「すみません」: 근처 단체 관광객·맛집 행렬이 비켜 줌
  sumimasen() {
    if (this.isBusy()) return false;
    const now = this.time.now;
    this.say(this.player.x, this.headY(), TEXTS.sumimasenSay, 900);
    let any = false;
    for (const t of this.tours) any = t.trySumimasen(now) || any;
    for (const q of this.queues) any = q.trySumimasen(now) || any;
    return any;
  }

  holdPlayer(ms) {
    this.heldUntil = this.time.now + ms;
    this.player.move(0, 0);
  }

  setHp(value) {
    this.hp = Phaser.Math.Clamp(value, 0, CONFIG.health.max);
    this.events.emit('hp', this.hp);
    if (this.hp <= 0 && !this.lostState && !this.finished) this.lose();
  }

  // 사람과 부딪힘: 조금 아프다 (연달아 깎이지 않게 잠깐 쉼)
  bumpPerson(amount = CONFIG.bump.damage) {
    const now = this.time.now;
    if (now < this.bumpReadyAt || now < this.invincibleUntil || this.isBusy()) return;
    this.bumpReadyAt = now + CONFIG.bump.cooldownMs;
    Sound.play('locked');
    this.floatText(this.player.x, this.headY(), `-${amount}`, NEON_RED);
    this.tweens.add({ targets: this.player, alpha: 0.4, duration: 80, yoyo: true, repeat: 1 });
    this.setHp(this.hp - amount);
  }

  hitByBike() {
    const now = this.time.now;
    if (now < this.invincibleUntil || this.isBusy()) return;
    this.invincibleUntil = now + CONFIG.bike.invincibleMs;
    Sound.play('hit');
    this.cameras.main.shake(180, 0.006);
    this.floatText(this.player.x, this.headY(), `-${CONFIG.bike.damage}`, NEON_RED);
    this.events.emit('toast', TEXTS.bikeHit);
    this.tweens.add({ targets: this.player, alpha: 0.3, duration: 100, yoyo: true, repeat: 5 });
    this.setHp(this.hp - CONFIG.bike.damage);
  }

  eat(type, x, y) {
    const food = CONFIG.food[type];
    Sound.play('eat');
    this.floatText(x, y - 24, `+${food.heal}`, '#3a8f6a');
    this.setHp(this.hp + food.heal);
    if (food.speedUp) {
      this.speedUpUntil = this.time.now + food.speedMs;
      this.events.emit('toast', `${TEXTS.foodEat(TEXTS.foodNames[type], food.heal)}\n${TEXTS.speedUp}`);
    } else {
      this.events.emit('toast', TEXTS.foodEat(TEXTS.foodNames[type], food.heal));
    }
  }

  // 체력 0: 「迷子になった…」 → 마지막 스탬프 자리에서 체력 60으로 다시 (시계는 계속)
  lose() {
    this.lostState = true;
    this.player.move(0, 0);
    this.arrow.setVisible(false);
    Sound.play('hit');
    this.events.emit('lost');
    this.time.delayedCall(CONFIG.health.lostScreenMs, () => {
      this.player.body.reset(this.checkpoint.x, this.checkpoint.y);
      this.player.setAlpha(1);
      this.lostState = false;
      this.invincibleUntil = this.time.now + CONFIG.bike.invincibleMs;
      this.lastProgressAt = this.time.now;
      this.setHp(CONFIG.health.respawnHp);
      this.events.emit('respawn');
    });
  }

  collectStamp(stamp) {
    this.collected.add(stamp.id);
    this.checkpoint = { x: stamp.x, y: stamp.y };
    this.lastProgressAt = this.time.now;
    this.arrow.setVisible(false);
    this.tweens.killTweensOf(stamp.img);
    stamp.img.destroy();
    this.events.emit('stamp', stamp.id, this.collected.size);
    const all = this.collected.size === this.stamps.length;
    if (all && this.van) {
      this.van.setTexture('van-open');
      this.tweens.add({ targets: this.vanGlow, fillAlpha: 0.35, duration: 600, yoyo: true, repeat: -1 });
    }

    // 사장님이 나와서 도장을 찍어 주는 연출. 그동안 게임은 멈춤 (시계는 계속 감)
    this.player.move(0, 0);
    this.scene.pause('UI');
    this.scene.pause();
    this.scene.launch('StampEvent', {
      id: stamp.id,
      count: this.collected.size,
      total: this.stamps.length,
      collected: [...this.collected],
      hint: this.nextHint(),
    });
  }

  onStampEventDone() {
    this.ui.joystick.reset();
    this.scene.resume('UI');
    this.scene.resume();
    this.lastProgressAt = this.time.now;
    if (this.collected.size === this.stamps.length) this.events.emit('toast', TEXTS.allStamps);
  }

  // 사장님이 말해 주는 다음 장소 힌트 (가장 가까운 남은 스탬프, 다 모았으면 밴)
  nextHint() {
    const c = this.player.body.center;
    const left = this.stamps.filter((s) => !this.collected.has(s.id));
    const targets = left.length ? left : [this.van];
    let best = null;
    let bestD = Infinity;
    for (const t of targets) {
      const d = Phaser.Math.Distance.Between(c.x, c.y, t.x, t.y);
      if (d < bestD) { bestD = d; best = t; }
    }
    if (!best) return '';
    const sector = Math.round(Phaser.Math.Angle.Between(c.x, c.y, best.x, best.y) / (Math.PI / 4));
    const names = { 0: 'right', 1: 'downRight', 2: 'down', 3: 'downLeft', 4: 'left', '-4': 'left',
      '-1': 'upRight', '-2': 'up', '-3': 'upLeft' };
    const dir = TEXTS.dirs[names[sector]];
    return left.length ? TEXTS.hintNext(TEXTS.placeNames[best.id], dir) : TEXTS.hintVan(dir);
  }

  checkVan() {
    if (!this.van) return;
    const c = this.player.body.center;
    if (Phaser.Math.Distance.Between(c.x, c.y, this.van.x, this.van.y) > CONFIG.van.reach) return;
    const left = this.stamps.length - this.collected.size;
    if (left === 0) {
      this.finish();
    } else if (this.time.now - this.lockedMsgAt > CONFIG.van.lockedMsgEvery) {
      this.lockedMsgAt = this.time.now;
      Sound.play('locked');
      this.events.emit('toast', TEXTS.vanLocked(left));
    }
  }

  finish() {
    this.finished = true;
    this.finishedAt = Date.now();
    this.player.move(0, 0);
    this.arrow.setVisible(false);
    Sound.play('clear');
    this.events.emit('goal', { ms: this.elapsed(), hp: this.hp });
  }

  // 오래 못 찾으면 가장 가까운 남은 스탬프(다 모았으면 밴) 쪽으로 화살표
  updateGuide() {
    const now = this.time.now;
    if (!this.arrow.visible && now - this.lastProgressAt > CONFIG.guide.idleMs) {
      this.arrow.setVisible(true);
      this.arrowUntil = now + CONFIG.guide.showMs;
    }
    if (!this.arrow.visible) return;
    if (now > this.arrowUntil) {
      this.arrow.setVisible(false);
      this.lastProgressAt = now; // 다음 화살표는 다시 30초 뒤
      return;
    }
    const c = this.player.body.center;
    const left = this.stamps.filter((s) => !this.collected.has(s.id));
    const targets = left.length ? left : [this.van];
    let best = null;
    let bestD = Infinity;
    for (const t of targets) {
      const d = Phaser.Math.Distance.Between(c.x, c.y, t.x, t.y);
      if (d < bestD) { bestD = d; best = t; }
    }
    if (!best) return;
    const angle = Phaser.Math.Angle.Between(c.x, c.y, best.x, best.y);
    const bob = Math.sin(now / 120) * 4;
    this.arrow.setPosition(c.x + Math.cos(angle) * (30 + bob), c.y - 8 + Math.sin(angle) * (30 + bob));
    this.arrow.setRotation(angle);
  }

  // 가게 정하기: 같은 줄에 이어진 앞면을 최대 3칸씩 끊어 가게 하나로.
  // 스탬프 장소에서 가장 가까운 가게는 그 장소 종류(코스메·버스킹·…)로 바꿈.
  planShops(facades, spots) {
    const size = CONFIG.tile;
    const sorted = [...facades].sort((a, b) => a.y - b.y || a.x - b.x);
    const runs = [];
    for (const f of sorted) {
      const last = runs[runs.length - 1];
      if (last && last[0].y === f.y && last[last.length - 1].x === f.x - 1) last.push(f);
      else runs.push([f]);
    }
    const shops = [];
    const normal = SHOPS.map((s, i) => i).filter((i) => !SHOPS[i].only);
    for (const run of runs) {
      for (let i = 0; i < run.length;) {
        const left = run.length - i;
        const n = left === 4 ? 2 : Math.min(3, left);
        const tiles = run.slice(i, i + n);
        i += n;
        const x0 = tiles[0].x;
        const y = tiles[0].y;
        shops.push({
          tiles, y,
          cx: (x0 + n / 2) * size,
          index: normal[hash(x0, y) % normal.length],
        });
      }
    }
    for (const [id, type] of Object.entries(STAMP_SHOPS)) {
      const spot = spots[id];
      if (!spot) continue;
      let best = null;
      let bestD = Infinity;
      for (const s of shops) {
        const d = Phaser.Math.Distance.Between(s.cx, (s.y + 0.5) * size, spot.x, spot.y);
        if (d < bestD) { bestD = d; best = s; }
      }
      if (best && bestD < size * 6) {
        best.index = SHOPS.findIndex((s) => s.type === type);
        best.stamp = true;
      }
    }
    return shops;
  }

  // 네온 간판 하나: 빈 간판 판(그림 또는 코드로 그린 판) + 코드로 얹는 한글 글자 + 바닥에 비친 불빛
  neonSign(cx, cy, word, color, { vertical = false, big = false, huge = false, reflectY = null } = {}) {
    const text = this.add.text(cx, cy, vertical ? [...word].join('\n') : word, {
      fontFamily: KOREAN_FONT,
      fontSize: huge ? '16px' : big ? '13px' : '11px',
      fontStyle: 'bold',
      color,
      align: 'center',
      lineSpacing: -2,
      resolution: 4,
    }).setOrigin(0.5).setDepth(6).setShadow(0, 0, color, 5, false, true);
    const bw = text.width + 6;
    const bh = text.height + 3;
    const boardKey = vertical ? 'sign-v' : 'sign-h';
    const num = Phaser.Display.Color.HexStringToColor(color).color;
    if (this.textures.exists(boardKey)) {
      this.add.image(cx, cy, boardKey).setDisplaySize(bw, bh).setDepth(5);
    } else {
      const g = this.add.graphics().setDepth(5);
      g.fillStyle(0x120e24, 0.92);
      g.fillRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 3);
      g.lineStyle(2, num, 0.95);
      g.strokeRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 3);
    }
    // 젖은 길바닥에 비친 간판 불빛
    if (reflectY !== null) {
      this.add.ellipse(cx, reflectY, bw + 10, 12, num, 0.22).setDepth(1).setBlendMode('ADD');
    }
    return text;
  }

  // 홍대 명소 표지판: 큰 한글 네온 + 아래에 작은 일본어 이름
  addLandmarks() {
    const cell = CONFIG.tile * CONFIG.cellTiles;
    const flashColors = [NEON.pink, NEON.cyan, NEON.yellow, NEON.purple];
    for (const lm of LANDMARKS) {
      const x = lm.x * cell;
      const y = lm.y * cell;
      const text = this.neonSign(x, y, lm.word, lm.color, { huge: true, reflectY: y + cell * 0.7 });
      this.add.text(x, y + 15, TEXTS.landmarks[lm.id], {
        fontFamily: CONFIG.font, fontSize: '9px', fontStyle: 'bold', color: '#ffffff',
        backgroundColor: '#120e24cc', padding: { x: 3, y: 1 }, resolution: 4,
      }).setOrigin(0.5, 0).setDepth(6);
      if (lm.flash) { // 클럽 조명처럼 색이 바뀜
        let i = 0;
        this.time.addEvent({
          delay: 450,
          loop: true,
          callback: () => {
            const c = flashColors[i++ % flashColors.length];
            text.setColor(c).setShadow(0, 0, c, 5, false, true);
          },
        });
      }
    }
  }

  // 홍익대학교 정문 (맵 글자 U): 벽돌 기둥 두 개 + 학교 이름 판 + 안쪽 캠퍼스 불빛
  addGate() {
    const cell = CONFIG.tile * CONFIG.cellTiles;
    const row = MAP.findIndex((line) => line.includes('U'));
    if (row < 0) return;
    const x0 = MAP[row].indexOf('U') * cell;
    const x1 = (MAP[row].lastIndexOf('U') + 1) * cell;
    const w = x1 - x0;
    const top = row * cell;
    const bottom = top + cell;
    const g = this.add.graphics().setDepth(4);
    g.fillStyle(0x1a1430).fillRect(x0, top, w, cell);
    g.fillStyle(0x2c2650).fillRect(x0 + 34, top + 24, w - 68, cell - 24); // 캠퍼스 건물
    for (let i = 0; i < 9; i++) {
      g.fillStyle(i % 3 ? 0xffd27a : 0x9ad8ff, 0.9).fillRect(x0 + 44 + i * 28, top + 32 + (i % 2) * 12, 8, 6);
    }
    const plate = top - GATE_RISE; // 학교 이름 판은 맵 위로 솟음
    for (const px of [x0 + 4, x1 - 30]) { // 벽돌 기둥
      g.fillStyle(0x8a3a30).fillRect(px, plate + 20, 26, bottom - plate - 20);
      g.fillStyle(0xb0503e);
      for (let by = plate + 28, n = 0; by < bottom - 2; by += 7, n++) g.fillRect(px + (n % 2 ? 2 : 12), by, 12, 3);
      g.fillStyle(0xffe08a).fillCircle(px + 13, top + 30, 4); // 등
    }
    g.fillStyle(0x3b2a20).fillRect(x0 - 6, plate, w + 12, 26); // 학교 이름 판
    g.lineStyle(2, 0xffd23f).strokeRect(x0 - 5, plate + 1, w + 10, 24);
    this.add.text(x0 + w / 2, plate + 13, GATE_SIGN, {
      fontFamily: KOREAN_FONT, fontSize: '16px', fontStyle: 'bold', color: '#fff6e6', resolution: 4,
    }).setOrigin(0.5).setDepth(5).setShadow(0, 0, NEON.yellow, 6, false, true);
    this.add.text(x0 + w / 2, bottom - 2, TEXTS.landmarks.gate, {
      fontFamily: CONFIG.font, fontSize: '9px', fontStyle: 'bold', color: '#ffffff',
      backgroundColor: '#120e24cc', padding: { x: 3, y: 1 }, resolution: 4,
    }).setOrigin(0.5, 1).setDepth(6);
    this.add.ellipse(x0 + w / 2, bottom + 12, w, 20, 0xffd23f, 0.18).setDepth(1).setBlendMode('ADD');
  }

  // 명소 표지판과 겹치는 자리인지 (가게 간판을 빼려고)
  nearLandmark(x, y) {
    const cell = CONFIG.tile * CONFIG.cellTiles;
    return LANDMARKS.some((lm) => Math.abs(lm.x * cell - x) < 90 && Math.abs(lm.y * cell - y) < 40);
  }

  // 가게마다 그 가게 종류에 맞는 한글 네온 간판 (아이콘 + 글자 + 색)
  addSigns(shops, charAt) {
    const size = CONFIG.tile;
    for (const shop of shops) {
      const info = SHOPS[shop.index];
      const y = shop.y;
      // 가로 간판: 차양 위
      if (!shop.stamp && this.nearLandmark(shop.cx, y * size)) continue; // 스탬프 장소 간판은 그대로
      if (shop.stamp || shop.tiles.length > 1 || hash(shop.tiles[0].x, y) % 2 === 0) {
        this.neonSign(shop.cx, y * size + 8, `${info.icon} ${info.word}`, info.color, {
          big: shop.stamp, reflectY: (y + 1) * size + 8,
        });
      }
      // 세로 간판: 위쪽 지붕에 걸쳐 세움 (가끔)
      const x = shop.tiles[0].x;
      if (!shop.stamp && hash(x, y) % 4 === 1 && charAt(x, y - 1) === '#' && charAt(x, y - 2) === '#') {
        this.neonSign((x + 0.5) * size, y * size - 16, info.word.slice(0, 3), info.color, { vertical: true });
      }
    }

    // 역 출구 간판
    const ey = MAP.findIndex((row) => row.includes('E'));
    if (ey >= 0) {
      const ex = MAP[ey].indexOf('E');
      const len = MAP[ey].lastIndexOf('E') - ex + 1;
      const cell = size * CONFIG.cellTiles;
      this.neonSign((ex + len / 2) * cell, (ey + 0.3) * cell, `🚇 ${STATION_SIGN}`, '#7dff9a', { big: true });
    }
  }

  update(time, delta) {
    if (this.finished) return;
    const now = this.time.now;
    const dt = Math.min(delta, 50);

    // 방해물은 붙잡혀 있을 때도 움직임
    for (const t of this.tours) t.update(now, dt);
    for (const f of this.flyers) f.update(now);
    for (const l of this.lanes) l.update(now);
    for (const p of this.pigeons) p.update(now);
    for (const q of this.queues) q.update(now);
    for (const w of this.walkers) w.update(dt);

    if (this.isBusy()) {
      this.player.move(0, 0);
      return;
    }

    const k = this.keys;
    let dx = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
    let dy = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
    if (dx || dy) {
      if (k.SHIFT.isDown) { dx *= 0.5; dy *= 0.5; } // PC는 Shift로 천천히
    } else if (this.ui.joystick) {
      dx = this.ui.joystick.value.x;
      dy = this.ui.joystick.value.y;
    }

    const c = this.player.body.center;
    let scale = 1;
    if (this.crowd.some((p) => p.contains(c.x, c.y))) {
      scale *= CONFIG.crowd.slow;
      if (dx || dy) this.bumpPerson(CONFIG.bump.crowdDamage);
    }
    if (now < this.speedUpUntil) scale *= CONFIG.food.m.speedUp;
    this.player.speedScale = scale;

    this.player.move(dx, dy);
    this.slideAlongWall(dx, dy);
    this.cornerAssist(dx, dy, dt);

    // 걷는 동안 체력이 조금씩 줄어듦
    if (dx || dy) {
      this.walkMs += dt;
      if (this.walkMs >= CONFIG.health.drainEveryMs) {
        this.walkMs -= CONFIG.health.drainEveryMs;
        this.setHp(this.hp - 1);
      }
    }

    for (const s of this.stamps) {
      if (!this.collected.has(s.id)
        && Phaser.Math.Distance.Between(c.x, c.y, s.x, s.y) < CONFIG.stamp.pickupRange) {
        this.collectStamp(s);
      }
    }
    for (const f of this.stalls) f.update(now);
    this.checkVan();
    this.updateGuide();
  }

  // 비스듬히 벽에 붙어 걸을 때도 벽을 따라 같은 속도로 미끄러지듯 걷게
  slideAlongWall(dx, dy) {
    const body = this.player.body;
    const v = body.velocity;
    const speed = Math.hypot(v.x, v.y);
    if (!dx || !dy || speed < 1) return;
    // 바로 앞(1픽셀)이 벽인지 직접 확인 (충돌 표시는 한 프레임씩 깜빡여서 속도가 들쭉날쭉해짐)
    const size = CONFIG.tile;
    const wall = (px, py) => !this.isOpenTile(Math.floor(px / size), Math.floor(py / size));
    const ex = dx > 0 ? body.right + 1 : body.left - 1;
    const ey = dy > 0 ? body.bottom + 1 : body.top - 1;
    const blockedX = wall(ex, body.top + 1) || wall(ex, body.bottom - 1);
    const blockedY = wall(body.left + 1, ey) || wall(body.right - 1, ey);
    if (blockedX && !blockedY) body.setVelocity(0, Math.sign(dy) * speed);
    else if (blockedY && !blockedX) body.setVelocity(Math.sign(dx) * speed, 0);
  }

  // 골목 입구 모서리에 걸리면 골목 가운데 쪽으로 살짝 밀어 줌 (터치 조작이 덜 답답하게)
  cornerAssist(dx, dy, dt) {
    const body = this.player.body;
    const size = CONFIG.tile;
    const step = (CONFIG.player.speed * dt) / 1000; // 걷는 속도와 같은 빠르기로
    const open = (tx, ty) => this.isOpenTile(tx, ty);
    // 앞이 트인 칸 중 가장 가까운 칸의 가운데까지 거리
    const offsetTo = (pos, aheadOpen) => {
      const c = Math.floor(pos / size);
      let best = null;
      for (const cand of [c, c - 1, c + 1]) {
        if (!aheadOpen(cand)) continue;
        const off = (cand + 0.5) * size - pos;
        if (best === null || Math.abs(off) < Math.abs(best)) best = off;
      }
      return best !== null && Math.abs(best) < size ? best : 0;
    };

    if (Math.abs(dy) > Math.abs(dx) && (body.blocked.up || body.blocked.down)) {
      const row = Math.floor((dy > 0 ? body.bottom + 1 : body.top - 1) / size);
      const off = offsetTo(body.center.x, (col) => open(col, row));
      this.player.x += Phaser.Math.Clamp(off, -step, step);
    } else if (Math.abs(dx) > Math.abs(dy) && (body.blocked.left || body.blocked.right)) {
      const col = Math.floor((dx > 0 ? body.right + 1 : body.left - 1) / size);
      const off = offsetTo(body.center.y, (row) => open(col, row));
      this.player.y += Phaser.Math.Clamp(off, -step, step);
    }
  }
}
