import type { Tutorial } from './ITutorial';

/**
 * Simplified Chinese version of the 2×2 Ortega beginner tutorial.
 */
export const tutorial2x2Beginner_zh: Tutorial = {
  id: '2x2-beginner',
  size: 2,
  title: '二阶魔方还原 — 入门方法',
  blurb:
    '二阶魔方只有角块,没有中心也没有棱。先还原一面,再让对面的角朝向一致,最后把两层都归位。一共三步。',
  steps: [
    {
      id: 'first-face',
      number: 1,
      title: '第一面',
      goal: '让整个白色面只显示白色。',
      intro:
        "选一种颜色开始,通常是白色。在底层(或顶层)凭直觉还原四个白色角块:挑一个白色角块,放在目标位置下方,反复使用 R U R' U' 直到正确插入。其它侧面颜色暂不需要对齐 — 这一步只关心白色面。",
      tips: [
        '没有中心块,所以拿哪一边都可以。',
        "用 R U R' U' 触发口诀,与三阶相同。",
      ],
      cases: [
        {
          id: 'corner-trigger',
          name: '使用基础口诀',
          description: "白色角块在目标槽下方时,R U R' U' 把它放进去。如果不对位置最多重复 3 次。",
          algorithm: "R U R' U'",
          recognition: '白色角块在底层并对齐到目标位置之下。',
        },
        {
          id: 'corner-direct',
          name: '白色朝右(直接插入)',
          description: "当白色贴纸朝右且对齐到目标槽位下方时,R' D' R 直接放入,无需多次触发。",
          algorithm: "R' D' R",
          recognition: '白色贴纸在 \"前下右\" 角块的右侧。',
        },
      ],
    },
    {
      id: 'oll',
      number: 2,
      title: '顶面同色',
      goal: '让整个顶面显示同一种颜色(若起始为白,顶面将是黄色)。',
      intro:
        '把魔方翻过来,未还原的一面朝上。看顶面有几个角已经显示正确颜色:0、1、2 或 3。每种图形对应一种短口诀。',
      tips: [
        'Sune 处理任何"已有 1 个角朝上"的情况。',
        '更复杂的图形使用 Pi 或 H 口诀,与三阶顶层用的同一系列。',
      ],
      cases: [
        {
          id: 'sune',
          name: 'Sune(1 个黄角朝上)',
          description: '把已朝上的那个黄角放在顶面的左下方,使用经典 7 步 Sune。',
          algorithm: "R U R' U R U2 R'",
          recognition: '顶面恰有一个黄角。',
        },
        {
          id: 'anti-sune',
          name: 'Anti-Sune(镜像 Sune)',
          description: '黄角在另一对角线方向时使用。Sune 不行,这个就行。',
          algorithm: "R U2 R' U' R U' R'",
          recognition: '一个黄角朝上,但 Sune 把黄色弄到了错误一侧。',
        },
        {
          id: 'h-pattern',
          name: 'H 型(对角两个黄角)',
          description: '两个黄角处于对角线两端。这条稍长的口诀同时翻好四个角。',
          algorithm: "R U R' U R U' R' U R U2 R'",
          recognition: '顶面两个黄角分布在对角线上。',
        },
        {
          id: 'pi-pattern',
          name: 'Pi 型(后方两个相邻黄角)',
          description: '两个黄角相邻并都在后方。使用 Pi 口诀。',
          algorithm: "R U2 R' U' R U R' U' R U' R'",
          recognition: '两个黄角相邻并位于后方("车头灯"朝后)。',
        },
      ],
    },
    {
      id: 'pbl',
      number: 3,
      title: '两层归位',
      goal: '把上下两层的角块都归到正确位置。',
      intro:
        '此时两层都已同色,只需要交换角块位置。先看底层 — 找一对相邻匹配,把它放在后方。然后判断顶面是相邻交换还是对角交换。',
      tips: [
        '若底层已经完成,只需要处理顶层。',
        '若两层都需要相同的交换,一条简短口诀同时解决。',
      ],
      cases: [
        {
          id: 'pbl-top-adj',
          name: '顶层相邻交换,底层完成',
          description: '顶层两个相邻角需要交换。把已匹配的那一对放在顶层的后方。',
          algorithm: "R U' R F2 R' U R'",
          recognition: '底层是纯色;顶层一侧是匹配对,另一侧需要交换。',
        },
        {
          id: 'pbl-top-diag',
          name: '顶层对角交换,底层完成',
          description: '顶层两个对角的角需要交换。稍长一些的口诀。',
          algorithm: "F R' F' R U R U' R'",
          recognition: '底层纯色;顶层没有任何匹配对。',
        },
        {
          id: 'pbl-double-diag',
          name: '两层都对角交换',
          description: '上下层都需要对角交换。一条简短易记的口诀同时解决。',
          algorithm: 'R2 F2 R2',
          recognition: '两层都不是纯色,都需要对角交换。',
        },
      ],
    },
  ],
};
