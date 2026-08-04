/**
 * 《我在唐朝当掌柜》手札占候配置（TANG-ADD-001 模块一）
 * 占候："占候：先祖在手札中留下的卜筮之术，每日清晨翻看手札，自会浮现当日卦象与判词，指引一日经营。"
 * 八卦逐字：泰卦 大吉 收益×1.15 / 谦卦 平稳 无效果 / 震卦 波动 客消±20% / 巽卦 顺风 进货×0.9 /
 * 坎卦 坎坷 事件概率×2 / 离卦 火爆 大单+30% / 艮卦 阻滞 耐心下降×2 / 兑卦 口福 夸奖+20%。
 * 纯数据，不依赖 store；效果应用纯函数在 systems/tang-hexagram.ts。
 */
import type { Hexagram } from '@/types/tang-manager';

/** 八卦全量（顺序即占候抽取顺序；id 用于存档/测试） */
export const HEXAGRAMS: readonly Hexagram[] = [
  {
    id: 'tai',
    name: '泰',
    judgment: '大吉',
    effect: { type: 'income_multiplier', value: 1.15 },
    description: '天地交而万物通，上下交而其志同。今日诸事顺遂，进账自当丰盈。',
    tagColor: '#d4af37',
  },
  {
    id: 'qian',
    name: '谦',
    judgment: '平稳',
    effect: { type: 'none', value: 0 },
    description: '谦谦君子，卑以自牧。今日无惊无喜，守成即是福。',
    tagColor: '#9ca3af',
  },
  {
    id: 'zhen',
    name: '震',
    judgment: '波动',
    effect: { type: 'guest_random', value: 0.2 },
    description: '震来虩虩，笑言哑哑。客源如潮起潮落，盈亏皆在须臾。',
    tagColor: '#f59e0b',
  },
  {
    id: 'xun',
    name: '巽',
    judgment: '顺风',
    effect: { type: 'cost_reduction', value: 0.9 },
    description: '随风巽，君子以申命行事。采买进货皆遇顺风，价低三分。',
    tagColor: '#10b981',
  },
  {
    id: 'kan',
    name: '坎',
    judgment: '坎坷',
    effect: { type: 'event_double', value: 2 },
    description: '习坎，重险也。今日暗流涌动，奇事怪闻怕是要接二连三。',
    tagColor: '#ef4444',
  },
  {
    id: 'li',
    name: '离',
    judgment: '火爆',
    effect: { type: 'big_order_bonus', value: 0.3 },
    description: '离，丽也。火德当空，贵客盈门，大单生意格外红火。',
    tagColor: '#c0392b',
  },
  {
    id: 'gen',
    name: '艮',
    judgment: '阻滞',
    effect: { type: 'patience_decay_double', value: 2 },
    description: '艮其背，不获其身。诸事易滞，客人等得焦躁，切莫久候。',
    tagColor: '#7f1d1d',
  },
  {
    id: 'dui',
    name: '兑',
    judgment: '口福',
    effect: { type: 'praise_bonus', value: 0.2 },
    description: '兑，说也。口舌生辉，宾主尽欢，夸奖之声不绝于耳。',
    tagColor: '#0f766e',
  },
];

/** id → 卦象 索引（查表用） */
export const HEXAGRAM_MAP: Readonly<Record<string, Hexagram>> = Object.fromEntries(
  HEXAGRAMS.map((h) => [h.id, h])
);

/** 卦象查询（id → 定义；不存在返回 null） */
export function hexagramById(id: string): Hexagram | null {
  return HEXAGRAM_MAP[id] ?? null;
}
