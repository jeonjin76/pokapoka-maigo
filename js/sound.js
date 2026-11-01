// 임시 효과음과 배경음 (파일 없이 브라우저에서 바로 만든 소리). 기본은 음소거.
// 나중에 진짜 소리 파일로 바꿀 때는 play()·startMusic()만 고치면 됩니다.

let ctx = null;
let muted = true;

// 효과음 악보: [주파수(Hz), 시작(초), 길이(초), 파형]
const SOUNDS = {
  stamp: [[523, 0, 0.08, 'square'], [659, 0.08, 0.08, 'square'], [784, 0.16, 0.08, 'square'], [1047, 0.24, 0.16, 'square']],
  eat: [[660, 0, 0.06, 'triangle'], [880, 0.07, 0.1, 'triangle']],
  hit: [[220, 0, 0.12, 'sawtooth'], [140, 0.1, 0.18, 'sawtooth']],
  clear: [[523, 0, 0.12, 'square'], [659, 0.12, 0.12, 'square'], [784, 0.24, 0.12, 'square'],
    [1047, 0.36, 0.3, 'square'], [784, 0.5, 0.1, 'triangle'], [1047, 0.6, 0.4, 'triangle']],
  locked: [[330, 0, 0.08, 'square'], [262, 0.1, 0.12, 'square']],
};

function note(freq, at, len, type, volume) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.0005, at + len);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + len + 0.02);
}

// ── 배경음: 느긋한 밤거리 루프 (Am7 → Fmaj7 → Cmaj7 → G7) ──
const BPM = 84;
const CHORDS = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
let musicTimer = null;
let nextTime = 0;
let step = 0;

function scheduleMusic() {
  const half = 60 / BPM / 2;
  while (nextTime < ctx.currentTime + 0.25) {
    const chord = CHORDS[Math.floor(step / 8) % CHORDS.length];
    const i = step % 8;
    if (i === 0 || i === 4) note(midi(chord[0] - 12), nextTime, half * 3.5, 'triangle', 0.05);
    note(midi(chord[ARP[i]] + 12), nextTime, half * 0.9, 'square', 0.012);
    nextTime += half;
    step++;
  }
}

function startMusic() {
  if (musicTimer || !ctx) return;
  nextTime = ctx.currentTime + 0.05;
  musicTimer = setInterval(scheduleMusic, 60);
}

function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}

export const Sound = {
  get muted() {
    return muted;
  },

  toggle() {
    muted = !muted;
    if (!muted && !ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    if (muted) stopMusic();
    else startMusic();
    return muted;
  },

  play(name) {
    if (muted || !ctx || !SOUNDS[name]) return;
    const now = ctx.currentTime;
    for (const [freq, at, len, type] of SOUNDS[name]) note(freq, now + at, len, type, 0.08);
  },
};
