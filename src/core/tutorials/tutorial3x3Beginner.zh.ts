import type { Tutorial } from './ITutorial';

/**
 * Simplified Chinese (zh-CN) version of the 3x3 beginner tutorial.
 * Same step / case structure as the English version; only the user-visible
 * strings change. Algorithms (R U R'…) stay in standard cubing notation.
 */
export const tutorial3x3Beginner_zh: Tutorial = {
  id: '3x3-beginner',
  size: 3,
  title: '三阶魔方还原 — 入门方法',
  blurb:
    '我们一层一层地还原魔方:先做白色面,再做中层,最后做黄色面。每一步只需要记住几个简单的图形和口诀。',
  steps: [
    {
      id: 'cross',
      number: 1,
      title: '白色十字',
      goal: '在顶部拼出一个白色十字,十字的四条边颜色与对应中心一致。',
      intro:
        '找到四个白色棱块,把它们放到白色中心周围。每个白色棱块有第二种颜色 — 让它对应到同色中心。本步骤主要靠直觉,没有固定的口诀。把所有四条边都对齐后,十字就完成了。',
      tips: [
        '把白色中心朝上拿稳。',
        '一次只考虑一条棱。',
        '若白色棱块在底层:对齐到目标位置正下方,再用 F2 / R2 / B2 / L2 翻上来。',
      ],
      cases: [
        {
          id: 'cross-bottom',
          name: '白色棱块在底层',
          description: '转动底层让该棱块对齐到目标侧面之下,然后该侧面转两次把它翻上来。',
          algorithm: 'D F2',
          recognition: '白色面朝下。',
        },
        {
          id: 'cross-equator',
          name: '白色棱块在中层(白色朝向侧面)',
          description: '先用一个 90° 转动把它送到底层,再用 180° 翻上来。',
          algorithm: "F'",
          recognition: '白色朝向侧面,棱块卡在上下层之间。',
        },
        {
          id: 'cross-top-flipped',
          name: '白色棱块在顶层但朝向反了',
          description: '棱块已在槽位但白色朝向侧面。一个短口诀可以翻转它而不破坏其它已对齐的边。',
          algorithm: "F U' R U F2",
          recognition: '白色棱块在顶层,但白色不在白色面。',
        },
      ],
    },
    {
      id: 'corners',
      number: 2,
      title: '白色角块',
      goal: '把四个白色角块归位 — 白色面整体完成。',
      intro:
        "在底层找一个白色角块。转动底层(D)让它处于目标位置(由两个侧面颜色决定)正下方。然后反复使用基础口诀 R U R' U' 直到它从下方插入正确位置。每个角最多重复三次。",
      tips: [
        "口诀 R U R' U' 也叫\"小鱼摆尾\"。",
        '若白色角块卡在顶层但位置错误,先用一次口诀把它踢到底层,再处理。',
      ],
      cases: [
        {
          id: 'corner-trigger',
          name: '使用基础口诀',
          description: "对齐角块在目标槽位下方,使用 R U R' U' 把它放上来。如果朝向不对继续重复,最多 3 次。",
          algorithm: "R U R' U'",
          recognition: '白色角块在底层并对齐到目标位置之下。',
        },
        {
          id: 'corner-stuck-top',
          name: '白色角块卡在顶层',
          description: '一个白色角块在顶层但位置错。先用一次口诀把它踢到底层,然后按底层的方法处理。',
          algorithm: "R U R' U'",
          recognition: '白色贴纸在顶层角块上,但不在白色面上。',
        },
        {
          id: 'corner-direct-right',
          name: '白色朝右(一步插入)',
          description: "当白色贴纸朝右且角块对齐到目标槽位下方时,R' D' R 直接把它放进去。",
          algorithm: "R' D' R",
          recognition: '白色贴纸在 \"前下右\" 角块的右侧面上。',
        },
      ],
    },
    {
      id: 'middle',
      number: 3,
      title: '中层棱块',
      goal: '放好四条中层棱块,前两层完成。',
      intro:
        '现在把魔方翻过来,白色朝下。在顶层(U)找一条没有黄色的棱 — 它属于中层。让它的前色与前面中心对齐,然后根据另一种颜色决定送往左还是右。',
      tips: [
        '右口诀:把棱送到右槽。',
        '左口诀:把棱送到左槽。',
        '如果中层棱已在槽里但颜色反了:先用右口诀把它弹出,再正确地放回去。',
      ],
      cases: [
        {
          id: 'middle-right',
          name: '送往右槽',
          description: '前色对应前中心,顶面色对应右中心。使用右口诀。',
          algorithm: "U R U' R' U' F' U F",
          recognition: '顶贴纸颜色与右中心相同。',
        },
        {
          id: 'middle-left',
          name: '送往左槽',
          description: '前色对应前中心,顶面色对应左中心。使用左口诀。',
          algorithm: "U' L' U L U F U' F'",
          recognition: '顶贴纸颜色与左中心相同。',
        },
        {
          id: 'middle-flipped',
          name: '中层棱卡反了',
          description: '某条非黄色棱在中层但两色反了。先用右口诀把它弹到顶层,再当作\"送往左/右\"处理。',
          algorithm: "U R U' R' U' F' U F",
          recognition: '中层棱位置正确但两个侧色互换了。',
        },
      ],
    },
    {
      id: 'yellow-cross',
      number: 4,
      title: '黄色十字',
      goal: '在顶部拼出黄色十字。',
      intro:
        "你会看到三种图形之一:点、L 形或一字。根据情况使用 F R U R' U' F' 一次或两次。点的话需要做两遍。",
      tips: [
        '看到 L 形时,把 L 的拐角放在视野的左上方。',
        '看到一字时,把一字横向摆放。',
        '点要做两次口诀;L 和一字只需做一次。',
      ],
      cases: [
        {
          id: 'oll-l',
          name: 'L 形(做一次)',
          description: '两条相邻的黄色棱组成一个 L。把 L 的角放在左上方,做一次口诀。',
          algorithm: "F R U R' U' F'",
          recognition: '两条黄色棱相邻,呈 90° 夹角。',
        },
        {
          id: 'oll-dot',
          name: '点(做两次)',
          description: '只有中心是黄色。第一次得到 L,再做一次得到十字。',
          algorithm: "F R U R' U' F' F R U R' U' F'",
          setup: "F U R U' R' F' F U R U' R' F'",
          recognition: '顶面没有黄色棱,只有中心。',
        },
      ],
    },
    {
      id: 'yellow-face',
      number: 5,
      title: '黄色面',
      goal: '让整个顶面都变成黄色。',
      intro:
        '十字完成后开始翻角。看一下顶面有几个黄角已经朝上 — 这决定了情况。',
      tips: [
        '0 个黄角:把任意一个有黄色的角放在视野的左前方。',
        '1 个黄角:把它放在顶面的左下角。',
        '2 个黄角:看是对角还是相邻。',
      ],
      cases: [
        {
          id: 'sune',
          name: 'Sune(1 个黄角朝上)',
          description: '把已经朝上的那个黄角放在顶面的左下方。经典 7 步口诀让其它三个角翻面。',
          algorithm: "R U R' U R U2 R'",
          recognition: '顶面只有一个角是黄色。',
        },
        {
          id: 'anti-sune',
          name: 'Anti-Sune(Sune 的镜像)',
          description: '相同思路,但黄角在右下方。使用镜像口诀。',
          algorithm: "R U2 R' U' R U' R'",
          recognition: '一个黄角朝上,但黄色贴纸朝向相反。',
        },
        {
          id: 'h-pattern',
          name: 'H 型(对角两个黄角)',
          description: '两个黄角处于对角线两端。这个稍长的口诀一次性解决四个角。',
          algorithm: "R U R' U R U' R' U R U2 R'",
          recognition: '顶面两个黄角分布在对角线上。',
        },
        {
          id: 'pi-pattern',
          name: 'Pi 型(后方两个相邻黄角)',
          description: '两个黄角相邻并都在后方。Pi 口诀翻前两个角同时保留后两个。',
          algorithm: "R U2 R' U' R U R' U' R U' R'",
          recognition: '两个黄角相邻并位于后方("车头灯"朝后)。',
        },
      ],
    },
    {
      id: 'pll-corners',
      number: 6,
      title: '角块归位',
      goal: '把顶层的角块换到正确位置(颜色可能还没全对齐)。',
      intro:
        '找两个相邻角块的侧色一致 — 这两个角已经在正确位置。把它们放在后方,使用角块交换口诀解决前两个角。如果没有匹配对,先做一次再观察。',
      cases: [
        {
          id: 'a-perm-cw',
          name: 'A-perm(顺时针)',
          description: '顶层三个角按顺时针循环,留一个角不动。把不动的那个放在右后方。',
          algorithm: "U R U' L' U R' U' L",
          recognition: '一对相邻匹配的侧色在右后方。',
        },
        {
          id: 'a-perm-ccw',
          name: 'A-perm(逆时针)',
          description: 'A-perm 的镜像,反方向循环。如果顺时针 A 让情况更糟,这个口诀可以纠正。',
          algorithm: "U' L' U R U' L U R'",
          recognition: '一对相邻匹配的侧色在左后方。',
        },
      ],
    },
    {
      id: 'pll-edges',
      number: 7,
      title: '最后一步 — 全 PLL',
      goal: '一条口诀完成整个魔方。识别图形,套用对应口诀。',
      intro:
        '共有 21 种 PLL 情况。如果你做完了第 6 步,只需用四个棱专用 PLL(Ua、Ub、H、Z)。如果你想跳过第 6 步,使用角专用或综合 PLL 一步完成。名称和算法均使用速拧界标准。',
      tips: [
        '棱专用 PLL(Ua、Ub、H、Z):接续第 6 步使用。',
        '角专用 PLL(Aa、Ab、E):跳过第 6 步直接使用。',
        '综合 PLL(T、F、V、Y、Ja、Jb、Ra、Rb、Na、Nb、Ga–Gd):一步搞定角和棱。',
      ],
      cases: [
        {
          id: 'pll-ua',
          name: 'Ua(三棱顺时针循环)',
          description: '三条不匹配的棱顺时针循环。把已匹配的那一面放在后方。',
          algorithm: "M2 U M U2 M' U M2",
          recognition: '一面已匹配中心,另外三条棱顺时针循环。',
        },
        {
          id: 'pll-ub',
          name: 'Ub(三棱逆时针循环)',
          description: 'Ua 的镜像,三条棱逆时针循环。',
          algorithm: "M2 U' M U2 M' U' M2",
          recognition: '类似 Ua 但循环方向相反。',
        },
        {
          id: 'pll-h',
          name: 'H(对面棱互换)',
          description: '两组对面棱互换。对称形,无方向问题。',
          algorithm: "M2 U M2 U2 M2 U M2",
          recognition: '没有匹配面,对面棱互换。',
        },
        {
          id: 'pll-z',
          name: 'Z(相邻棱互换)',
          description: '两组相邻棱互换。把一面已匹配的面放在前方。',
          algorithm: "M' U M2 U M2 U M' U2 M2",
          recognition: '相邻棱构成两组对角互换。',
        },
        {
          id: 'pll-aa',
          name: 'Aa(三角顺时针循环)',
          description: '三个角顺时针循环,留一个角不动。固定的角放在右后方。',
          algorithm: "x R' U R' D2 R U' R' D2 R2 x'",
          recognition: '三角顺时针循环;匹配对位于右后方。',
        },
        {
          id: 'pll-ab',
          name: 'Ab(三角逆时针循环)',
          description: 'Aa 的镜像。',
          algorithm: "x' R U' R D2 R' U R D2 R2 x",
          recognition: '三角逆时针循环;匹配对位于左后方。',
        },
        {
          id: 'pll-e',
          name: 'E(对角双换)',
          description: '两组对角的角块互换。棱块已正确。',
          algorithm: "x' R U' R' D R U R' D' R U R' D R U' R' D' x",
          recognition: '没有任何角块归位;对角的角互换。',
        },
        {
          id: 'pll-t',
          name: 'T(角棱互换 T 形)',
          description: '互换两个相邻的角和它们之间的两条棱。最常见的情况之一。',
          algorithm: "R U R' U' R' F R2 U' R' U' R U R' F'",
          recognition: '"车头灯"在左方;前右角与后右角互换。',
        },
        {
          id: 'pll-f',
          name: 'F(角棱互换 F 形)',
          description: '互换两个相邻的角和顶面对面的两条棱。',
          algorithm: "R' U R U' R2 F' U' F U R F R' F' R2",
          recognition: '车头灯在前方;对面棱和角互换。',
        },
        {
          id: 'pll-ja',
          name: 'Ja(相邻互换 a)',
          description: '互换一对相邻的角及其间的棱。',
          algorithm: "L' U' L F L' U' L U L F' L2 U L",
          recognition: '右侧三块已对齐;左后角和棱互换。',
        },
        {
          id: 'pll-jb',
          name: 'Jb(相邻互换 b)',
          description: 'Ja 的镜像,在右侧操作。',
          algorithm: "R U R' F' R U R' U' R' F R2 U' R'",
          recognition: '左侧三块已对齐;右前角和棱互换。',
        },
        {
          id: 'pll-ra',
          name: 'Ra(对角型角循环)',
          description: '三角三棱循环,且打破两对相邻匹配。',
          algorithm: "R U R' F' R U2 R' U2 R' F R U R U2 R'",
          recognition: '左侧有一组匹配方块;其余循环。',
        },
        {
          id: 'pll-rb',
          name: 'Rb(Ra 的镜像)',
          description: '与 Ra 形状相同,方向相反。',
          algorithm: "R' U2 R U2 R' F R U R' U' R' F' R2",
          recognition: '右侧有一组匹配方块;其余循环。',
        },
        {
          id: 'pll-na',
          name: 'Na(对角角棱互换)',
          description: '两对对角的角棱整组互换。',
          algorithm: "L U' R U2 L' U R' L U' R U2 L' U R'",
          recognition: '没有任何匹配对;形态对称。',
        },
        {
          id: 'pll-nb',
          name: 'Nb(Na 的镜像)',
          description: '镜像版本。',
          algorithm: "R' U L' U2 R U' L R' U L' U2 R U' L",
          recognition: '与 Na 同形但镜像。',
        },
        {
          id: 'pll-v',
          name: 'V(对角角棱互换 V 形)',
          description: '两对对角的角棱互换。',
          algorithm: "R' U R' U' y R' F' R2 U' R' U R' F R F",
          recognition: '"V" 形:角棱沿对角线互换。',
        },
        {
          id: 'pll-y',
          name: 'Y(对角角棱互换 Y 形)',
          description: '另一种对角对互换,视觉略不同。',
          algorithm: "F R U' R' U' R U R' F' R U R' U' R' F R F'",
          recognition: '"Y" 形:类似 V 但右后角与左前角互换。',
        },
        {
          id: 'pll-ga',
          name: 'Ga(角循环 a)',
          description: '三角三棱循环;一组角棱不动。',
          algorithm: "R2 U R' U R' U' R U' R2 U' D R' U R D'",
          recognition: '某处有一组匹配;循环朝某一方向。',
        },
        {
          id: 'pll-gb',
          name: 'Gb(角循环 b)',
          description: 'Ga 的镜像。',
          algorithm: "R' U' R U D' R2 U R' U R U' R U' R2 D",
          recognition: 'Ga 的镜像。',
        },
        {
          id: 'pll-gc',
          name: 'Gc(角循环 c)',
          description: 'Ga 的反向。',
          algorithm: "R2 U' R U' R U R' U R2 D' U R U' R' D",
          recognition: '类似 Ga 但循环反向。',
        },
        {
          id: 'pll-gd',
          name: 'Gd(角循环 d)',
          description: 'Gc 的镜像。',
          algorithm: "R U R' U' D R2 U' R U' R' U R' U R2 D'",
          recognition: 'Gc 的镜像。',
        },
      ],
    },
  ],
};
