/** 东市事件池（商业竞争）— 模块三 3.2 */
import type { GameEvent } from '@/types/tang-manager';

export const EAST_MARKET_EVENTS: GameEvent[] = [
  {
    type: 'random', id: 'em-shen-yaji', title: '沈听澜雅集',
    description: '沈听澜邀你参加东市商会的雅集——席间皆是长安商界有头有脸的人物。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '备厚礼赴宴（花 30 两）', consequence: '与沈听澜及众商贾相谈甚欢，人脉大进。', effect: { gold: -30, reputation: 12, shenTinglanFavor: 5 } },
      { id: 'b', label: '空手赴宴', consequence: '以诚相交，倒也谈得来。', effect: { reputation: 6, shenTinglanFavor: 2 } },
      { id: 'c', label: '推辞不去', consequence: '错过结识人脉的机会。', effect: { shenTinglanFavor: -3 } },
    ],
  },
  {
    type: 'random', id: 'em-supply-race', title: '货源争夺',
    description: '一种稀缺原料到港，几家铺子同时盯着——价高者得。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '高价抢下（花 60 两）', consequence: '原料到手，但银两见紧。', effect: { gold: -60, reputation: 4 } },
      { id: 'b', label: '出个公道价', consequence: '没抢到，但也未伤和气。', effect: {} },
      { id: 'c', label: '放弃，等下一批', consequence: '忍一时风平浪静。', effect: {} },
    ],
  },
  {
    type: 'random', id: 'em-guild-vote', title: '商会投票',
    description: '商会要表决一项政策——是否限制胡商在东市经营。你有一票。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '赞成限制', consequence: '胡商份额转出，但得罪西市势力。', effect: { reputation: 4 } },
      { id: 'b', label: '反对限制', consequence: '胡商承情，西市商路更顺。', effect: { reputation: 3 } },
      { id: 'c', label: '弃权', consequence: '两不得罪，也两不讨好。', effect: {} },
    ],
  },
  {
    type: 'random', id: 'em-old-shop-close', title: '老字号倒闭',
    description: '东市一家老字号经营不善要倒闭——它的客源与铺面可以接手。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '接手铺面（花 100 两）', consequence: '铺面到手，客源渐来；原店主心存芥蒂。', effect: { gold: -100, reputation: 8 } },
      { id: 'b', label: '只接客源（花 20 两打点）', consequence: '客源转来，不担铺面之累。', effect: { gold: -20, reputation: 4 } },
      { id: 'c', label: '不掺和', consequence: '君子不夺人所好。', effect: {} },
    ],
  },
];
