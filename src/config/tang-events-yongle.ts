/**
 * 《我在唐朝当掌柜》区域特色事件池（地图与事件深化 模块三 3.1）— 永乐坊（邻里市井）
 * 与现有事件系统整合（type=random，经 triggerRegionEvent 入队）。
 */
import type { GameEvent } from '@/types/tang-manager';

export const YONGLE_EVENTS: GameEvent[] = [
  {
    type: 'random', id: 'yl-miaohui', title: '坊内庙会',
    description: '永乐坊的庙会到了——香火缭绕，人声鼎沸。这样的日子，生意格外好做。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '摆摊添热闹（进货 20 两）', consequence: '庙会人潮带来客源，当日收益上浮。', effect: { gold: -20, reputation: 5 } },
      { id: 'b', label: '只在店门口挂灯迎客', consequence: '庙会客流经过店铺，小有进账。', effect: { gold: 10, reputation: 2 } },
      { id: 'c', label: '闭店半日去逛庙会', consequence: '偷得浮生半日闲，心情放松，但当日无客。', effect: { energy: 10 } },
    ],
  },
  {
    type: 'random', id: 'yl-neighbor-dispute', title: '邻里纠纷',
    description: '两位邻居在你店门口吵起来了——一个说你家的灯油味熏人，一个说对方乱倒脏水。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '出面调解（费些口舌）', consequence: '处理得当，两家都念你的好。', effect: { reputation: 10 } },
      { id: 'b', label: '劝他们去坊正处评理', consequence: '公事公办，谁也不得罪。', effect: { reputation: 2 } },
      { id: 'c', label: '当作没看见', consequence: '两家都不满你冷眼旁观。', effect: { reputation: -5 } },
    ],
  },
  {
    type: 'random', id: 'yl-fangzheng', title: '坊正换届',
    description: '永乐坊坊正要换届了。两位候选人各有主张——一位要加税修路，一位要减税治安。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '支持减税候选人', consequence: '若当选，坊内税率下调，治安稍松。', effect: { reputation: 6 } },
      { id: 'b', label: '支持修路候选人', consequence: '若当选，道路畅通，商货往来便利。', effect: { gold: 12 } },
      { id: 'c', label: '两不相帮', consequence: '不趟浑水，静观其变。', effect: {} },
    ],
  },
  {
    type: 'random', id: 'yl-kid-mischief', title: '小孩砸招牌',
    description: '几个小孩在你店门口玩闹，不小心把你家的招牌砸坏了。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '找家长理论（要 5 两赔偿）', consequence: '家长赔了钱，但孩子们见你就躲。', effect: { gold: 5, reputation: -2 } },
      { id: 'b', label: '算了，自己修好（花 3 两）', consequence: '孩子们感激，帮你四处吆喝生意。', effect: { gold: -3, reputation: 4 } },
      { id: 'c', label: '让小孩们帮工抵账', consequence: '小孩干了一下午活，招牌也修好了。', effect: { gold: 2 } },
    ],
  },
  {
    type: 'random', id: 'yl-new-neighbor', title: '新邻居搬来',
    description: '隔壁空置许久的铺面终于有人接手了——你好奇地探头去看。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '登门送贺礼（花 5 两）', consequence: '新邻居承你的情，日后多有照应。', effect: { gold: -5, reputation: 5 } },
      { id: 'b', label: '远远打个招呼', consequence: '先混个脸熟，不深不浅。', effect: { reputation: 1 } },
      { id: 'c', label: '打听对方底细', consequence: '原来是同行——日后难免竞争。', effect: { reputation: -1 } },
    ],
  },
];
