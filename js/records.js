// 기록 저장. 지금은 이 기기 안(브라우저)에만 내 최고 기록을 저장한다.
// 나중에 서버 기록판을 붙일 때는 이 파일만 바꾸면 된다.

const BEST_KEY = 'pokapoka-maigo-best';

export function getBest() {
  try {
    const v = Number(localStorage.getItem(BEST_KEY));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

// 클리어 시간을 넣으면 자기 최고 기록인지 알려주고 저장한다
export function submitTime(ms) {
  const best = getBest();
  const isBest = best === null || ms < best;
  if (isBest) {
    try {
      localStorage.setItem(BEST_KEY, String(ms));
    } catch {
      // 저장이 막힌 브라우저(시크릿 창 등)에서는 그냥 넘어감
    }
  }
  return { isBest, best: isBest ? ms : best };
}
