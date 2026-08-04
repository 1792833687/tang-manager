/**
 * 《我在唐朝当掌柜》官场线·政务抉择（P1-2026-08-05 转政最小闭环）
 * 进入 phase='politics' 后，每日一道政务（共 5 道），抉择影响声望/评分/政治立场；
 * 5 道尽办 → 权倾朝野结局。选项遵循「A 秉公长期 / B 圆滑 / C 私利有代价」。
 */
export interface PoliticsDecisionChoice {
  id: string;
  label: string;
  consequence: string;
  effect: { reputation?: number; score?: number; alignmentDelta?: number };
}

export interface PoliticsDecision {
  id: string;
  title: string;
  description: string;
  choices: PoliticsDecisionChoice[];
}

export const POLITICS_DECISIONS: PoliticsDecision[] = [
  {
    id: 'pol-caoyun', title: '漕运决案',
    description: '漕运衙门递来折子：今岁运河淤塞，军粮与商货争道。你如何决断？',
    choices: [
      { id: 'a', label: '先军后商，令商货改道', consequence: '军粮无虞，商路略损，朝中赞你持重。', effect: { reputation: 8, alignmentDelta: 2 } },
      { id: 'b', label: '官商各半，分段放行', consequence: '两头不误，两头不讨好。', effect: { reputation: 2 } },
      { id: 'c', label: '放商货先行，暗收过路银', consequence: '银子入袋，军粮迟了三日。', effect: { reputation: -6, alignmentDelta: -2 } },
    ],
  },
  {
    id: 'pol-faction', title: '党争站队',
    description: '朝中两派相争，都遣人来探你口风——这站队，一步错步步错。',
    choices: [
      { id: 'a', label: '上折直陈利弊，不偏不倚', consequence: '以理服人，两派都挑不出错。', effect: { reputation: 6, alignmentDelta: 1 } },
      { id: 'b', label: '含糊其辞，左右周旋', consequence: '谁也拿不住你，但谁也没把你当自己人。', effect: { reputation: 1 } },
      { id: 'c', label: '攀附当权者', consequence: '升得快，也跌得险。', effect: { reputation: -4, alignmentDelta: 3 } },
    ],
  },
  {
    id: 'pol-border', title: '边军粮草',
    description: '边关急报：军粮短缺，府库空虚。你掌着调拨之权——',
    choices: [
      { id: 'a', label: '足额调拨，绝不克扣', consequence: '边军感激，朝廷倚重。', effect: { reputation: 10, score: 0.02 } },
      { id: 'b', label: '按七成拨付，余者缓办', consequence: '折中处置，两边都有话说。', effect: { reputation: 2 } },
      { id: 'c', label: '以次充好，中饱私囊', consequence: '银子肥了，边关苦了。', effect: { reputation: -8, alignmentDelta: -2 } },
    ],
  },
  {
    id: 'pol-tax', title: '商税新政',
    description: '户部拟议商税新政：轻徭薄赋，还是加征充库？你曾为商贾，最知其中甘苦。',
    choices: [
      { id: 'a', label: '轻徭薄赋，休养生息', consequence: '市井称颂，商旅复来。', effect: { reputation: 8, score: 0.03 } },
      { id: 'b', label: '维持旧制，不动为好', consequence: '四平八稳，无功无过。', effect: {} },
      { id: 'c', label: '加征商税以充府库', consequence: '库银充盈，怨声载道。', effect: { reputation: -6 } },
    ],
  },
  {
    id: 'pol-huangshang', title: '皇商招标',
    description: '宫中采买需定皇商——数家商号递了厚礼，等着你点头。',
    choices: [
      { id: 'a', label: '秉公择价廉质优者', consequence: '宫中省了银子，商贾心服。', effect: { reputation: 8, alignmentDelta: 1 } },
      { id: 'b', label: '择与你有旧交情者', consequence: '人情到了，物议四起。', effect: { reputation: -2, score: 0.01 } },
      { id: 'c', label: '暗收重礼，内定人选', consequence: '银子入袋，把柄落人。', effect: { reputation: -8 } },
    ],
  },
];
