/** 长安城事件池（权力与风险）— 模块三 3.4 */
import type { GameEvent } from '@/types/tang-manager';

export const CHANGAN_EVENTS: GameEvent[] = [
  {
    type: 'random', id: 'ca-imperial-tour', title: '皇家出行',
    description: '皇帝出巡，仪仗经过你的店铺附近——全城店铺停业一日，但声望大涨。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '停业一日，门前恭候', consequence: '圣驾过处，万民欢腾——你的店铺声名远播。', effect: { reputation: 20, gold: -10 } },
      { id: 'b', label: '偷偷开张做熟客生意', consequence: '赚了点小钱，但被巡查的官差训斥。', effect: { gold: 10, reputation: -3 } },
      { id: 'c', label: '搭个看台卖茶点', consequence: '游人如织，茶点卖得飞快。', effect: { gold: 15, reputation: 5 } },
    ],
  },
  {
    type: 'random', id: 'ca-snow-warning', title: '天灾预警',
    description: '钦天监发出大雪预警——所有食材未来一周进价翻倍。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '抢购囤货（花 80 两）', consequence: '囤粮在手，雪中来钱。', effect: { gold: -80 } },
      { id: 'b', label: '适量补货（花 30 两）', consequence: '够用即可，不贪不惧。', effect: { gold: -30 } },
      { id: 'c', label: '按兵不动', consequence: '雪后价高，少赚一笔。', effect: {} },
    ],
  },
  {
    type: 'random', id: 'ca-faction-strife', title: '党争余波',
    description: '朝中两位大臣的斗争波及商界——你必须选择站队。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '支持王侍郎（押 50 两）', consequence: '赌对了是飞黄腾达，赌错了是池鱼之殃。', effect: { gold: -50 } },
      { id: 'b', label: '支持李仆射（押 50 两）', consequence: '另一条船，另一种前程。', effect: { gold: -50 } },
      { id: 'c', label: '两不相帮，守好本分', consequence: '不站队，也就没有盟友。', effect: {} },
    ],
  },
  {
    type: 'random', id: 'ca-mystery-buyer', title: '神秘买主',
    description: '有人匿名收购大量某种商品——可能是囤积居奇，也可能是官府暗中储备。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '高价卖给他一批', consequence: '赚了一笔，但库房空了。', effect: { gold: 40 } },
      { id: 'b', label: '追查买主身份（花 10 两）', consequence: '原来是官府的暗手——知道了也装不知道。', effect: { gold: -10, reputation: 3 } },
      { id: 'c', label: '留着自己卖', consequence: '不贪这快钱。', effect: {} },
    ],
  },
];
