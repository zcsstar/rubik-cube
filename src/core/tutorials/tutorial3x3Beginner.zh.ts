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
      title: '棱块归位',
      goal: '把顶层棱块循环到最终位置 — 魔方还原完成。',
      intro:
        '看顶层四条棱的侧色 — 一定有一面颜色已经匹配中心。把那一面放在后方。使用 U-perm。如果方向反了,使用镜像口诀。',
      cases: [
        {
          id: 'u-perm-cw',
          name: 'U-perm(顺时针)',
          description: '顶层三条棱按顺时针循环。把已匹配的那一面放在后方。',
          algorithm: "F2 U L R' F2 L' R U F2",
          recognition: '棱块需要顺时针循环。',
        },
        {
          id: 'u-perm-ccw',
          name: 'U-perm(逆时针)',
          description: '相同结构但循环方向相反。如果顺时针 U-perm 让情况更糟,这个可以纠正。',
          algorithm: "F2 U' L R' F2 L' R U' F2",
          recognition: '棱块需要逆时针循环。',
        },
      ],
    },
  ],
};
