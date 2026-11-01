// 화면에 나오는 모든 문구 (일본어). 문구를 고칠 때는 이 파일만 바꾸면 됩니다.
export const TEXTS = {
  title: 'ポカポカ迷子ラリー in 弘大',
  hintMove: '画面をドラッグして歩きます',
  hintMovePc: 'PC：矢印キー / WASD（Shiftでゆっくり）\nスペース：すみません',

  // 스탬프 (맵 글자 1~5 순서)
  stampNames: {
    1: 'シートマスク',
    2: 'ペンライト',
    3: 'スプレー缶',
    4: '人生4カット',
    5: 'クロッフル',
  },
  placeNames: {
    1: 'コスメ通り',
    2: 'バスキング通り',
    3: '落書きの壁',
    4: '4カット写真館',
    5: 'カフェ路地',
  },
  stampGet: (name) => `「${name}」のスタンプをゲット！`,

  // 사장님 5명 (스탬프 획득 연출)
  bosses: {
    1: { name: 'ウサギのお姉さん', hello: 'いらっしゃい！パックどうぞ〜' },
    2: { name: 'ネコのバスカー', hello: '聴いてくれてありがとニャ！' },
    3: { name: 'カササギの画家', hello: 'キミも描いていく？' },
    4: { name: '珍島犬の店長', hello: 'はい、チーズ！' },
    5: { name: 'ツキノワグマのバリスタ', hello: '焼きたてクロッフルだよ〜' },
  },
  stampCardTitle: 'スタンプカード',
  don: 'ドン！',
  stampCount: (n, total) => `スタンプ ${n}/${total} ゲット！`,
  hintNext: (place, dir) => `次は${place}はどう？\n${dir}のほうにあるよ`,
  hintVan: (dir) => `ポカポカのバンが待ってるよ！\n${dir}のほうへどうぞ`,
  dirs: {
    up: '上', down: '下', left: '左', right: '右',
    upLeft: '左上', upRight: '右上', downLeft: '左下', downRight: '右下',
  },
  tapToSkip: 'タップでとじる',
  allStamps: 'スタンプが全部そろいました！\nポカポカのバンへ向かいましょう',
  vanLocked: (left) => `スタンプをあと${left}こ集めると\nバンのドアが開きます`,
  vanLabel: 'ポカポカ',

  soundOn: '🔊',
  soundOff: '🔇',

  // 방해물
  sumimasen: 'すみません',
  sumimasenSay: 'すみません〜',
  tourYield: 'どうぞ〜',
  flyerSay: 'チラシどうぞ〜！',
  queueBlocked: '人気店の行列で通れません…\nしばらく待つと通れます',
  queueWait: (sec) => `あと${sec}秒`,
  bikeHit: 'わっ！ デリバリーのバイク！',

  // 체력과 음식
  hp: 'HP',
  foodNames: {
    t: 'トッポッキ',
    h: 'ハットグ',
    o: 'ホットク',
    b: 'たい焼き（プンオパン）',
    m: 'バナナ牛乳',
  },
  foodEat: (name, heal) => `${name}でHP+${heal}！`,
  speedUp: 'バナナ牛乳パワーで足が速くなりました！',
  lost: '迷子になった…',
  lostSub: '最後のスタンプの場所からやり直します',

  // 시작 화면
  titleLine1: 'ポカポカ迷子ラリー',
  titleLine2: 'in 弘大',
  titleLead: 'スタンプを5つ集めて\nポカポカのバンに乗ろう！',
  howTo: [
    '画面をドラッグして歩きます',
    '人にぶつかるとHPが減ります',
    '団体ツアーは「すみません」で通り抜け',
    '屋台のごはんでHP回復',
    'ハトのそばはゆっくり歩きましょう',
  ],
  start: 'スタート',
  bestRecord: (time) => `自己ベスト ${time}`,

  // 클리어 화면
  clearTitle: 'ゴール！',
  clearTime: (time) => `クリアタイム ${time}`,
  clearHp: (hp) => `残りHP ${hp}`,
  newBest: '自己ベスト更新！',
  couponTitle: (amount) => `ポカポカ送迎 ${amount}引きクーポン`,
  couponNote: (until) => `${until}までのご予約で使えます\n予約1件につき1回・他の割引との併用はできません`,
  copy: 'コピー',
  copied: 'コピーしました！',
  shareThreads: 'Threadsでシェア',
  shareX: 'Xでシェア',
  saveImage: '画像を保存',
  reserve: 'ポカポカ送迎を予約する',
  reserveSoon: '予約ページは準備中です',
  playAgain: 'もう一度',
  shareText: (timeJa) => `弘大を${timeJa}で脱出！ #ポカポカ迷子ラリー`,

  // 결과 카드 이미지
  cardTitle: 'ポカポカ迷子ラリー in 弘大',
  cardEscape: (timeJa) => `弘大を${timeJa}で\n脱出！`,
  cardDetail: (time, hp) => `クリアタイム ${time}　残りHP ${hp}`,
  imageFileName: 'pokapoka-maigo.png',
};
