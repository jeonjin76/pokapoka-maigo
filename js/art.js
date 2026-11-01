// 게임 그림 만들기.
// assets/game/ 에 진짜 그림(Gemini → tools/prepare-assets.ps1)이 있으면 그걸 쓰고,
// 없으면 여기서 코드로 그린 임시 도형을 쓴다. 파일 이름만 맞으면 그림을 넣는 순간 바뀐다.
//
//   player.png / player_walk.png  시바견       npc_*.png  사장님 5명
//   van.png       포카포카 밴 (옆, 위)         stamps.png 스탬프 5종
//   foods.png     음식 5종                     obstacles.png 방해물 5종
//   tiles.png     맵 타일 9종                  bg_alley.png / keyart.png  눈높이 배경
//
// 임시 그림의 글자 한 칸 = 픽셀 한 칸, '.' 은 투명.

import { CONFIG } from './config.js';
import { SHOPS } from './map.js';

// 진짜 그림이 들어왔는지 (다른 파일에서 확인용)
export const ART = { player: false, obstacles: false, tiles: false };

export function hasRaw(scene, name) {
  return scene.textures.exists(`raw-${name}`);
}

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function makeCanvas(scene, key, w, h, paint) {
  const tex = scene.textures.createCanvas(key, w, h);
  tex.context.imageSmoothingEnabled = false;
  paint(tex.context);
  tex.refresh();
  return tex;
}

// 불러온 시트의 i번째 칸을 캔버스에 그림
function drawRaw(ctx, scene, rawKey, i, dx, dy, dw, dh) {
  const f = scene.textures.getFrame(rawKey, i);
  ctx.drawImage(f.source.image, f.cutX, f.cutY, f.cutWidth, f.cutHeight, dx, dy, dw ?? f.cutWidth, dh ?? f.cutHeight);
}

// 시트의 한 칸을 따로 떼어 새 텍스처로
function textureFromRaw(scene, key, rawKey, i) {
  const f = scene.textures.getFrame(rawKey, i);
  makeCanvas(scene, key, f.cutWidth, f.cutHeight, (ctx) => drawRaw(ctx, scene, rawKey, i, 0, 0));
}

// ── 플레이어 (시바견) ─────────────────────────────────
const PALETTE = {
  k: '#2a1e30', // 신발·눈
  h: '#b8743a', // 털
  s: '#f2d2a8', // 얼굴 아래
  c: '#1f8a8a', // 청록 후드
  b: '#FF8A3D', // 주황 배낭
  B: '#c8602a',
  p: '#2a2440', // 바지
};

const HEAD_FRONT = [
  '....h......h....',
  '....hh....hh....',
  '....hhhhhhhh....',
  '...hhhhhhhhhh...',
  '...hkhsssshkh...',
  '...hsssksssh....',
  '....ssssssss....',
  '.....ssssss.....',
  '...bccccccccb...',
  '..cbccccccccbc..',
  '..cbccccccccbc..',
  '...bccccccccb...',
];
const HEAD_BACK = [
  '....h......h....',
  '....hh....hh....',
  '....hhhhhhhh....',
  '...hhhhhhhhhh...',
  '...hhhhhhhhhh...',
  '...hhhhhhhhhh...',
  '....hhhhhhhh....',
  '.....cccccc.....',
  '...cbbbbbbbbc...',
  '..ccbbbbbbbbcc..',
  '..ccbbBBBBbbcc..',
  '...cbbbbbbbbc...',
];
const HEAD_SIDE = [
  '.....h...h......',
  '.....hh..hh.....',
  '....hhhhhhhh....',
  '....hhhhhhsss...',
  '....hhhhhskss...',
  '....hhhhsssssk..',
  '.....hhsssss....',
  '......ssss......',
  '..bbbcccccc.....',
  '..bbbccccccs....',
  '..bbbcccccc.....',
  '..bbbcccccc.....',
];
const LEGS_FRONT = [
  ['....pppppppp....', '....ppp..ppp....', '....ppp..ppp....', '....kkk..kkk....'],
  ['....pppppppp....', '....ppp..ppp....', '....ppp..kkk....', '....kkk.........'],
  ['....pppppppp....', '....ppp..ppp....', '....kkk..ppp....', '.........kkk....'],
];
const LEGS_SIDE = [
  ['.....pppppp.....', '.....pp..pp.....', '.....pp..pp.....', '.....kk..kkk....'],
  ['.....pppppp.....', '....pp....pp....', '...pp......pp...', '...kk......kkk..'],
  ['.....pppppp.....', '......pppp......', '......pppp......', '......kkkkk.....'],
];
const PLAYER_FRAMES = {
  down: LEGS_FRONT.map((legs) => HEAD_FRONT.concat(legs)),
  up: LEGS_FRONT.map((legs) => HEAD_BACK.concat(legs)),
  side: LEGS_SIDE.map((legs) => HEAD_SIDE.concat(legs)),
};

function drawPixels(ctx, rows, palette, ox = 0, oy = 0) {
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = palette[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    });
  });
}

// 프레임 여러 장을 가로로 이어 붙인 스프라이트시트 텍스처
function makeSheet(scene, key, frames, palette, w = 16, h = 16) {
  const tex = scene.textures.createCanvas(key, w * frames.length, h);
  frames.forEach((rows, i) => drawPixels(tex.context, rows, palette, i * w, 0));
  tex.refresh();
  frames.forEach((_, i) => tex.add(i, 0, i * w, 0, w, h));
}

// 진짜 그림으로 방향별 3프레임 시트. 같은 칸이 반복되면 1픽셀 위로 띄워 통통 튀게.
function sheetFromRaw(scene, key, rawKey, indexes) {
  const f0 = scene.textures.getFrame(rawKey, indexes[0]);
  const w = f0.cutWidth;
  const h = f0.cutHeight;
  const tex = scene.textures.createCanvas(key, w * 3, h);
  tex.context.imageSmoothingEnabled = false;
  indexes.forEach((idx, i) => {
    const hop = i > 0 && idx === indexes[0] ? -1 : 0;
    drawRaw(tex.context, scene, rawKey, idx, i * w, hop);
  });
  tex.refresh();
  indexes.forEach((_, i) => tex.add(i, 0, i * w, 0, w, h));
}

function makePlayer(scene) {
  if (hasRaw(scene, 'player_walk')) {
    ART.player = true;
    for (const [dir, idx] of Object.entries(CONFIG.player.walkFrames)) {
      sheetFromRaw(scene, `player-${dir}`, 'raw-player_walk', idx);
    }
  } else if (hasRaw(scene, 'player')) {
    // 서 있는 그림만 있을 때: 앞 0, 뒤 1, 오른쪽 2
    ART.player = true;
    sheetFromRaw(scene, 'player-down', 'raw-player', [0, 0, 0]);
    sheetFromRaw(scene, 'player-up', 'raw-player', [1, 1, 1]);
    sheetFromRaw(scene, 'player-side', 'raw-player', [2, 2, 2]);
  } else {
    for (const [dir, frames] of Object.entries(PLAYER_FRAMES)) {
      makeSheet(scene, `player-${dir}`, frames, PALETTE);
    }
  }
}

// ── 맵 타일 (비 오는 밤 네온 거리, 한 칸 32픽셀) ───────────────
// 타일 번호: 0 골목, 1 큰길, 2 중앙선, 3 나무, 4 역, 5~9 지붕, 10~ 가게 앞면 (map.js SHOPS 순서)
export const ROOF_COLORS = 5;
export const TILE = {
  ALLEY: 0,
  ROAD: 1,
  ROAD_LINE: 2,
  TREE: 3,
  STATION: 4,
  ROOF: 5,
  FACADE: 5 + ROOF_COLORS,
};
export const BLOCKING_TILES = Array.from({ length: TILE.FACADE + SHOPS.length - TILE.TREE }, (_, i) => TILE.TREE + i);

export const NEON = {
  pink: '#FF3FA4',
  cyan: '#3FF3FF',
  yellow: '#FFD23F',
  orange: '#FF8A3D',
  purple: '#B07CFF',
};

// 16픽셀 기준으로 그리고 2배로 키우는 기본 타일
const BASE_PAINTERS = [
  // 골목: 젖은 보도블록 (지붕보다 어둡게 → 길과 건물이 잘 구분됨)
  (ctx) => {
    rect(ctx, '#2f2b48', 0, 0, 16, 16);
    rect(ctx, '#3c3760', 0, 0, 16, 1);
    rect(ctx, '#3c3760', 0, 0, 1, 16);
    rect(ctx, '#3c3760', 8, 8, 8, 1);
    rect(ctx, '#3c3760', 8, 8, 1, 8);
    rect(ctx, '#55508a', 3, 4, 2, 1); // 물웅덩이 반짝임
    rect(ctx, '#55508a', 12, 12, 1, 1);
  },
  // 큰길: 아스팔트
  (ctx) => {
    rect(ctx, '#211d33', 0, 0, 16, 16);
    rect(ctx, '#2c2844', 3, 5, 1, 1);
    rect(ctx, '#2c2844', 11, 12, 1, 1);
  },
  // 큰길 가운데 노란 점선
  (ctx) => {
    rect(ctx, '#211d33', 0, 0, 16, 16);
    rect(ctx, NEON.yellow, 2, 7, 8, 2);
  },
  // 나무 (전구가 걸린 연남동 숲길)
  (ctx) => {
    rect(ctx, '#24463c', 0, 0, 16, 16);
    rect(ctx, '#5a4030', 7, 11, 2, 4);
    rect(ctx, '#3a8a5f', 2, 2, 12, 10);
    rect(ctx, '#3a8a5f', 4, 1, 8, 12);
    rect(ctx, '#5ab07a', 4, 3, 4, 3);
    rect(ctx, NEON.yellow, 3, 9, 1, 1); // 전구
    rect(ctx, NEON.yellow, 7, 10, 1, 1);
    rect(ctx, NEON.yellow, 11, 9, 1, 1);
    rect(ctx, NEON.pink, 5, 6, 1, 1);
  },
  // 역 출구 (2호선 초록)
  (ctx) => {
    rect(ctx, '#2f9a55', 0, 0, 16, 16);
    rect(ctx, '#f7f3e8', 0, 4, 16, 2);
    rect(ctx, '#1e5a33', 0, 14, 16, 2);
  },
];

// 지붕: 밝은 테두리 + 옥상 물건(실외기·물탱크·환풍구)으로 어두워도 잘 보이게
const ROOFS = ['#5a4a8a', '#6a4a78', '#4a5c8a', '#7a4a6a', '#4f6a7a'];
function paintRoof(ctx, color, variant) {
  rect(ctx, color, 0, 0, 32, 32);
  rect(ctx, '#ffffff38', 0, 0, 32, 2);
  rect(ctx, '#ffffff38', 0, 0, 2, 32);
  rect(ctx, '#00000040', 0, 30, 32, 2);
  rect(ctx, '#00000040', 30, 0, 2, 32);
  if (variant === 0) { // 실외기
    rect(ctx, '#c8c4d8', 8, 10, 12, 9);
    rect(ctx, '#8a86a0', 10, 12, 7, 5);
    rect(ctx, '#5a5670', 12, 13, 3, 3);
  } else if (variant === 1) { // 물탱크
    rect(ctx, '#d8d4e8', 12, 8, 10, 12);
    rect(ctx, '#aaa6c0', 12, 18, 10, 2);
  } else if (variant === 2) { // 환풍구
    rect(ctx, '#3a3650', 18, 18, 6, 6);
    rect(ctx, '#8a86a0', 19, 19, 4, 1);
    rect(ctx, '#8a86a0', 19, 21, 4, 1);
  } else if (variant === 3) { // 옥상 정원
    rect(ctx, '#3a8a5f', 6, 6, 8, 6);
    rect(ctx, '#5ab07a', 7, 7, 3, 2);
  }
}

// 가게 앞면 (32×32): 줄무늬 차양 + 불 켜진 진열창 + 가게마다 다른 진열 물건
function shopFront(wall, awningA, awningB, glow, items) {
  return (ctx) => {
    rect(ctx, wall, 0, 0, 32, 32);
    for (let i = 0; i < 8; i++) rect(ctx, i % 2 ? awningB : awningA, i * 4, 0, 4, 7);
    for (let i = 0; i < 8; i++) rect(ctx, i % 2 ? awningB : awningA, i * 4 + 1, 7, 2, 2); // 차양 끝 물결
    rect(ctx, '#1a1430', 3, 11, 26, 17); // 창틀
    rect(ctx, glow, 4, 12, 24, 15); // 불빛
    rect(ctx, '#ffffff40', 4, 12, 24, 2);
    if (items) items(ctx);
    rect(ctx, '#00000066', 0, 29, 32, 3); // 그림자
  };
}

const SHOP_FRONTS = {
  cafe: shopFront('#5a3a2a', '#f4e4c8', '#8a5a3a', '#ffd88a', (c) => {
    for (const x of [7, 18]) {
      rect(c, '#ffffff', x, 19, 6, 6);
      rect(c, '#ffffff', x + 6, 20, 2, 3);
      rect(c, '#8a5a3a', x + 1, 19, 4, 2);
      rect(c, '#ffffffaa', x + 2, 15, 1, 2);
    }
  }),
  chicken: shopFront('#6a2a2a', '#FFD23F', '#e8402a', '#ffb060', (c) => {
    for (const x of [6, 14, 21]) {
      rect(c, '#b8622a', x, 17, 6, 6);
      rect(c, '#d8823a', x + 1, 17, 3, 2);
      rect(c, '#fff6e6', x + 5, 22, 2, 3);
    }
  }),
  bunsik: shopFront('#6a2a3a', '#e8402a', '#ffffff', '#ffc070', (c) => {
    rect(c, '#2a1e30', 6, 20, 20, 6);
    for (const [x, y] of [[8, 19], [12, 20], [16, 19], [20, 20], [10, 22], [18, 22]]) rect(c, '#e8402a', x, y, 3, 2);
  }),
  cosme: shopFront('#5a3a5a', '#ff9ad5', '#ffffff', '#ffd8ee', (c) => {
    [[6, '#ff5aa0', 8], [10, '#ffffff', 6], [14, '#b07cff', 9], [18, '#ff9ad5', 7], [22, '#3ff3ff', 8]]
      .forEach(([x, col, hgt]) => { rect(c, col, x, 27 - hgt, 3, hgt); rect(c, '#2a1e30', x, 27 - hgt, 3, 1); });
  }),
  karaoke: shopFront('#2a2050', '#B07CFF', '#2a2050', '#3a2a6a', (c) => {
    rect(c, NEON.cyan, 8, 16, 2, 7); rect(c, NEON.cyan, 6, 22, 4, 3); rect(c, NEON.cyan, 10, 16, 4, 2);
    rect(c, NEON.pink, 19, 15, 2, 8); rect(c, NEON.pink, 17, 21, 4, 3); rect(c, NEON.pink, 21, 15, 4, 2);
  }),
  clothes: shopFront('#2a4a5a', '#3FF3FF', '#ffffff', '#e8f4ff', (c) => {
    rect(c, '#5a5670', 5, 14, 22, 1);
    [[6, '#ff7aa8'], [13, '#5ab0ff'], [20, '#FFD23F']].forEach(([x, col]) => {
      rect(c, col, x, 16, 6, 3); rect(c, col, x + 1, 19, 4, 6); rect(c, '#5a5670', x + 2, 15, 2, 1);
    });
  }),
  conv: shopFront('#e8e8f0', '#2f9a55', '#3a6fd8', '#ffffff', (c) => {
    for (const y of [17, 23]) {
      rect(c, '#9aa0b8', 4, y + 3, 24, 1);
      for (let x = 5; x < 27; x += 3) rect(c, ['#e8402a', '#3a6fd8', '#FFD23F', '#2f9a55'][(x + y) % 4], x, y, 2, 3);
    }
  }),
  bbq: shopFront('#4a2020', '#8a2a2a', '#2a1a1a', '#ff9a50', (c) => {
    rect(c, '#2a1e30', 7, 20, 18, 4);
    for (let x = 8; x < 25; x += 3) rect(c, '#5a5670', x, 19, 1, 6);
    rect(c, '#ff5a2a', 11, 24, 3, 2); rect(c, '#FFD23F', 16, 24, 3, 2);
  }),
  bakery: shopFront('#6a4a2a', '#fff0d0', '#c98a4a', '#ffe0a0', (c) => {
    rect(c, '#8a5a3a', 5, 24, 22, 1);
    for (const x of [6, 14, 21]) { rect(c, '#d99a4a', x, 20, 6, 4); rect(c, '#f0c070', x + 1, 20, 3, 1); }
  }),
  ramen: shopFront('#5a1a1a', '#e8402a', '#2a1a1a', '#ffc890', (c) => {
    rect(c, '#ffffff', 9, 20, 14, 5); rect(c, '#ffffff', 11, 25, 10, 1);
    rect(c, '#e8602a', 10, 20, 12, 2);
    rect(c, '#ffffffaa', 12, 15, 1, 3); rect(c, '#ffffffaa', 16, 14, 1, 4); rect(c, '#ffffffaa', 20, 15, 1, 3);
  }),
  photo: shopFront('#3a4a6a', '#ffffff', '#5ab0ff', '#d8ecff', (c) => {
    for (const x of [6, 14, 22]) { rect(c, '#ffffff', x, 16, 6, 8); rect(c, '#9ad8ff', x + 1, 17, 4, 5); }
  }),
  pc: shopFront('#1a2a4a', '#5ab0ff', '#1a2a4a', '#20305a', (c) => {
    for (const x of [6, 17]) { rect(c, NEON.cyan, x, 16, 9, 6); rect(c, '#5a5670', x + 3, 22, 3, 3); }
  }),
  stage: shopFront('#2a1a4a', '#B07CFF', '#FFD23F', '#3a2a5a', (c) => {
    c.fillStyle = '#FFD23F55'; c.beginPath(); c.moveTo(16, 12); c.lineTo(8, 27); c.lineTo(24, 27); c.fill();
    rect(c, '#c8c4d8', 15, 18, 2, 9); rect(c, '#2a1e30', 14, 16, 4, 3);
  }),
  graffiti: (c) => {
    rect(c, '#4a4a6a', 0, 0, 32, 32);
    [[4, 4, 10, 8, NEON.pink], [16, 8, 12, 9, NEON.cyan], [6, 16, 9, 9, NEON.yellow], [18, 19, 10, 7, NEON.purple]]
      .forEach(([x, y, w, h, col]) => { rect(c, col, x, y, w, h); rect(c, col, x + 2, y + h, 2, 3); });
    rect(c, '#00000066', 0, 29, 32, 3);
  },
  fourcut: shopFront('#2a2a3a', '#ffffff', '#FFD23F', '#ffffff', (c) => {
    for (const x of [8, 18]) {
      rect(c, '#2a1e30', x, 13, 6, 14);
      for (let i = 0; i < 4; i++) rect(c, ['#ffb0c8', '#9ad8ff', '#ffe08a', '#b8a0ff'][i], x + 1, 14 + i * 3, 4, 2);
    }
  }),
};

// tiles.png 가 있을 때 칸 순서: 골목, 큰길, 중앙선, 나무, 역, 지붕, 앞면, 가로 간판, 세로 간판
function makeTileset(scene) {
  const S = 32;
  const n = TILE.FACADE + SHOPS.length;
  const real = hasRaw(scene, 'tiles');
  ART.tiles = real;
  const tex = scene.textures.createCanvas('tiles', S * n, S);
  const ctx = tex.context;
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.translate(i * S, 0);
    if (real) {
      const raw = i < TILE.ROOF ? i : i < TILE.FACADE ? 5 : 6;
      drawRaw(ctx, scene, 'raw-tiles', raw, 0, 0, S, S);
      if (i >= TILE.FACADE) { // 가게마다 차양 색으로 구분
        rect(ctx, SHOPS[i - TILE.FACADE].color, 0, 0, S, 6);
      } else if (i >= TILE.ROOF) {
        rect(ctx, `${ROOFS[i - TILE.ROOF]}66`, 0, 0, S, S);
      }
    } else if (i < TILE.ROOF) {
      ctx.scale(2, 2);
      BASE_PAINTERS[i](ctx);
    } else if (i < TILE.FACADE) {
      paintRoof(ctx, ROOFS[i - TILE.ROOF], (i - TILE.ROOF) % 5);
    } else {
      SHOP_FRONTS[SHOPS[i - TILE.FACADE].type](ctx);
    }
    ctx.restore();
    tex.add(i, 0, i * S, 0, S, S);
  }
  tex.refresh();
  if (real) {
    textureFromRaw(scene, 'sign-h', 'raw-tiles', 7);
    textureFromRaw(scene, 'sign-v', 'raw-tiles', 8);
  }
}

// ── 스탬프 아이콘 ──────────────────────────────────
const STAMP_ICONS = {
  // 1 시트 마스크팩
  1: (ctx) => {
    rect(ctx, '#ff9ac8', 3, 3, 10, 11);
    rect(ctx, '#ffffff', 5, 5, 6, 7);
    rect(ctx, '#ff9ac8', 6, 7, 1, 1);
    rect(ctx, '#ff9ac8', 9, 7, 1, 1);
    rect(ctx, '#ff9ac8', 7, 10, 2, 1);
    rect(ctx, '#d94b8a', 3, 3, 10, 1);
  },
  // 2 응원봉 (펜라이트)
  2: (ctx) => {
    rect(ctx, '#3FF3FF', 6, 2, 4, 4);
    rect(ctx, '#bffcff', 7, 3, 2, 2);
    rect(ctx, '#ffffff', 7, 6, 2, 1);
    rect(ctx, '#3b3558', 7, 7, 2, 7);
    rect(ctx, '#FF3FA4', 7, 9, 2, 1);
  },
  // 3 스프레이 캔
  3: (ctx) => {
    rect(ctx, '#9a9aa8', 6, 3, 3, 2);
    rect(ctx, '#d94b4b', 5, 5, 5, 8);
    rect(ctx, '#FFD23F', 5, 8, 5, 2);
    rect(ctx, '#3FF3FF', 11, 3, 1, 1);
    rect(ctx, '#FF3FA4', 12, 5, 1, 1);
  },
  // 4 네컷 사진
  4: (ctx) => {
    rect(ctx, '#ffffff', 5, 1, 6, 14);
    for (let i = 0; i < 4; i++) rect(ctx, ['#ffb0c8', '#9ad8ff', '#ffe08a', '#b8a0ff'][i], 6, 2 + i * 3, 4, 2);
    rect(ctx, '#3b2a20', 6, 14, 4, 1);
  },
  // 5 크로플
  5: (ctx) => {
    rect(ctx, '#d99a3e', 3, 5, 10, 7);
    rect(ctx, '#b8762a', 3, 8, 10, 1);
    rect(ctx, '#b8762a', 6, 5, 1, 7);
    rect(ctx, '#b8762a', 9, 5, 1, 7);
    rect(ctx, '#fff6e6', 4, 4, 8, 2);
  },
};

function makeStamps(scene) {
  for (const [id, paint] of Object.entries(STAMP_ICONS)) {
    if (hasRaw(scene, 'stamps')) {
      textureFromRaw(scene, `stamp-${id}`, 'raw-stamps', Number(id) - 1);
      continue;
    }
    makeCanvas(scene, `stamp-${id}`, 16, 16, (ctx) => {
      ctx.fillStyle = '#fff6e6';
      ctx.beginPath();
      ctx.arc(8, 8, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = NEON.pink;
      ctx.lineWidth = 1;
      ctx.stroke();
      paint(ctx);
    });
  }
}

// ── 포카포카 밴 ──────────────────────────────────
function makeVan(scene) {
  if (hasRaw(scene, 'van')) {
    textureFromRaw(scene, 'van', 'raw-van', 0); // 옆모습 (맵·결과 카드)
    textureFromRaw(scene, 'van-open', 'raw-van', 0);
    if (scene.textures.getFrame('raw-van', 1)) textureFromRaw(scene, 'van-top', 'raw-van', 1);
    return;
  }
  for (const [key, open] of [['van', false], ['van-open', true]]) {
    makeCanvas(scene, key, 32, 20, (ctx) => {
      rect(ctx, '#00000055', 2, 17, 28, 2);
      rect(ctx, '#f4f2fb', 1, 3, 30, 12);
      rect(ctx, '#ffffff', 1, 3, 30, 2);
      rect(ctx, NEON.orange, 1, 10, 30, 2);
      rect(ctx, '#9cf0ff', 3, 5, 6, 4);
      rect(ctx, '#9cf0ff', 22, 5, 7, 4);
      if (open) {
        rect(ctx, '#2a2440', 12, 4, 8, 11);
        rect(ctx, NEON.yellow, 13, 5, 6, 1);
      } else {
        rect(ctx, '#dcd8ea', 12, 4, 8, 11);
        rect(ctx, '#3b2a20', 18, 9, 1, 2);
      }
      rect(ctx, '#2a1e30', 5, 14, 5, 4);
      rect(ctx, '#2a1e30', 22, 14, 5, 4);
    });
  }
}

// 길잡이 화살표 (오른쪽을 가리킴)
function makeArrow(scene) {
  makeCanvas(scene, 'arrow', 12, 12, (ctx) => {
    ctx.fillStyle = NEON.yellow;
    ctx.strokeStyle = '#2a1e30';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(11, 6);
    ctx.lineTo(2, 1);
    ctx.lineTo(4, 6);
    ctx.lineTo(2, 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
}

// ── 동네 사람들 (임시: 주인공 그림에 색만 바꿔서) ───────────
export const NPC_COUNT = 6;
const NPC_PALETTES = [
  { h: '#2a1e18', c: '#e86a6a', p: '#4a4a5a' },
  { h: '#c98a4a', c: '#f2c94c', p: '#3d4a7a' },
  { h: '#3b2a20', c: '#8a6ad0', p: '#2f2f3a' },
  { h: '#6a4a3a', c: '#ffffff', p: '#6a8ac4' },
  { h: '#1e1e1e', c: '#5aaa7a', p: '#3b2a20' },
  { h: '#d8b070', c: '#e88ab0', p: '#5a5a6a' },
].map((p) => ({ ...PALETTE, s: '#f5c9a0', ...p, b: p.c, B: p.c }));

// obstacles.png 칸 순서: 관광객, 호객꾼, 오토바이, 비둘기, 구경꾼
export const PERSON_KINDS = { tour: 0, flyer: 1, crowd: 4 };

function makePeople(scene) {
  NPC_PALETTES.forEach((palette, i) => {
    for (const [dir, frames] of Object.entries(PLAYER_FRAMES)) {
      makeSheet(scene, `npc${i}-${dir}`, frames, palette);
    }
  });
  ART.obstacles = hasRaw(scene, 'obstacles');
  if (ART.obstacles) {
    for (const [kind, idx] of Object.entries(PERSON_KINDS)) {
      sheetFromRaw(scene, `person-${kind}`, 'raw-obstacles', [idx, idx, idx]);
    }
  }
}

function makeObstacleArt(scene) {
  // 가이드 깃발
  makeCanvas(scene, 'flag', 8, 12, (ctx) => {
    rect(ctx, '#d8d0f0', 1, 0, 1, 12);
    rect(ctx, NEON.yellow, 2, 0, 6, 4);
    rect(ctx, NEON.pink, 2, 1, 6, 2);
  });

  // 배달 오토바이 (오른쪽으로 달림)
  if (ART.obstacles) {
    textureFromRaw(scene, 'bike', 'raw-obstacles', 2);
  } else {
    makeCanvas(scene, 'bike', 24, 16, (ctx) => {
      rect(ctx, '#00000055', 2, 14, 20, 2);
      rect(ctx, '#2a1e30', 2, 10, 5, 5);
      rect(ctx, '#2a1e30', 17, 10, 5, 5);
      rect(ctx, '#e8503a', 5, 8, 14, 4);
      rect(ctx, NEON.yellow, 1, 2, 7, 6);
      rect(ctx, '#d9a63c', 1, 2, 7, 1);
      rect(ctx, '#3d4a7a', 10, 3, 4, 5);
      rect(ctx, '#ffffff', 10, 0, 5, 3);
      rect(ctx, NEON.yellow, 21, 8, 2, 2); // 전조등
    });
  }

  // 비둘기 (0 = 앉음, 1 = 날개 펼침)
  if (ART.obstacles) {
    sheetFromRaw(scene, 'pigeon', 'raw-obstacles', [3, 3]);
  } else {
    const pigeon = makeCanvas(scene, 'pigeon', 20, 10, (pc) => {
      rect(pc, '#9a9ab0', 1, 4, 7, 4);
      rect(pc, '#7a7a90', 6, 2, 3, 3);
      rect(pc, NEON.orange, 9, 3, 1, 1);
      rect(pc, '#5aaa9a', 6, 5, 2, 1);
      rect(pc, NEON.orange, 3, 8, 1, 2);
      rect(pc, NEON.orange, 5, 8, 1, 2);
      rect(pc, '#9a9ab0', 12, 4, 6, 3);
      rect(pc, '#c0c0d0', 10, 0, 4, 4);
      rect(pc, '#c0c0d0', 16, 0, 4, 4);
      rect(pc, '#7a7a90', 17, 3, 2, 2);
    });
    pigeon.add(0, 0, 0, 0, 10, 10);
    pigeon.add(1, 0, 10, 0, 10, 10);
  }
}

// ── 길거리 음식 ─────────────────────────────────
const FOOD_KEYS = ['t', 'h', 'o', 'b', 'm'];
const FOOD_ICONS = {
  t: (ctx) => {
    rect(ctx, '#ffffff', 2, 6, 10, 5);
    rect(ctx, '#d94b4b', 3, 5, 8, 4);
    rect(ctx, '#fbe3d0', 4, 5, 2, 1);
    rect(ctx, '#fbe3d0', 8, 6, 2, 1);
    rect(ctx, '#fbe3d0', 5, 7, 2, 1);
  },
  h: (ctx) => {
    rect(ctx, '#d9a63c', 5, 2, 4, 8);
    rect(ctx, '#b8762a', 5, 3, 1, 1);
    rect(ctx, '#b8762a', 7, 6, 1, 1);
    rect(ctx, '#d94b4b', 6, 2, 1, 6);
    rect(ctx, '#e9d3b0', 6, 10, 2, 3);
  },
  o: (ctx) => {
    rect(ctx, '#c9843c', 2, 5, 10, 5);
    rect(ctx, '#c9843c', 3, 4, 8, 7);
    rect(ctx, '#e0a85c', 4, 5, 3, 2);
    rect(ctx, '#7a4a20', 7, 8, 2, 1);
  },
  b: (ctx) => {
    rect(ctx, '#d99a3e', 2, 5, 8, 5);
    rect(ctx, '#d99a3e', 10, 4, 3, 7);
    rect(ctx, '#3b2a20', 3, 6, 1, 1);
    rect(ctx, '#b8762a', 5, 7, 4, 1);
  },
  m: (ctx) => {
    rect(ctx, '#f6e27a', 3, 4, 8, 8);
    rect(ctx, '#f6e27a', 5, 2, 4, 2);
    rect(ctx, '#ffffff', 6, 1, 2, 1);
    rect(ctx, '#3b6fb6', 3, 7, 8, 2);
  },
};

function makeFood(scene) {
  FOOD_KEYS.forEach((key, i) => {
    if (hasRaw(scene, 'foods')) textureFromRaw(scene, `food-${key}`, 'raw-foods', i);
    else makeCanvas(scene, `food-${key}`, 14, 14, FOOD_ICONS[key]);
  });
  // 포장마차 (줄무늬 차양 + 판매대)
  makeCanvas(scene, 'cart', 16, 16, (ctx) => {
    for (let i = 0; i < 4; i++) rect(ctx, i % 2 ? '#fff6e6' : NEON.pink, i * 4, 0, 4, 4);
    rect(ctx, '#4a3528', 1, 4, 1, 8);
    rect(ctx, '#4a3528', 14, 4, 1, 8);
    rect(ctx, '#8a5a3a', 0, 10, 16, 5);
    rect(ctx, NEON.yellow, 0, 10, 16, 1);
    rect(ctx, '#2a1e30', 2, 15, 2, 1);
    rect(ctx, '#2a1e30', 12, 15, 2, 1);
  });
}

// ── 사장님 5명 (임시: 동그란 얼굴 + 귀 모양으로 구분) ──────────
export const BOSS_ANIMALS = ['rabbit', 'cat', 'magpie', 'jindo', 'bear'];

const BOSS_LOOKS = {
  rabbit: { face: '#ffffff', ear: 'long', inner: NEON.pink, cloth: '#ff7aa8' },
  cat: { face: '#ffb060', ear: 'cat', inner: '#ff9a9a', cloth: '#5a7a4a' },
  magpie: { face: '#1e2a3a', ear: 'none', inner: '#ffffff', cloth: '#2a3a5a', beak: true },
  jindo: { face: '#f4ecd8', ear: 'dog', inner: '#ffb0a0', cloth: '#5a3a8a' },
  bear: { face: '#2a2430', ear: 'round', inner: '#4a3a40', cloth: '#1f6a6a', moon: true },
};

function drawBossPlaceholder(ctx, look) {
  const c = 100;
  const blob = (x, y, rx, ry, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  // 몸
  blob(c, 185, 62, 45, look.cloth);
  if (look.moon) blob(c, 160, 22, 8, '#f4ecd8');
  // 귀
  if (look.ear === 'long') {
    blob(c - 28, 40, 13, 38, look.face);
    blob(c + 28, 40, 13, 38, look.face);
    blob(c - 28, 42, 6, 26, look.inner);
    blob(c + 28, 42, 6, 26, look.inner);
  } else if (look.ear === 'cat' || look.ear === 'dog') {
    for (const s of [-1, 1]) {
      ctx.fillStyle = look.face;
      ctx.beginPath();
      ctx.moveTo(c + s * 52, 82);
      ctx.lineTo(c + s * 40, 30);
      ctx.lineTo(c + s * 14, 62);
      ctx.fill();
    }
  } else if (look.ear === 'round') {
    blob(c - 44, 58, 18, 18, look.face);
    blob(c + 44, 58, 18, 18, look.face);
  }
  // 얼굴
  blob(c, 100, 58, 50, look.face);
  if (look.beak) {
    blob(c, 118, 40, 28, look.inner);
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.moveTo(c - 10, 108);
    ctx.lineTo(c + 10, 108);
    ctx.lineTo(c, 124);
    ctx.fill();
  }
  const dark = look.face === '#2a2430' || look.face === '#1e2a3a';
  blob(c - 22, 96, 6, 8, dark ? '#ffffff' : '#2a1e30');
  blob(c + 22, 96, 6, 8, dark ? '#ffffff' : '#2a1e30');
  blob(c - 36, 114, 9, 5, '#ff9ab088');
  blob(c + 36, 114, 9, 5, '#ff9ab088');
  if (!look.beak) {
    ctx.strokeStyle = dark ? '#ffffff' : '#2a1e30';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c, 114, 8, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
}

function makeBosses(scene) {
  for (const animal of BOSS_ANIMALS) {
    if (hasRaw(scene, `npc_${animal}`)) {
      textureFromRaw(scene, `boss-${animal}`, `raw-npc_${animal}`, 0);
    } else {
      const tex = scene.textures.createCanvas(`boss-${animal}`, 200, 230);
      drawBossPlaceholder(tex.context, BOSS_LOOKS[animal]);
      tex.refresh();
    }
  }
}

export function makeTextures(scene) {
  if (scene.textures.exists('tiles')) return; // 다시 시작할 때는 이미 있음
  makePlayer(scene);
  makePeople(scene);
  makeObstacleArt(scene);
  makeFood(scene);
  makeStamps(scene);
  makeVan(scene);
  makeArrow(scene);
  makeBosses(scene);
  makeTileset(scene);
}
