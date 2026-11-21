(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.__agDualMascotRig = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  /**
   * 双宠像素骨架与物理引擎（Aligned to Official Claude Clawd Pixel Grammar）
   * - 主宠栅格 PX = 3 (每格 3 CSS px), 离散动画节拍 TICK = 100ms
   * - 主体与腿爪耳尾零黑描边、零眼高光噪点、纯方块几何、暗部色 's'、1x2 竖瞳 'o'
   * - 动作道具采用同色系柔和中间调渲染
   */
  const PX = 3;
  const TICK = 100;

  const OFFICIAL_OPEN_REF = [
    '..############..',
    '..############..',
    '..##o######o##..',
    '..##o######o##..',
    '..############..',
    '################',
    '################',
    '..############..',
    '...#.#....#.#...',
    '...#.#....#.#...',
  ];

  const SHARED_PROP_PALETTE = {
    k: '#9c958c',
    w: '#fbf8f1',
    c: '#ecdfc6',
    g: '#a8a194',
    B: '#5b8fb9',
    b: '#cfe3ee',
    r: '#cc4f45',
    y: '#e8b64a',
    h: 'rgba(20, 20, 19, 0.20)',
    d: '#9a8e80',
    D: '#6f8ca6',
    p: '#ef9aa6',
    n: '#8b5e3c',
    l: '#6a6158',
    e: '#78716a',
    F: '#9e3324',
    f: '#c9642a',
    Y: '#e0a23c',
    V: '#fff1dc',
    m: 'rgba(120, 112, 104, 0.55)',
    G: '#7dff9b',
    t: 'rgba(125, 255, 155, 0.38)',
    N: '#ff6bd6',
    u: 'rgba(255, 107, 214, 0.38)',
    W: '#effff3',
    Z: '#232120',
    z: '#756f69',
    A: '#3d8bff',
    E: '#d6e8ff',
    C: '#2753a8',
    i: 'rgba(80, 150, 255, 0.78)',
    I: 'rgba(80, 150, 255, 0.32)',
    L: '#ff3b30',
    H: '#ffd6d2',
    x: '#b3312a',
    j: 'rgba(255, 80, 60, 0.78)',
    J: 'rgba(255, 80, 60, 0.32)',
    P: '#d87e64',
    M: '#ded6cc',
    R: '#ff3b4f',
    // 编排器冰晶：冰白受光面 / 冷灰背光面（纯平两色，无描边）
    a: '#c6d9f7',
    v: '#788eac',
  };

  const PALETTES = {
    clawd: {
      ...SHARED_PROP_PALETTE,
      '#': '#d97757',
      s: '#bf684c',
      o: '#141413',
      O: '#d97757',
      q: '#e8a88e',
      Q: '#f1cbbb',
    },
    cat: {
      ...SHARED_PROP_PALETTE,
      '#': '#947fd6',
      s: '#735eb5',
      o: '#141413',
      k: '#a89fc4',
      B: '#6a8fd6',
      O: '#947fd6',
      q: '#b6a7e6',
      Q: '#d9cff6',
    },
    cowboy: {
      '#': '#d97757',
      s: '#bf684c',
      o: '#141413',
      H: '#8b5e3c',
      R: '#a6744e',
      h: 'rgba(20, 20, 19, 0.18)',
    },
    shades: {
      '#': '#e0896b',
      s: '#c16f53',
      o: '#141413',
      G: '#141413',
      g: '#6d778a',
      w: '#ffffff',
      h: 'rgba(20, 20, 19, 0.18)',
    },
    wizard: {
      '#': '#8a74cf',
      s: '#6a56aa',
      o: '#141413',
      M: '#5c4b9e',
      y: '#e8b64a',
      b: '#cfe3ee',
      h: 'rgba(20, 20, 19, 0.18)',
    },
  };

  const F = (rows, ox = 0, oy = 0, extra = null) =>
    extra ? { rows, ox, oy, ...extra } : { rows, ox, oy };
  const rep = (s, n) => Array(n).fill(s);

  function mirrorFrame(fr, partW) {
    const w = Math.max(...fr.rows.map((r) => r.length));
    const rows = fr.rows.map((r) => r.padEnd(w, '.').split('').reverse().join(''));
    return F(rows, partW - (fr.ox + w), fr.oy, fr.grounded ? { grounded: true } : null);
  }

  function recolorFrame(fr, map) {
    return {
      ...fr,
      rows: fr.rows.map((r) => r.replace(/./g, (ch) => map[ch] || ch)),
    };
  }

  // ── Claude 官方 Clawd 分件点阵（16x10 标准画框，y=9 着地） ──────────────
  const CLAWD_PARTS = {
    shadow: {
      w12: { ox: 2, oy: 10, grounded: true, rows: ['hhhhhhhhhhhh'] },
      w14: { ox: 1, oy: 10, grounded: true, rows: ['hhhhhhhhhhhhhh'] },
      w10: { ox: 3, oy: 10, grounded: true, rows: ['hhhhhhhhhh'] },
    },
    body: {
      stand: { ox: 2, oy: 0, rows: rep('############', 8) },
      tall: { ox: 2, oy: -1, rows: rep('############', 9) },
      squash: { ox: 1, oy: 2, rows: ['.ssssssssssss.', ...rep('##############', 5)] },
      squash2: { ox: 1, oy: 4, rows: ['.ssssssssssss.', ...rep('##############', 4)] },
      flat: { ox: 2, oy: 7, rows: ['ssssssssssss', '############', '############'] },
      turnL: { ox: 2, oy: 0, rows: rep('###########s', 8) },
      turnR: { ox: 2, oy: 0, rows: rep('s###########', 8) },
      leanR: { ox: 2, oy: 0, rows: [...rep('.############', 4), ...rep('############.', 4)] },
      leanL: { ox: 1, oy: 0, rows: [...rep('############.', 4), ...rep('.############', 4)] },
      peek: { ox: 2, oy: 4, rows: ['############', '############', '############', '############'] },
    },
    eyes: {
      open: { ox: 4, oy: 2, rows: ['o......o', 'o......o'] },
      openL: { ox: 3, oy: 2, rows: ['o......o', 'o......o'] },
      openR: { ox: 5, oy: 2, rows: ['o......o', 'o......o'] },
      half: { ox: 4, oy: 3, rows: ['o......o'] },
      shut: { ox: 3, oy: 3, rows: ['oo......oo'] },
      happy: { ox: 3, oy: 2, rows: ['.o......o.', 'o.o....o.o'] },
      squint: { ox: 4, oy: 2, rows: ['o......o', '.o....o.', 'o......o'] },
      wide: { ox: 3, oy: 2, rows: ['oo......oo', 'oo......oo'] },
      peekOpen: { ox: 4, oy: 6, rows: ['o......o', 'o......o'] },
      peekHalf: { ox: 4, oy: 7, rows: ['o......o'] },
      flatEyes: { ox: 4, oy: 8, rows: ['oo....oo'] },
      // 随机眨眼闭眼帧：仅用暗面色 s 的 1 格高横线（零眼白高光）
      blink: { ox: 3, oy: 3, rows: ['ss......ss'] },
      // 抬头扫视：竖瞳整体上移 1 格（左上 / 正上 / 右上）
      upL: { ox: 3, oy: 1, rows: ['o......o', 'o......o'] },
      up: { ox: 4, oy: 1, rows: ['o......o', 'o......o'] },
      upR: { ox: 5, oy: 1, rows: ['o......o', 'o......o'] },
    },
    // 嘴部（打哈欠）：仅用暗面色 s 在身体中部开口
    mouth: {
      small: { ox: 6, oy: 5, rows: ['.ss.'] },
      yawn: { ox: 6, oy: 5, rows: ['ssss', '.ss.'] },
    },
    legs: {
      stand: { ox: 2, oy: 8, rows: ['.#.#....#.#.', '.#.#....#.#.'] },
      crouch: { ox: 2, oy: 9, rows: ['.#.#....#.#.'] },
      tuck: { ox: 2, oy: 8, rows: ['..#.#..#.#..'] },
      walkA: { ox: 2, oy: 8, rows: ['.#.s....#.s.', '.#......#...'] },
      walkB: { ox: 2, oy: 8, rows: ['.s.#....s.#.', '...#......#.'] },
      dangle: { ox: 2, oy: 8, rows: ['.#.#....#.#.', '.#.#........', '.#.#........'] },
      dangle2: { ox: 2, oy: 8, rows: ['.#.#....#.#.', '........#.#.', '........#.#.'] },
      flailA: { ox: 2, oy: 8, rows: ['#...#..#...#', '#..........#'] },
      flailB: { ox: 2, oy: 8, rows: ['..#.#..#.#..', '....#..#....'] },
      flailC: { ox: 2, oy: 8, rows: ['#..#....#..#', '...#....#..#'] },
    },
    clawL: {
      stub: { ox: 0, oy: 5, rows: ['##', '##'] },
      front: { ox: 0, oy: 5, rows: ['ss', 'ss'] },
      up: { ox: 0, oy: -2, rows: ['##', '##', '#.'] },
      low: { ox: -1, oy: 8, rows: ['###', '###'] },
      peekGrip: { ox: 3, oy: 7, rows: ['ss'] },
      flatLeft: { ox: 0, oy: 8, rows: ['ss'] },
      // 单钳张开（朝外的「<」形钳口），用于偶发开合与叠叠乐平衡张钳
      open: { ox: 0, oy: 4, rows: ['##', '.#', '##'] },
    },
    clawR: {
      stub: { ox: 14, oy: 5, rows: ['##', '##'] },
      front: { ox: 14, oy: 5, rows: ['ss', 'ss'] },
      up: { ox: 14, oy: -2, rows: ['##', '##', '.#'] },
      low: { ox: 14, oy: 8, rows: ['###', '###'] },
      reach1: { ox: 14, oy: 4, rows: ['...##', '#####'] },
      reach2: { ox: 14, oy: 3, rows: ['......##', '########'] },
      write1: { ox: 13, oy: 6, rows: ['ss', 'ss'] },
      write2: { ox: 14, oy: 5, rows: ['ss', 'ss'] },
      peekGrip: { ox: 11, oy: 7, rows: ['ss'] },
      flatRight: { ox: 14, oy: 8, rows: ['ss'] },
      open: { ox: 14, oy: 4, rows: ['##', '#.', '##'] },
      // 挥手外摆帧：举起的右钳向外倾 1 格（与 up 交替形成挥手）
      waveOut: { ox: 14, oy: -1, rows: ['.##', '.##', '#..'] },
    },
  };

  // ── Gemini 小紫猫分件点阵（仅限 ['#', 's', 'o', '.', ' ']，y=9 同地平线） ──
  const CAT_PARTS = {
    shadow: CLAWD_PARTS.shadow,
    ears: {
      stand: { ox: 2, oy: -1, rows: ['#..........#', '##........##'] },
      nod: { ox: 2, oy: 0, rows: ['#..........#', '##........##'] },
      loaf: { ox: 2, oy: 2, rows: ['#..........#', '##........##'] },
      airplane: { ox: 0, oy: 0, rows: ['##............##', '###..........###'] },
      peek: { ox: 2, oy: 3, rows: ['#..........#', '##........##'] },
      flat: { ox: 1, oy: 6, rows: ['#............#'] },
      // 偶发耳尖抖动：单侧耳尖瞬间收起 1~2 拍
      twitchL: { ox: 2, oy: -1, rows: ['...........#', '##........##'] },
      twitchR: { ox: 2, oy: -1, rows: ['#...........', '##........##'] },
    },
    body: {
      stand: { ox: 2, oy: 1, rows: rep('############', 7) },
      squash: { ox: 1, oy: 3, rows: ['.ssssssssssss.', ...rep('##############', 4)] },
      loaf: { ox: 1, oy: 4, rows: ['.ssssssssssss.', ...rep('##############', 4), '##############'] },
      flat: { ox: 2, oy: 7, rows: ['ssssssssssss', '############', '############'] },
      stretch: {
        ox: 2,
        oy: 0,
        rows: [
          's###########',
          '############',
          '############',
          '.###########',
          '.###########',
          '..##########',
          '############',
        ],
      },
      turnL: { ox: 2, oy: 1, rows: rep('###########s', 7) },
      turnR: { ox: 2, oy: 1, rows: rep('s###########', 7) },
      leanR: { ox: 2, oy: 1, rows: [...rep('.############', 4), ...rep('############.', 3)] },
      leanL: { ox: 1, oy: 1, rows: [...rep('############.', 4), ...rep('.############', 3)] },
      peek: { ox: 2, oy: 4, rows: ['############', '############', '############', '############'] },
    },
    eyes: {
      open: { ox: 4, oy: 3, rows: ['o......o', 'o......o'] },
      openL: { ox: 3, oy: 3, rows: ['o......o', 'o......o'] },
      openR: { ox: 5, oy: 3, rows: ['o......o', 'o......o'] },
      half: { ox: 4, oy: 4, rows: ['o......o'] },
      shut: { ox: 3, oy: 4, rows: ['oo......oo'] },
      happy: { ox: 3, oy: 3, rows: ['.o......o.', 'o.o....o.o'] },
      squint: { ox: 4, oy: 3, rows: ['o......o', '.o....o.', 'o......o'] },
      wide: { ox: 3, oy: 3, rows: ['oo......oo', 'oo......oo'] },
      loafShut: { ox: 3, oy: 6, rows: ['oo......oo'] },
      loafHalf: { ox: 4, oy: 6, rows: ['o......o'] },
      peekOpen: { ox: 4, oy: 6, rows: ['o......o', 'o......o'] },
      flatEyes: { ox: 4, oy: 8, rows: ['oo....oo'] },
      blink: { ox: 3, oy: 4, rows: ['ss......ss'] },
      upL: { ox: 3, oy: 2, rows: ['o......o', 'o......o'] },
      up: { ox: 4, oy: 2, rows: ['o......o', 'o......o'] },
      upR: { ox: 5, oy: 2, rows: ['o......o', 'o......o'] },
    },
    mouth: {
      small: { ox: 6, oy: 5, rows: ['.ss.'] },
      yawn: { ox: 6, oy: 5, rows: ['ssss', '.ss.'] },
    },
    legs: CLAWD_PARTS.legs,
    paws: {
      none: { ox: 0, oy: 0, rows: [] },
      groom1: { ox: 12, oy: 4, rows: ['ss', 'ss'] },
      groom2: { ox: 12, oy: 3, rows: ['ss', 'ss'] },
      cheer: { ox: 0, oy: 2, rows: ['#..............#', '#..............#'] },
      up: { ox: 0, oy: -1, rows: ['##............##', '##............##'] },
      peekGrip: { ox: 3, oy: 7, rows: ['ss......ss'] },
      write1: { ox: 13, oy: 5, rows: ['ss', 'ss'] },
      write2: { ox: 14, oy: 6, rows: ['ss', 'ss'] },
      // 单爪举起（敬礼 / 挥手）
      upR: { ox: 14, oy: 0, rows: ['##', '##'] },
    },
    tail: {
      up: { ox: 14, oy: 3, rows: ['.s', '.#', '.#', '##'] },
      sway: { ox: 14, oy: 3, rows: ['.#', '.#', 's#', '#.'] },
      curl: { ox: 14, oy: 4, rows: ['##', '.#', 's#'] },
      loaf: { ox: 14, oy: 6, rows: ['.#', '.#', 's#'] },
      puff: { ox: 14, oy: 2, rows: ['.#', '##', '##', 's#', '#.'] },
    },
  };

  // ── 道具与剧场精灵（迁移自 TauriTavern 并新增猫专属鱼盘/激光点） ─────────
  const PROPS = {
    quill1: F(['..B', '.B.', 'k..'], 15, 3),
    quill2: F(['..B', '.B.', 'k..'], 16, 4),
    sheet: F(['cccccc', 'ckkccc', 'gggggg'], 12, 8),

    // 擦杯子
    mug: F(['..DDDD', 'DDDbwD', 'D.DbbD', 'DDDbbD', '..DDDD'], 13, 4),
    cloth1: F(['cw..', 'wccc', '.cwc', '..c.'], 13, 2),
    cloth2: F(['..cw', 'cccw', '.cwc', '..c.'], 14, 3),

    // 吃饭（碗 + 筷子）
    bowl: F(['wwwww', 'DBwBD', '.DDD.'], 12, 7),
    bowlEmpty: F(['DgggD', '.DDD.'], 12, 8),
    chop1: F(['...n', '..n.', '.n..', 'n...'], 12, 4),
    chop2: F(['...n', '..n.', '.n..', 'w...'], 12, 3),

    // 小紫猫吃小鱼
    fishDish: F(['.PPsPP.', 'DDDDDDD', '.DDDDD.'], 11, 7),
    fishBone: F(['.M.M.M.', 'DDDDDDD', '.DDDDD.'], 11, 7),

    // 读信
    envS: F(['dddddd', 'ddwwdd', 'dwddwd', 'dwwwwd', 'dddddd'], 12, 5),
    envSOpen: F(['..dd..', '.dwwd.', 'dddddd', 'dwwwwd', 'dwwwwd', 'dddddd'], 12, 4),
    letter: F(['ddddddd', 'dcccccd', 'dgggccd', 'dcccccd', 'dggggcd', 'dcccccd', 'dggccrd', 'ddddddd'], 12, 1),

    // 种节点（沿右旁地面生长与枯萎）
    seed: F(['On', 'nO'], 15, 8, { grounded: true }),
    p1: F(['O', 'l', 'l'], 16, 7, { grounded: true }),
    p2: F(['O', 'l', 'l', 'l'], 16, 6, { grounded: true }),
    p3: F(['..O..', '..l..', 'O.l.O', '.lll.', '..l..'], 14, 5, { grounded: true }),
    p4: F(['..O..', 'O.l.O', '.lll.', 'O.l.O', '.lll.', '..l..', '..l..'], 14, 3, { grounded: true }),
    d1: F(['...O...', 'O.....O', '.O...O.', '.......', 'O.....O', '.......', '.......', '...O...'], 13, 0, { grounded: true }),
    d2: F(['.q...q.', '...q...', 'q.....q', '.......', '.q...q.', '.......', '...q...'], 13, -2, { grounded: true }),
    wilt1: F(['..q..', 'q.l.q', '.lll.', 'q.l.q', '.lll.', '..l..', '..l..'], 14, 3, { grounded: true }),
    wilt2: F(['q....', '.q.q.', '..ll.', '.q.l.', '..ll.', '..l..'], 14, 4, { grounded: true }),
    wilt3: F(['Q.Q', '.l.', 'Ql.', '.l.'], 15, 6, { grounded: true }),

    // 追蝴蝶
    bfUp: F(['B...B', 'BB.BB', '.BkB.', '..k..'], 13, -4),
    bfDn: F(['.....', '.....', 'BBkBB', '.BkB.'], 13, -4),
    bfLeftUp: F(['B...B', 'BB.BB', '.BkB.', '..k..'], 1, -5),
    bfLeftDn: F(['.....', '.....', 'BBkBB', '.BkB.'], 1, -5),
    bfRest: F(['..B..', '.BB..', '..k..'], 7, -3),

    // 荧光棒（右手绿，再镜像变色成左手紫粉）
    stickUp: F(['WW', 'GG', 'GG', 'GG', 'GG', 'GG', 'GG'], 14, -9),
    stickLT: F(['.....tt', 'WG...tt', '.GG..tt', '..GG.tt', '...GGtt', '....GGt', '.....GG'], 9, -9),
    stickRT: F(['tt.....', 'tt...GW', 'tt..GG.', 'tt.GG..', 'ttGG...', 'tGG....', 'GG.....'], 14, -9),

    // 警笛与光束（坐落头顶正中）
    sirenDim: F(['..LL..', '.xxxx.', '.xxxx.', 'llllll'], 5, -4),
    sirenL: F(['..Lx..', '.HLxx.', '.LLxx.', 'llllll'], 5, -4),
    sirenF: F(['..HH..', '.LHHL.', '.LLLL.', 'llllll'], 5, -4),
    sirenR: F(['..xL..', '.xxLH.', '.xxLL.', 'llllll'], 5, -4),
    beamL: F(['J.....', '.j....', '..j...', '......', 'Jjjj..', '......', '.Jjj..'], -1, -7),
    beamF: F(['J..JJ..J', '.j.jj.j.'], 4, -7),

    // Rickroll 立麦底座（grounded=true，身体左右摇晃时底座与麦克风立在舞台地面不动）
    micStand: F(['......ZZ......', '......Zz......', '......ZZ......', '......Z.......', '......Z.......', '.....ZZZZ.....'], 1, 4, { grounded: true }),
    micSink1: F(['......ZZ......', '......Zz......', '......ZZ......', '.....ZZZZ.....'], 1, 6, { grounded: true }),
    micSink2: F(['......ZZ......', '.....ZZZZ.....'], 1, 8, { grounded: true }),
    smoke: F(['.m.', 'mm.', '.mm', '.m.'], 6, -4),

    // 编排器冰晶（Orchestrator 模式常驻 Clawd 头顶）：6×5 菱形，左上冰白 a / 右下冷灰 v
    iceCrystal: F(['..av..', '.aavv.', 'aaavvv', '.aavv.', '..av..'], 5, -6),
    iceCrystalHi: F(['..av..', '.aavv.', 'aaavvv', '.aavv.', '..av..'], 5, -7),
  };

  ['stickUp', 'stickLT', 'stickRT'].forEach((k) => {
    PROPS[k + 'M'] = recolorFrame(mirrorFrame(PROPS[k], 16), { G: 'N', t: 'u' });
  });
  PROPS.beamR = mirrorFrame(PROPS.beamL, 16);
  ['sirenDim', 'sirenL', 'sirenF', 'sirenR', 'beamL', 'beamR', 'beamF'].forEach((k) => {
    PROPS[k + 'B'] = recolorFrame(PROPS[k], { L: 'A', H: 'E', x: 'C', j: 'i', J: 'I' });
  });

  // 背后火海算法生成（保留 Clawd/小紫猫轮廓一圈白光 'V'，火焰比本体暗一档）
  (() => {
    const sil = new Set();
    for (let y = 0; y <= 7; y++) for (let x = 2; x <= 13; x++) sil.add(`${x},${y}`);
    for (let y = 5; y <= 6; y++) [0, 1, 14, 15].forEach((x) => sil.add(`${x},${y}`));
    for (let y = 8; y <= 9; y++) [3, 5, 10, 12].forEach((x) => sil.add(`${x},${y}`));
    const glow = (x, y) =>
      y <= 9 &&
      !sil.has(`${x},${y}`) &&
      [-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => sil.has(`${x + dx},${y + dy}`)));

    const X0 = -3;
    const W = 22;
    const TONGUES = [
      [[-1, 15, 3, 3, 1], [3, 2, 3, 3, 0], [7, 10, 2, 3, -1.5], [11, 4, 3, 3, 0], [16, 14, 3, 3, -0.5]],
      [[-1, 14, 3, 3, 1.5], [3, 3, 3, 3, 0], [7, 11, 3, 2, -2], [11, 3, 3, 3, 0], [16, 15, 3, 3, -1]],
    ];
    const base = (x) => (x >= 2 && x <= 13 ? 0 : x >= 0 && x <= 15 ? 5 : 8);
    const SWAY = 2.4;
    const mk = (k, f) => {
      const tips = TONGUES[f % 2].map(([cx, h, sl, sr, lean], i) => {
        const by = base(cx);
        const ty = by - Math.round(h * k);
        return { cx, by, ty, sl, sr, h, sw: lean + SWAY * Math.sin((f * Math.PI) / 2 + i * 1.3) };
      });
      const heat = (x, y) =>
        Math.max(
          -1,
          ...tips.map(({ cx, by, ty, sl, sr, sw }) => {
            const rel = Math.max(0, Math.min(1, (by - y) / Math.max(1, by - ty)));
            const c = cx + sw * rel * rel;
            return y - ty - (x < c ? sl : sr) * Math.abs(x - c);
          })
        );
      const embers = new Set();
      tips.forEach(({ cx, ty, h, sw }, i) => {
        if (i % 3 === f % 3 && h * k >= 4) embers.add(`${Math.round(cx + sw + (i % 2 ? 1 : -1))},${ty - 2}`);
      });
      const cells = [];
      let y0 = 0;
      for (let y = -16; y <= 9; y++) {
        for (let i = 0; i < W; i++) {
          if (heat(X0 + i, y) >= 0 || embers.has(`${X0 + i},${y}`)) y0 = Math.min(y0, y);
        }
      }
      for (let y = y0 - 1; y <= 9; y++) {
        cells.push(
          Array.from({ length: W }, (_, i) => {
            const x = X0 + i;
            if (sil.has(`${x},${y}`)) return '.';
            if (glow(x, y)) return 'V';
            if (embers.has(`${x},${y}`)) return 'f';
            const e = heat(x, y);
            return e < 0 ? '.' : e < 1 ? 'F' : e < 4 ? 'f' : 'Y';
          }).join('')
        );
      }
      return F(cells, X0, y0 - 1, { grounded: true });
    };
    [
      [1, 0.35],
      [2, 0.7],
      [3, 1.05],
    ].forEach(([lv, k]) => {
      for (let f = 0; f < 4; f++) PROPS['fire' + lv + f] = mk(k, f);
    });
  })();

  const SYMS = {
    heart: F(['.r.r.', 'rrrrr', '.rrr.', '..r..'], 5, -7),
    spark: F(['..y..', '..y..', 'yyyyy', '..y..', '..y..'], 5, -8),
    z1: F(['kkkk', '..k.', '.k..', 'kkkk'], 10, -6),
    z2: F(['kkk', '.k.', 'kkk'], 12, -9),
    vein: F(['.r.r.', 'rr.rr', '.....', 'rr.rr', '.r.r.'], 5, -7),
    bang: F(['.r.', '.r.', '.r.', '...', '.r.'], 6, -8),
    q: F(['.kkk.', 'k...k', '...k.', '..k..', '.....', '..k..'], 5, -9),
    note: F(['..kk.', '..k.k', '..k..', 'kkk..', 'kk...'], 5, -8),
    sweat: F(['.B.', 'BbB', 'BbB', '.B.'], 13, -4),
    tilde: F(['.k...', 'k.k.k', '...k.'], 5, -7),
    // 打盹 z：从头顶右侧逐级变大上浮（3×3 → 4×4 → 5×5，块状无描边）
    dozeZ0: F(['kkk', '.k.', 'kkk'], 12, -3),
    dozeZ1: F(['kkkk', '..k.', '.k..', 'kkkk'], 13, -7),
    dozeZ2: F(['kkkkk', '...k.', '..k..', '.k...', 'kkkkk'], 14, -12),
  };

  // ── 刚体层登记：道具与符号在整数格挤压时只做整格平移、不参与行列增删 ────
  const RIGID_LAYERS = new WeakSet();
  Object.values(PROPS).forEach((l) => RIGID_LAYERS.add(l));
  Object.values(SYMS).forEach((l) => RIGID_LAYERS.add(l));

  // 整格平移帧（带缓存，避免每拍新建对象；保持刚体登记属性）
  const SHIFT_CACHE = new WeakMap();
  function shiftFrame(fr, dx, dy) {
    if (!fr || (!dx && !dy)) return fr;
    let bucket = SHIFT_CACHE.get(fr);
    if (!bucket) {
      bucket = new Map();
      SHIFT_CACHE.set(fr, bucket);
    }
    const key = dx + ',' + dy;
    let out = bucket.get(key);
    if (!out) {
      out = { ...fr, ox: fr.ox + dx, oy: fr.oy + dy };
      bucket.set(key, out);
      if (RIGID_LAYERS.has(fr)) RIGID_LAYERS.add(out);
    }
    return out;
  }

  // ── 3 只迷你装扮小蟹（PX = 2 彩蛋堆，保持 MINI_SPRITES 三键契约） ─────────
  const MINI_SPRITES = {
    cowboy: F([
      '.....HHHHHH.....',
      '...HHHHHHHHHH...',
      '..RRRRRRRRRRRR..',
      '..############..',
      '..##o######o##..',
      '################',
      '..############..',
      '...#.#....#.#...',
    ], 0, -2),
    shades: F([
      '..############..',
      '..GGGGg##gGGGG..',
      '..GGGGGGGGGGGG..',
      '################',
      '..############..',
      '...#.#....#.#...',
    ], 0, 0),
    wizard: F([
      '.......MM.......',
      '......MyMM......',
      '.....MMMMMM.....',
      '..MMMMMMMMMMMM..',
      '..############..',
      '..##o######o##..',
      '################',
      '..############..',
      '...#.#....#.#...',
    ], 0, -3),
  };

  // 迷你蟹行走帧与招牌小把戏
  const MINI_ANIM_FRAMES = {
    cowboy: {
      walkB: F([
        '.....HHHHHH.....',
        '...HHHHHHHHHH...',
        '..RRRRRRRRRRRR..',
        '..############..',
        '..##o######o##..',
        '################',
        '..############..',
        '..s#.#....#.#s..',
      ], 0, -2),
      trick: F([
        '....HHHHHH......',
        '..HHHHHHHHHH....',
        '.RRRRRRRRRRRR...',
        '..############..',
        '..##o######o##..',
        '################',
        '..############..',
        '..#..#....#..#..',
      ], 0, -3),
    },
    shades: {
      walkB: F([
        '..############..',
        '..GGGGg##gGGGG..',
        '..GGGGGGGGGGGG..',
        '################',
        '..############..',
        '..s#.#....#.#s..',
      ], 0, 0),
      trick: F([
        '..############..',
        '..GwGGw##GwGGw..',
        '..GGGGGGGGGGGG..',
        '################',
        '..############..',
        '...#.#....#.#...',
      ], 0, 0),
    },
    wizard: {
      walkB: F([
        '.......MM.......',
        '......MyMM......',
        '.....MMMMMM.....',
        '..MMMMMMMMMMMM..',
        '..############..',
        '..##o######o##..',
        '################',
        '..############..',
        '..s#.#....#.#s..',
      ], 0, -3),
      trick: F([
        '.....y..........',
        '....yMyMM.......',
        '.....MMMMMM.....',
        '..MMMMMMMMMMMM..',
        '..############..',
        '..##o######o##..',
        '################',
        '..############y.',
        '...#.#....#.#.y.',
      ], 0, -3),
    },
  };

  function resolveClawdStandGrid() {
    const grid = Array.from({ length: 10 }, () => Array(16).fill('.'));
    const paint = (part) => {
      part.rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          const ch = row[rx];
          if (ch !== '.' && ch !== ' ') {
            const x = part.ox + rx;
            const y = part.oy + ry;
            if (y >= 0 && y < 10 && x >= 0 && x < 16) grid[y][x] = ch;
          }
        }
      });
    };
    paint(CLAWD_PARTS.legs.stand);
    paint(CLAWD_PARTS.body.stand);
    paint(CLAWD_PARTS.eyes.open);
    paint(CLAWD_PARTS.clawL.stub);
    paint(CLAWD_PARTS.clawR.stub);
    return grid.map((r) => r.join(''));
  }

  function drawLayerSet(ctx, oxGrid, oyGrid, pxSize, palette, layers, colorResolver = null) {
    let lf = '';
    for (const part of layers) {
      if (!part || !part.rows || !part.rows.length) continue;
      for (let ry = 0; ry < part.rows.length; ry++) {
        const row = part.rows[ry], py = (oyGrid + part.oy + ry) * pxSize;
        for (let rx = 0; rx < row.length; rx++) {
          const ch = row[rx];
          if (ch === '.' || ch === ' ') continue;
          const gx = part.ox + rx;
          const color = colorResolver ? colorResolver(ch, gx, part.oy + ry, palette) : palette[ch];
          if (!color) continue;
          let r = 1;
          if (!colorResolver) while (rx + r < row.length && row[rx + r] === ch) r++;
          if (color !== lf) ctx.fillStyle = lf = color;
          ctx.fillRect((oxGrid + gx) * pxSize, py, pxSize * r, pxSize);
          rx += r - 1;
        }
      }
    }
  }

  // ── 整数格挤压（替代 ctx.scale 浮点缩放）─────────────────────────────────
  // 思路：把弹性身体部件合成为一张字符点阵，再按「中心接缝最近邻」在整格层面
  // 增删行/列（优先选纯色体块行列、靠近中心、保护眼睛 o 与暗面 s 特征和着地腿），
  // 水平中心与底边锚定。这样每个方块永远是精确 PX×PX，边缘锐利不糊。
  function compositeGrid(layers) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const part of layers) {
      if (!part || !part.rows) continue;
      part.rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          const ch = row[rx];
          if (ch === '.' || ch === ' ') continue;
          const x = part.ox + rx;
          const y = part.oy + ry;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      });
    }
    if (minX === Infinity) return null;
    const W = maxX - minX + 1;
    const H = maxY - minY + 1;
    const g = Array.from({ length: H }, () => Array(W).fill('.'));
    for (const part of layers) {
      if (!part || !part.rows) continue;
      part.rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          const ch = row[rx];
          if (ch === '.' || ch === ' ') continue;
          g[part.oy + ry - minY][part.ox + rx - minX] = ch;
        }
      });
    }
    return { g, minX, minY, W, H };
  }

  // 选择要删除/复制的接缝线（行或列）；lines 为字符串数组
  function pickSeams(lines, count, remove, protectTail) {
    const n = lines.length;
    if (!count || n < 3) return new Set();
    const center = (n - 1) / 2;
    const cand = [];
    for (let i = 0; i < n; i++) {
      const line = lines[i];
      const blank = !/[^.]/.test(line);
      const pure = !blank && /^[#.]+$/.test(line);
      const same = (i > 0 && lines[i - 1] === line) || (i < n - 1 && lines[i + 1] === line);
      let score = Math.abs(i - center) + (pure ? 0 : same ? 2 : 20);
      if (blank) score += 40;
      if (protectTail && i >= n - protectTail) score += 30;
      if (i === 0 || i === n - 1) score += 8;
      cand.push({ i, score, pure });
    }
    cand.sort((a, b) => a.score - b.score || a.i - b.i);
    const chosen = new Set();
    const limit = Math.min(count, n - 2);
    // 第一轮：删除非纯色线时必须保留一条未被删除的同形邻线，防止特征整体消失
    for (const c of cand) {
      if (chosen.size >= limit) break;
      if (remove && !c.pure) {
        const ok = (j) => j >= 0 && j < n && !chosen.has(j) && lines[j] === lines[c.i];
        if (!ok(c.i - 1) && !ok(c.i + 1)) continue;
      }
      chosen.add(c.i);
    }
    for (const c of cand) {
      if (chosen.size >= limit) break;
      chosen.add(c.i);
    }
    return chosen;
  }

  function buildSeamMap(n, removeSet, dupSet) {
    const map = [];
    for (let i = 0; i < n; i++) {
      if (removeSet.has(i)) continue;
      map.push(i);
      if (dupSet.has(i)) map.push(i);
    }
    return map;
  }

  /**
   * 对弹性部件做整数格挤压，返回 { layer, shiftX(x), shiftY(y) }。
   * sqW / sqH 为整数格增量（正=拉宽/拉高，负=压窄/压扁）。
   */
  function squashLayersToGrid(layers, sqW, sqH) {
    const comp = compositeGrid(layers);
    if (!comp) return null;
    const { g, minX, minY, W, H } = comp;
    const rowsStr = g.map((r) => r.join(''));
    const colsStr = Array.from({ length: W }, (_, x) => g.map((r) => r[x]).join(''));
    const dw = Math.max(-(W - 2), Math.round(sqW || 0));
    const dh = Math.max(-(H - 2), Math.round(sqH || 0));
    const colPick = pickSeams(colsStr, Math.abs(dw), dw < 0, 0);
    const rowPick = pickSeams(rowsStr, Math.abs(dh), dh < 0, 2);
    const colMap = buildSeamMap(W, dw < 0 ? colPick : new Set(), dw > 0 ? colPick : new Set());
    const rowMap = buildSeamMap(H, dh < 0 ? rowPick : new Set(), dh > 0 ? rowPick : new Set());
    const newW = colMap.length;
    const newH = rowMap.length;
    const left = minX + Math.round((W - newW) / 2); // 水平中心锚定
    const top = minY + (H - newH); // 底边锚定
    const rows = rowMap.map((ry) => colMap.map((cx) => g[ry][cx]).join(''));
    // 源行/列 → 目标位置（被删除的线映射到其下方/右方最近保留线）
    const targetOf = (map, src, n) => {
      for (let s = src; s < n; s++) {
        const t = map.indexOf(s);
        if (t >= 0) return t;
      }
      return map.length;
    };
    const shiftY = (y) => {
      if (y > minY + H - 1) return 0;
      const src = Math.max(0, y - minY);
      return top + targetOf(rowMap, src, H) - (minY + src);
    };
    const shiftX = (x) => {
      const src = Math.max(0, Math.min(W - 1, x - minX));
      return left + targetOf(colMap, src, W) - (minX + src);
    };
    return { layer: { rows, ox: left, oy: top }, shiftX, shiftY };
  }

  const DOZE_TICK = 400;
  const LAYER_SIG_MAP = new WeakMap();

  function computeLayersFrameIdx(layers) {
    let key = '';
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      if (!l) continue;
      let sig = LAYER_SIG_MAP.get(l);
      if (sig === undefined) {
        sig = Array.isArray(l.rows)
          ? `${l.ox || 0},${l.oy || 0},${l.grounded ? 1 : 0}:${l.rows.join('/')}`
          : String(i);
        LAYER_SIG_MAP.set(l, sig);
      }
      key += (key ? '|' : '') + sig;
    }
    return key;
  }

  function renderPixelLayers(canvas, dpr, oxGrid, oyGrid, pxSize, palette, layers, options = {}) {
    const ctx = canvas.__agCtx2d || (canvas.__agCtx2d = canvas.getContext('2d'));
    if (!ctx) return;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.imageSmoothingEnabled = false;

    const mirror = Boolean(options.mirror);
    // 垂直位移吸附到整格，保证方块网格不出现亚格错位
    const tyPx = Math.round(Number(options.tyPx || 0) / pxSize) * pxSize;
    const rotDeg = Number(options.rotDeg || 0);
    const clipBottomY = options.clipBottomY;
    // 兼容旧入参 sxScale/syScale：换算为 16×10 画框上的整数格增量
    const sqW =
      options.sqW !== undefined ? Math.round(options.sqW) : Math.round(16 * (Number(options.sxScale || 1) - 1));
    const sqH =
      options.sqH !== undefined ? Math.round(options.sqH) : Math.round(10 * (Number(options.syScale || 1) - 1));

    const anchorX = (oxGrid + 8) * pxSize;
    const anchorY = (oyGrid + 10) * pxSize;

    const groundedLayers = [];
    const bodyLayers = [];
    const rigidLayers = [];
    for (const layer of layers) {
      if (!layer) continue;
      if (layer.grounded) groundedLayers.push(layer);
      else if (RIGID_LAYERS.has(layer)) rigidLayers.push(layer);
      else bodyLayers.push(layer);
    }

    // 弹性层最终列表：挤压时身体合成为一张整格点阵，道具/符号整格平移随行
    let elasticLayers;
    if ((sqW || sqH) && bodyLayers.length) {
      const sq = squashLayersToGrid(bodyLayers, sqW, sqH);
      if (sq) {
        elasticLayers = [sq.layer];
        for (const r of rigidLayers) {
          const w = Math.max(1, ...r.rows.map((row) => row.length));
          // 左右边缘平移量取均值：加宽时居中符号保持居中，偏侧道具随该侧移动
          const dx = Math.round((sq.shiftX(r.ox) + sq.shiftX(r.ox + w - 1)) / 2);
          const dy = sq.shiftY(r.oy + r.rows.length - 1);
          elasticLayers.push(shiftFrame(r, dx, dy));
        }
      }
    }
    if (!elasticLayers) elasticLayers = [...bodyLayers, ...rigidLayers];
    // 保持原有绘制顺序：身体部件 → 道具 → 符号（rigid 本就位于末尾）

    ctx.save();
    if (typeof clipBottomY === 'number') {
      ctx.beginPath();
      ctx.rect(0, 0, cssW, clipBottomY);
      ctx.clip();
    }

    // 地面/背景独立层（影子、火海衬底、生长节点、地面激光、立麦架）不随挤压或歪头旋转
    if (groundedLayers.length) {
      ctx.save();
      if (mirror) {
        ctx.translate(anchorX, 0);
        ctx.scale(-1, 1);
        ctx.translate(-anchorX, 0);
      }
      drawLayerSet(ctx, oxGrid, oyGrid, pxSize, palette, groundedLayers);
      ctx.restore();
    }

    const paintElastic = (c2) => {
      c2.save();
      c2.translate(0, tyPx);
      if (mirror) {
        c2.translate(anchorX, 0);
        c2.scale(-1, 1);
        c2.translate(-anchorX, 0);
      }
      drawLayerSet(c2, oxGrid, oyGrid, pxSize, palette, elasticLayers, options.colorResolver || null);
      if (typeof options.overlayPainter === 'function') {
        options.overlayPainter(c2, oxGrid, oyGrid, pxSize);
      }
      c2.restore();
    };

    if (!rotDeg) {
      paintElastic(ctx);
    } else {
      // 拖拽摆角：先在离屏画布上按整格绘制，再整体旋转贴图（关闭平滑，避免逐块缝隙与模糊）
      let off = canvas.__agRotOff;
      const docRef = canvas.ownerDocument;
      if (!off && docRef && typeof docRef.createElement === 'function') {
        off = docRef.createElement('canvas');
        canvas.__agRotOff = off;
      }
      const offCtx = off ? off.getContext('2d') : null;
      if (!offCtx) {
        ctx.translate(anchorX, anchorY);
        ctx.rotate((rotDeg * Math.PI) / 180);
        ctx.translate(-anchorX, -anchorY);
        paintElastic(ctx);
      } else {
        if (off.width !== canvas.width || off.height !== canvas.height) {
          off.width = canvas.width;
          off.height = canvas.height;
        }
        offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        offCtx.clearRect(0, 0, cssW, cssH);
        offCtx.imageSmoothingEnabled = false;
        paintElastic(offCtx);
        ctx.imageSmoothingEnabled = false;
        ctx.translate(anchorX, anchorY);
        ctx.rotate((rotDeg * Math.PI) / 180);
        ctx.translate(-anchorX, -anchorY);
        ctx.drawImage(off, 0, 0, cssW, cssH);
      }
    }
    ctx.restore();
  }

  // 可被随机眨眼覆盖眼部的姿态；小紫猫慢摆尾的姿态
  const BLINKABLE_POSES = new Set(['idle', 'walk', 'lookNod', 'readAlong', 'gaze']);
  const SLOW_TAIL_POSES = new Set(['idle', 'lookNod', 'readAlong', 'gaze']);
  // 冰晶让位：头顶已有道具的姿态不挂冰晶；居中符号出现时冰晶暂隐，仅侧边汗滴与打盹 z 可共存
  const CRYSTAL_HIDE_POSES = new Set(['siren', 'onFire', 'cheerSticks', 'peek', 'flat', 'rickroll', 'carry']);
  const CRYSTAL_OK_SYMS = new Set([SYMS.sweat, SYMS.z1, SYMS.z2, SYMS.dozeZ0, SYMS.dozeZ1, SYMS.dozeZ2]);
  // 哈欠接伸懒腰：前 10 拍打哈欠，之后伸懒腰
  const YAWN_STRETCH_SPLIT = 10;

  /**
   * opts 新增（均可选，旧调用不受影响）：
   * - blinkStage: 'half' | 'closed'  随机眨眼过渡阶段（1×2 → 1×1 → 闭 → 1×1 → 1×2）
   * - breath: true                    待机呼吸下沉 1 格（腿收短 1 格、影子宽 ±1 格）
   * - earTwitch: 'L' | 'R'            小紫猫偶发耳尖抖动
   * - clawSnap: 'L' | 'R'             Clawd 偶发单钳张开
   * - clipParam: number               双宠剧目的错峰参数（如点头时刻）
   * - reduced: true                   减少动态偏好：尾巴静止
   * - crystal: true                   Clawd 头顶常驻编排器冰晶（crystalBob 控制 1 格上浮）
   */
  function buildClipLayers(kind, poseKey, tickIdx, opts = {}) {
    if (poseKey === 'yawnStretch') {
      // 复合剧目：哈欠 → 伸懒腰（按剧目本地拍拆分）
      const lt = Number(opts.clipTick ?? tickIdx);
      const first = lt < YAWN_STRETCH_SPLIT;
      return buildClipLayers(kind, first ? 'yawn' : 'stretch', tickIdx, {
        ...opts,
        clipTick: first ? lt : lt - YAWN_STRETCH_SPLIT,
      });
    }
    const isCat = kind === 'cat';
    const frameMod = tickIdx % 2;
    const phase4 = tickIdx % 4;
    const sym = opts.sym ? SYMS[opts.sym] : null;
    const localTick = Number(opts.clipTick ?? tickIdx);
    const clipMod = localTick % 2;
    const blinkStage = opts.blinkStage || (opts.blink ? 'closed' : null);
    let sink = 0; // 整体下沉格数（呼吸 / 步态落脚 / 点头），只平移身体部件

    if (!isCat) {
      const p = CLAWD_PARTS;
      let backProp = null;
      let shadow = opts.noShadow ? null : p.shadow.w12;
      let body = p.body.stand;
      let eyes = opts.eyeScan === -1 ? p.eyes.openL : opts.eyeScan === 1 ? p.eyes.openR : p.eyes.open;
      let legs = p.legs.stand;
      let clawL = p.clawL.stub;
      let clawR = p.clawR.stub;
      let prop1 = null;
      let prop2 = null;
      let mouth = null;
      let extraSym = sym;

      switch (poseKey) {
        case 'flat':
          shadow = p.shadow.w14;
          body = p.body.flat;
          eyes = p.eyes.flatEyes;
          legs = null;
          clawL = p.clawL.flatLeft;
          clawR = p.clawR.flatRight;
          break;
        case 'squash':
          shadow = p.shadow.w14;
          body = p.body.squash;
          eyes = p.eyes.squint;
          legs = p.legs.crouch;
          break;
        case 'dangle':
          shadow = null;
          body = frameMod ? p.body.turnL : p.body.turnR;
          eyes = p.eyes.wide;
          legs = [p.legs.dangle, p.legs.flailA, p.legs.dangle2, p.legs.flailB][phase4];
          clawL = p.clawL.up;
          clawR = p.clawR.up;
          break;
        case 'walk': {
          // 4 拍步态 [walkA, stand, walkB, stand]，每拍 2 tick；落脚拍整体下沉 1 格形成蹒跚感
          const beat = Math.floor(tickIdx / 2) % 4;
          legs = [p.legs.walkA, p.legs.stand, p.legs.walkB, p.legs.stand][beat];
          body = opts.dir === 'left' ? p.body.turnL : p.body.turnR;
          if (beat % 2 === 0) sink = 1;
          break;
        }
        case 'write':
          body = frameMod ? p.body.stand : p.body.turnR;
          legs = p.legs.crouch;
          clawR = frameMod ? p.clawR.write1 : p.clawR.write2;
          prop1 = PROPS.sheet;
          prop2 = frameMod ? PROPS.quill1 : PROPS.quill2;
          break;
        case 'pet':
        case 'happy':
          eyes = p.eyes.happy;
          body = frameMod ? p.body.squash : p.body.stand;
          legs = frameMod ? p.legs.crouch : p.legs.stand;
          clawL = p.clawL.up;
          clawR = p.clawR.up;
          break;
        case 'sleep':
          body = p.body.squash;
          eyes = p.eyes.shut;
          legs = p.legs.tuck;
          break;
        case 'jiggle':
          legs = [p.legs.flailA, p.legs.flailB, p.legs.flailC][tickIdx % 3];
          clawL = p.clawL.up;
          clawR = p.clawR.up;
          eyes = p.eyes.happy;
          break;
        case 'peek':
          shadow = null;
          body = p.body.peek;
          eyes = phase4 === 3 ? p.eyes.peekHalf : p.eyes.peekOpen;
          legs = null;
          clawL = p.clawL.peekGrip;
          clawR = p.clawR.peekGrip;
          break;
        case 'angry':
          body = frameMod ? p.body.squash : p.body.stand;
          eyes = p.eyes.squint;
          legs = frameMod ? p.legs.walkA : p.legs.walkB;
          break;
        case 'tilt':
          body = p.body.turnL;
          eyes = p.eyes.half;
          break;
        case 'wow':
          body = p.body.tall;
          eyes = p.eyes.wide;
          clawL = p.clawL.up;
          clawR = p.clawR.up;
          break;
        case 'sulk':
          body = p.body.turnL;
          eyes = clipMod ? p.eyes.squint : p.eyes.shut;
          legs = p.legs.tuck;
          clawL = p.clawL.front;
          clawR = p.clawR.front;
          extraSym = sym || SYMS.vein;
          break;
        case 'polish':
          body = p.body.turnR;
          eyes = phase4 === 2 ? p.eyes.happy : p.eyes.open;
          clawR = p.clawR.front;
          prop1 = PROPS.mug;
          prop2 = clipMod ? PROPS.cloth1 : PROPS.cloth2;
          break;
        case 'eat':
          body = localTick > 22 ? p.body.stand : p.body.squash;
          legs = localTick > 22 ? p.legs.stand : p.legs.crouch;
          eyes = localTick > 22 ? p.eyes.happy : clipMod ? p.eyes.half : p.eyes.open;
          prop1 = localTick > 20 ? PROPS.bowlEmpty : PROPS.bowl;
          prop2 = localTick > 20 ? null : clipMod ? PROPS.chop2 : PROPS.chop1;
          extraSym = localTick > 22 ? SYMS.heart : sym;
          break;
        case 'eatFish':
          body = localTick > 20 ? p.body.stand : p.body.squash;
          eyes = localTick > 20 ? p.eyes.happy : p.eyes.half;
          prop1 = localTick > 18 ? PROPS.fishBone : PROPS.fishDish;
          extraSym = localTick > 20 ? SYMS.heart : sym;
          break;
        case 'letter':
          body = p.body.turnR;
          eyes = localTick >= 10 && localTick <= 18 ? p.eyes.half : localTick > 18 ? p.eyes.happy : p.eyes.open;
          prop1 = localTick < 6 ? PROPS.envS : localTick < 11 ? PROPS.envSOpen : PROPS.letter;
          extraSym = localTick > 18 ? SYMS.heart : sym;
          break;
        case 'plant':
          body = localTick < 8 ? p.body.squash2 : p.body.stand;
          legs = localTick < 8 ? p.legs.crouch : p.legs.stand;
          clawR = localTick < 8 ? p.clawR.low : p.clawR.stub;
          eyes = localTick >= 16 && localTick <= 24 ? p.eyes.happy : localTick > 24 ? p.eyes.half : p.eyes.open;
          prop1 =
            localTick < 5
              ? PROPS.seed
              : localTick < 9
                ? PROPS.p1
                : localTick < 13
                  ? PROPS.p2
                  : localTick < 17
                    ? PROPS.p3
                    : localTick < 23
                      ? PROPS.p4
                      : localTick < 27
                        ? PROPS.wilt1
                        : localTick < 31
                          ? PROPS.wilt2
                          : PROPS.wilt3;
          prop2 = localTick >= 17 && localTick < 21 ? PROPS.d1 : localTick >= 21 && localTick < 23 ? PROPS.d2 : null;
          extraSym = localTick > 28 ? SYMS.sweat : sym;
          break;
        case 'butterfly': {
          const leftPhase = localTick % 16 >= 8;
          const resting = localTick >= 24 && localTick <= 30;
          eyes = resting ? p.eyes.happy : leftPhase ? p.eyes.openL : p.eyes.openR;
          clawR = localTick % 10 < 5 ? p.clawR.reach1 : p.clawR.stub;
          prop1 = resting ? PROPS.bfRest : leftPhase ? (clipMod ? PROPS.bfLeftUp : PROPS.bfLeftDn) : clipMod ? PROPS.bfUp : PROPS.bfDn;
          extraSym = resting ? SYMS.spark : sym;
          break;
        }
        case 'stretch':
          body = p.body.tall;
          legs = p.legs.stand;
          clawL = p.clawL.up;
          clawR = p.clawR.up;
          eyes = p.eyes.shut;
          extraSym = sym || SYMS.tilde;
          break;
        case 'spinHop':
          body = [p.body.turnR, p.body.stand, p.body.turnL, p.body.squash][phase4];
          eyes = phase4 === 3 ? p.eyes.happy : p.eyes.open;
          legs = phase4 === 3 ? p.legs.crouch : p.legs.tuck;
          break;
        case 'onFire': {
          const cooling = localTick >= 30;
          const lv = localTick < 5 ? 1 : localTick < 10 ? 2 : 3;
          backProp = cooling ? null : PROPS['fire' + lv + (localTick % 4)];
          prop1 = PROPS.mug;
          eyes = p.eyes.open; // 灵魂淡定 ("This is fine")
          extraSym = cooling
            ? PROPS.smoke
            : SYMS['fireSpark' + (localTick % 3)];
          break;
        }
        case 'cheerSticks':
          body = frameMod ? p.body.squash : p.body.stand;
          legs = frameMod ? p.legs.crouch : p.legs.stand;
          eyes = p.eyes.happy;
          clawL = p.clawL.up;
          clawR = p.clawR.up;
          prop1 = [PROPS.stickLT, PROPS.stickUp, PROPS.stickRT, PROPS.stickUp][phase4];
          prop2 = [PROPS.stickRTM, PROPS.stickUpM, PROPS.stickLTM, PROPS.stickUpM][phase4];
          extraSym = sym || SYMS.note;
          break;
        case 'rickroll':
          body = [p.body.leanR, p.body.squash, p.body.leanL, p.body.stand][phase4];
          eyes = clipMod ? p.eyes.happy : p.eyes.open;
          clawL = clipMod ? p.clawL.up : p.clawL.stub;
          clawR = clipMod ? p.clawR.stub : p.clawR.up;
          prop1 = localTick > 33 ? PROPS.micSink2 : localTick > 30 ? PROPS.micSink1 : PROPS.micStand;
          extraSym = sym || SYMS.note;
          break;
        case 'siren': {
          const isBlue = Math.floor(localTick / 6) % 2 === 1;
          const sfx = isBlue ? 'B' : '';
          const step4 = localTick % 4;
          const sirenName = ['sirenL', 'sirenF', 'sirenR', 'sirenDim'][step4];
          const beamName = step4 === 0 ? 'beamL' : step4 === 1 ? 'beamF' : step4 === 2 ? 'beamR' : null;
          body = clipMod ? p.body.squash : p.body.stand;
          eyes = p.eyes.wide;
          prop1 = PROPS[sirenName + sfx];
          prop2 = beamName ? PROPS[beamName + sfx] : null;
          extraSym = clipMod ? SYMS.bang : SYMS.sweat;
          break;
        }
        case 'chatGreet':
          body = clipMod ? p.body.stand : p.body.squash;
          eyes = p.eyes.happy;
          clawL = clipMod ? p.clawL.up : p.clawL.stub;
          extraSym = sym || (clipMod ? SYMS.heart : SYMS.note);
          break;
        case 'lookNod': {
          // 对视点头：转向伙伴，在错峰时刻点头一次（下沉 1 格 2 拍 + 笑眼）
          const faceL = opts.dir === 'left';
          const nodAt = Number(opts.clipParam ?? 5);
          const nodding = localTick >= nodAt && localTick < nodAt + 2;
          body = faceL ? p.body.turnL : p.body.turnR;
          eyes = nodding ? p.eyes.happy : faceL ? p.eyes.openL : p.eyes.openR;
          if (nodding) {
            sink = 1;
            legs = p.legs.crouch;
          }
          extraSym = sym || (localTick >= nodAt + 2 && localTick < nodAt + 8 ? SYMS.note : null);
          break;
        }
        case 'readAlong': {
          // 并排跟读：与伙伴同一起始拍，同步轻点头 3 拍
          const beatOn = localTick >= 2 && localTick < 14 && (localTick - 2) % 4 < 2;
          eyes = beatOn ? p.eyes.half : p.eyes.open;
          if (beatOn) {
            sink = 1;
            legs = p.legs.crouch;
          }
          extraSym = sym || SYMS.note;
          break;
        }
        case 'balance':
          // 叠叠乐上层保持平衡：双钳张开、睁大眼
          eyes = p.eyes.wide;
          clawL = p.clawL.open;
          clawR = p.clawR.open;
          break;
        case 'yawn':
          // 打哈欠：张嘴 1 拍 → 闭眼大张嘴 + 拉高举钳 7 拍 → 半眼收嘴
          if (localTick < 2) {
            eyes = p.eyes.half;
            mouth = p.mouth.small;
          } else if (localTick < 9) {
            body = p.body.tall;
            eyes = p.eyes.shut;
            mouth = p.mouth.yawn;
            clawL = p.clawL.up;
            clawR = p.clawR.up;
            extraSym = sym || (localTick >= 4 ? SYMS.tilde : null);
          } else {
            eyes = p.eyes.half;
          }
          break;
        case 'wave': {
          // 单钳挥手 3 次：右钳在 up / waveOut 间每 2 拍切换，之后放下冒心
          const waving = localTick < 12;
          eyes = p.eyes.happy;
          clawR = waving ? (Math.floor(localTick / 2) % 2 ? p.clawR.waveOut : p.clawR.up) : p.clawR.stub;
          extraSym = sym || (waving ? SYMS.note : SYMS.heart);
          break;
        }
        case 'gaze': {
          // 扫视：转身 + 竖瞳偏向目标侧；clipParam=1 时抬头
          const faceL = opts.dir === 'left';
          const up = opts.clipParam === 1;
          body = faceL ? p.body.turnL : p.body.turnR;
          eyes = up ? (faceL ? p.eyes.upL : p.eyes.upR) : faceL ? p.eyes.openL : p.eyes.openR;
          break;
        }
        case 'worry':
          // 担忧：半眼、收腿、双钳护在身前，默认冒汗
          eyes = clipMod ? p.eyes.half : p.eyes.squint;
          legs = p.legs.tuck;
          clawL = p.clawL.front;
          clawR = p.clawR.front;
          extraSym = sym || SYMS.sweat;
          break;
        case 'salute':
          // 敬礼 / 举钳：右钳高举，笑眼
          eyes = p.eyes.happy;
          clawR = p.clawR.up;
          extraSym = sym || SYMS.spark;
          break;
        case 'carry':
          // 头顶驮着迷你蟹：抬眼看头顶、双钳微张保持平衡
          eyes = p.eyes.up;
          clawL = p.clawL.open;
          clawR = p.clawR.open;
          break;
        default:
          break;
      }

      if (poseKey === 'idle') {
        if (opts.clawSnap === 'L') clawL = p.clawL.open;
        else if (opts.clawSnap === 'R') clawR = p.clawR.open;
        if (opts.breath) {
          sink = 1;
          legs = p.legs.crouch;
          if (shadow) shadow = p.shadow.w14;
        }
      }
      if (blinkStage && BLINKABLE_POSES.has(poseKey)) {
        const eyeDx = eyes === p.eyes.open ? 0 : eyes === p.eyes.openL ? -1 : eyes === p.eyes.openR ? 1 : null;
        if (eyeDx !== null) eyes = shiftFrame(blinkStage === 'half' ? p.eyes.half : p.eyes.blink, eyeDx, 0);
      }
      if (sink) {
        body = shiftFrame(body, 0, sink);
        eyes = shiftFrame(eyes, 0, sink);
        clawL = shiftFrame(clawL, 0, sink);
        clawR = shiftFrame(clawR, 0, sink);
        mouth = shiftFrame(mouth, 0, sink);
      }
      let crystal = null;
      if (opts.crystal && !CRYSTAL_HIDE_POSES.has(poseKey) && !(extraSym && !CRYSTAL_OK_SYMS.has(extraSym))) {
        crystal = opts.crystalBob ? PROPS.iceCrystalHi : PROPS.iceCrystal;
      }
      return [backProp, shadow, legs, body, mouth, eyes, clawL, clawR, prop1, prop2, crystal, extraSym].filter(Boolean);
    }

    // ── Gemini 小紫猫分件合成 ──
    const c = CAT_PARTS;
    let backProp = null;
    let shadow = opts.noShadow ? null : c.shadow.w12;
    let ears = c.ears.stand;
    let body = c.body.stand;
    let eyes = opts.eyeScan === -1 ? c.eyes.openL : opts.eyeScan === 1 ? c.eyes.openR : c.eyes.open;
    let legs = c.legs.stand;
    let paws = c.paws.none;
    let tail = [c.tail.up, c.tail.sway, c.tail.curl, c.tail.up][phase4];
    let prop1 = null;
    let prop2 = null;
    let mouth = null;
    let extraSym = sym;

    switch (poseKey) {
      case 'flat':
        shadow = c.shadow.w14;
        ears = c.ears.flat;
        body = c.body.flat;
        eyes = c.eyes.flatEyes;
        legs = null;
        tail = c.tail.curl;
        break;
      case 'squash':
        shadow = c.shadow.w14;
        ears = c.ears.nod;
        body = c.body.squash;
        eyes = c.eyes.half;
        legs = c.legs.crouch;
        break;
      case 'loaf':
      case 'sleep':
        shadow = c.shadow.w14;
        ears = c.ears.loaf;
        body = c.body.loaf;
        eyes = poseKey === 'sleep' || phase4 === 3 ? c.eyes.loafShut : c.eyes.loafHalf;
        legs = null;
        tail = poseKey === 'sleep' ? c.tail.loaf : Math.floor(tickIdx / 4) % 2 ? c.tail.loaf : c.tail.curl;
        break;
      case 'dangle':
        shadow = null;
        ears = c.ears.airplane;
        eyes = c.eyes.wide;
        legs = [c.legs.dangle, c.legs.flailA, c.legs.dangle2, c.legs.flailB][phase4];
        tail = c.tail.puff;
        break;
      case 'walk': {
        const beat = Math.floor(tickIdx / 2) % 4;
        legs = [c.legs.walkA, c.legs.stand, c.legs.walkB, c.legs.stand][beat];
        tail = beat < 2 ? c.tail.up : c.tail.sway;
        if (beat % 2 === 0) sink = 1;
        break;
      }
      case 'write':
        ears = frameMod ? c.ears.stand : c.ears.nod;
        legs = c.legs.crouch;
        paws = frameMod ? c.paws.write1 : c.paws.write2;
        tail = frameMod ? c.tail.sway : c.tail.curl;
        prop1 = PROPS.sheet;
        prop2 = frameMod ? PROPS.quill1 : PROPS.quill2;
        break;
      case 'pet':
      case 'happy':
        eyes = c.eyes.happy;
        ears = frameMod ? c.ears.nod : c.ears.stand;
        paws = c.paws.cheer;
        tail = frameMod ? c.tail.up : c.tail.puff;
        break;
      case 'jiggle':
        legs = [c.legs.flailA, c.legs.flailB, c.legs.flailC][tickIdx % 3];
        eyes = c.eyes.happy;
        ears = c.ears.stand;
        tail = c.tail.puff;
        break;
      case 'peek':
        shadow = null;
        ears = c.ears.peek;
        body = c.body.peek;
        eyes = c.eyes.peekOpen;
        legs = null;
        paws = c.paws.peekGrip;
        tail = c.tail.loaf;
        break;
      case 'angry':
        ears = c.ears.airplane;
        body = frameMod ? c.body.squash : c.body.stand;
        eyes = c.eyes.wide;
        legs = frameMod ? c.legs.walkA : c.legs.walkB;
        tail = c.tail.puff;
        break;
      case 'groom':
        ears = c.ears.nod;
        eyes = c.eyes.shut;
        paws = frameMod ? c.paws.groom1 : c.paws.groom2;
        break;
      case 'tilt':
        ears = c.ears.nod;
        body = c.body.turnL;
        eyes = c.eyes.half;
        tail = c.tail.curl;
        break;
      case 'wow':
        ears = c.ears.stand;
        eyes = c.eyes.wide;
        paws = c.paws.up;
        tail = c.tail.puff;
        break;
      case 'sulk':
        ears = c.ears.airplane;
        body = c.body.turnL;
        eyes = clipMod ? c.eyes.squint : c.eyes.shut;
        legs = c.legs.tuck;
        tail = c.tail.curl;
        extraSym = sym || SYMS.vein;
        break;
      case 'eatFish':
        ears = localTick > 20 ? c.ears.stand : c.ears.nod;
        body = localTick > 20 ? c.body.stand : c.body.squash;
        eyes = localTick > 20 ? c.eyes.happy : clipMod ? c.eyes.half : c.eyes.open;
        tail = clipMod ? c.tail.sway : c.tail.up;
        prop1 = localTick > 18 ? PROPS.fishBone : PROPS.fishDish;
        extraSym = localTick > 20 ? SYMS.heart : sym;
        break;
      case 'eat':
        ears = c.ears.nod;
        body = localTick > 20 ? c.body.stand : c.body.squash;
        eyes = localTick > 20 ? c.eyes.happy : c.eyes.half;
        prop1 = localTick > 18 ? PROPS.bowlEmpty : PROPS.bowl;
        prop2 = localTick > 18 ? null : clipMod ? PROPS.chop2 : PROPS.chop1;
        extraSym = localTick > 20 ? SYMS.heart : sym;
        break;
      case 'chaseDot':
        ears = c.ears.airplane;
        body = clipMod ? c.body.squash : c.body.stretch;
        eyes = c.eyes.wide;
        legs = clipMod ? c.legs.walkA : c.legs.crouch;
        tail = c.tail.puff;
        prop1 = PROPS['laser' + (localTick % 3)];
        extraSym = sym || SYMS.spark;
        break;
      case 'catStretch':
        if (localTick >= 18) {
          ears = c.ears.loaf;
          body = c.body.loaf;
          eyes = c.eyes.loafHalf;
          legs = null;
          tail = c.tail.loaf;
          extraSym = SYMS.z1;
        } else {
          ears = c.ears.nod;
          body = c.body.stretch;
          eyes = c.eyes.shut;
          tail = c.tail.up;
          extraSym = SYMS.tilde;
        }
        break;
      case 'polish':
        ears = c.ears.stand;
        body = c.body.turnR;
        eyes = phase4 === 2 ? c.eyes.happy : c.eyes.open;
        prop1 = PROPS.mug;
        prop2 = clipMod ? PROPS.cloth1 : PROPS.cloth2;
        break;
      case 'letter':
        ears = c.ears.nod;
        body = c.body.turnR;
        eyes = localTick >= 10 && localTick <= 18 ? c.eyes.half : localTick > 18 ? c.eyes.happy : c.eyes.open;
        prop1 = localTick < 6 ? PROPS.envS : localTick < 11 ? PROPS.envSOpen : PROPS.letter;
        extraSym = localTick > 18 ? SYMS.heart : sym;
        break;
      case 'plant':
        ears = c.ears.nod;
        body = localTick < 8 ? c.body.squash : c.body.stand;
        legs = localTick < 8 ? c.legs.crouch : c.legs.stand;
        eyes = localTick >= 16 && localTick <= 24 ? c.eyes.happy : c.eyes.open;
        prop1 =
          localTick < 5
            ? PROPS.seed
            : localTick < 9
              ? PROPS.p1
              : localTick < 13
                ? PROPS.p2
                : localTick < 17
                  ? PROPS.p3
                  : localTick < 23
                    ? PROPS.p4
                    : PROPS.wilt2;
        prop2 = localTick >= 17 && localTick < 21 ? PROPS.d1 : null;
        break;
      case 'butterfly': {
        const leftPhase = localTick % 16 >= 8;
        const resting = localTick >= 24 && localTick <= 30;
        ears = resting ? c.ears.nod : c.ears.stand;
        eyes = resting ? c.eyes.happy : leftPhase ? c.eyes.openL : c.eyes.openR;
        tail = clipMod ? c.tail.sway : c.tail.puff;
        prop1 = resting ? PROPS.bfRest : leftPhase ? (clipMod ? PROPS.bfLeftUp : PROPS.bfLeftDn) : clipMod ? PROPS.bfUp : PROPS.bfDn;
        extraSym = resting ? SYMS.spark : sym;
        break;
      }
      case 'stretch':
        ears = c.ears.stand;
        body = c.body.stretch;
        eyes = c.eyes.shut;
        tail = c.tail.puff;
        extraSym = sym || SYMS.tilde;
        break;
      case 'spinHop':
        body = [c.body.turnR, c.body.stand, c.body.turnL, c.body.squash][phase4];
        eyes = phase4 === 3 ? c.eyes.happy : c.eyes.open;
        legs = phase4 === 3 ? c.legs.crouch : c.legs.tuck;
        tail = c.tail.puff;
        break;
      case 'onFire': {
        const cooling = localTick >= 30;
        const lv = localTick < 5 ? 1 : localTick < 10 ? 2 : 3;
        backProp = cooling ? null : PROPS['fire' + lv + (localTick % 4)];
        prop1 = PROPS.mug;
        eyes = c.eyes.open;
        extraSym = cooling ? PROPS.smoke : SYMS['fireSpark' + (localTick % 3)];
        break;
      }
      case 'cheerSticks':
        ears = clipMod ? c.ears.stand : c.ears.nod;
        body = frameMod ? c.body.squash : c.body.stand;
        legs = frameMod ? c.legs.crouch : c.legs.stand;
        eyes = c.eyes.happy;
        paws = c.paws.up;
        tail = c.tail.puff;
        prop1 = [PROPS.stickLT, PROPS.stickUp, PROPS.stickRT, PROPS.stickUp][phase4];
        prop2 = [PROPS.stickRTM, PROPS.stickUpM, PROPS.stickLTM, PROPS.stickUpM][phase4];
        extraSym = sym || SYMS.note;
        break;
      case 'rickroll':
        ears = clipMod ? c.ears.stand : c.ears.nod;
        body = [c.body.leanR, c.body.squash, c.body.leanL, c.body.stand][phase4];
        eyes = clipMod ? c.eyes.happy : c.eyes.open;
        paws = c.paws.cheer;
        prop1 = localTick > 33 ? PROPS.micSink2 : localTick > 30 ? PROPS.micSink1 : PROPS.micStand;
        extraSym = sym || SYMS.note;
        break;
      case 'siren': {
        const isBlue = Math.floor(localTick / 6) % 2 === 1;
        const sfx = isBlue ? 'B' : '';
        const step4 = localTick % 4;
        const sirenName = ['sirenL', 'sirenF', 'sirenR', 'sirenDim'][step4];
        const beamName = step4 === 0 ? 'beamL' : step4 === 1 ? 'beamF' : step4 === 2 ? 'beamR' : null;
        ears = c.ears.airplane;
        body = clipMod ? c.body.squash : c.body.stand;
        eyes = c.eyes.wide;
        prop1 = PROPS[sirenName + sfx];
        prop2 = beamName ? PROPS[beamName + sfx] : null;
        extraSym = clipMod ? SYMS.bang : SYMS.sweat;
        break;
      }
      case 'chatGreet':
        ears = c.ears.nod;
        body = clipMod ? c.body.stand : c.body.squash;
        eyes = c.eyes.happy;
        tail = clipMod ? c.tail.up : c.tail.puff;
        extraSym = sym || (clipMod ? SYMS.heart : SYMS.note);
        break;
      case 'lookNod': {
        const faceL = opts.dir === 'left';
        const nodAt = Number(opts.clipParam ?? 9);
        const nodding = localTick >= nodAt && localTick < nodAt + 2;
        body = faceL ? c.body.turnL : c.body.turnR;
        eyes = nodding ? c.eyes.happy : faceL ? c.eyes.openL : c.eyes.openR;
        if (nodding) {
          sink = 1;
          legs = c.legs.crouch;
        }
        extraSym = sym || (localTick >= nodAt + 2 && localTick < nodAt + 8 ? SYMS.heart : null);
        break;
      }
      case 'readAlong': {
        const beatOn = localTick >= 2 && localTick < 14 && (localTick - 2) % 4 < 2;
        eyes = beatOn ? c.eyes.half : c.eyes.open;
        if (beatOn) {
          sink = 1;
          legs = c.legs.crouch;
        }
        extraSym = sym || null;
        break;
      }
      case 'balance':
        // 叠叠乐上层保持平衡：双爪张开、飞机耳、炸毛尾
        ears = c.ears.airplane;
        eyes = c.eyes.wide;
        paws = c.paws.cheer;
        tail = c.tail.puff;
        break;
      case 'yawn':
        // 打哈欠：耳朵后压、闭眼大张嘴（s 开口）、尾巴炸开
        if (localTick < 2) {
          ears = c.ears.nod;
          eyes = c.eyes.half;
          mouth = c.mouth.small;
        } else if (localTick < 9) {
          ears = c.ears.nod;
          eyes = c.eyes.shut;
          mouth = c.mouth.yawn;
          tail = c.tail.puff;
          extraSym = sym || (localTick >= 4 ? SYMS.tilde : null);
        } else {
          eyes = c.eyes.half;
          tail = c.tail.curl;
        }
        break;
      case 'wave':
        // 单爪挥手：右爪举起 / 放下每 2 拍切换
        eyes = c.eyes.happy;
        ears = c.ears.nod;
        paws = localTick < 12 && Math.floor(localTick / 2) % 2 === 0 ? c.paws.upR : c.paws.none;
        extraSym = sym || SYMS.note;
        break;
      case 'gaze': {
        const faceL = opts.dir === 'left';
        const up = opts.clipParam === 1;
        body = faceL ? c.body.turnL : c.body.turnR;
        eyes = up ? (faceL ? c.eyes.upL : c.eyes.upR) : faceL ? c.eyes.openL : c.eyes.openR;
        if (opts.earTwitch === 'L') ears = c.ears.twitchL;
        else if (opts.earTwitch === 'R') ears = c.ears.twitchR;
        break;
      }
      case 'worry':
        ears = c.ears.airplane;
        eyes = clipMod ? c.eyes.half : c.eyes.squint;
        legs = c.legs.tuck;
        tail = c.tail.curl;
        extraSym = sym || SYMS.sweat;
        break;
      case 'salute':
        ears = c.ears.stand;
        eyes = c.eyes.happy;
        paws = c.paws.upR;
        tail = c.tail.up;
        extraSym = sym || SYMS.spark;
        break;
      default:
        break;
    }

    if (SLOW_TAIL_POSES.has(poseKey)) {
      // 待机尾巴放慢：约 600ms 一次往复（3 拍 up / 3 拍 sway）；减少动态时静止
      tail = opts.reduced ? c.tail.up : Math.floor(tickIdx / 3) % 2 ? c.tail.sway : c.tail.up;
    }
    if (poseKey === 'idle') {
      if (opts.earTwitch === 'L') ears = c.ears.twitchL;
      else if (opts.earTwitch === 'R') ears = c.ears.twitchR;
      if (opts.breath) {
        sink = 1;
        legs = c.legs.crouch;
        if (shadow) shadow = c.shadow.w14;
      }
    }
    if (blinkStage && BLINKABLE_POSES.has(poseKey)) {
      const eyeDx = eyes === c.eyes.open ? 0 : eyes === c.eyes.openL ? -1 : eyes === c.eyes.openR ? 1 : null;
      if (eyeDx !== null) eyes = shiftFrame(blinkStage === 'half' ? c.eyes.half : c.eyes.blink, eyeDx, 0);
    }
    if (sink) {
      body = shiftFrame(body, 0, sink);
      ears = shiftFrame(ears, 0, sink);
      eyes = shiftFrame(eyes, 0, sink);
      paws = shiftFrame(paws, 0, sink);
      tail = shiftFrame(tail, 0, sink);
      mouth = shiftFrame(mouth, 0, sink);
    }
    return [backProp, shadow, tail, legs, body, mouth, ears, eyes, paws, prop1, prop2, extraSym].filter(Boolean);
  }

  // 随机眨眼过渡：1×2 竖瞳 → 1×1 → 闭（s 暗面横线）→ 1×1 → 1×2
  const BLINK_SINGLE = ['half', 'closed', 'half'];
  const BLINK_DOUBLE = ['half', 'closed', 'half', 'closed', 'half'];
  // 迷你蟹眨眼帧缓存：把竖瞳 o 替换为暗面色 s
  const MINI_BLINK_CACHE = new WeakMap();
  function miniBlinkFrame(fr) {
    let out = MINI_BLINK_CACHE.get(fr);
    if (!out) {
      out = recolorFrame(fr, { o: 's' });
      MINI_BLINK_CACHE.set(fr, out);
    }
    return out;
  }

  // ── 纯几何碰撞与擦肩经过判定（供主宠自主散步 / 拖拽 / 单元契约共测） ──
  const CRAB_ENCOUNTER_SEQ = new WeakMap();

  function classifyPairEncounter(opts = {}) {
    const {
      xA = 0,
      yA = 0,
      walkingA = false,
      dirA = 1,
      xB = 0,
      yB = 0,
      walkingB = false,
      dirB = -1,
      contactDist = 42,
      verticalTol = 22,
    } = opts;
    if (Math.abs(yA - yB) > verticalTol) return null;
    const dx = xB - xA;
    if (Math.abs(dx) >= contactDist) return null;
    if (!walkingA && !walkingB) return null;
    const sign = dx >= 0 ? 1 : -1;
    const dA = dirA >= 0 ? 1 : -1;
    const dB = dirB >= 0 ? 1 : -1;

    // 1. 双向相向逼近 → 迎面轻撞 (bump)
    if (walkingA && walkingB && dA * sign > 0 && dB * sign < 0) {
      return { kind: 'bump', sign };
    }
    // 2. 单方朝静止伙伴靠近且尚未完全跨过 → 擦肩经过 (passBy)
    if (walkingA && !walkingB && dA * sign > 0 && Math.abs(dx) >= 10) {
      return { kind: 'passBy', mover: 'A', stationary: 'B', dir: dA };
    }
    if (walkingB && !walkingA && dB * sign < 0 && Math.abs(dx) >= 10) {
      return { kind: 'passBy', mover: 'B', stationary: 'A', dir: dB };
    }
    // 3. 同向行走且后方追上前车 → 超车擦肩经过 (passBy)
    if (walkingA && walkingB && dA === dB && Math.abs(dx) >= 8) {
      const rearIsA = dA > 0 ? xA < xB : xA > xB;
      return {
        kind: 'passBy',
        mover: rearIsA ? 'A' : 'B',
        stationary: rearIsA ? 'B' : 'A',
        dir: dA,
      };
    }
    return null;
  }

  // ── 迷你三蟹舞台走廊漫步与碰钳/翻越经过逻辑 ─────────────────────────────
  function stepMiniCrabCorridor(crabs, opts = {}) {
    const minX = Number.isFinite(opts.minX) ? opts.minX : 2;
    const maxX = Math.max(minX + 16, Number.isFinite(opts.maxX) ? opts.maxX : 220);
    const contactDist = Number.isFinite(opts.contactDist) ? opts.contactDist : 26;
    const nowTick = Number.isFinite(opts.nowTick) ? opts.nowTick : 0;
    const events = [];
    if (!Array.isArray(crabs) || crabs.length === 0) return events;

    let pairCounts = CRAB_ENCOUNTER_SEQ.get(crabs);
    if (!pairCounts) {
      pairCounts = new Map();
      CRAB_ENCOUNTER_SEQ.set(crabs, pairCounts);
    }

    // 1. 自由状态下的迷你蟹匀速漫步 + 走廊边界折返
    for (const mc of crabs) {
      if (!mc || mc.act) continue;
      if (!Number.isFinite(mc.px)) mc.px = Number.isFinite(mc.x) ? mc.x : minX;
      if ((mc.bumpUntilTick || -1) > nowTick) {
        mc.px = Math.max(minX, Math.min(maxX, mc.px));
        continue;
      }
      const spd = Number.isFinite(mc.speed) ? mc.speed : 1.0;
      mc.dir = mc.dir >= 0 ? 1 : -1;
      let next = mc.px + mc.dir * spd;
      if (next <= minX) {
        next = minX;
        mc.dir = 1;
      } else if (next >= maxX) {
        next = maxX;
        mc.dir = -1;
      }
      mc.px = next;
    }

    // 2. 两两检测接触：迎面交替触发 crabBump / crabPass；同向追及触发 crabPass
    for (let i = 0; i < crabs.length; i++) {
      const a = crabs[i];
      if (!a || a.act || (a.cooldownTick || -99) > nowTick) continue;
      for (let j = i + 1; j < crabs.length; j++) {
        const b = crabs[j];
        if (!b || b.act || (b.cooldownTick || -99) > nowTick) continue;
        const dx = b.px - a.px;
        if (Math.abs(dx) >= contactDist) continue;
        const sign = dx >= 0 ? 1 : -1;
        const dA = a.dir >= 0 ? 1 : -1;
        const dB = b.dir >= 0 ? 1 : -1;
        const headOn = dA * sign > 0 && dB * sign < 0;
        const sameDirChase = dA === dB && Math.abs(dx) >= 4;
        if (!headOn && !sameDirChase) continue;

        if (headOn) {
          const pairKey = [a.id, b.id].sort().join('-');
          const count = pairCounts.get(pairKey) || 0;
          pairCounts.set(pairKey, count + 1);
          if (count % 2 === 0) {
            a.px = Math.max(minX, Math.min(maxX, a.px - sign * 3));
            b.px = Math.max(minX, Math.min(maxX, b.px + sign * 3));
            a.dir = -sign;
            b.dir = sign;
            a.bumpUntilTick = nowTick + 3;
            b.bumpUntilTick = nowTick + 3;
            a.cooldownTick = nowTick + 8;
            b.cooldownTick = nowTick + 8;
            events.push({ type: 'crabBump', pair: `${a.id}-${b.id}` });
          } else {
            const vaulter = a;
            const yielded = b;
            vaulter.px = Math.max(minX, Math.min(maxX, vaulter.px + vaulter.dir * 8));
            vaulter.passHopUntilTick = nowTick + 4;
            yielded.blinkAt = nowTick;
            a.cooldownTick = nowTick + 9;
            b.cooldownTick = nowTick + 9;
            events.push({ type: 'crabPass', pair: `${vaulter.id}-${yielded.id}` });
          }
        } else {
          const rearIsA = dA > 0 ? a.px < b.px : a.px > b.px;
          const vaulter = rearIsA ? a : b;
          const yielded = rearIsA ? b : a;
          vaulter.px = Math.max(minX, Math.min(maxX, vaulter.px + vaulter.dir * 8));
          vaulter.passHopUntilTick = nowTick + 4;
          yielded.blinkAt = nowTick;
          a.cooldownTick = nowTick + 9;
          b.cooldownTick = nowTick + 9;
          events.push({ type: 'crabPass', pair: `${vaulter.id}-${yielded.id}` });
        }
        break;
      }
    }
    return events;
  }

  // ── Google 四色全息棱镜虹彩光谱插值 & 5 宠一维刚体防重叠 & 遇障决策纯函数 ──────
  const CHROMA_STOPS = [
    [0x42, 0x85, 0xf4], // #4285F4 Cobalt Blue
    [0x9b, 0x72, 0xcb], // #9B72CB Amethyst Iris
    [0xea, 0x43, 0x35], // #EA4335 Coral Red
    [0xfb, 0xbc, 0x04], // #FBBC04 Warm Amber
    [0x5c, 0xc6, 0xfc], // #5CC6FC Sky Cyan
  ];
  const CHROMA_HEX = ['#4285F4', '#9B72CB', '#EA4335', '#FBBC04', '#5CC6FC'];

  function evalChromaColorAt(gx, gy, phase = 0, isShadow = false) {
    const raw = ((gx + gy) * 0.068 - phase) % 1;
    const u = (raw < 0 ? raw + 1 : raw) * CHROMA_STOPS.length;
    const i0 = Math.floor(u) % CHROMA_STOPS.length;
    const i1 = (i0 + 1) % CHROMA_STOPS.length;
    const t = u - Math.floor(u);
    const s = t * t * (3 - 2 * t);
    const c0 = CHROMA_STOPS[i0];
    const c1 = CHROMA_STOPS[i1];
    let r = c0[0] + (c1[0] - c0[0]) * s;
    let g = c0[1] + (c1[1] - c0[1]) * s;
    let b = c0[2] + (c1[2] - c0[2]) * s;
    if (isShadow) {
      r = r * 0.68 + 18 * 0.14;
      g = g * 0.68 + 22 * 0.14;
      b = b * 0.72 + 40 * 0.14;
    }
    const hex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }

  /**
   * 一维地面刚体防重叠与向空旷侧推挤分离求解器
   * 输入 bodies: Array<{ id: string, cx: number, halfW: number, locked?: boolean }>
   * 原地更新每个非 locked 角色的 cx，保证净间距 >= minGap（默认 6px）
   */
  function resolveGroundSeparation(bodies, stageMinX = 12, stageMaxX = 708, minGap = 6) {
    if (!Array.isArray(bodies) || bodies.length < 2) {
      if (Array.isArray(bodies) && bodies.length === 1 && !bodies[0].locked) {
        const b = bodies[0];
        b.cx = Math.max(stageMinX + b.halfW, Math.min(stageMaxX - b.halfW, b.cx));
      }
      return bodies;
    }
    const span = Math.max(40, stageMaxX - stageMinX);
    const totalHalfW = bodies.reduce((s, b) => s + b.halfW * 2, 0);
    const maxFeasibleGap = bodies.length > 1 ? Math.max(0, (span - totalHalfW) / (bodies.length - 1)) : minGap;
    const effGap = Math.min(minGap, maxFeasibleGap);

    const ordered = bodies
      .map((b, idx) => ({ b, idx }))
      .sort((a, z) => (Math.abs(a.b.cx - z.b.cx) > 0.01 ? a.b.cx - z.b.cx : a.idx - z.idx))
      .map((x) => x.b);

    for (const b of ordered) {
      if (!b.locked) {
        b.cx = Math.max(stageMinX + b.halfW, Math.min(stageMaxX - b.halfW, b.cx));
      }
    }

    for (let iter = 0; iter < 6; iter++) {
      let moved = false;
      for (let i = 0; i < ordered.length - 1; i++) {
        const left = ordered[i];
        const right = ordered[i + 1];
        const req = left.halfW + right.halfW + effGap;
        const dist = right.cx - left.cx;
        if (dist >= req - 0.01) continue;
        const overlap = req - dist;
        moved = true;
        if (left.locked && right.locked) continue;
        if (left.locked) {
          right.cx += overlap;
        } else if (right.locked) {
          left.cx -= overlap;
        } else {
          const leftRoom = Math.max(0, left.cx - left.halfW - stageMinX);
          const rightRoom = Math.max(0, stageMaxX - (right.cx + right.halfW));
          const sumRoom = leftRoom + rightRoom;
          const wRight = sumRoom > 1 ? rightRoom / sumRoom : 0.5;
          left.cx -= overlap * (1 - wRight);
          right.cx += overlap * wRight;
        }
        if (!left.locked) left.cx = Math.max(stageMinX + left.halfW, Math.min(stageMaxX - left.halfW, left.cx));
        if (!right.locked) right.cx = Math.max(stageMinX + right.halfW, Math.min(stageMaxX - right.halfW, right.cx));
      }
      // 二次单向扫掠消除靠墙挤压残余
      for (let i = 0; i < ordered.length - 1; i++) {
        const l = ordered[i];
        const r = ordered[i + 1];
        const req = l.halfW + r.halfW + effGap;
        if (r.cx - l.cx < req && !r.locked) {
          r.cx = Math.min(stageMaxX - r.halfW, l.cx + req);
        }
      }
      for (let i = ordered.length - 1; i > 0; i--) {
        const l = ordered[i - 1];
        const r = ordered[i];
        const req = l.halfW + r.halfW + effGap;
        if (r.cx - l.cx < req && !l.locked) {
          l.cx = Math.max(stageMinX + l.halfW, r.cx - req);
        }
      }
      if (!moved) break;
    }
    return bodies;
  }

  /**
   * 散步遇障三种灵动越障决策器：
   * - 'leapfrog': 抛物线撑跳越过对方头顶（峰值 ~26px）落到另一侧继续走
   * - 'autoPerch': 顺势轻跳坐上对方（或塔顶）头顶搭便车
   * - 'greetTurn': 驻足眨眼/拉墨镜偷瞄/挥魔杖闪星后礼貌转身
   */
  function chooseObstacleAction(opts = {}) {
    const canLeap = opts.canLeap !== false;
    const canPerch = Boolean(opts.canPerch);
    const roll = Number.isFinite(opts.roll) ? opts.roll : Math.random();
    if (canLeap && canPerch) {
      if (roll < 0.42) return 'leapfrog';
      if (roll < 0.74) return 'autoPerch';
      return 'greetTurn';
    }
    if (canLeap) return roll < 0.58 ? 'leapfrog' : 'greetTurn';
    if (canPerch) return roll < 0.52 ? 'autoPerch' : 'greetTurn';
    return 'greetTurn';
  }

  function mountDualMascotStage(hostEl, options = {}) {
    if (!hostEl) return null;
    const doc = hostEl.ownerDocument;
    const win = (doc && doc.defaultView) || (typeof window !== 'undefined' ? window : null);
    const readDpr = () => Math.min((win && win.devicePixelRatio) || 1, 2);
    let dpr = readDpr();
    const rand = (a, b) => a + Math.random() * (b - a);
    const ticksIn = (minMs, maxMs) => Math.max(1, Math.round(rand(minMs, maxMs) / TICK));

    let tickIdx = 0;
    let disposed = false;

    // ── prefers-reduced-motion：无 window / matchMedia 时安全降级为 false ──
    let reducedMotion = false;
    let reducedMq = null;
    const onReducedChange = (e) => {
      reducedMotion = Boolean(e && e.matches);
      if (reducedMotion) freezeMotion();
      else lastActivityAt = performance.now();
      syncHeartbeat();
    };
    try {
      if (win && typeof win.matchMedia === 'function') {
        reducedMq = win.matchMedia('(prefers-reduced-motion: reduce)');
        reducedMotion = Boolean(reducedMq && reducedMq.matches);
        if (reducedMq && typeof reducedMq.addEventListener === 'function') {
          reducedMq.addEventListener('change', onReducedChange);
        } else if (reducedMq && typeof reducedMq.addListener === 'function') {
          reducedMq.addListener(onReducedChange);
        }
      }
    } catch (_) {
      reducedMotion = false;
      reducedMq = null;
    }
    if (options.reducedMotion !== undefined) reducedMotion = Boolean(options.reducedMotion);

    // 统一托管的延时器（剧目分镜 / 起跳预备），dispose 时全部清理
    const pendingTimers = new Set();
    const later = (ms, fn) => {
      const id = setTimeout(() => {
        pendingTimers.delete(id);
        if (!disposed) fn();
      }, ms);
      pendingTimers.add(id);
      return id;
    };

    const createActorState = (id, kind, label, phaseTicks) => ({
      id,
      kind,
      label,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      rot: 0,
      sqx: 1,
      sqy: 1,
      pose: 'idle',
      overridePose: null,
      overrideUntil: 0,
      overrideRot: 0,
      clipStartTick: 0,
      sym: null,
      symUntil: 0,
      dragging: false,
      flying: 0,
      stackedOn: null,
      throws: 0,
      lastThrowAt: 0,
      pokeCount: 0,
      lastPokeAt: 0,
      nodY: 0,
      nodUntil: 0,
      eyeScan: 0,
      patrolDir: 1,
      el: null,
      canvas: null,
      mirror: false,
      // 节拍序列（落地四相衰减 / 叠落挤压 / 起跳预备）
      seq: null,
      seqStartTick: 0,
      seqThen: null,
      // 待机微动作计时（各宠物独立随机，相位错开）
      blinkTick: -99,
      blinkDouble: false,
      nextBlinkTick: phaseTicks + ticksIn(2400, 6000),
      breathTick: -99,
      nextBreathTick: phaseTicks + ticksIn(2800, 4200),
      twitchTick: -99,
      twitchLen: 1,
      twitchSide: 'R',
      nextTwitchTick: phaseTicks + ticksIn(6000, 10000),
      snapTick: -99,
      snapSide: 'R',
      nextSnapTick: phaseTicks + ticksIn(8000, 12000),
      glanceDir: 0,
      glanceUntil: 0,
      glanceSecond: false,
      nextGlanceAt: performance.now() + phaseTicks * TICK + rand(3000, 7000),
      faceDir: null,
      clipParam: null,
      balRot: 0,
      prevX: null,
      lastFx: null,
      lastSq: null,
      // 生态联动：外部事件触发的强制耳尖抖动（ripple 点击方向）与经过加速窗口
      forceTwitchStart: -99,
      forceTwitchSide: 'R',
      passBoostUntil: 0,
      walkStepTick: -1,
      // 静止帧与 DOM 位移缓存（像素帧与坐标不变时 0 clearRect、0 style.transform 写入）
      lastDomX: null,
      lastDomY: null,
      lastDomZ: null,
      lastRender: {
        poseKey: null,
        frameIdx: null,
        flip: null,
        tintState: null,
        tyPx: null,
        sqW: null,
        sqH: null,
        lastRot: null,
        clipBottomY: null,
        cw: 0,
        ch: 0,
      },
    });

    const actors = {
      clawd: createActorState('clawd', 'clawd', 'Claude Clawd', 0),
      cat: createActorState('cat', 'cat', 'Gemini Cat', 14),
    };

    const miniCrabs = [
      { id: 'cowboy', x: 16, dir: 1 },
      { id: 'shades', x: 76, dir: -1 },
      { id: 'wizard', x: 136, dir: 1 },
    ];
    miniCrabs.forEach((mc, idx) => {
      mc.kind = 'mini';
      mc.blinkAt = -99;
      mc.nextBlink = ticksIn(1500, 6000);
      mc.lastX = mc.x;
      mc.px = mc.x;
      mc.y = 0;
      mc.vx = 0;
      mc.vy = 0;
      mc.rot = 0;
      mc.balRot = 0;
      mc.dragging = false;
      mc.stackedOn = null;
      mc.flying = 0;
      mc.leap = null;
      mc.perchUntil = 0;
      mc.speed = [1.05, 0.86, 1.18][idx] || 1.0;
      mc.bumpUntilTick = -1;
      mc.passHopUntilTick = -1;
      mc.cooldownTick = -1;
      mc.act = null;
      mc.mirror = false;
      mc.lastDomX = null;
      mc.lastDomY = null;
      mc.lastDomZ = null;
      mc.lastFrameKey = null;
    });

    const rAF =
      (win && typeof win.requestAnimationFrame === 'function' && win.requestAnimationFrame.bind(win)) ||
      (typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (fn) => later(16, () => fn(performance.now())));

    const CHROMA_STORE_KEY = '__op_chroma_v1';
    const getStorage = () => {
      try {
        return options.storage || (win && win.localStorage) || (typeof localStorage !== 'undefined' ? localStorage : null);
      } catch (_) {
        return null;
      }
    };
    const readChromaSaved = () => {
      try {
        const st = getStorage();
        return Boolean(st && st.getItem(CHROMA_STORE_KEY) === '1');
      } catch (_) {
        return false;
      }
    };
    const writeChromaSaved = (on) => {
      try {
        const st = getStorage();
        if (!st) return;
        if (on) st.setItem(CHROMA_STORE_KEY, '1');
        else if (typeof st.removeItem === 'function') st.removeItem(CHROMA_STORE_KEY);
        else st.setItem(CHROMA_STORE_KEY, '0');
      } catch (_) {
        /* 忽略存储受限环境 */
      }
    };

    let camp = options.camp === 'claude' ? 'claude' : 'gemini';
    let streaming = Boolean(options.streaming);
    let streamTier = Number(options.streamTier || 2);
    let hasError = Boolean(options.hasError);
    let yieldMode = options.yieldMode || 'none';
    let leapOffsetY = Number(options.leapOffsetY || 0);
    let popoverRightWidth = Number(options.popoverRightWidth || 0);
    let miniPileEnabled = Boolean(options.miniPileEnabled);
    let orchestrator = Boolean(options.orchestrator);
    let prismaticCoat = readChromaSaved();
    const sharedSessionGates =
      !options.storage && hostEl && typeof hostEl === 'object'
        ? (hostEl.__opChromaGates || (hostEl.__opChromaGates = { tuned: false, forged: false }))
        : { tuned: false, forged: false };
    const chromaGates = sharedSessionGates;
    const chromaTapTimes = [];
    let chromaPhase = 0;
    const chromaSparks = [];
    let fxCanvasCleared = true;

    // 打盹生态：45s（深夜 30s）无用户操作 → 哈欠 → 打盹；任何操作唤醒
    const DOZE_AFTER_MS = 45000;
    const DOZE_AFTER_NIGHT_MS = 30000;
    let dozing = false;
    let lastActivityAt = performance.now();
    let lastHandoffAt = 0;
    let duetUntil = 0;
    let lastCrabStepTick = -1;
    const pairCooldowns = new Map();
    const canTriggerPair = (key, now, cdMs) => {
      const until = pairCooldowns.get(key) || 0;
      if (now < until) return false;
      pairCooldowns.set(key, now + cdMs);
      return true;
    };
    let lastInteraction = { type: null, pair: null, at: 0, tick: -1 };
    const recordInteraction = (type, pair, now = performance.now()) => {
      lastInteraction = { type, pair, at: now, tick: tickIdx };
    };
    let pauseTimer = 0;
    let theaterTimer = 0;
    let theaterCursor = 0;
    let tickTimer = null;
    let currentTickMs = 0;
    let lastMiniDisplay = null;
    const perfStats = {
      canvasDraws: 0,
      canvasSkips: 0,
      domTransformWrites: 0,
      domTransformSkips: 0,
    };

    // 扩大至 96x84px (32x28 格, PX=3), OX=8, OY=17 -> y=10 脚底在 81px, 头顶留满 51px 放火舌/立麦/节点花!
    const CANVAS_W = 96;
    const CANVAS_H = 84;
    const OX = 8;
    const OY = 17;

    if (typeof hostEl.removeChild === 'function') {
      while (hostEl.firstChild) hostEl.removeChild(hostEl.firstChild);
    } else {
      hostEl.innerHTML = '';
    }

    const miniGroupEl = doc.createElement('div');
    miniGroupEl.className = 'ag-v2-mini-pile';
    if (miniGroupEl.style) miniGroupEl.style.zIndex = 'auto';
    miniCrabs.forEach((mc) => {
      const cv = doc.createElement('canvas');
      cv.className = 'ag-v2-mini-crab-canvas';
      cv.width = Math.round(40 * dpr);
      cv.height = Math.round(32 * dpr);
      cv.dataset.miniCrab = mc.id;
      if (cv.style) {
        cv.style.pointerEvents = 'auto';
        cv.style.cursor = 'grab';
        cv.style.touchAction = 'none';
      }
      miniGroupEl.appendChild(cv);
      mc.canvas = cv;
      mc.el = cv;
    });
    hostEl.appendChild(miniGroupEl);

    const createActorDom = (actor) => {
      const btn = doc.createElement('div');
      btn.className = 'ag-v2-mascot-actor';
      btn.setAttribute('data-mascot-id', actor.id);
      btn.setAttribute('data-no-press-spring', '1');
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      btn.setAttribute('aria-label', actor.label);
      const cv = doc.createElement('canvas');
      cv.className = 'ag-v2-mascot-canvas';
      cv.width = Math.round(CANVAS_W * dpr);
      cv.height = Math.round(CANVAS_H * dpr);
      btn.appendChild(cv);
      actor.el = btn;
      actor.canvas = cv;
      hostEl.appendChild(btn);
    };

    createActorDom(actors.cat);
    createActorDom(actors.clawd);

    const fxCanvas = doc.createElement('canvas');
    fxCanvas.className = 'ag-v2-chroma-fx';
    const releaseFxCanvas = () => {
      fxCanvas.width = fxCanvas.height = 0;
      if (fxCanvas.style) { fxCanvas.style.width = fxCanvas.style.height = '0px'; fxCanvas.style.display = 'none'; }
      fxCanvasCleared = true;
    };
    if (fxCanvas.style) {
      fxCanvas.style.position = 'absolute';
      fxCanvas.style.left = fxCanvas.style.bottom = '0';
      fxCanvas.style.pointerEvents = 'none';
      fxCanvas.style.zIndex = '42';
      fxCanvas.style.imageRendering = 'pixelated';
    }
    releaseFxCanvas();
    hostEl.appendChild(fxCanvas);

    // ── 5 宠统一图腾塔拓扑、抽底重力补位与地面刚体防重叠核心 ─────────────────
    const miniById = new Map(miniCrabs.map((m) => [m.id, m]));
    const getEnt = (id) => (id === 'cat' || id === 'clawd' ? actors[id] : miniById.get(id) || null);
    const isMiniEnt = (ent) => Boolean(ent && ent.kind === 'mini');
    const entHalfW = (ent) => (isMiniEnt(ent) ? 13 : 22);
    const mountStepH = (holderId) => (holderId === 'cat' || holderId === 'clawd' ? 26 : 16);
    const allActiveEnts = () => (miniPileEnabled ? [actors.cat, actors.clawd, ...miniCrabs] : [actors.cat, actors.clawd]);
    const maxTowerDepthAllowed = () => (miniPileEnabled ? 5 : 2);

    const syncStageDpr = () => {
      const nextDpr = readDpr();
      if (nextDpr === dpr) return false;
      dpr = nextDpr;
      for (const id of ['cat', 'clawd']) {
        const a = actors[id];
        if (a.canvas) {
          a.canvas.width = Math.round(CANVAS_W * dpr);
          a.canvas.height = Math.round(CANVAS_H * dpr);
        }
        a.lastRender.poseKey = null;
      }
      miniCrabs.forEach((mc) => {
        if (mc.canvas) {
          mc.canvas.width = Math.round(40 * dpr);
          mc.canvas.height = Math.round(32 * dpr);
        }
        mc.lastFrameKey = null;
      });
      return true;
    };

    const cleanups = [];
    let cachedHostWidth = typeof hostEl.clientWidth === 'number' && hostEl.clientWidth > 0 ? hostEl.clientWidth : 720;
    const isMockHostWidth = Object.prototype.hasOwnProperty.call(hostEl, 'clientWidth');
    let pdOn = false, reboundTm = null, resizeRaf = 0, pendPrevW = 0, pendNextW = 0;
    if (win && typeof win.addEventListener === 'function') {
      const onPd = () => { pdOn = true; }, onPu = () => { pdOn = false; }, pOpt = { capture: true, passive: true };
      win.addEventListener('pointerdown', onPd, pOpt);
      win.addEventListener('pointerup', onPu, pOpt);
      win.addEventListener('pointercancel', onPu, pOpt);
      win.addEventListener('blur', onPu);
      cleanups.push(() => {
        if (reboundTm) { clearTimeout(reboundTm); pendingTimers.delete(reboundTm); reboundTm = null; }
        if (resizeRaf) { try { win.cancelAnimationFrame?.(resizeRaf); } catch {} resizeRaf = 0; }
        win.removeEventListener('pointerdown', onPd, pOpt);
        win.removeEventListener('pointerup', onPu, pOpt);
        win.removeEventListener('pointercancel', onPu, pOpt);
        win.removeEventListener('blur', onPu);
      });
    }
    const maxXFor = (w) => Math.max(8, Math.max(96, w - 14 - (popoverRightWidth > 0 ? Math.min(w - 150, popoverRightWidth + 16) : 0)) - 80);
    const syncTower = (a) => {
      applyActorTransform(a);
      for (const cid of getTowerMembers(a.id)) {
        if (cid === a.id) continue;
        const r = getEnt(cid);
        if (!r) continue;
        if (isMiniEnt(r)) {
          const dom = r.canvas || r.el;
          if (!dom) continue;
          const direct = syncDirectMotionDomAttr(r, dom);
          const tx = snapCoord(getEntWorldCx(a) - 32, direct);
          const ty = snapCoord(computeWorldFootY(r), direct);
          const depth = r.stackedOn ? getStackDepth(r.id) : 0;
          const tz = r.dragging ? '39' : depth > 0 ? String(25 + depth * 2) : '25';
          r.px = tx;
          r.lastX = Math.round(tx);
          if (r.lastDomX !== tx || r.lastDomY !== ty) {
            r.lastDomX = tx;
            r.lastDomY = ty;
            dom.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
            perfStats.domTransformWrites += 1;
          } else {
            perfStats.domTransformSkips += 1;
          }
          if (r.lastDomZ !== tz) {
            r.lastDomZ = tz;
            dom.style.zIndex = tz;
          }
        } else {
          applyActorTransform(r);
        }
      }
    };
    const freeMain = (a) => Boolean(a && a.el && !a.dragging && !a.stackedOn);
    const applyReboundGlide = (a) => {
      if (reducedMotion) return;
      const now = performance.now();
      for (const cid of getTowerMembers(a.id)) {
        const ent = getEnt(cid);
        if (ent?.el?.style) {
          const seq = (ent.glideSeq = (ent.glideSeq || 0) + 1);
          ent.glideUntil = now + 320;
          ent.el.style.transition = 'transform 320ms cubic-bezier(.22,1,.36,1)';
          later(340, () => {
            if (!disposed && ent.glideSeq === seq && ent.el?.style && !ent.lastDomDirect && ent.el.style.transition.includes('320ms')) {
              ent.el.style.transition = '';
              ent.glideUntil = 0;
            }
          });
        }
      }
    };
    const launchRebound = (a, targetCapX) => {
      if (disposed || !freeMain(a) || !a.sideEdgeSnap || a.sidePushOriginX == null) return;
      const ox = a.sidePushOriginX;
      const fm = maxXFor(Math.max(readStageWidth(), cachedHostWidth));
      const tx = Math.max(8, Math.min(ox, targetCapX, fm));
      const dist = tx - a.x;
      a.sideEdgeSnap = false; a.sidePushOriginX = null; a.sideEdgeOffset = 0; a.sideEdgeDirectUntil = 0;
      if (dist >= 28 && !reducedMotion && !findDirectRider(a.id)) {
        const vy0 = -Math.max(4.6, Math.min(8.2, 4.4 + dist / 220));
        let svy = vy0, sy = 0, sb = 0, sGain = 0, sMul = 1;
        for (let t = 0; t < 160; t++) {
          svy += 0.44;
          sMul *= 0.988;
          svy *= 0.988;
          sy += svy;
          sGain += sMul;
          if (sy >= 0) {
            sy = 0;
            if (Math.abs(svy) > 2.4 && sb < 2) {
              svy = -svy * 0.36;
              sMul *= 0.82;
              sb += 1;
            } else break;
          }
        }
        const vx0 = dist / Math.max(1, sGain);
        startBallistic(a, vx0, vy0, { noSnap: true, reboundTargetX: tx, reboundNoBump: true });
        renderAllFrames(performance.now());
      } else if (tx > a.x + 1) {
        a.x = tx;
        syncTower(a);
        applyReboundGlide(a);
      } else {
        syncTower(a);
      }
    };
    const handleStageWidthResize = (prevW, nw) => {
      if (disposed || !Number.isFinite(nw) || nw <= 0 || nw === prevW) return;
      const now = performance.now(), nextMaxX = maxXFor(nw), mains = [actors.cat, actors.clawd];
      if (nw < prevW) {
        if (reboundTm) { clearTimeout(reboundTm); pendingTimers.delete(reboundTm); reboundTm = null; }
        // 快路径：两只主角均远离右边界时 0 计算早退
        if (!mains.some((a) => freeMain(a) && a.x >= nextMaxX - 96)) return;
        const beforeX = mains.map((a) => (a ? a.x : 0));
        const order = [0, 1].sort((i, j) => beforeX[j] - beforeX[i]);
        let capX = nextMaxX;
        for (const i of order) {
          const a = mains[i];
          if (!freeMain(a)) continue;
          if (a.x > capX) { a.x = capX; capX = Math.max(8, capX - 1); }
          else capX = Math.min(capX, Math.max(8, a.x - 1));
        }
        enforceGroundSeparation();
        for (let i = 0; i < 2; i++) {
          const a = mains[i];
          if (!freeMain(a)) continue;
          if (a.x < beforeX[i] - 0.5 || a.x >= nextMaxX - 4) {
            if (a.sidePushOriginX == null) a.sidePushOriginX = beforeX[i];
            a.sideEdgeSnap = true;
            a.sideEdgeOffset = Math.max(0, nextMaxX - a.x);
            a.sideEdgeDirectUntil = now + 180;
            syncTower(a);
          }
        }
        return;
      }
      if (!mains.some((a) => freeMain(a) && a.sideEdgeSnap && a.sidePushOriginX != null)) return;
      let needReb = false;
      const prevMaxX = maxXFor(prevW);
      for (const a of mains) {
        if (!freeMain(a) || !a.sideEdgeSnap || a.sidePushOriginX == null) continue;
        const off = a.sideEdgeOffset || 0;
        if (!reboundTm && a.x < prevMaxX - off - 64) { a.sideEdgeSnap = false; a.sidePushOriginX = null; continue; }
        const tx = Math.min(a.sidePushOriginX, Math.max(8, nextMaxX - off));
        if (pdOn) {
          if (reboundTm) { clearTimeout(reboundTm); pendingTimers.delete(reboundTm); reboundTm = null; }
          a.sideEdgeDirectUntil = now + 180;
          a.x = tx;
          syncTower(a);
          if (tx >= a.sidePushOriginX - 1) { a.sideEdgeSnap = false; a.sidePushOriginX = null; a.sideEdgeOffset = 0; }
        } else {
          needReb = true;
        }
      }
      if (needReb) {
        if (reboundTm) { clearTimeout(reboundTm); pendingTimers.delete(reboundTm); reboundTm = null; }
        reboundTm = later(120, () => {
          reboundTm = null;
          if (pdOn) return;
          const fm = maxXFor(Math.max(readStageWidth(), cachedHostWidth));
          const list = mains
            .filter((a) => freeMain(a) && a.sideEdgeSnap && a.sidePushOriginX != null)
            .sort((u, v) => v.sidePushOriginX - u.sidePushOriginX);
          let capX = fm;
          const targets = list.map((a) => {
            const tx = Math.max(8, Math.min(a.sidePushOriginX, capX));
            capX = Math.max(8, tx - 56);
            return { a, tx };
          });
          targets.forEach(({ a, tx }, idx) => (idx ? later(55 * idx, () => launchRebound(a, tx)) : launchRebound(a, tx)));
        });
      }
    };
    const schedStageResize = (prevW, nw) => {
      if (!pendPrevW) pendPrevW = prevW;
      pendNextW = nw;
      if (resizeRaf) return;
      const flush = () => {
        resizeRaf = 0;
        const p = pendPrevW, n = pendNextW;
        pendPrevW = pendNextW = 0;
        handleStageWidthResize(p, n);
      };
      if (win && typeof win.requestAnimationFrame === 'function') resizeRaf = win.requestAnimationFrame(flush);
      else flush();
    };
    if (!isMockHostWidth && typeof ResizeObserver === 'function' && hostEl && hostEl.nodeType === 1) {
      try {
        const hostRo = new ResizeObserver((entries) => {
          const cr = entries && entries[0] && entries[0].contentRect;
          const nw = cr && cr.width > 0 ? Math.round(cr.width) : hostEl.clientWidth;
          const dprChanged = syncStageDpr();
          if (nw > 0 && nw !== cachedHostWidth) {
            const prevW = cachedHostWidth;
            cachedHostWidth = nw;
            schedStageResize(prevW, nw);
          }
          if (dprChanged && !disposed) renderAllFrames(performance.now());
        });
        hostRo.observe(hostEl);
        cleanups.push(() => hostRo.disconnect());
      } catch (_) {}
    }
    const readStageWidth = () => {
      if (isMockHostWidth) return hostEl.clientWidth || 720;
      if (cachedHostWidth <= 0 && typeof hostEl.clientWidth === 'number' && hostEl.clientWidth > 0) {
        cachedHostWidth = hostEl.clientWidth;
      }
      return cachedHostWidth || 720;
    };

    const stageBoundsX = () => {
      const w = readStageWidth();
      const rightReserve = popoverRightWidth > 0 ? Math.min(w - 150, popoverRightWidth + 16) : 0;
      return {
        minX: 14,
        maxX: Math.max(96, w - 14 - rightReserve),
      };
    };

    const clampActorX = (x) => {
      const w = readStageWidth();
      const rightReserve = popoverRightWidth > 0 ? Math.min(w - 150, popoverRightWidth + 16) : 0;
      const maxX = Math.max(24, w - 88 - rightReserve);
      return Math.max(8, Math.min(maxX, x));
    };

    const getEntWorldCx = (ent) => (isMiniEnt(ent) ? 12 + (Number.isFinite(ent.px) ? ent.px : ent.x) + 20 : ent.x + 48);
    const setEntWorldCx = (ent, cx) => {
      const { minX, maxX } = stageBoundsX();
      const hw = entHalfW(ent);
      const clamped = Math.max(minX + hw, Math.min(maxX - hw, cx));
      if (isMiniEnt(ent)) {
        const px = Math.max(2, clamped - 32);
        ent.px = px;
        ent.lastX = Math.round(px);
      } else {
        ent.x = clampActorX(clamped - 48);
      }
    };

    const findDirectRider = (holderId) => {
      for (const e of [actors.cat, actors.clawd, ...miniCrabs]) {
        if (e.stackedOn === holderId) return e;
      }
      return null;
    };

    const getStackDepth = (id) => {
      let d = 0;
      let cur = getEnt(id);
      const seen = new Set();
      while (cur && cur.stackedOn && !seen.has(cur.id)) {
        seen.add(cur.id);
        const base = getEnt(cur.stackedOn);
        if (!base) break;
        d += 1;
        cur = base;
      }
      return d;
    };

    const getTowerRoot = (id) => {
      let cur = getEnt(id);
      const seen = new Set();
      while (cur && cur.stackedOn && !seen.has(cur.id)) {
        seen.add(cur.id);
        const base = getEnt(cur.stackedOn);
        if (!base) break;
        cur = base;
      }
      return cur;
    };

    const getTowerMembers = (anyId) => {
      const root = getTowerRoot(anyId);
      if (!root) return [];
      const chain = [root.id];
      const seen = new Set(chain);
      let curId = root.id;
      while (true) {
        const next = findDirectRider(curId);
        if (!next || seen.has(next.id)) break;
        seen.add(next.id);
        chain.push(next.id);
        curId = next.id;
      }
      return chain;
    };

    const getStackTop = (anyId) => {
      const chain = getTowerMembers(anyId);
      return chain.length ? getEnt(chain[chain.length - 1]) : getEnt(anyId);
    };

    const listAllTowers = () => {
      const out = [];
      const visited = new Set();
      for (const e of allActiveEnts()) {
        if (visited.has(e.id)) continue;
        const chain = getTowerMembers(e.id);
        chain.forEach((cid) => visited.add(cid));
        if (chain.length >= 2) out.push(chain);
      }
      return out;
    };

    const computeWorldFootY = (ent) => {
      if (!ent) return 0;
      if (ent.stackedOn) {
        const seen = new Set([ent.id]);
        let cur = ent;
        let yAcc = 0;
        while (cur && cur.stackedOn && !seen.has(cur.stackedOn)) {
          seen.add(cur.stackedOn);
          const base = getEnt(cur.stackedOn);
          if (!base) break;
          yAcc -= mountStepH(base.id);
          cur = base;
        }
        return (cur ? cur.y || 0 : 0) + yAcc;
      }
      return ent.y || 0;
    };

    const syncAllStackedFollowers = () => {
      for (const root of allActiveEnts()) {
        if (root.stackedOn) continue;
        const chain = getTowerMembers(root.id);
        if (chain.length < 2) continue;
        const rootCx = getEntWorldCx(root);
        let yCursor = root.y || 0;
        for (let i = 1; i < chain.length; i++) {
          const prev = getEnt(chain[i - 1]);
          const rider = getEnt(chain[i]);
          if (!rider || rider.dragging) break;
          yCursor -= mountStepH(prev.id);
          setEntWorldCx(rider, rootCx);
          rider.y = yCursor;
        }
      }
    };

    const enforceGroundSeparation = (lockedId = null) => {
      const { minX, maxX } = stageBoundsX();
      const groundList = [];
      for (const e of allActiveEnts()) {
        if (e.stackedOn || e.dragging) continue;
        if ((e.y || 0) < -3 || e.leap) continue;
        if (isMiniEnt(e) && e.act && (e.act.type === 'ride' || e.act.type === 'leap')) continue;
        groundList.push({
          id: e.id,
          ent: e,
          cx: getEntWorldCx(e),
          halfW: entHalfW(e),
          locked: e.id === lockedId,
        });
      }
      if (groundList.length >= 2) {
        resolveGroundSeparation(groundList, minX, maxX, 6);
        for (const item of groundList) {
          if (!item.locked) setEntWorldCx(item.ent, item.cx);
        }
      }
      syncAllStackedFollowers();
    };

    const spawnChromaBurst = (cx, cy, count = 12, gentle = false) => {
      for (let i = 0; i < count; i++) {
        if (chromaSparks.length >= 48) chromaSparks.shift();
        const ang = gentle
          ? -Math.PI * (0.25 + Math.random() * 0.5)
          : (i / Math.max(1, count)) * Math.PI * 2 + (Math.random() - 0.5) * 0.18;
        const spd = gentle ? 0.6 + Math.random() * 0.9 : 2.2 + (i % 2) * 1.15 + Math.random() * 0.6;
        chromaSparks.push({
          x: cx + (gentle ? (Math.random() - 0.5) * 14 : 0),
          y: cy + (gentle ? -4 - Math.random() * 8 : 0),
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - (gentle ? 0.8 : 1.1),
          life: 0,
          maxLife: gentle ? 6 : 11,
          color: CHROMA_HEX[i % CHROMA_HEX.length],
          size: gentle ? 3 : i % 3 === 0 ? 4 : 3,
        });
      }
    };

    const getRestPositions = () => {
      const w = readStageWidth();
      const safeRight = popoverRightWidth > 0 ? Math.max(185, w - popoverRightWidth - 18) : w - 12;
      const leaderX = clampActorX(safeRight - 82);
      const partnerX = clampActorX(leaderX - 66);
      return camp === 'claude' ? { clawd: leaderX, cat: partnerX } : { cat: leaderX, clawd: partnerX };
    };

    const resetHomePositions = (animateWalk = false) => {
      const pos = getRestPositions();
      for (const id of ['cat', 'clawd']) {
        const a = actors[id];
        if (a.dragging || a.stackedOn) continue;
        a.sideEdgeSnap = false;
        a.sidePushOriginX = null;
        a.sideEdgeOffset = 0;
        a.sideEdgeDirectUntil = 0;
        const target = pos[id];
        if (animateWalk && !reducedMotion && Math.abs(a.x - target) > 6 && a.y === 0) {
          a.overridePose = 'walk';
          a.overrideUntil = performance.now() + 380;
          a.overrideRot = 0;
        }
        a.x = target;
        if (a.y > 0) a.y = 0;
      }
      enforceGroundSeparation();
    };

    resetHomePositions(false);

    // ── 节拍序列：steps = [pose, ticks, sqW, sqH, lift] ───────────────────────
    const playSeq = (actor, steps, then) => {
      actor.seq = steps.map(([pose, ticks, sqW = 0, sqH = 0, lift = 0]) => ({ pose, ticks, sqW, sqH, lift }));
      actor.seqStartTick = tickIdx + 1;
      actor.seqThen = then || null;
    };
    const seqStep = (actor) => {
      if (!actor.seq) return null;
      let k = Math.max(0, tickIdx - actor.seqStartTick);
      for (const st of actor.seq) {
        if (k < st.ticks) return st;
        k -= st.ticks;
      }
      actor.seq = null;
      const then = actor.seqThen;
      actor.seqThen = null;
      if (then) then();
      return null;
    };
    const seqTotalMs = (steps) => steps.reduce((s, st) => s + st[1] * TICK, 0) + TICK;

    const landingSteps = (flatTicks) => [
      ['flat', flatTicks, 2, 0],
      ['idle', 1, -2, 1],
      ['idle', 1, 2, -1],
    ];

    const hopSteps = (airPose) => [
      ['squash', 1, 2, -1, 0],
      [airPose, 1, -1, 1, -2],
      [airPose, 1, 0, 0, -4],
      [airPose, 1, 0, 0, -4],
      [airPose, 1, 0, 0, -2],
      ['idle', 1, 2, -1, 0],
    ];

    const resolvePoseFor = (actor, now) => {
      if (actor.dragging) return 'dangle';
      const st = seqStep(actor);
      if (st) return st.pose;
      if (actor.overridePose && now < actor.overrideUntil) return actor.overridePose;
      if (actor.overridePose && now >= actor.overrideUntil) {
        actor.overridePose = null;
        actor.overrideRot = 0;
        actor.mirror = false;
        actor.faceDir = null;
        actor.clipParam = null;
      }
      if (yieldMode === 'peek') return 'peek';
      const isLeader = (camp === 'claude' && actor.id === 'clawd') || (camp !== 'claude' && actor.id === 'cat');
      if (hasError && isLeader) return 'angry';
      if (streaming) {
        return isLeader ? 'write' : actor.id === 'cat' ? 'loaf' : 'sleep';
      }
      if (dozing) return 'sleep';
      if (!isLeader && actor.id === 'cat' && Math.floor(now / 9000) % 2 === 1) return 'loaf';
      return actor.pose || 'idle';
    };

    const effectiveRot = (a, now) => {
      if (a.stackedOn && a.balRot && !a.dragging) return a.balRot;
      return now < a.overrideUntil && a.overrideRot ? a.overrideRot : a.rot;
    };

    const isEntDirectMotion = (ent) => {
      if (!ent) return false;
      if (ent.dragging || ent.leap || (ent.sideEdgeDirectUntil > 0 && performance.now() < ent.sideEdgeDirectUntil) || (!ent.stackedOn && (ent.y || 0) < -0.4)) return true;
      if (ent.stackedOn) {
        const root = getTowerRoot(ent.id);
        if (root && root !== ent && (root.dragging || root.leap || (root.sideEdgeDirectUntil > 0 && performance.now() < root.sideEdgeDirectUntil) || (root.y || 0) < -0.4)) return true;
      }
      return false;
    };

    const syncDirectMotionDomAttr = (ent, domEl) => {
      if (!domEl || !domEl.style) return false;
      const direct = isEntDirectMotion(ent);
      const dragNow = Boolean(ent && ent.dragging);
      if (ent.lastDomDirect !== direct) {
        ent.lastDomDirect = direct;
        if (direct) {
          domEl.setAttribute?.('data-direct', '1');
          domEl.style.transition = 'none';
        } else {
          domEl.removeAttribute?.('data-direct');
          domEl.style.transition = '';
        }
      }
      if (ent.lastDomDrag !== dragNow) {
        ent.lastDomDrag = dragNow;
        if (dragNow) {
          domEl.setAttribute?.('data-dragging', '1');
          domEl.style.cursor = 'grabbing';
        } else {
          domEl.removeAttribute?.('data-dragging');
          domEl.style.cursor = 'grab';
        }
      }
      return direct;
    };

    const snapCoord = (v, direct) => (direct ? Math.round(v * 100) / 100 : Math.round(v));

    const applyActorTransform = (actor) => {
      if (!actor.el) return;
      let yPx = actor.y;
      if (actor.stackedOn) {
        const root = getTowerRoot(actor.id);
        const worldCx = getEntWorldCx(root || actor);
        actor.x = clampActorX(worldCx - 48);
        yPx = computeWorldFootY(actor) + (yieldMode === 'leap' ? -leapOffsetY : 0);
      } else if (yieldMode === 'leap' && !actor.dragging && actor.y === 0) {
        yPx -= leapOffsetY;
      } else if (yieldMode === 'peek' && !actor.dragging) {
        yPx += 6;
      }
      const direct = syncDirectMotionDomAttr(actor, actor.el);
      const depth = actor.stackedOn ? getStackDepth(actor.id) : 0;
      const tx = snapCoord(actor.x, direct);
      const ty = snapCoord(yPx, direct);
      const tz = actor.dragging ? '38' : depth > 0 ? String(24 + depth * 2) : '24';
      if (actor.lastDomX !== tx || actor.lastDomY !== ty) {
        actor.lastDomX = tx;
        actor.lastDomY = ty;
        actor.el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
        perfStats.domTransformWrites += 1;
      } else {
        perfStats.domTransformSkips += 1;
      }
      if (actor.lastDomZ !== tz) {
        actor.lastDomZ = tz;
        actor.el.style.zIndex = tz;
      }
    };

    // ── 待机微动作：随机眨眼 / 呼吸下沉 / 耳尖抖动 / 单钳开合 / 左顾右盼 ──
    const updateIdleFx = (a, pose, now) => {
      // 眨眼计时在任何姿态下推进，仅在可眨眼姿态生效；减少动态时依旧保留
      if (tickIdx >= a.nextBlinkTick) {
        a.blinkTick = tickIdx;
        a.blinkDouble = Math.random() < 0.15;
        a.nextBlinkTick = tickIdx + ticksIn(2400, 6000) + (a.blinkDouble ? 5 : 3);
      }
      const bk = tickIdx - a.blinkTick;
      const blinkSeq = a.blinkDouble ? BLINK_DOUBLE : BLINK_SINGLE;
      const fx = {
        blinkStage: bk >= 0 && bk < blinkSeq.length ? blinkSeq[bk] : null,
        breath: false,
        earTwitch: null,
        clawSnap: null,
        glance: 0,
      };
      const idleNow = pose === 'idle' && !a.seq && !a.dragging;
      if (reducedMotion || !idleNow) {
        // 非待机期间把到期的微动作顺延，避免回到待机瞬间扎堆触发
        if (tickIdx >= a.nextBreathTick) a.nextBreathTick = tickIdx + ticksIn(800, 1800);
        if (tickIdx >= a.nextTwitchTick) a.nextTwitchTick = tickIdx + ticksIn(1500, 4000);
        if (tickIdx >= a.nextSnapTick) a.nextSnapTick = tickIdx + ticksIn(1500, 4000);
        a.glanceDir = 0;
        if (now >= a.nextGlanceAt) a.nextGlanceAt = now + rand(1500, 4000);
        return fx;
      }
      // 呼吸：每 2.8~4.2s 下沉 1 格持续 2 拍
      if (tickIdx >= a.nextBreathTick) {
        a.breathTick = tickIdx;
        a.nextBreathTick = tickIdx + ticksIn(2800, 4200);
      }
      const brk = tickIdx - a.breathTick;
      fx.breath = brk >= 0 && brk < 2;
      if (a.kind === 'cat') {
        // 耳尖抖动：6~10s 一次，1~2 拍
        if (tickIdx >= a.nextTwitchTick) {
          a.twitchTick = tickIdx;
          a.twitchLen = Math.random() < 0.5 ? 1 : 2;
          a.twitchSide = Math.random() < 0.5 ? 'L' : 'R';
          a.nextTwitchTick = tickIdx + ticksIn(6000, 10000);
        }
        const tk = tickIdx - a.twitchTick;
        if (tk >= 0 && tk < a.twitchLen) fx.earTwitch = a.twitchSide;
      } else {
        // 单钳开合：8~12s 一次，开-合-开-合 共 4 拍
        if (tickIdx >= a.nextSnapTick) {
          a.snapTick = tickIdx;
          a.snapSide = Math.random() < 0.5 ? 'L' : 'R';
          a.nextSnapTick = tickIdx + ticksIn(8000, 12000);
        }
        const sk = tickIdx - a.snapTick;
        if (sk >= 0 && sk < 4 && sk % 2 === 0) fx.clawSnap = a.snapSide;
      }
      // 左顾右盼：随机方向 + 随机驻留，30% 概率回看另一侧
      if (!a.glanceDir && now >= a.nextGlanceAt) {
        a.glanceDir = Math.random() < 0.5 ? -1 : 1;
        a.glanceUntil = now + rand(600, 1800);
        a.glanceSecond = Math.random() < 0.3;
      }
      if (a.glanceDir && now >= a.glanceUntil) {
        if (a.glanceSecond) {
          a.glanceDir = -a.glanceDir;
          a.glanceUntil = now + rand(500, 1400);
          a.glanceSecond = false;
        } else {
          a.glanceDir = 0;
          a.nextGlanceAt = now + rand(4000, 9000);
        }
      }
      fx.glance = a.glanceDir;
      return fx;
    };

    // ── 叠叠乐平衡：下方角色每拍水平位移 → 上方角色反向摆角（±8°）──
    const updateBalance = () => {
      for (const id of ['cat', 'clawd']) {
        const top = actors[id];
        const base = top.stackedOn ? actors[top.stackedOn] : null;
        let target = 0;
        if (base && !reducedMotion && base.prevX !== null) {
          target = Math.max(-8, Math.min(8, -(base.x - base.prevX) * 4));
        }
        top.balRot = Math.abs(target) >= Math.abs(top.balRot) ? target : top.balRot * 0.55 + target * 0.45;
        if (Math.abs(top.balRot) < 0.4) top.balRot = 0;
      }
      for (const id of ['cat', 'clawd']) actors[id].prevX = actors[id].x;
    };

    // ── 生态联动辅助：打盹 z / 迷你蟹互动路径 ─────────────────────────────
    // 打盹 z 周期：每 18 拍冒一串（小 → 中 → 大上浮），两宠错开半周期；减少动态时静态显示中号 z
    const dozeSymFor = (a) => {
      if (reducedMotion) return 'dozeZ1';
      const ph = (tickIdx + (a.id === 'cat' ? 9 : 0)) % 18;
      return ph < 4 ? 'dozeZ0' : ph < 8 ? 'dozeZ1' : ph < 12 ? 'dozeZ2' : null;
    };
    const crabRiding = () =>
      miniPileEnabled && miniCrabs.some((mc) => mc.act && mc.act.type === 'ride' && tickIdx >= mc.act.start);

    // 迷你蟹分段路径求值：返回 { x, y, sprite, mirror, hopPx }；未激活或结束返回 null
    const miniActPose = (mc, baseSprite, anim) => {
      const act = mc.act;
      if (!act) return null;
      const t = tickIdx - act.start;
      if (t < 0) return null;
      let k0 = t;
      let segIdx = -1;
      for (let i = 0; i < act.segs.length; i++) {
        if (k0 < act.segs[i].ticks) {
          segIdx = i;
          break;
        }
        k0 -= act.segs[i].ticks;
      }
      if (segIdx < 0 || (act.abort && act.abort(segIdx))) {
        mc.act = null;
        if (segIdx >= 0 && act.onAbort) act.onAbort();
        return null;
      }
      const seg = act.segs[segIdx];
      const k = (k0 + 1) / seg.ticks;
      const x = seg.x0 + (seg.x1 - seg.x0) * k;
      const y = seg.y0 + (seg.y1 - seg.y0) * k - (seg.arc || 0) * Math.sin(Math.PI * k);
      if (seg.x1 !== seg.x0) mc.mirror = seg.x1 < seg.x0;
      else if (seg.face) mc.mirror = seg.face < 0;
      const still = MINI_SPRITES[mc.id];
      const blinking = tickIdx - mc.blinkAt >= 0 && tickIdx - mc.blinkAt < 2;
      let sprite;
      if (seg.sprite === 'walk') sprite = tickIdx % 2 ? anim.walkB : still;
      else if (seg.sprite === 'trick') sprite = anim.trick;
      else if (seg.sprite === 'wave') sprite = reducedMotion || k0 % 4 < 2 ? anim.trick : still;
      else if (seg.sprite === 'sit') sprite = k0 >= 8 && k0 < 14 && k0 % 4 < 2 ? anim.trick : blinking ? miniBlinkFrame(still) : still;
      else sprite = blinking ? miniBlinkFrame(still) : still;
      return {
        x: Math.round(x),
        y: Math.round(y / 2) * 2,
        sprite: sprite || baseSprite,
        mirror: mc.mirror,
        hopPx: seg.hop && !reducedMotion && k0 % 4 < 2 ? -2 : 0,
      };
    };

    // 迷你蟹坐标：translateX 相对迷你堆左缘（宿主 left 12px），精灵中心在画布 20px 处
    const crabHostCenter = (mc) => 12 + mc.lastX + 20;
    const crabSafeX = (x) => Math.min(clampActorX(9999) - 132, Math.max(2, Math.round(x)));
    const crabMaxX = () => Math.max(40, readStageWidth() - 52);
    const nearestFreeCrab = (hx) =>
      miniCrabs
        .filter((mc) => !mc.act || tickIdx - mc.act.start < 0)
        .sort((m1, m2) => Math.abs(crabHostCenter(m1) - hx) - Math.abs(crabHostCenter(m2) - hx))[0] || null;
    const actorFree = (a, now) =>
      !a.dragging && !a.stackedOn && !a.seq && a.y === 0 && !(a.overridePose === 'dangle' && now < a.overrideUntil);

    // 迎宾：三蟹集体挥手（复用 trick 帧，错峰 2 拍起手）
    const crabsWave = () => {
      if (!miniPileEnabled) return;
      miniCrabs.forEach((mc, idx) => {
        if (mc.act && mc.act.type === 'ride') return;
        const x = crabSafeX(mc.lastX);
        mc.act = {
          type: 'wave',
          start: tickIdx + 1 + idx * 2,
          segs: [{ ticks: 14, x0: x, x1: x, y0: 0, y1: 0, sprite: 'wave', hop: true }],
        };
      });
    };

    // 抛掷落地砸在蟹附近：受惊跳开 → 定住 → 慢慢走回原位
    const scatterCrabsNear = (hx) => {
      if (!miniPileEnabled || reducedMotion) return;
      miniCrabs.forEach((mc, idx) => {
        if (mc.act && mc.act.type === 'ride') return;
        const d = crabHostCenter(mc) - hx;
        if (Math.abs(d) >= 64) return;
        const dir = d >= 0 ? 1 : -1;
        const x0 = crabSafeX(mc.lastX);
        const far = Math.max(0, Math.min(crabMaxX(), x0 + dir * 26));
        mc.act = {
          type: 'scatter',
          start: tickIdx + (idx % 2),
          segs: [
            { ticks: 5, x0, x1: far, y0: 0, y1: 0, arc: 6, sprite: 'walk' },
            { ticks: 4, x0: far, x1: far, y0: 0, y1: 0, sprite: 'still', face: -dir },
            { ticks: 9, x0: far, x1: x0, y0: 0, y1: 0, sprite: 'walk' },
          ],
        };
      });
    };

    let crabSerial = 0;
    // 小猫追蟹：一只迷你蟹跑到猫跟前挑衅 → 猫惊觉追几步 → 蟹逃回原位 → 猫歪头
    const runCrabChase = (force) => {
      const now = performance.now();
      const cat = actors.cat;
      if (!miniPileEnabled || reducedMotion || dozing || !actorFree(cat, now)) return false;
      if (!force && stageBusy()) return false;
      const mc = nearestFreeCrab(cat.x + 48);
      if (!mc) return false;
      const x0 = crabSafeX(mc.lastX);
      const crabLeft = x0 + 20 + 12 < cat.x + 48;
      const tx = Math.max(0, Math.min(crabMaxX(), crabLeft ? cat.x - 26 : cat.x + 58));
      const catDir = crabLeft ? -1 : 1;
      const dist = Math.abs(tx - x0);
      const approach = Math.max(3, Math.min(36, Math.round(dist / 7)));
      const flee = Math.max(4, Math.min(28, Math.round(dist / 10)));
      const act = {
        type: 'chase',
        start: tickIdx + 1,
        segs: [
          { ticks: approach, x0, x1: tx, y0: 0, y1: 0, sprite: 'walk' },
          { ticks: 6, x0: tx, x1: tx, y0: 0, y1: 0, sprite: 'wave', face: -catDir },
          { ticks: flee, x0: tx, x1: x0, y0: 0, y1: 0, sprite: 'walk', hop: true },
        ],
      };
      mc.act = act;
      const serial = (crabSerial += 1);
      const alive = () => serial === crabSerial && !disposed && !reducedMotion && !cat.dragging && !cat.stackedOn && !dozing;
      const t0 = (approach + 1) * TICK;
      later(t0, () => {
        if (!alive()) return;
        startClip(cat, 'wow', 500, { sym: 'bang' });
        renderAllFrames(performance.now());
      });
      later(t0 + 500, () => {
        if (!alive()) return;
        startClip(cat, 'walk', 1200, { patrolDir: catDir, mirror: catDir > 0, sym: 'spark', symDurationMs: 600 });
      });
      later(t0 + 1750, () => {
        if (!alive()) return;
        startClip(cat, 'tilt', 900, { rot: -9, sym: 'q' });
        renderAllFrames(performance.now());
      });
      later(t0 + 2750, () => {
        if (alive() && !stageBusy()) resetHomePositions(true);
      });
      return true;
    };

    // 迷你蟹骑头：走到 Clawd 脚边 → 整格弧线跳上头顶坐一会儿（中途挥手）→ 跳下走回
    const runCrabRide = (force) => {
      const now = performance.now();
      const clawd = actors.clawd;
      if (!miniPileEnabled || reducedMotion || dozing || yieldMode !== 'none') return false;
      if (!actorFree(clawd, now) || actors.cat.stackedOn === 'clawd') return false;
      if (!force && stageBusy()) return false;
      const mc = nearestFreeCrab(clawd.x + 48);
      if (!mc) return false;
      const x0 = crabSafeX(mc.lastX);
      const clawdX0 = clawd.x;
      // Clawd 头顶（y=0 行顶边）距宿主底 33px，迷你蟹脚底距宿主底 11px → 上移 22px；水平居中对齐 48px / 20px
      const headX = Math.round(clawd.x + 16);
      const headY = -22;
      const side = x0 + 32 < clawd.x + 48 ? -1 : 1;
      const sideX = Math.max(0, Math.min(crabMaxX(), headX + side * 36));
      const approach = Math.max(1, Math.min(36, Math.round(Math.abs(sideX - x0) / 7)));
      const SIT = 22;
      const act = {
        type: 'ride',
        start: tickIdx + 1,
        segs: [
          { ticks: approach, x0, x1: sideX, y0: 0, y1: 0, sprite: 'walk' },
          { ticks: 4, x0: sideX, x1: headX, y0: 0, y1: headY, arc: 10, sprite: 'trick' },
          { ticks: SIT, x0: headX, x1: headX, y0: headY, y1: headY, sprite: 'sit', face: -side },
          { ticks: 4, x0: headX, x1: sideX, y0: headY, y1: 0, arc: 8, sprite: 'trick' },
          { ticks: Math.max(2, approach), x0: sideX, x1: x0, y0: 0, y1: 0, sprite: 'walk' },
        ],
        // Clawd 被拖走 / 起飞 / 位移 / 叠叠乐时，蟹立即放弃骑头回到原位
        abort: (segIdx) =>
          segIdx >= 1 &&
          segIdx <= 3 &&
          (clawd.dragging ||
            clawd.stackedOn ||
            actors.cat.stackedOn === 'clawd' ||
            clawd.y !== 0 ||
            Math.abs(clawd.x - clawdX0) > 2 ||
            yieldMode !== 'none' ||
            dozing),
        onAbort: () => {
          if (clawd.overridePose === 'carry') clawd.overrideUntil = 0;
        },
      };
      mc.act = act;
      const tLand = (1 + approach + 4) * TICK;
      later(tLand, () => {
        if (mc.act !== act) return;
        startClip(clawd, 'carry', SIT * TICK + 60);
        renderAllFrames(performance.now());
      });
      later(tLand + (SIT + 4) * TICK, () => {
        if (mc.act !== act) return;
        startClip(clawd, 'happy', 700, { sym: 'spark' });
        renderAllFrames(performance.now());
      });
      return true;
    };

    // 舞台棱镜像素星屑渲染器（无粒子时自动缩回 0×0 释放 GPU 显存纹理，0 常驻开销）
    const stepAndPaintChromaFx = () => {
      if (!chromaSparks.length) {
        if (!fxCanvasCleared || fxCanvas.width || fxCanvas.height) releaseFxCanvas();
        return;
      }
      fxCanvasCleared = false;
      const wCss = Math.max(240, readStageWidth());
      const hCss = 160;
      const tw = Math.round(wCss * dpr);
      const th = Math.round(hCss * dpr);
      if (fxCanvas.style?.display === 'none') fxCanvas.style.display = '';
      if (fxCanvas.width !== tw || fxCanvas.height !== th) {
        fxCanvas.width = tw;
        fxCanvas.height = th;
        if (fxCanvas.style) { fxCanvas.style.width = `${wCss}px`; fxCanvas.style.height = `${hCss}px`; }
      }
      const ctx = fxCanvas.getContext('2d');
      if (!ctx) { chromaSparks.length = 0; releaseFxCanvas(); return; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, wCss, hCss);
      ctx.imageSmoothingEnabled = false;
      for (let i = chromaSparks.length - 1; i >= 0; i--) {
        const sp = chromaSparks[i];
        sp.life += 1;
        if (sp.life > sp.maxLife) { chromaSparks.splice(i, 1); continue; }
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vy += 0.28;
        ctx.fillStyle = sp.life % 3 === 1 ? '#FFFFFF' : sp.color;
        ctx.fillRect(Math.round(sp.x / PX) * PX, Math.round((hCss - 8 + sp.y) / PX) * PX, sp.size, sp.size);
      }
      if (!chromaSparks.length) releaseFxCanvas();
    };

    let lastChromaStepTick = -1;
    const renderAllFrames = (now) => {
      syncStageDpr();
      if (prismaticCoat && !reducedMotion && !dozing && lastChromaStepTick !== tickIdx) {
        lastChromaStepTick = tickIdx;
        if (tickIdx % 3 === 0) {
          chromaPhase = (chromaPhase + 1 / 12) % 1;
        }
      }
      syncAllStackedFollowers();

      for (const id of ['cat', 'clawd']) {
        const a = actors[id];
        let pose = resolvePoseFor(a, now);
        const st = seqStep(a);

        // 待机巡逻位移（每拍定步推进，底下散步时稳稳驮着头顶整串伙伴同步移动）
        if (pose === 'walk' && !a.dragging && !a.stackedOn && !a.leap && now < a.overrideUntil && !reducedMotion && a.walkStepTick !== tickIdx) {
          a.walkStepTick = tickIdx;
          const stepPx = now < a.passBoostUntil ? 1.4 * 1.55 : 1.4;
          a.x = clampActorX(a.x + a.patrolDir * stepPx);
          if (a.x <= 12 || a.x >= clampActorX(9999) - 2) a.patrolDir *= -1;
          syncAllStackedFollowers();
        }

        // 自动搭便车超时后轻巧侧跳落地
        if (a.stackedOn && a.perchUntil > 0 && now >= a.perchUntil && !a.dragging) {
          a.perchUntil = 0;
          const prevY = computeWorldFootY(a);
          const jumpDir = a.id === 'cat' ? 1 : -1;
          a.stackedOn = null;
          a.y = prevY;
          startBallistic(a, jumpDir * 2.8, -3.6, { noSnap: true });
        }

        // 主动抛物线撑跳越过 / 搭便车跃上（Leapfrog / AutoPerch，峰值 ~26px）
        if (a.leap && !a.dragging) {
          const lp = a.leap;
          const k = Math.min(1, (tickIdx - lp.startTick + 1) / Math.max(1, lp.ticks));
          const cx = lp.cx0 + (lp.cx1 - lp.cx0) * k;
          setEntWorldCx(a, cx);
          a.y = -Math.round(lp.peak * Math.sin(Math.PI * k));
          pose = k < 1 ? 'spinHop' : 'idle';
          if (k >= 1) {
            a.leap = null;
            a.y = 0;
            if (lp.landOnto) {
              const holder = getEnt(lp.landOnto);
              if (holder && !holder.dragging && getTowerMembers(holder.id).length < maxTowerDepthAllowed()) {
                a.stackedOn = holder.id;
                a.perchUntil = now + 7600;
                a.sym = 'heart';
                a.symUntil = now + 1000;
                playSeq(a, [['happy', 1, 2, -1, 0]]);
                syncAllStackedFollowers();
              } else {
                playSeq(a, [['idle', 1, 2, -1, 0]]);
                enforceGroundSeparation();
              }
            } else {
              playSeq(a, [['idle', 1, 2, -1, 0]]);
              enforceGroundSeparation();
            }
          }
          syncAllStackedFollowers();
        }

        // 叠叠乐上层失衡：张钳/张爪
        if (a.stackedOn && pose === 'idle' && Math.abs(a.balRot) > 1.5) pose = 'balance';

        const sym =
          a.sym && now < a.symUntil
            ? a.sym
            : dozing && pose === 'sleep'
              ? dozeSymFor(a)
              : pose === 'sleep' || pose === 'loaf'
                ? tickIdx % 8 < 4
                  ? 'z1'
                  : 'z2'
                : pose === 'angry'
                  ? 'vein'
                  : null;
        const localTick = pose === 'write' ? Math.floor(tickIdx / (streamTier === 3 ? 2 : 3)) : tickIdx;
        const fx = updateIdleFx(a, pose, now);
        a.lastFx = fx;
        const hasRider = Boolean(findDirectRider(id));
        const effectivePose = hasRider && pose === 'idle' ? 'squash' : pose;
        const sulkJitter = effectivePose === 'sulk' && !reducedMotion ? (tickIdx % 4 < 2 ? 0 : -PX) : 0;
        const liftPx = st && st.lift && !reducedMotion ? st.lift * PX : 0;
        const nodOffset = (now < a.nodUntil ? a.nodY : 0) + sulkJitter + liftPx;
        let sqW = st ? st.sqW : 0;
        let sqH = st ? st.sqH : 0;
        if (!st && hasRider && pose !== 'idle') sqH = -1;
        a.lastSq = { w: sqW, h: sqH };
        const rot = effectiveRot(a, now);
        const clipBottomY = yieldMode === 'peek' && !a.dragging ? (OY + 8) * PX : undefined;
        const ftk = tickIdx - a.forceTwitchStart;
        const forcedTwitch = ftk >= 0 && ftk < 4 && ftk !== 2 ? a.forceTwitchSide : null;

        const crystalActive = id === 'clawd' && orchestrator && !hasRider && !crabRiding();
        const layers = buildClipLayers(a.kind, effectivePose, localTick, {
          clipTick: Math.max(0, tickIdx - a.clipStartTick),
          sym,
          blinkStage: fx.blinkStage,
          breath: fx.breath,
          earTwitch: forcedTwitch || fx.earTwitch,
          clawSnap: fx.clawSnap,
          clipParam: a.clipParam,
          reduced: reducedMotion,
          crystal: crystalActive,
          crystalBob: !reducedMotion && Math.floor(tickIdx / 6) % 2 === 1,
          eyeScan: a.eyeScan || fx.glance,
          noShadow: a.dragging || a.y < -2 || Boolean(a.stackedOn) || yieldMode === 'peek',
          dir: a.faceDir || (a.vx < 0 || a.patrolDir < 0 ? 'left' : 'right'),
        });

        const isChromaCat = id === 'cat' && prismaticCoat;
        const phaseBucket = isChromaCat ? Math.round(chromaPhase * 12) : 0;
        const earSparkPhase = isChromaCat ? Math.floor(tickIdx / 2) % 10 : -1;
        if (
          isChromaCat &&
          !reducedMotion &&
          (a.dragging || a.leap || a.y < -3 || (st && st.lift) || (effectivePose === 'walk' && now < a.overrideUntil))
        ) {
          spawnChromaBurst(getEntWorldCx(a), computeWorldFootY(a) - 6, 1, true);
        }

        const flip = Boolean(a.mirror);
        const tintState = `${a.kind}:${crystalActive ? 1 : 0}:${isChromaCat ? `p${phaseBucket}_${earSparkPhase}` : '0'}`;
        const snappedTy = Math.round(Number(nodOffset || 0) / PX) * PX;
        const frameIdx = computeLayersFrameIdx(layers);
        const hasPhysicalMotion =
          a.dragging ||
          Boolean(a.leap) ||
          Math.abs(a.vx) > 0.01 ||
          Math.abs(a.vy) > 0.01 ||
          (effectivePose === 'walk' && now < a.overrideUntil && !reducedMotion);
        const rc = a.lastRender;
        if (
          !hasPhysicalMotion &&
          rc.poseKey === effectivePose &&
          rc.frameIdx === frameIdx &&
          rc.flip === flip &&
          rc.tintState === tintState &&
          rc.tyPx === snappedTy &&
          rc.sqW === sqW &&
          rc.sqH === sqH &&
          rc.lastRot === rot &&
          rc.clipBottomY === clipBottomY &&
          rc.cw === a.canvas.width &&
          rc.ch === a.canvas.height
        ) {
          perfStats.canvasSkips += 1;
        } else {
          rc.poseKey = effectivePose;
          rc.frameIdx = frameIdx;
          rc.flip = flip;
          rc.tintState = tintState;
          rc.tyPx = snappedTy;
          rc.sqW = sqW;
          rc.sqH = sqH;
          rc.lastRot = rot;
          rc.clipBottomY = clipBottomY;
          rc.cw = a.canvas.width;
          rc.ch = a.canvas.height;
          const colorResolver = isChromaCat
            ? (ch, gx, gy, pal) =>
                ch === '#'
                  ? evalChromaColorAt(gx, gy, chromaPhase, false)
                  : ch === 's'
                    ? evalChromaColorAt(gx, gy, chromaPhase, true)
                    : pal[ch]
            : null;
          const overlayPainter =
            isChromaCat && (earSparkPhase < 3 || (earSparkPhase >= 5 && earSparkPhase < 8))
              ? (c2, oxG, oyG, pxS) => {
                  const leftEar = earSparkPhase < 3;
                  const sx = (oxG + (leftEar ? 2 : 13)) * pxS;
                  const sy = (oyG - 3) * pxS;
                  c2.fillStyle = '#FFFFFF';
                  c2.fillRect(sx, sy, pxS, pxS);
                  if (earSparkPhase === 1 || earSparkPhase === 6) {
                    c2.fillRect(sx - pxS, sy, pxS, pxS);
                    c2.fillRect(sx + pxS, sy, pxS, pxS);
                    c2.fillRect(sx, sy - pxS, pxS, pxS);
                    c2.fillRect(sx, sy + pxS, pxS, pxS);
                  }
                }
              : null;
          renderPixelLayers(a.canvas, dpr, OX, OY, PX, PALETTES[a.kind], layers, {
            mirror: flip,
            tyPx: snappedTy,
            sqW,
            sqH,
            rotDeg: rot,
            clipBottomY,
            colorResolver,
            overlayPainter,
          });
          perfStats.canvasDraws += 1;
        }
      }

      const nextMiniDisplay = miniPileEnabled ? 'flex' : 'none';
      if (lastMiniDisplay !== nextMiniDisplay) {
        lastMiniDisplay = nextMiniDisplay;
        miniGroupEl.style.display = nextMiniDisplay;
      }
      if (miniPileEnabled) {
        const safeRight = Math.max(48, (stageBoundsX().maxX || 680) - 48);
        if (!reducedMotion && !dozing && lastCrabStepTick !== tickIdx) {
          lastCrabStepTick = tickIdx;
          const freeCorridorCrabs = miniCrabs.filter((mc) => !mc.dragging && !mc.stackedOn && !mc.leap && mc.y === 0);
          const crabEvs = stepMiniCrabCorridor(freeCorridorCrabs, {
            minX: 2,
            maxX: safeRight,
            contactDist: 26,
            nowTick: tickIdx,
          });
          if (crabEvs.length) {
            recordInteraction(crabEvs[0].type, crabEvs[0].pair, now);
          }
        }
        syncAllStackedFollowers();
        miniCrabs.forEach((mc, idx) => {
          const anim = MINI_ANIM_FRAMES[mc.id];
          const moving = !reducedMotion && !dozing;

          // 自动搭便车超时后轻巧侧跳落地
          if (mc.stackedOn && mc.perchUntil > 0 && now >= mc.perchUntil && !mc.dragging) {
            mc.perchUntil = 0;
            const prevY = computeWorldFootY(mc);
            const jumpDir = idx % 2 === 0 ? -1 : 1;
            mc.stackedOn = null;
            mc.y = prevY;
            startMiniBallistic(mc, jumpDir * 2.8, -3.6, { noSnap: true });
          }

          // 抛物线撑跳越过推进
          if (mc.leap && !mc.dragging) {
            const lp = mc.leap;
            const k = Math.min(1, (tickIdx - lp.startTick + 1) / Math.max(1, lp.ticks));
            const cx = lp.cx0 + (lp.cx1 - lp.cx0) * k;
            setEntWorldCx(mc, cx);
            mc.y = -Math.round(lp.peak * Math.sin(Math.PI * k));
            if (k >= 1) {
              mc.leap = null;
              mc.y = 0;
              if (lp.landOnto) {
                const holder = getEnt(lp.landOnto);
                if (holder && !holder.dragging && getTowerMembers(holder.id).length < maxTowerDepthAllowed()) {
                  mc.stackedOn = holder.id;
                  mc.perchUntil = now + 7200;
                  syncAllStackedFollowers();
                } else {
                  enforceGroundSeparation();
                }
              } else {
                enforceGroundSeparation();
              }
            }
          }

          const cycle = (tickIdx + idx * 7) % 24;
          const isTrick = moving && !mc.stackedOn && cycle >= 18;
          const inBump = moving && tickIdx < mc.bumpUntilTick;
          const inPassHop = moving && tickIdx < mc.passHopUntilTick;
          let sprite = mc.dragging
            ? tickIdx % 2 === 0
              ? anim.walkB
              : MINI_SPRITES[mc.id]
            : mc.leap
              ? anim.trick
              : mc.stackedOn
                ? cycle >= 20
                  ? anim.trick
                  : MINI_SPRITES[mc.id]
                : inBump
                  ? anim.trick
                  : isTrick && !inPassHop
                    ? anim.trick
                    : moving && tickIdx % 4 >= 2
                      ? anim.walkB
                      : MINI_SPRITES[mc.id];
          if (tickIdx >= mc.nextBlink) {
            mc.blinkAt = tickIdx;
            mc.nextBlink = tickIdx + ticksIn(2600, 6500);
          }
          if (!mc.dragging && tickIdx - mc.blinkAt >= 0 && tickIdx - mc.blinkAt < 2 && !isTrick && !inBump) {
            sprite = miniBlinkFrame(sprite);
          }
          const tc = cycle - 18;
          let hopPx = 0;
          if (!mc.dragging && !mc.stackedOn && !mc.leap) {
            if (inPassHop) {
              const rem = mc.passHopUntilTick - tickIdx;
              hopPx = rem === 2 || rem === 3 ? -4 : -2;
            } else if (inBump) {
              hopPx = -2;
            } else if (moving) {
              const hopCells = isTrick
                ? mc.id === 'cowboy'
                  ? [0, -1, -2, -2, -1, 0][tc] || 0
                  : tc === 1 || tc === 2
                    ? -1
                    : 0
                : (tickIdx + idx * 3) % 14 === 0
                  ? -1
                  : 0;
              hopPx = hopCells * 2;
            }
          }

          const actPos = !mc.dragging && !mc.stackedOn && !mc.leap ? miniActPose(mc, sprite, anim) : null;
          const targetSprite = actPos ? actPos.sprite : sprite;
          const targetMirror = actPos ? Boolean(actPos.mirror) : Boolean(moving && mc.dir < 0);
          const targetTy = actPos ? actPos.hopPx : hopPx;
          const mcDirect = syncDirectMotionDomAttr(mc, mc.canvas);
          let targetX;
          let targetY;
          if (mc.stackedOn && !mc.dragging) {
            const root = getTowerRoot(mc.id);
            const wCx = getEntWorldCx(root || mc);
            targetX = snapCoord(wCx - 32, mcDirect);
            targetY = snapCoord(computeWorldFootY(mc), mcDirect);
            mc.px = targetX;
            mc.lastX = Math.round(targetX);
          } else if (actPos) {
            targetX = actPos.x;
            targetY = actPos.y;
            if (actPos.y === 0) {
              mc.lastX = Math.min(safeRight, Math.max(2, actPos.x));
              mc.px = mc.lastX;
            }
          } else {
            const rawX = mc.dragging
              ? mc.px
              : moving
                ? Math.min(safeRight, Math.max(2, mc.px))
                : Math.min(safeRight, Math.max(2, mc.px ?? mc.x));
            targetX = snapCoord(rawX, mcDirect);
            targetY = snapCoord(mc.y || 0, mcDirect);
            mc.lastX = Math.round(targetX);
          }

          const depth = mc.stackedOn ? getStackDepth(mc.id) : 0;
          const mz = mc.dragging ? '39' : depth > 0 ? String(25 + depth * 2) : '25';
          const mKey = `${computeLayersFrameIdx([targetSprite])}|${targetMirror ? 1 : 0}|${targetTy}|${mc.canvas.width}`;
          if (mc.lastFrameKey !== mKey) {
            mc.lastFrameKey = mKey;
            renderPixelLayers(mc.canvas, dpr, 2, 5, 2, PALETTES[mc.id], [targetSprite], {
              mirror: targetMirror,
              tyPx: targetTy,
            });
          }
          if (mc.lastDomX !== targetX || mc.lastDomY !== targetY) {
            mc.lastDomX = targetX;
            mc.lastDomY = targetY;
            mc.canvas.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
          }
          if (mc.lastDomZ !== mz) {
            mc.lastDomZ = mz;
            mc.canvas.style.zIndex = mz;
          }
        });
      } else {
        miniCrabs.forEach((mc) => {
          mc.act = null;
          mc.stackedOn = null;
          mc.dragging = false;
          mc.y = 0;
        });
      }

      enforceGroundSeparation(
        actors.cat.dragging
          ? 'cat'
          : actors.clawd.dragging
            ? 'clawd'
            : (miniCrabs.find((m) => m.dragging) || {}).id || null
      );
      // 二次刷新被防重叠微调后的 DOM transform（若未变则自动命中缓存 0 写入）
      applyActorTransform(actors.cat);
      applyActorTransform(actors.clawd);
      if (miniPileEnabled) {
        for (const mc of miniCrabs) {
          if (!mc.dragging && !mc.stackedOn && !mc.act && !mc.leap && mc.y === 0) {
            syncDirectMotionDomAttr(mc, mc.canvas);
            const tx = Math.round(mc.px);
            if (mc.lastDomX !== tx || mc.lastDomY !== 0) {
              mc.lastDomX = tx;
              mc.lastDomY = 0;
              mc.canvas.style.transform = `translate3d(${tx}px, 0px, 0)`;
            }
          }
        }
      }
      stepAndPaintChromaFx();
    };

    const startClip = (actor, pose, durationMs, opts = {}) => {
      const now = performance.now();
      actor.overridePose = pose;
      actor.overrideUntil = now + durationMs;
      actor.overrideRot = opts.rot || 0;
      actor.mirror = Boolean(opts.mirror);
      actor.faceDir = opts.face || null;
      actor.clipParam = opts.param ?? null;
      actor.clipStartTick = tickIdx;
      if (opts.sym) {
        actor.sym = opts.sym;
        actor.symUntil = now + (opts.symDurationMs || durationMs);
      }
      if (opts.patrolDir) actor.patrolDir = opts.patrolDir;
    };

    // 减少动态开启：中止抛掷/巡逻/序列，回到静态待机
    function freezeMotion() {
      for (const id of ['cat', 'clawd']) {
        const a = actors[id];
        a.flying += 1;
        a.leap = null;
        a.seq = null;
        a.seqThen = null;
        a.vx = 0;
        a.vy = 0;
        a.rot = 0;
        a.balRot = 0;
        a.passBoostUntil = 0;
        if (!a.stackedOn) a.y = 0;
        if (a.overridePose === 'walk' || a.overridePose === 'dangle') a.overridePose = null;
      }
      miniCrabs.forEach((mc) => {
        mc.flying += 1;
        mc.leap = null;
        if (mc.act && mc.act.type !== 'wave') mc.act = null;
        mc.bumpUntilTick = -1;
        mc.passHopUntilTick = -1;
        mc.cooldownTick = -1;
        if (!mc.stackedOn) {
          mc.y = 0;
          mc.px = mc.x;
          mc.lastX = mc.x;
        }
      });
      if (actors.clawd.overridePose === 'carry') actors.clawd.overrideUntil = 0;
      resetHomePositions(false);
    }

    const toggleChromaResonance = (now) => {
      prismaticCoat = !prismaticCoat;
      writeChromaSaved(prismaticCoat);
      const catCx = getEntWorldCx(actors.cat);
      const catFootY = computeWorldFootY(actors.cat);
      if (prismaticCoat) {
        // 觉醒：迸发一圈 12 粒四色棱镜像素星屑 + 腾空轻跃蜕变为棱彩炫彩形态
        spawnChromaBurst(catCx, catFootY - 18, 12, false);
        playSeq(actors.cat, hopSteps('spinHop'));
        actors.cat.sym = 'spark';
        actors.cat.symUntil = now + 1500;
        recordInteraction('chromaAwaken', 'cat', now);
      } else {
        spawnChromaBurst(catCx, catFootY - 16, 6, true);
        startClip(actors.cat, 'groom', 800, { sym: 'note' });
        recordInteraction('chromaRest', 'cat', now);
      }
    };

    // ── 五段递进戳戳气鼓鼓 + 叠塔连击四下切换隐藏棱彩形态 ────────────────────
    const triggerPoke = (actor, fromPointer) => {
      const now = performance.now();
      markActivity();

      // 检查叠塔态小紫猫 2.6s 内连续点击 4 次仪式（2 层及以上叠塔皆可）
      if (actor.id === 'cat') {
        const towerLen = getTowerMembers('cat').length;
        const reqTower = 2;
        if (towerLen >= reqTower && (prismaticCoat || (chromaGates.tuned && chromaGates.forged))) {
          while (chromaTapTimes.length && now - chromaTapTimes[0] > 2600) {
            chromaTapTimes.shift();
          }
          chromaTapTimes.push(now);
          if (chromaTapTimes.length >= 4) {
            chromaTapTimes.length = 0;
            actor.pokeCount = 0;
            toggleChromaResonance(now);
            renderAllFrames(now);
            return;
          }
          startClip(actor, 'happy', 550, { sym: 'spark' });
          renderAllFrames(now);
          return;
        }
      }

      if (now - actor.lastPokeAt > 4500) actor.pokeCount = 0;
      actor.pokeCount += 1;
      actor.lastPokeAt = now;
      const inTower = getTowerMembers(actor.id).length >= 2;

      if (actor.pokeCount === 1) {
        startClip(actor, actor.id === 'cat' && Math.random() < 0.45 ? 'groom' : 'happy', 750, { sym: 'spark' });
        if (fromPointer && !inTower) startBallistic(actor, 0, -4.4, { anticipate: true });
      } else if (actor.pokeCount === 2) {
        startClip(actor, 'jiggle', 950, { sym: 'note' });
      } else if (actor.pokeCount === 3) {
        startClip(actor, 'tilt', 1100, { rot: -9, sym: 'q' });
      } else if (actor.pokeCount === 4) {
        startClip(actor, 'wow', 950, { sym: 'bang' });
        if (fromPointer && !inTower) startBallistic(actor, 0, -3.2, { anticipate: true });
      } else {
        actor.pokeCount = 0;
        startClip(actor, 'sulk', 3200, { mirror: true, sym: 'vein' });
      }
      renderAllFrames(now);
    };

    // ── 日常自主小剧场调度 + 约 6% 低概率彩蛋 + 双宠互动剧目 ───────────────
    const DAILY_CLAWD = ['polish', 'eat', 'letter', 'plant', 'butterfly', 'walk', 'stretch', 'spinHop', 'wave', 'yawn'];
    const DAILY_CAT = ['groom', 'eatFish', 'chaseDot', 'catStretch', 'butterfly', 'letter', 'walk', 'plant', 'yawnStretch'];
    const DAILY_WEIGHTS = { wave: 1.3, yawn: 0.6, yawnStretch: 1.1 };
    const NIGHT_BOOST = new Set(['yawn', 'yawnStretch', 'stretch', 'catStretch']);
    const CLIP_MS = { wave: 1500, yawn: 1300, yawnStretch: 2200 };
    const isLateNight = () => {
      const h = new Date().getHours();
      return h >= 23 || h < 6;
    };
    const pickDaily = (pool) => {
      const night = isLateNight();
      const ws = pool.map((k) => (DAILY_WEIGHTS[k] ?? 1) * (night && NIGHT_BOOST.has(k) ? 3 : 1));
      let r = Math.random() * ws.reduce((s, w) => s + w, 0);
      for (let i = 0; i < pool.length; i++) {
        r -= ws[i];
        if (r < 0) return pool[i];
      }
      return pool[pool.length - 1];
    };
    const EGGS = ['onFire', 'cheerSticks', 'rickroll', 'siren'];
    const DUETS = [
      ['chatGreet', 0.4],
      ['lookNod', 0.25],
      ['catRub', 0.2],
      ['readAlong', 0.15],
    ];
    const pickDuet = () => {
      let r = Math.random();
      for (const [k, w] of DUETS) {
        r -= w;
        if (r < 0) return k;
      }
      return 'chatGreet';
    };

    const stageBusy = () =>
      streaming ||
      hasError ||
      yieldMode !== 'none' ||
      actors.clawd.dragging ||
      actors.cat.dragging ||
      miniCrabs.some((m) => m.dragging) ||
      actors.clawd.stackedOn ||
      actors.cat.stackedOn ||
      miniCrabs.some((m) => m.stackedOn);

    let duetSerial = 0;
    const runDuet = (name) => {
      const now = performance.now();
      const clawd = actors.clawd;
      const cat = actors.cat;
      const serial = (duetSerial += 1);
      if (name === 'lookNod') {
        duetUntil = now + 2500;
        // 对视点头：两宠转向对方，Clawd 先点、小紫猫随后点头回应
        const clawdFace = cat.x >= clawd.x ? 'right' : 'left';
        const catFace = clawdFace === 'right' ? 'left' : 'right';
        startClip(clawd, 'lookNod', 2000, { face: clawdFace, param: 5 });
        startClip(cat, 'lookNod', 2000, { face: catFace, param: 9 });
      } else if (name === 'readAlong') {
        duetUntil = now + 2500;
        // 并排跟读：同一起始拍，同步轻点头 3 拍
        startClip(clawd, 'readAlong', 1600, { sym: 'note' });
        startClip(cat, 'readAlong', 1600);
      } else if (name === 'catRub') {
        // 小紫猫蹭爪：猫走近 Clawd → 伸爪蹭蹭 → Clawd 冒心 → 猫走回原位
        const dirToClawd = clawd.x < cat.x ? -1 : 1;
        const walkPx = Math.max(0, Math.abs(clawd.x - cat.x) - 46);
        const walkTicks = Math.min(16, Math.round(walkPx / 1.4));
        const walkMs = walkTicks * TICK;
        duetUntil = now + walkMs * 2 + 2000;
        const alive = () => serial === duetSerial && !disposed && !stageBusy() && !reducedMotion;
        if (walkTicks >= 2) startClip(cat, 'walk', walkMs, { patrolDir: dirToClawd });
        later(walkMs, () => {
          if (!alive()) return;
          startClip(cat, 'groom', 1600, { mirror: dirToClawd < 0 });
          renderAllFrames(performance.now());
        });
        later(walkMs + 400, () => {
          if (!alive()) return;
          startClip(clawd, 'pet', 1300, { sym: 'heart' });
          renderAllFrames(performance.now());
        });
        later(walkMs + 1700, () => {
          if (!alive()) return;
          if (walkTicks >= 2) startClip(cat, 'walk', walkMs, { patrolDir: -dirToClawd });
          renderAllFrames(performance.now());
        });
        later(walkMs * 2 + 1800, () => {
          if (!alive()) return;
          resetHomePositions(false);
        });
      } else {
        duetUntil = now + 2500;
        startClip(clawd, 'chatGreet', 2400, { sym: 'heart' });
        startClip(cat, 'chatGreet', 2400, { mirror: true, sym: 'note' });
        crabsWave();
      }
      renderAllFrames(now);
    };

    const pickNextTheater = () => {
      if (disposed) return;
      // 减少动态：冻结自主巡逻与剧场，只保留静态待机与眨眼；打盹期间不排剧目
      if (!stageBusy() && !reducedMotion && !dozing) {
        const now = performance.now();
        const cIdle = !actors.clawd.overridePose || now >= actors.clawd.overrideUntil;
        const kIdle = !actors.cat.overridePose || now >= actors.cat.overrideUntil;
        const crabBusy = miniCrabs.some((mc) => mc.act);

        if (miniPileEnabled && cIdle && kIdle && !crabBusy && Math.random() < 0.18) {
          // 迷你三蟹生态互动：小猫追蟹 / 蟹骑 Clawd 头顶 / 集体挥手
          const r = Math.random();
          const ok = r < 0.4 ? runCrabChase(false) : r < 0.8 ? runCrabRide(false) : (crabsWave(), true);
          if (ok) renderAllFrames(now);
        } else if (cIdle && kIdle && Math.random() < 0.3) {
          runDuet(pickDuet());
        } else {
          const target = theaterCursor % 2 === 0 ? actors.cat : actors.clawd;
          theaterCursor += 1;
          if (!target.overridePose || now >= target.overrideUntil) {
            const roll = Math.random();
            if (roll < 0.06) {
              const egg = EGGS[Math.floor(Math.random() * EGGS.length)];
              startClip(target, egg, 3800);
            } else {
              const pool = target.id === 'cat' ? DAILY_CAT : DAILY_CLAWD;
              const clip = pickDaily(pool);
              startClip(target, clip, CLIP_MS[clip] || 3600, { patrolDir: Math.random() < 0.5 ? -1 : 1 });
              if (clip === 'walk') {
                // 巡逻散步后原路折返并归位，避免长期偏离站位与伙伴重叠
                const walker = target;
                const backOk = () => !stageBusy() && !reducedMotion && !walker.seq && walker.y === 0;
                later(3700, () => {
                  if (!backOk()) return;
                  startClip(walker, 'walk', 3600, { patrolDir: -walker.patrolDir });
                });
                later(7400, () => {
                  if (backOk()) resetHomePositions(true);
                });
              }
            }
            renderAllFrames(now);
          }
        }
      }
      if (!doc || !doc.hidden) {
        theaterTimer = setTimeout(pickNextTheater, 4600 + Math.round(Math.random() * 2600));
      } else {
        theaterTimer = 0;
      }
    };
    const scheduleTheater = (delayMs) => {
      clearTimeout(theaterTimer);
      theaterTimer = 0;
      if (disposed || dozing || (doc && doc.hidden)) return;
      theaterTimer = setTimeout(pickNextTheater, delayMs ?? 4600 + Math.round(Math.random() * 2600));
    };
    scheduleTheater(3800);

    // ── 多层图腾塔吸附、抽底重力顺滑补位、剧烈动作侧跳下塔与迷你蟹弹道 ────────
    const trySnapOntoTower = (mover, now = performance.now()) => {
      if (!mover || mover.dragging) return false;
      const moverChain = getTowerMembers(mover.id);
      const maxDepth = maxTowerDepthAllowed();
      const moverCx = getEntWorldCx(mover);
      const moverFootY = mover.y || 0;
      const seenRoots = new Set(moverChain);

      for (const cand of allActiveEnts()) {
        const root = getTowerRoot(cand.id);
        if (!root || seenRoots.has(root.id)) continue;
        seenRoots.add(root.id);
        if (root.dragging || root.leap || (root.y || 0) < -4) continue;
        if (!isMiniEnt(root) && now < root.overrideUntil && ['onFire', 'siren', 'spinHop'].includes(root.overridePose)) {
          continue;
        }
        const baseChain = getTowerMembers(root.id);
        if (baseChain.length + moverChain.length > maxDepth) continue;
        const top = getEnt(baseChain[baseChain.length - 1]);
        if (!top || top.dragging || top.leap || (top.y || 0) < -2 && !top.stackedOn) continue;

        const perchY = computeWorldFootY(top) - mountStepH(top.id);
        const dx = Math.abs(moverCx - getEntWorldCx(top));
        if (dx <= 28 && moverFootY >= perchY - 24 && moverFootY <= perchY + 20) {
          mover.stackedOn = top.id;
          mover.y = 0;
          mover.vx = 0;
          mover.vy = 0;
          mover.perchUntil = 0;
          if (!isMiniEnt(mover)) {
            mover.rot = 0;
            mover.overridePose = 'happy';
            mover.overrideUntil = now + 950;
            mover.sym = 'heart';
            mover.symUntil = now + 1100;
            playSeq(mover, [['happy', 1, 2, -1]]);
          }
          syncAllStackedFollowers();
          renderAllFrames(now);
          return true;
        }
      }
      return false;
    };

    const startGravitySettle = (subRoot, targetHolderId) => {
      if (!subRoot) return;
      const subLen = getTowerMembers(subRoot.id).length;
      if (reducedMotion) {
        subRoot.flying += 1;
        const holder = targetHolderId ? getEnt(targetHolderId) : null;
        if (holder && !holder.dragging && getTowerMembers(holder.id).length + subLen <= maxTowerDepthAllowed()) {
          subRoot.stackedOn = holder.id;
          subRoot.y = 0;
          syncAllStackedFollowers();
        } else {
          subRoot.stackedOn = null;
          subRoot.y = 0;
          enforceGroundSeparation();
        }
        subRoot.vx = 0;
        subRoot.vy = 0;
        renderAllFrames(performance.now());
        return;
      }

      const settleId = (subRoot.flying += 1);
      let vy = 0.65;
      let prev = performance.now();
      const step = (now) => {
        if (disposed || settleId !== subRoot.flying || subRoot.dragging) return;
        const k = Math.max(0.5, Math.min(2.5, (now - prev) / 16.6667));
        prev = now;

        let holder = targetHolderId ? getEnt(targetHolderId) : null;
        if (
          holder &&
          (holder.dragging ||
            getTowerMembers(holder.id).includes(subRoot.id) ||
            getTowerMembers(holder.id).length + subLen > maxTowerDepthAllowed())
        ) {
          holder = null;
        }
        const goalY = holder ? computeWorldFootY(holder) - mountStepH(holder.id) : 0;
        if (holder) {
          const curCx = getEntWorldCx(subRoot);
          const dstCx = getEntWorldCx(holder);
          setEntWorldCx(subRoot, curCx + (dstCx - curCx) * Math.min(1, 0.35 * k));
        }

        vy = Math.min(14, vy + 0.54 * k);
        subRoot.y += vy * k;
        subRoot.vy = vy;

        if (subRoot.y >= goalY) {
          subRoot.vx = 0;
          subRoot.vy = 0;
          if (holder) {
            subRoot.stackedOn = holder.id;
            subRoot.y = 0;
            if (!isMiniEnt(subRoot)) {
              subRoot.rot = 0;
              playSeq(subRoot, [['idle', 1, 2, -1]]);
            }
            syncAllStackedFollowers();
          } else {
            subRoot.stackedOn = null;
            subRoot.y = 0;
            if (!isMiniEnt(subRoot)) {
              subRoot.rot = 0;
              playSeq(subRoot, landingSteps(1));
            }
            enforceGroundSeparation();
          }
          renderAllFrames(now);
          return;
        }

        syncAllStackedFollowers();
        renderAllFrames(now);
        rAF(step);
      };
      rAF(step);
    };

    const detachWithGravitySettle = (pulledId) => {
      const pulled = getEnt(pulledId);
      if (!pulled) return;
      const lowerHolderId = pulled.stackedOn || null;
      const upperRider = findDirectRider(pulledId);
      let riderStartFootY = 0;
      let riderStartCx = 0;
      if (upperRider) {
        riderStartFootY = computeWorldFootY(upperRider);
        riderStartCx = getEntWorldCx(upperRider);
        upperRider.stackedOn = null;
        upperRider.perchUntil = 0;
        setEntWorldCx(upperRider, riderStartCx);
        upperRider.y = riderStartFootY;
      }
      pulled.stackedOn = null;
      pulled.perchUntil = 0;
      if (upperRider) {
        startGravitySettle(upperRider, lowerHolderId);
      }
    };

    const startMiniBallistic = (mc, vx0, vy0, mopts = {}) => {
      if (!mc) return;
      mc.act = null;
      mc.leap = null;
      if (reducedMotion) {
        mc.flying += 1;
        mc.y = 0;
        mc.vx = 0;
        mc.vy = 0;
        if (mopts.noSnap || !trySnapOntoTower(mc, performance.now())) {
          enforceGroundSeparation();
          renderAllFrames(performance.now());
        }
        return;
      }
      const flightId = (mc.flying += 1);
      let vx = Math.max(-14, Math.min(14, vx0));
      let vy = Math.max(-14, Math.min(14, vy0));
      let bounces = 0;
      let prev = performance.now();

      const step = (now) => {
        if (disposed || flightId !== mc.flying || mc.dragging) return;
        const k = Math.max(0.5, Math.min(2.5, (now - prev) / 16.6667));
        prev = now;
        vy += 0.46 * k;
        vx *= Math.pow(0.985, k);
        vy *= Math.pow(0.985, k);

        const { minX, maxX } = stageBoundsX();
        const hw = entHalfW(mc);
        let cx = getEntWorldCx(mc) + vx * k;
        if (cx < minX + hw) {
          cx = minX + hw;
          vx = -0.45 * vx;
        } else if (cx > maxX - hw) {
          cx = maxX - hw;
          vx = -0.45 * vx;
        }
        setEntWorldCx(mc, cx);
        mc.y = Math.max(-180, (mc.y || 0) + vy * k);
        mc.vx = vx;
        mc.vy = vy;

        if (!mopts.noSnap && vy >= 0 && trySnapOntoTower(mc, now)) {
          return;
        }

        if (mc.y >= 0) {
          mc.y = 0;
          if (Math.abs(vy) > 2.6 && bounces < 1) {
            vy = -vy * 0.32;
            vx *= 0.78;
            bounces += 1;
          } else {
            mc.vx = 0;
            mc.vy = 0;
            enforceGroundSeparation();
            renderAllFrames(now);
            return;
          }
        }
        syncAllStackedFollowers();
        renderAllFrames(now);
        rAF(step);
      };
      rAF(step);
    };

    const dismountRidersSideHop = (baseId) => {
      const chain = getTowerMembers(baseId);
      const idx = chain.indexOf(baseId);
      if (idx < 0 || idx >= chain.length - 1) return false;
      const riders = chain
        .slice(idx + 1)
        .map((id) => getEnt(id))
        .filter(Boolean);
      const snapshots = riders.map((r) => ({
        r,
        footY: computeWorldFootY(r),
        cx: getEntWorldCx(r),
      }));
      for (const s of snapshots) {
        s.r.stackedOn = null;
        s.r.perchUntil = 0;
        s.r.y = s.footY;
        setEntWorldCx(s.r, s.cx);
      }
      snapshots.forEach((s, i) => {
        const dir = i % 2 === 0 ? -1 : 1;
        if (reducedMotion) {
          setEntWorldCx(s.r, s.cx + dir * (28 + i * 18));
          s.r.y = 0;
        } else if (isMiniEnt(s.r)) {
          startMiniBallistic(s.r, dir * (2.6 + i * 0.6), -3.5 - i * 0.4, { noSnap: true });
        } else {
          startBallistic(s.r, dir * (2.8 + i * 0.6), -3.8 - i * 0.4, { noSnap: true });
        }
      });
      if (reducedMotion) {
        enforceGroundSeparation();
        renderAllFrames(performance.now());
      }
      return true;
    };

    const triggerObstacleEncounter = (moverId, obstacleId, forcedAction = null) => {
      const mover = getEnt(moverId);
      const obs = getEnt(obstacleId);
      if (!mover || !obs || mover.id === obs.id) return null;
      const now = performance.now();
      const obsRoot = getTowerRoot(obs.id) || obs;
      if (obsRoot.id === mover.id) return null;

      const moverCx = getEntWorldCx(mover);
      const obsCx = getEntWorldCx(obsRoot);
      const dir = moverCx <= obsCx ? 1 : -1;
      const landCx = obsCx + dir * (entHalfW(obsRoot) + entHalfW(mover) + 12);
      const { minX, maxX } = stageBoundsX();
      const mHw = entHalfW(mover);
      const canLeap = landCx >= minX + mHw + 2 && landCx <= maxX - mHw - 2;
      const obsTowerLen = getTowerMembers(obsRoot.id).length;
      const moverTowerLen = getTowerMembers(mover.id).length;
      const canPerch = moverTowerLen === 1 && obsTowerLen < maxTowerDepthAllowed();

      let action = forcedAction || chooseObstacleAction({ canLeap, canPerch });
      if (action === 'autoPerch' && !canPerch) action = canLeap ? 'leapfrog' : 'greetTurn';
      if (action === 'leapfrog' && !canLeap) action = canPerch ? 'autoPerch' : 'greetTurn';

      if (action === 'leapfrog') {
        const peak = Math.min(62, 26 + Math.max(0, obsTowerLen - 1) * 14);
        if (isMiniEnt(mover)) mover.act = null;
        if (reducedMotion) {
          setEntWorldCx(mover, landCx);
          mover.y = 0;
          enforceGroundSeparation();
        } else {
          mover.leap = {
            cx0: moverCx,
            cx1: landCx,
            peak,
            startTick: tickIdx,
            ticks: 6,
            landOnto: null,
          };
          if (!isMiniEnt(mover)) {
            mover.faceDir = dir > 0 ? 'right' : 'left';
            mover.sym = 'spark';
            mover.symUntil = now + 750;
          }
        }
      } else if (action === 'autoPerch') {
        const top = getStackTop(obsRoot.id);
        if (isMiniEnt(mover)) mover.act = null;
        if (reducedMotion) {
          mover.stackedOn = top.id;
          mover.y = 0;
          mover.perchUntil = now + 7200;
          syncAllStackedFollowers();
        } else {
          const peak = Math.max(26, Math.abs(computeWorldFootY(top) - mountStepH(top.id)) + 10);
          mover.leap = {
            cx0: moverCx,
            cx1: getEntWorldCx(top),
            peak,
            startTick: tickIdx,
            ticks: 5,
            landOnto: top.id,
          };
          if (!isMiniEnt(obsRoot) && !obsRoot.dragging && !obsRoot.stackedOn) {
            startClip(obsRoot, 'walk', 2800, { patrolDir: dir });
          }
        }
      } else {
        action = 'greetTurn';
        if (isMiniEnt(mover)) {
          mover.act = null;
          mover.bumpUntilTick = tickIdx + 6;
          mover.blinkAt = tickIdx;
          mover.dir = -dir;
          setEntWorldCx(mover, moverCx - dir * 4);
        } else {
          mover.nextBlinkTick = tickIdx;
          mover.patrolDir = -dir;
          startClip(mover, mover.id === 'clawd' ? 'wave' : 'tilt', 560, {
            face: dir > 0 ? 'right' : 'left',
            sym: 'note',
            rot: mover.id === 'cat' ? -8 : 0,
          });
          later(520, () => {
            if (!disposed && !stageBusy() && !reducedMotion && !dozing && !mover.dragging && !mover.stackedOn) {
              startClip(mover, 'walk', 2000, { patrolDir: -dir });
            }
          });
        }
        if (isMiniEnt(obsRoot)) {
          obsRoot.bumpUntilTick = tickIdx + 5;
          obsRoot.blinkAt = tickIdx;
        } else {
          obsRoot.nextBlinkTick = tickIdx;
          obsRoot.nodY = PX;
          obsRoot.nodUntil = now + 180;
        }
      }

      recordInteraction(action, `${mover.id}->${obsRoot.id}`, now);
      renderAllFrames(now);
      return action;
    };

    const startBallistic = (actor, vx0, vy0, bopts = {}) => {
      if (Math.hypot(vx0, vy0) > 2.2) {
        dismountRidersSideHop(actor.id);
      }
      if (reducedMotion) {
        // 减少动态：不做抛物线与弹跳，若在塔顶上方则吸附叠塔，否则静止落回地面并防重叠
        actor.flying += 1;
        actor.seq = null;
        actor.vx = 0;
        actor.vy = 0;
        actor.rot = 0;
        if (actor.overridePose === 'dangle') actor.overridePose = null;
        if (typeof bopts.reboundTargetX === 'number' && Number.isFinite(bopts.reboundTargetX)) {
          actor.x = clampActorX(bopts.reboundTargetX);
        }
        if (bopts.noSnap || !trySnapOntoTower(actor, performance.now())) {
          actor.y = 0;
          enforceGroundSeparation();
          applyActorTransform(actor);
          renderAllFrames(performance.now());
        }
        return;
      }
      if (bopts.anticipate && actor.y === 0 && !actor.stackedOn) {
        // 起跳前 1 拍下蹲预备（整数格压扁加宽）
        const prepId = (actor.flying += 1);
        playSeq(actor, [['squash', 2, 2, -1]]);
        later(TICK * 2, () => {
          if (actor.flying === prepId && !actor.dragging) launch(actor, vx0, vy0, bopts);
        });
        return;
      }
      launch(actor, vx0, vy0, bopts);
    };

    const launch = (actor, vx0, vy0, bopts = {}) => {
      const flightId = (actor.flying += 1);
      const hasReboundTarget = typeof bopts.reboundTargetX === 'number' && Number.isFinite(bopts.reboundTargetX);
      const maxVx = hasReboundTarget ? 64 : 18;
      let vx = Math.max(-maxVx, Math.min(maxVx, vx0));
      let vy = Math.max(-18, Math.min(18, vy0));
      let bounces = 0;
      let scattered = false;
      actor.reboundNoBump = Boolean(bopts.reboundNoBump);
      actor.leap = null;
      actor.seq = null;
      actor.overridePose = 'dangle';
      actor.overrideUntil = performance.now() + 3000;

      let prev = performance.now();
      const step = (now) => {
        if (disposed || flightId !== actor.flying || actor.dragging) return;
        if (doc && doc.hidden) {
          if (hasReboundTarget) {
            actor.x = Math.max(8, Math.min(maxXFor(readStageWidth()), bopts.reboundTargetX));
          }
          actor.reboundNoBump = false;
          actor.y = 0;
          actor.vx = 0;
          actor.vy = 0;
          actor.rot = 0;
          actor.overridePose = null;
          actor.overrideRot = 0;
          enforceGroundSeparation();
          applyActorTransform(actor);
          return;
        }
        const k = Math.max(0.5, Math.min(2.5, (now - prev) / 16.6667));
        prev = now;
        vy += 0.44 * k;
        vx *= Math.pow(0.988, k);
        vy *= Math.pow(0.988, k);
        actor.x += vx * k;
        actor.y += vy * k;

        const w = readStageWidth();
        const minX = 8;
        const maxX = maxXFor(w);
        if (hasReboundTarget) {
          const targetX = Math.max(minX, Math.min(maxX, bopts.reboundTargetX));
          if ((vx >= 0 && actor.x > targetX) || (vx < 0 && actor.x < targetX)) {
            actor.x = targetX;
            vx = 0;
          }
        }
        if (actor.x < minX) {
          actor.x = minX;
          vx = -0.45 * vx;
        } else if (actor.x > maxX) {
          actor.x = maxX;
          vx = -0.45 * vx;
        }
        if (actor.y < -180) {
          actor.y = -180;
          vy = -0.45 * vy;
        }

        // 支持 2~5 层通用图腾塔下落吸附
        if (!bopts.noSnap && vy >= 0 && trySnapOntoTower(actor, now)) {
          return;
        }

        // 场景 1 · 抛掷横向弹道撞击（不破坏上方叠叠乐，同层横撞则互弹 + 冲量传递）
        const other = actor.id === 'cat' ? actors.clawd : actors.cat;
        if (
          !bopts.reboundNoBump &&
          !other.reboundNoBump &&
          !other.dragging &&
          !other.stackedOn &&
          !actor.stackedOn &&
          Math.abs(actor.x - other.x) < 42 &&
          Math.abs(actor.y - other.y) < 22 &&
          ((actor.x < other.x && vx > 0.35) || (actor.x >= other.x && vx < -0.35)) &&
          canTriggerPair('ballistic', now, 650)
        ) {
          const sign = actor.x < other.x ? -1 : 1;
          actor.x = clampActorX(other.x + sign * 42);
          const incomingVx = vx;
          vx = -incomingVx * 0.46;
          if (Math.abs(vx) < 1.6) vx = sign * 1.8;
          actor.sym = 'sweat';
          actor.symUntil = now + 750;
          const knockVx = Math.max(-7.2, Math.min(7.2, incomingVx * 0.62 || -sign * 2.6));
          startClip(other, 'wow', 800, { sym: 'bang', face: sign < 0 ? 'left' : 'right' });
          startBallistic(other, knockVx, -2.7);
          recordInteraction('ballisticBump', `${actor.id}->${other.id}`, now);
          renderAllFrames(now);
        }

        if (actor.y >= 0) {
          actor.y = 0;
          // 首次触地砸在迷你蟹附近：蟹四散后归位
          if (!scattered) {
            scattered = true;
            scatterCrabsNear(actor.x + 48);
          }
          if (Math.abs(vy) > 2.4 && bounces < 2) {
            vy = -vy * 0.36;
            vx *= 0.82;
            bounces += 1;
            // 中途弹跳：1 拍整格压扁触地，随后继续腾空
            playSeq(actor, [['flat', 1, 2, 0]]);
          } else {
            const impact = Math.abs(vy);
            if (hasReboundTarget) {
              actor.x = Math.max(minX, Math.min(maxX, bopts.reboundTargetX));
            }
            actor.reboundNoBump = false;
            actor.vx = 0;
            actor.vy = 0;
            actor.rot = 0;
            actor.overridePose = null;
            actor.overrideRot = 0;
            const steps = landingSteps(impact > 1.2 || bounces > 0 ? 2 : 1);
            playSeq(actor, steps);
            if (actor.throws >= 3) {
              actor.throws = 0;
              startClip(actor, 'angry', 1400 + seqTotalMs(steps), { sym: 'vein' });
            }
            enforceGroundSeparation();
            applyActorTransform(actor);
            renderAllFrames(now);
            return;
          }
        }
        actor.rot = Math.max(-14, Math.min(14, -vx * 0.65));
        actor.vx = vx;
        actor.vy = vy;
        syncAllStackedFollowers();
        applyActorTransform(actor);
        rAF(step);
      };
      rAF(step);
    };

    const dragReleaseHooks = [];
    let dragRafPending = false;
    let dragRafId = 0;
    const cAF =
      (win && typeof win.cancelAnimationFrame === 'function' && win.cancelAnimationFrame.bind(win)) ||
      (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null);
    const scheduleDragRender = () => {
      if (dragRafPending || disposed) return;
      dragRafPending = true;
      dragRafId = rAF((frameNow) => {
        dragRafId = 0;
        dragRafPending = false;
        if (!disposed) renderAllFrames(frameNow);
      });
    };

    const bindActorEvents = (actor) => {
      let downX = 0;
      let downY = 0;
      let startX = 0;
      let startY = 0;
      let cachedStageW = 720;
      let lastMoveX = 0;
      let lastMoveY = 0;
      let lastMoveT = 0;
      let moved = false;
      let petTimer = 0;
      let petTriggered = false;

      const onDown = (evt) => {
        if (evt.button !== 0) return;
        evt.preventDefault();
        evt.stopPropagation();
        cachedStageW = hostEl.clientWidth || 720;
        try {
          actor.el.setPointerCapture?.(evt.pointerId);
        } catch (_) {}
        const downNow = performance.now();
        if (actor.glideUntil && downNow < actor.glideUntil) {
          actor.glideSeq = (actor.glideSeq || 0) + 1;
          actor.glideUntil = 0;
          try {
            const er = actor.el?.getBoundingClientRect?.();
            const hr = hostEl?.getBoundingClientRect?.();
            const hasRect =
              er &&
              hr &&
              Number.isFinite(er.left) &&
              Number.isFinite(hr.left) &&
              ((Number.isFinite(er.width) && er.width > 0) || (Number.isFinite(er.right) && er.right > er.left));
            if (hasRect) {
              actor.x = clampActorX(er.left - hr.left);
            }
          } catch (_) {}
          for (const cid of getTowerMembers(actor.id)) {
            const ent = getEnt(cid);
            if (!ent) continue;
            ent.glideSeq = (ent.glideSeq || 0) + 1;
            ent.glideUntil = 0;
            if (ent.el?.style) ent.el.style.transition = '';
          }
          syncTower(actor);
        }
        actor.reboundNoBump = false;
        downX = evt.clientX;
        downY = evt.clientY;
        startX = actor.x;
        startY = actor.stackedOn ? computeWorldFootY(actor) : actor.y;
        lastMoveX = evt.clientX;
        lastMoveY = evt.clientY;
        lastMoveT = downNow;
        moved = false;
        petTriggered = false;
        markActivity();
        actor.flying += 1;
        actor.leap = null;
        actor.seq = null;
        actor.seqThen = null;
        actor.vx = 0;
        actor.vy = 0;
        actor.overrideRot = 0;
        actor.mirror = false;

        clearTimeout(petTimer);
        petTimer = setTimeout(() => {
          if (!moved && !disposed) {
            petTriggered = true;
            startClip(actor, 'pet', 1100, { sym: 'heart' });
            renderAllFrames(performance.now());
          }
        }, 360);
      };

      const onMove = (evt) => {
        if (lastMoveT === 0) return;
        const dxTotal = evt.clientX - downX;
        const dyTotal = evt.clientY - downY;
        let justStartedDrag = false;
        if (!moved && Math.hypot(dxTotal, dyTotal) > 7) {
          moved = true;
          justStartedDrag = true;
          clearTimeout(petTimer);
          detachWithGravitySettle(actor.id);
          actor.sideEdgeSnap = false;
          actor.sidePushOriginX = null;
          actor.sideEdgeDirectUntil = 0;
          actor.dragging = true;
          syncDirectMotionDomAttr(actor, actor.el);
        }
        if (!moved) return;
        evt.stopPropagation?.();
        const now = performance.now();
        const dt = Math.max(4, now - lastMoveT);
        const instVx = ((evt.clientX - lastMoveX) / dt) * 16;
        const instVy = ((evt.clientY - lastMoveY) / dt) * 16;
        actor.vx = actor.vx * 0.4 + instVx * 0.6;
        actor.vy = actor.vy * 0.4 + instVy * 0.6;
        actor.rot = Math.max(-14, Math.min(14, -actor.vx * 0.7));
        lastMoveX = evt.clientX;
        lastMoveY = evt.clientY;
        lastMoveT = now;

        const rightReserve = popoverRightWidth > 0 ? Math.min(cachedStageW - 150, popoverRightWidth + 16) : 0;
        const maxDragX = Math.max(24, cachedStageW - 88 - rightReserve);
        actor.x = Math.max(4, Math.min(maxDragX, startX + dxTotal));
        actor.y = Math.max(-180, Math.min(0, startY + dyTotal));
        // 0ms 直通 GPU 合成层更新亚像素坐标，不等待全舞台重绘
        applyActorTransform(actor);
        if (justStartedDrag) {
          renderAllFrames(now);
        } else {
          scheduleDragRender();
        }

        // 场景 2 · 鼠标拖拽地面擦撞、慢速经过与惊扰迷你蟹
        if (!reducedMotion && actor.dragging && actor.y > -22) {
          const other = actor.id === 'cat' ? actors.clawd : actors.cat;
          if (!other.dragging && !other.stackedOn && other.y === 0 && Math.abs(actor.x - other.x) < 38) {
            if (Math.abs(actor.vx) >= 2.0 && canTriggerPair('dragBump', now, 750)) {
              const pushDir = actor.vx >= 0 ? 1 : -1;
              startClip(other, 'wow', 750, { sym: 'bang', face: pushDir > 0 ? 'left' : 'right' });
              startBallistic(other, pushDir * Math.min(5.2, Math.abs(actor.vx) * 0.58), -2.5);
              recordInteraction('dragBump', `${actor.id}->${other.id}`, now);
              scheduleDragRender();
            } else if (Math.abs(actor.vx) < 2.0 && canTriggerPair('dragPass', now, 1400)) {
              gaze(other, actor.x < other.x ? 'left' : 'right', 750, false, 'note');
              hop(other, 'wave');
              recordInteraction('dragPass', `${actor.id}->${other.id}`, now);
              scheduleDragRender();
            }
          }
          if (miniPileEnabled && actor.y > -16 && Math.abs(actor.vx) > 1.4 && canTriggerPair('dragCrab', now, 800)) {
            const nearCrab = miniCrabs.some((mc) => !mc.act && !mc.stackedOn && Math.abs(crabHostCenter(mc) - (actor.x + 48)) < 32);
            if (nearCrab) {
              scatterCrabsNear(actor.x + 48);
              recordInteraction('crabScatter', actor.id, now);
              scheduleDragRender();
            }
          }
        }
      };

      const onUp = (evt) => {
        if (lastMoveT === 0) return;
        clearTimeout(petTimer);
        actor.el.releasePointerCapture?.(evt.pointerId);
        const prevMoveT = lastMoveT;
        lastMoveT = 0;

        if (moved) {
          actor.dragging = false;
          const pNow = performance.now();
          if (pNow - prevMoveT > 35) {
            actor.vx = 0;
            actor.vy = 0;
          }
          if (Math.hypot(actor.vx, actor.vy) < 4.5 && trySnapOntoTower(actor, pNow)) {
            syncDirectMotionDomAttr(actor, actor.el);
            moved = false;
            return;
          }
          const now = Date.now();
          if (now - actor.lastThrowAt > 8000) actor.throws = 0;
          actor.throws += 1;
          actor.lastThrowAt = now;
          startBallistic(actor, actor.vx * 0.85, actor.vy * 0.85);
          moved = false;
          return;
        }

        if (petTriggered) return;
        triggerPoke(actor, true);
      };

      const cancelDragOnBlur = () => {
        if (lastMoveT === 0 && !actor.dragging) return;
        clearTimeout(petTimer);
        lastMoveT = 0;
        if (moved || actor.dragging) {
          moved = false;
          actor.dragging = false;
          actor.vx = 0;
          actor.vy = 0;
          syncDirectMotionDomAttr(actor, actor.el);
          if (!disposed) startBallistic(actor, 0, 0, { noSnap: true });
        }
      };
      dragReleaseHooks.push(cancelDragOnBlur);

      actor.el.addEventListener('pointerdown', onDown);
      actor.el.addEventListener('pointermove', onMove);
      actor.el.addEventListener('pointerup', onUp);
      actor.el.addEventListener('pointercancel', onUp);
      cleanups.push(() => {
        clearTimeout(petTimer);
        actor.el.removeEventListener('pointerdown', onDown);
        actor.el.removeEventListener('pointermove', onMove);
        actor.el.removeEventListener('pointerup', onUp);
        actor.el.removeEventListener('pointercancel', onUp);
      });
    };

    const bindMiniCrabEvents = (mc) => {
      let downX = 0;
      let downY = 0;
      let startCx = 0;
      let startY = 0;
      let cachedMinCx = 27;
      let cachedMaxCx = 680;
      let lastMoveX = 0;
      let lastMoveY = 0;
      let lastMoveT = 0;
      let moved = false;

      const onDown = (evt) => {
        if (evt.button !== 0 || !miniPileEnabled) return;
        evt.preventDefault();
        evt.stopPropagation();
        const { minX, maxX } = stageBoundsX();
        const hw = entHalfW(mc);
        cachedMinCx = minX + hw;
        cachedMaxCx = maxX - hw;
        try {
          mc.el.setPointerCapture?.(evt.pointerId);
        } catch (_) {}
        const downNow = performance.now();
        if (mc.glideUntil && downNow < mc.glideUntil) {
          mc.glideSeq = (mc.glideSeq || 0) + 1;
          mc.glideUntil = 0;
          try {
            const er = mc.el?.getBoundingClientRect?.();
            const hr = hostEl?.getBoundingClientRect?.();
            const hasRect =
              er &&
              hr &&
              Number.isFinite(er.left) &&
              Number.isFinite(hr.left) &&
              ((Number.isFinite(er.width) && er.width > 0) || (Number.isFinite(er.right) && er.right > er.left));
            if (hasRect) {
              setEntWorldCx(mc, er.left - hr.left + 20);
            }
          } catch (_) {}
          if (mc.el?.style) mc.el.style.transition = '';
        }
        downX = evt.clientX;
        downY = evt.clientY;
        startCx = getEntWorldCx(mc);
        startY = mc.stackedOn ? computeWorldFootY(mc) : mc.y || 0;
        lastMoveX = evt.clientX;
        lastMoveY = evt.clientY;
        lastMoveT = downNow;
        moved = false;
        markActivity();
        mc.flying += 1;
        mc.leap = null;
        mc.act = null;
        mc.vx = 0;
        mc.vy = 0;
      };

      const onMove = (evt) => {
        if (lastMoveT === 0) return;
        const dxTotal = evt.clientX - downX;
        const dyTotal = evt.clientY - downY;
        let justStartedDrag = false;
        if (!moved && Math.hypot(dxTotal, dyTotal) > 2.5) {
          moved = true;
          justStartedDrag = true;
          detachWithGravitySettle(mc.id);
          mc.dragging = true;
          syncDirectMotionDomAttr(mc, mc.canvas);
        }
        if (!moved) return;
        evt.stopPropagation?.();
        const now = performance.now();
        const dt = Math.max(4, now - lastMoveT);
        const instVx = ((evt.clientX - lastMoveX) / dt) * 16;
        const instVy = ((evt.clientY - lastMoveY) / dt) * 16;
        mc.vx = mc.vx * 0.4 + instVx * 0.6;
        mc.vy = mc.vy * 0.4 + instVy * 0.6;
        lastMoveX = evt.clientX;
        lastMoveY = evt.clientY;
        lastMoveT = now;

        // 零 DOM 读取，0ms 直推亚像素浮点 transform 至 GPU 合成层
        const clampedCx = Math.max(cachedMinCx, Math.min(cachedMaxCx, startCx + dxTotal));
        const nextPx = Math.max(2, clampedCx - 32);
        const nextY = Math.max(-180, Math.min(0, startY + dyTotal));
        mc.px = nextPx;
        mc.lastX = Math.round(nextPx);
        mc.y = nextY;

        const tx = snapCoord(nextPx, true);
        const ty = snapCoord(nextY, true);
        if (mc.lastDomX !== tx || mc.lastDomY !== ty) {
          mc.lastDomX = tx;
          mc.lastDomY = ty;
          mc.canvas.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
        }
        if (mc.lastDomZ !== '39') {
          mc.lastDomZ = '39';
          mc.canvas.style.zIndex = '39';
        }

        if (justStartedDrag) {
          renderAllFrames(now);
        } else {
          scheduleDragRender();
        }
      };

      const onUp = (evt) => {
        if (lastMoveT === 0) return;
        mc.el.releasePointerCapture?.(evt.pointerId);
        const prevMoveT = lastMoveT;
        lastMoveT = 0;
        if (moved) {
          mc.dragging = false;
          const now = performance.now();
          if (now - prevMoveT > 35) {
            mc.vx = 0;
            mc.vy = 0;
          }
          if (Math.hypot(mc.vx, mc.vy) < 4.5 && trySnapOntoTower(mc, now)) {
            syncDirectMotionDomAttr(mc, mc.canvas);
            moved = false;
            return;
          }
          startMiniBallistic(mc, mc.vx * 0.78, mc.vy * 0.78);
          moved = false;
          return;
        }
        // 轻点迷你蟹：触发专属特技小跳
        mc.bumpUntilTick = tickIdx + 6;
        mc.passHopUntilTick = tickIdx + 4;
        renderAllFrames(performance.now());
      };

      const cancelMiniDragOnBlur = () => {
        if (lastMoveT === 0 && !mc.dragging) return;
        lastMoveT = 0;
        if (moved || mc.dragging) {
          moved = false;
          mc.dragging = false;
          mc.vx = 0;
          mc.vy = 0;
          syncDirectMotionDomAttr(mc, mc.canvas);
          if (!disposed) startMiniBallistic(mc, 0, 0, { noSnap: true });
        }
      };
      dragReleaseHooks.push(cancelMiniDragOnBlur);

      mc.el.addEventListener('pointerdown', onDown);
      mc.el.addEventListener('pointermove', onMove);
      mc.el.addEventListener('pointerup', onUp);
      mc.el.addEventListener('pointercancel', onUp);
      cleanups.push(() => {
        mc.el.removeEventListener('pointerdown', onDown);
        mc.el.removeEventListener('pointermove', onMove);
        mc.el.removeEventListener('pointerup', onUp);
        mc.el.removeEventListener('pointercancel', onUp);
      });
    };

    bindActorEvents(actors.cat);
    bindActorEvents(actors.clawd);
    miniCrabs.forEach(bindMiniCrabEvents);

    const onWindowBlur = () => {
      if (disposed) return;
      for (let i = 0; i < dragReleaseHooks.length; i++) dragReleaseHooks[i]();
    };
    if (win && typeof win.addEventListener === 'function') {
      win.addEventListener('blur', onWindowBlur);
      cleanups.push(() => {
        if (typeof win.removeEventListener === 'function') win.removeEventListener('blur', onWindowBlur);
      });
    }

    // ── 生态联动：活动唤醒 / 打盹 / 领衔交接 / 外部事件 notify ───────────────
    const leaderActor = () => (camp === 'claude' ? actors.clawd : actors.cat);
    const partnerActor = () => (camp === 'claude' ? actors.cat : actors.clawd);
    const faceToward = (from, to) => (to.x >= from.x ? 'right' : 'left');

    const isDocHidden = () => Boolean(doc && (doc.hidden || doc.documentElement?.getAttribute?.('data-ag-cs-win-blur') === '1'));
    const hasDozeTransition = (now) =>
      (actors.cat.overridePose && now < actors.cat.overrideUntil) ||
      (actors.clawd.overridePose && now < actors.clawd.overrideUntil);

    const onHeartbeat = () => {
      if (disposed) return;
      if (isDocHidden()) {
        syncHeartbeat();
        return;
      }
      tickIdx += 1;
      const now = performance.now();
      updateBalance();
      ecoTick(now);
      renderAllFrames(now);
      syncHeartbeat(now);
    };

    function syncHeartbeat(now = performance.now()) {
      let targetMs = TICK;
      if (disposed || isDocHidden() || (reducedMotion && !stageBusy())) {
        targetMs = 0;
      } else if (dozing && !stageBusy() && !hasDozeTransition(now)) {
        targetMs = DOZE_TICK;
      }
      if (targetMs === 0 || dozing || reducedMotion) {
        clearTimeout(theaterTimer);
        theaterTimer = 0;
      } else if (!theaterTimer) {
        scheduleTheater();
      }
      if (targetMs === currentTickMs) return;
      if (tickTimer !== null) {
        clearInterval(tickTimer);
        tickTimer = null;
      }
      currentTickMs = targetMs;
      if (targetMs > 0) {
        tickTimer = setInterval(onHeartbeat, targetMs);
        if (tickTimer && typeof tickTimer.unref === 'function') tickTimer.unref();
      }
    }

    function wakeUp() {
      if (!dozing) return;
      dozing = false;
      lastActivityAt = performance.now();
      syncHeartbeat();
      // 伸懒腰醒来（复用 stretch 姿态，小紫猫错峰 2 拍）
      startClip(actors.clawd, 'stretch', 1100);
      later(TICK * 2, () => {
        if (!dozing) startClip(actors.cat, 'stretch', 1100);
      });
      renderAllFrames(performance.now());
    }

    function markActivity() {
      lastActivityAt = performance.now();
      if (dozing) wakeUp();
      else syncHeartbeat();
    }

    // 进入打盹：先打哈欠（小紫猫先、Clawd 错峰 0.4s），哈欠结束后由 resolvePoseFor 接管为 sleep 并拉宽至 400ms
    function startDoze(skipYawn) {
      if (dozing) return;
      dozing = true;
      for (const id of ['cat', 'clawd']) {
        const a = actors[id];
        if (a.overridePose && a.overridePose !== 'dangle') a.overrideUntil = 0;
        a.eyeScan = 0;
      }
      if (!skipYawn) {
        startClip(actors.cat, 'yawn', 1200);
        later(400, () => {
          if (dozing) startClip(actors.clawd, 'yawn', 1200);
        });
      }
      const now = performance.now();
      renderAllFrames(now);
      syncHeartbeat(now);
    }

    // 每拍生态检查：忙碌视为活动；空闲超时则打盹；检测自主散步遇障（撑跳越过 / 搭便车 / 礼貌转身）与双宠碰撞
    const ecoTick = (now) => {
      if (stageBusy()) {
        lastActivityAt = now;
        if (dozing) wakeUp();
        return;
      }
      const limit = isLateNight() ? DOZE_AFTER_NIGHT_MS : DOZE_AFTER_MS;
      if (!dozing && now - lastActivityAt > limit) {
        startDoze(false);
        return;
      }
      if (reducedMotion || dozing || now < duetUntil) return;

      const clawd = actors.clawd;
      const cat = actors.cat;
      if (!clawd.dragging && !cat.dragging && !clawd.stackedOn && !cat.stackedOn && !clawd.leap && !cat.leap && clawd.y === 0 && cat.y === 0) {
        const cPose = resolvePoseFor(clawd, now);
        const kPose = resolvePoseFor(cat, now);
        const cWalking = cPose === 'walk' && now < clawd.overrideUntil;
        const kWalking = kPose === 'walk' && now < cat.overrideUntil;
        const enc = classifyPairEncounter({
          xA: clawd.x,
          yA: clawd.y,
          walkingA: cWalking,
          dirA: clawd.patrolDir,
          xB: cat.x,
          yB: cat.y,
          walkingB: kWalking,
          dirB: cat.patrolDir,
          contactDist: 46,
          verticalTol: 22,
        });
        if (enc && enc.kind === 'bump' && canTriggerPair('mainWalk', now, 1200)) {
          clawd.x = clampActorX(clawd.x - enc.sign * 5);
          cat.x = clampActorX(cat.x + enc.sign * 5);
          clawd.faceDir = enc.sign > 0 ? 'right' : 'left';
          cat.faceDir = enc.sign > 0 ? 'left' : 'right';
          clawd.sym = 'bang';
          clawd.symUntil = now + 850;
          cat.sym = 'spark';
          cat.symUntil = now + 850;
          clawd.overridePose = 'idle';
          clawd.overrideUntil = now + 440;
          cat.overridePose = 'idle';
          cat.overrideUntil = now + 440;
          playSeq(clawd, [
            ['squash', 1, 2, -1, 0],
            ['wow', 2, -1, 1, -2],
            ['idle', 1, 1, -1, 0],
          ]);
          playSeq(cat, [
            ['squash', 1, 2, -1, 0],
            ['tilt', 2, -1, 1, -2],
            ['idle', 1, 1, -1, 0],
          ]);
          later(420, () => {
            if (disposed || stageBusy() || reducedMotion || dozing) return;
            startClip(clawd, 'walk', 2200, { patrolDir: -enc.sign });
            startClip(cat, 'walk', 2200, { patrolDir: enc.sign });
          });
          recordInteraction('bump', 'clawd-cat', now);
          return;
        }
        if (enc && enc.kind === 'passBy' && canTriggerPair('mainPass', now, 1500)) {
          const walker = enc.mover === 'A' ? clawd : cat;
          const stationary = enc.mover === 'A' ? cat : clawd;
          triggerObstacleEncounter(walker.id, stationary.id);
          return;
        }
      }

      // 场景 4 · 5 宠散步遇障（主宠与自由迷你蟹相遇时触发撑跳越过 / 自动搭便车 / 驻足眨眼转身）
      if (miniPileEnabled) {
        for (const a of [clawd, cat]) {
          if (a.dragging || a.stackedOn || a.leap || a.y !== 0) continue;
          const aWalk = resolvePoseFor(a, now) === 'walk' && now < a.overrideUntil;
          for (const mc of miniCrabs) {
            if (mc.dragging || mc.stackedOn || mc.leap || mc.act || mc.y !== 0) continue;
            const d = getEntWorldCx(mc) - getEntWorldCx(a);
            if (Math.abs(d) < 40 && canTriggerPair(`obs:${a.id}:${mc.id}`, now, 1600)) {
              if (aWalk && d * a.patrolDir > 0) {
                triggerObstacleEncounter(a.id, mc.id);
                return;
              }
              if (d * mc.dir < 0) {
                triggerObstacleEncounter(mc.id, a.id);
                return;
              }
            }
          }
        }
      }
    };

    // 原地整格小跳（减少动态 / 拖拽 / 叠叠乐 / 腾空时跳过，直接回调）
    const hop = (a, airPose, then) => {
      const now = performance.now();
      const partnerOnTop = Boolean(findDirectRider(a.id));
      if (reducedMotion || !actorFree(a, now) || partnerOnTop) {
        if (then) then();
        return;
      }
      playSeq(a, hopSteps(airPose), then);
    };

    // 扫视：转身 + 竖瞳偏向；up=true 时抬头
    const gaze = (a, dir, ms, up = false, sym = null) => {
      const now = performance.now();
      if (a.dragging || (a.overridePose === 'dangle' && now < a.overrideUntil)) return;
      startClip(a, 'gaze', ms, { face: dir === 'left' ? 'left' : 'right', param: up ? 1 : 0, sym: sym || undefined });
    };

    // 领衔位交接：两宠下蹲小跳，腾空瞬间交换站位；落地后新领衔冒 spark、旧领衔点头，三蟹迎宾挥手
    const campHandoff = () => {
      const now = performance.now();
      if (now - lastHandoffAt < 700) return;
      lastHandoffAt = now;
      duetUntil = now + 1200;
      const leader = leaderActor();
      const old = partnerActor();
      const finish = () => {
        if (disposed) return;
        startClip(leader, 'happy', 900, { sym: 'spark' });
        startClip(old, 'lookNod', 1300, { face: faceToward(old, leader), param: 2 });
        crabsWave();
        renderAllFrames(performance.now());
      };
      if (reducedMotion) {
        resetHomePositions(false);
        finish();
        return;
      }
      let pending = 2;
      const done = () => {
        pending -= 1;
        if (pending === 0) finish();
      };
      hop(leader, 'jiggle', done);
      hop(old, 'jiggle', done);
      later(TICK * 2, () => resetHomePositions(false));
    };

    const celebrateDone = () => {
      const leader = leaderActor();
      const partner = partnerActor();
      const now = performance.now();
      leader.sym = 'heart';
      leader.symUntil = now + 1500;
      if (reducedMotion) {
        startClip(leader, 'happy', 900, { sym: 'heart' });
        startClip(partner, 'happy', 900);
        return;
      }
      hop(leader, 'jiggle');
      hop(partner, 'jiggle');
    };

    // 外部事件处理表（未知事件静默忽略）
    const NOTIFY = {
      activity() {},
      campSwitch() {
        // 与 setState 自动触发 700ms 内去重，避免主代理双路调用时重复交接
        campHandoff();
      },
      'model-shift'() {
        chromaGates.tuned = true;
        gaze(leaderActor(), 'left', 800, true, 'spark');
      },
      'vial-opened'() {
        chromaGates.tuned = true;
        gaze(actors.clawd, 'left', 820, false, 'spark');
        gaze(actors.cat, 'left', 820, false, 'spark');
      },
      'code-copied'() {
        chromaGates.forged = true;
        const leader = leaderActor();
        leader.nodY = PX;
        leader.nodUntil = performance.now() + 180;
        leader.sym = 'note';
        leader.symUntil = performance.now() + 850;
      },
      'files-changed'() {
        chromaGates.forged = true;
        startClip(leaderActor(), 'salute', 780, { sym: 'spark' });
      },
      complete() {
        chromaGates.forged = true;
        celebrateDone();
      },
      orchestrator(p) {
        orchestrator = Boolean(p.on);
        if (orchestrator) {
          gaze(actors.clawd, 'left', 900, true, 'spark');
          gaze(actors.cat, 'left', 900, true, 'spark');
        }
      },
      streamDone(p) {
        const leader = leaderActor();
        const partner = partnerActor();
        if (p.error) {
          startClip(leader, 'worry', 1500, { sym: 'sweat' });
          startClip(partner, 'worry', 1500, { sym: 'sweat' });
          return;
        }
        chromaGates.forged = true;
        celebrateDone();
      },
      ripple(p) {
        const x = Number(p.x);
        if (!Number.isFinite(x)) return;
        for (const a of [actors.clawd, actors.cat]) {
          const dir = x < a.x + 48 ? 'left' : 'right';
          gaze(a, dir, 700);
          if (a.kind === 'cat') {
            a.forceTwitchStart = tickIdx;
            a.forceTwitchSide = dir === 'left' ? 'L' : 'R';
          }
        }
      },
      send() {
        const leader = leaderActor();
        const partner = partnerActor();
        startClip(leader, 'salute', 900, { sym: 'spark' });
        startClip(partner, 'lookNod', 1200, { face: faceToward(partner, leader), param: 2 });
      },
    };
    const handleNotify = (event, payload) => {
      if (disposed) return;
      const fn = Object.prototype.hasOwnProperty.call(NOTIFY, event) ? NOTIFY[event] : null;
      if (!fn) return;
      const wasDozing = dozing;
      markActivity();
      if (event === 'activity') {
        if (wasDozing) renderAllFrames(performance.now());
        return;
      }
      fn(payload && typeof payload === 'object' ? payload : {});
      renderAllFrames(performance.now());
    };

    // 鼠标靠近舞台或切回可见标签页时，0ms 恢复 100ms 灵敏心跳
    const onApproach = () => {
      markActivity();
    };
    if (typeof hostEl.addEventListener === 'function') {
      hostEl.addEventListener('pointerenter', onApproach, { passive: true });
      hostEl.addEventListener('pointermove', onApproach, { passive: true });
      cleanups.push(() => {
        hostEl.removeEventListener('pointerenter', onApproach);
        hostEl.removeEventListener('pointermove', onApproach);
      });
    }
    const onVisibilityChange = () => {
      if (disposed) return;
      syncHeartbeat();
      if (!isDocHidden()) renderAllFrames(performance.now());
    };
    if (doc && typeof doc.addEventListener === 'function') {
      doc.addEventListener('visibilitychange', onVisibilityChange);
      cleanups.push(() => {
        doc.removeEventListener('visibilitychange', onVisibilityChange);
      });
    }

    const mountOntoStack = (riderId, holderId) => {
      const rider = getEnt(riderId);
      const holder = getEnt(holderId);
      if (!rider || !holder || rider.id === holder.id) return false;
      if (!miniPileEnabled && (isMiniEnt(rider) || isMiniEnt(holder))) return false;
      const top = getStackTop(holder.id);
      if (!top || getTowerMembers(top.id).includes(rider.id)) return false;
      const riderSubLen = getTowerMembers(rider.id).length;
      const baseLen = getTowerMembers(top.id).length;
      if (baseLen + riderSubLen > maxTowerDepthAllowed()) return false;
      if (rider.stackedOn) {
        detachWithGravitySettle(rider.id);
      }
      rider.flying += 1;
      rider.leap = null;
      if (isMiniEnt(rider)) rider.act = null;
      rider.stackedOn = top.id;
      rider.y = 0;
      rider.vx = 0;
      rider.vy = 0;
      rider.perchUntil = 0;
      if (!isMiniEnt(rider)) {
        rider.seq = null;
        startClip(rider, 'happy', 900, { sym: 'heart' });
      }
      syncAllStackedFollowers();
      renderAllFrames(performance.now());
      return true;
    };

    renderAllFrames(performance.now());
    syncHeartbeat();

    return {
      setState(next = {}) {
        const prevRight = popoverRightWidth;
        const prevCamp = camp;
        const prevStreaming = streaming;
        const prevStreamTier = streamTier;
        const prevHasError = hasError;
        const prevYield = yieldMode;
        const prevLeapOffset = leapOffsetY;
        const prevMiniPile = miniPileEnabled;
        const prevOrch = orchestrator;
        const prevReduced = reducedMotion;

        if (next.camp !== undefined) camp = next.camp === 'claude' ? 'claude' : 'gemini';
        if (next.streaming !== undefined) streaming = Boolean(next.streaming);
        if (next.streamTier !== undefined) streamTier = Number(next.streamTier || 2);
        if (next.hasError !== undefined) hasError = Boolean(next.hasError);
        if (next.yieldMode !== undefined) yieldMode = next.yieldMode || 'none';
        if (next.leapOffsetY !== undefined) leapOffsetY = Number(next.leapOffsetY || 0);
        if (next.popoverRightWidth !== undefined) popoverRightWidth = Number(next.popoverRightWidth || 0);
        if (next.miniPileEnabled !== undefined) miniPileEnabled = Boolean(next.miniPileEnabled);
        if (next.orchestrator !== undefined) orchestrator = Boolean(next.orchestrator);
        if (next.reducedMotion !== undefined) {
          reducedMotion = Boolean(next.reducedMotion);
          if (reducedMotion && !prevReduced) freezeMotion();
          else if (!reducedMotion && prevReduced) lastActivityAt = performance.now();
        }

        const changed =
          camp !== prevCamp ||
          streaming !== prevStreaming ||
          streamTier !== prevStreamTier ||
          hasError !== prevHasError ||
          yieldMode !== prevYield ||
          leapOffsetY !== prevLeapOffset ||
          popoverRightWidth !== prevRight ||
          miniPileEnabled !== prevMiniPile ||
          orchestrator !== prevOrch ||
          reducedMotion !== prevReduced;

        if (!changed) return;

        if (camp !== prevCamp) {
          // 挂载后阵营实际变化：自动播放领衔交接（站位交换在其内部完成）
          markActivity();
          campHandoff();
          if (performance.now() - lastHandoffAt > 50) resetHomePositions(popoverRightWidth !== prevRight);
        } else if (popoverRightWidth !== prevRight || miniPileEnabled !== prevMiniPile) {
          resetHomePositions(popoverRightWidth !== prevRight);
        }
        if (reducedMotion !== prevReduced || streaming !== prevStreaming) {
          syncHeartbeat();
        }
        renderAllFrames(performance.now());
      },
      notify(event, payload = {}) {
        handleNotify(event, payload);
      },
      stackOnto(riderId, holderId) {
        return mountOntoStack(riderId, holderId);
      },
      pullFromStack(id, mode = 'settle') {
        const ent = getEnt(id);
        if (!ent) return false;
        if (mode === 'sideHop') {
          return dismountRidersSideHop(ent.id);
        }
        const origCx = getEntWorldCx(ent);
        detachWithGravitySettle(ent.id);
        ent.flying += 1;
        ent.leap = null;
        ent.y = 0;
        ent.vx = 0;
        ent.vy = 0;
        setEntWorldCx(ent, origCx - 64);
        enforceGroundSeparation();
        renderAllFrames(performance.now());
        return true;
      },
      triggerObstacle(moverId, obstacleId, forcedAction = null) {
        return triggerObstacleEncounter(moverId, obstacleId, forcedAction);
      },
      triggerDemo(kind) {
        const now = performance.now();
        const leader = camp === 'claude' ? actors.clawd : actors.cat;
        const partner = camp === 'claude' ? actors.cat : actors.clawd;
        const stageObstacle = (mode) => {
          partner.stackedOn = null;
          leader.stackedOn = null;
          partner.y = 0;
          leader.y = 0;
          const mid = Math.round((clampActorX(9999) + 16) * 0.48);
          partner.x = clampActorX(mid);
          leader.x = clampActorX(mid - 50);
          triggerObstacleEncounter(leader.id, partner.id, mode);
        };
        if (kind === 'doze') {
          startDoze(true);
        } else if (kind === 'wake') {
          markActivity();
        } else if (kind === 'leapfrog' || kind === 'autoPerch' || kind === 'greetTurn') {
          stageObstacle(kind);
        } else if (kind === 'stack') {
          mountOntoStack(partner.id, leader.id);
        } else if (kind === 'unstack') {
          allActiveEnts().forEach((e) => {
            e.stackedOn = null;
            e.perchUntil = 0;
            e.leap = null;
            e.y = 0;
          });
          actors.cat.overridePose = null;
          actors.clawd.overridePose = null;
          actors.cat.mirror = false;
          actors.clawd.mirror = false;
          resetHomePositions(true);
        } else if (kind === 'toss') {
          dismountRidersSideHop(leader.id);
          if (leader.stackedOn) detachWithGravitySettle(leader.id);
          leader.y = -48;
          startBallistic(leader, -3.5, -7.8);
        } else if (kind === 'poke') {
          triggerPoke(leader, false);
        } else {
          const clipMap = { fire: 'onFire', cheer: 'cheerSticks', rickroll: 'rickroll', siren: 'siren' };
          const mapped = clipMap[kind] || kind;
          if (['onFire', 'siren', 'spinHop'].includes(mapped)) dismountRidersSideHop(leader.id);
          startClip(leader, mapped, 3800);
          if (['onFire', 'cheerSticks', 'rickroll', 'siren'].includes(mapped)) {
            startClip(partner, mapped === 'cheerSticks' ? 'cheerSticks' : 'wow', 3600, { sym: mapped === 'siren' ? 'sweat' : 'spark' });
          }
        }
        renderAllFrames(now);
      },
      poke(id = 'cat') {
        const target = actors[id] || actors.cat;
        triggerPoke(target, false);
      },
      onUserType(text = '') {
        const now = performance.now();
        markActivity();
        const leader = camp === 'claude' ? actors.clawd : actors.cat;
        const trimmed = String(text || '').replace(/\s+$/, '');
        if (/[?？]$/.test(trimmed)) {
          startClip(leader, 'tilt', 750, { rot: -9, sym: 'q' });
        } else if (/[!！]$/.test(trimmed)) {
          startClip(leader, 'wow', 700, { sym: 'bang' });
        } else {
          leader.nodY = PX; // 打字点头：整格下沉 1 格
          leader.nodUntil = now + 140;
          leader.eyeScan = 0;
          clearTimeout(pauseTimer);
          pauseTimer = setTimeout(() => {
            if (disposed) return;
            leader.eyeScan = tickIdx % 2 ? -1 : 1;
            renderAllFrames(performance.now());
            later(500, () => {
              leader.eyeScan = 0;
            });
          }, 450);
        }
        renderAllFrames(now);
      },
      getLayoutSnapshot() {
        const now = performance.now();
        return {
          camp,
          miniPileEnabled,
          reducedMotion,
          // 生态联动与按需渲染遥测只读诊断
          dozing,
          orchestrator,
          towers: listAllTowers(),
          chromaResonance: {
            active: prismaticCoat,
            tuned: chromaGates.tuned,
            forged: chromaGates.forged,
            sparkCount: chromaSparks.length,
          },
          perf: {
            timerIntervalMs: currentTickMs,
            timerPaused: isDocHidden() || currentTickMs === 0,
            canvasDraws: perfStats.canvasDraws,
            canvasSkips: perfStats.canvasSkips,
            domTransformWrites: perfStats.domTransformWrites,
            domTransformSkips: perfStats.domTransformSkips,
          },
          lastInteraction: { ...lastInteraction },
          minis: miniCrabs.map((mc) => ({
            id: mc.id,
            act: mc.act && tickIdx >= mc.act.start ? mc.act.type : null,
            x: Math.round(mc.lastX),
            y: Math.round(mc.stackedOn ? computeWorldFootY(mc) : mc.y || 0),
            worldCx: Math.round(getEntWorldCx(mc)),
            dir: mc.dir,
            stackedOn: mc.stackedOn,
            leap: Boolean(mc.leap),
          })),
          actors: ['cat', 'clawd'].map((id) => {
            const a = actors[id];
            const rect = a.el ? a.el.getBoundingClientRect() : null;
            const fx = a.lastFx || {};
            return {
              id,
              x: a.x,
              y: a.y,
              footY: Math.round(computeWorldFootY(a)),
              worldCx: Math.round(getEntWorldCx(a)),
              pose: resolvePoseFor(a, now),
              sym: a.sym && now < a.symUntil ? a.sym : null,
              rot: effectiveRot(a, now),
              pokeCount: a.pokeCount,
              stackedOn: a.stackedOn,
              leap: Boolean(a.leap),
              rect: rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } : null,
              // 附加诊断字段（只读）：整数格挤压量、待机微动作与静止帧缓存快照
              squash: a.lastSq ? { ...a.lastSq } : { w: 0, h: 0 },
              blinkStage: fx.blinkStage || null,
              breath: Boolean(fx.breath),
              earTwitch: fx.earTwitch || null,
              clawSnap: fx.clawSnap || null,
              glance: fx.glance || 0,
              tick: tickIdx,
              renderCache: {
                poseKey: a.lastRender.poseKey,
                frameIdx: a.lastRender.frameIdx,
                flip: a.lastRender.flip,
                tintState: a.lastRender.tintState,
                lastX: a.lastDomX,
                lastY: a.lastDomY,
                lastRot: a.lastRender.lastRot,
              },
            };
          }),
        };
      },
      syncPowerState() {
        syncHeartbeat();
      },
      dispose() {
        disposed = true;
        if (tickTimer !== null) {
          clearInterval(tickTimer);
          tickTimer = null;
        }
        currentTickMs = 0;
        if (dragRafId && cAF) {
          try { cAF(dragRafId); } catch (_) {}
          dragRafId = 0;
        }
        dragRafPending = false;
        clearTimeout(pauseTimer);
        clearTimeout(theaterTimer);
        pendingTimers.forEach((t) => clearTimeout(t));
        pendingTimers.clear();
        try {
          if (reducedMq && typeof reducedMq.removeEventListener === 'function') {
            reducedMq.removeEventListener('change', onReducedChange);
          } else if (reducedMq && typeof reducedMq.removeListener === 'function') {
            reducedMq.removeListener(onReducedChange);
          }
        } catch (_) {
          /* 忽略 */
        }
        pairCooldowns.clear();
        try {
          if (fxCanvas) { fxCanvas.width = 0; fxCanvas.height = 0; }
          for (const a of [actors.cat, actors.clawd]) {
            if (a?.canvas?.__agRotOff) { a.canvas.__agRotOff.width = 0; a.canvas.__agRotOff.height = 0; a.canvas.__agRotOff = null; }
          }
        } catch (_) {}
        cleanups.forEach((fn) => fn());
        for (const node of [miniGroupEl, actors.cat.el, actors.clawd.el, fxCanvas]) {
          if (node) {
            if (typeof node.remove === 'function') node.remove();
            else if (node.parentNode && typeof node.parentNode.removeChild === 'function') {
              node.parentNode.removeChild(node);
            } else if (hostEl && typeof hostEl.removeChild === 'function') {
              try { hostEl.removeChild(node); } catch (_) {}
            }
          }
        }
      },
    };
  }

  return {
    PX,
    TICK,
    DOZE_TICK,
    OFFICIAL_OPEN_REF,
    PALETTES,
    CLAWD_PARTS,
    CAT_PARTS,
    MINI_SPRITES,
    MINI_ANIM_FRAMES,
    PROPS,
    SYMS,
    resolveClawdStandGrid,
    buildClipLayers,
    classifyPairEncounter,
    stepMiniCrabCorridor,
    evalChromaColorAt,
    resolveGroundSeparation,
    chooseObstacleAction,
    mountDualMascotStage,
  };
});
