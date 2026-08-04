/** 西市事件池（胡商与冒险）— 模块三 3.3 */
import type { GameEvent } from '@/types/tang-manager';

export const WEST_MARKET_EVENTS: GameEvent[] = [
  {
    type: 'random', id: 'wm-novelty', title: '胡商新玩意',
    description: '一个胡商带来长安从未见过的商品——你敢不敢做第一个吃螃蟹的人？',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '重金购入（花 50 两）', consequence: '若是稀罕货，转手便是暴利；若是噱头，血本无归。', effect: { gold: -50 } },
      { id: 'b', label: '先买一件试试水（花 10 两）', consequence: '小试牛刀，进退有据。', effect: { gold: -10 } },
      { id: 'c', label: '只看看不动手', consequence: '等别人试过了再说。', effect: {} },
    ],
  },
  {
    type: 'random', id: 'wm-dock-strike', title: '码头罢工',
    description: '码头工人罢工了——所有货物延迟三天到港。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '加价雇人抢运（花 15 两）', consequence: '货物如期到港，少误了生意。', effect: { gold: -15 } },
      { id: 'b', label: '等罢工结束', consequence: '省了钱，但货迟了三天。', effect: { gold: -10 } },
      { id: 'c', label: '趁机低价收购积压货', consequence: '有人急于出手，你捡了便宜。', effect: { gold: 20 } },
    ],
  },
  {
    type: 'random', id: 'wm-smuggle-check', title: '走私调查',
    description: '京兆府怀疑有人在西市走私——所有商户的账目都要接受检查。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '主动配合，账目透明', consequence: '查无问题，反得清廉之名。', effect: { reputation: 6 } },
      { id: 'b', label: '塞银子打点（花 30 两）', consequence: '检查走了过场，银两打了水漂。', effect: { gold: -30 } },
      { id: 'c', label: '托关系拖延', consequence: '拖得一时，风声更紧。', effect: { reputation: -3 } },
    ],
  },
  {
    type: 'random', id: 'wm-persian-help', title: '波斯商人求助',
    description: '一位波斯商人丢了通关文牒，需要你帮忙作保——帮了他可能获得西域稀有货源。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '替他作保', consequence: '担了风险，也结下善缘——西域货源有望。', effect: { reputation: 8 } },
      { id: 'b', label: '帮他引荐官府熟人', consequence: '牵线搭桥，两头都是人情。', effect: { reputation: 4 } },
      { id: 'c', label: '婉言拒绝', consequence: '明哲保身，不担风险。', effect: {} },
    ],
  },
];
