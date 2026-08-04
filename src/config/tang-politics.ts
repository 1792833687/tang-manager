/**
 * 《我在唐朝当掌柜》巍明楼政治配置（Step 5b-5 模块三）
 * 巍明楼："巍明楼：皇城根下的权力中枢，朝廷政令、派系党争皆出于此。声望够高方可踏足。"
 * 六派系扩展（用户 3.3 逐字）：在原五势力（东市/西市/京兆/地下/平康）基础上加「朝廷派系」，
 * 含三子派：保守派 / 开明派 / 宦官派。政治派系数据独立成 config（不动 tang-factions 的
 * FIVE_FACTIONS，避免影响既有名声关系网面板与 tang-factions 测试基线，注释）。
 * 政令池（用户 3.2 逐字）：税收±20% / 宵禁客流-20% / 互市进货-15% / 禁私走私风险翻倍 /
 * 皇商招标（信用≥700 参与）/ 清查账目（偷税罚款）；持续 30 天。
 * 纯数据，不依赖 store；systems/tang-politics.ts 消费本配置。
 */
import type { Faction } from '@/types/tang-factions';

/** 朝廷子派系 id：保守派 / 开明派 / 宦官派 */
export type PoliticalSubFactionId = 'conservative' | 'reformist' | 'eunuch';

/** 朝廷子派系定义 */
export interface PoliticalSubFactionDef {
  id: PoliticalSubFactionId;
  name: string;
  /** 立场一句话（古风） */
  description: string;
  /** 代表色 */
  color: string;
  /** 支持本派系后的特殊效果（用户 3.3 逐字） */
  perk: { name: string; description: string };
}

/** 朝廷派系（六系之第六；relationship 即「支持派系」值 0-100） */
export const COURT_FACTION: Faction = {
  id: 'court',
  name: '朝廷派系',
  type: 'court',
  relationship: 0,
  description: '皇城根下的权力中枢，朝廷政令、派系党争皆出于此。声望够高方可踏足。',
  leader: '圣上',
  color: '#8C3B2E',
  perks: [
    { threshold: 20, name: '官面引路', description: '朝中有人，官单采买先递到你手上。', effect: { type: 'order', value: 0.1 } },
    { threshold: 40, name: '政令先知', description: '政令未出宫门，你已先得风声。', effect: { type: 'intel', value: 0.1 } },
    { threshold: 60, name: '派系照拂', description: '朝中党争，有人替你挡灾。', effect: { type: 'protection', value: 0.2 } },
    { threshold: 80, name: '皇商之门', description: '皇商招标，你有了入场的资格。', effect: { type: 'order', value: 0.2 } },
    { threshold: 100, name: '权倾朝野', description: '朝堂之上，有你一席之地。', effect: { type: 'power', value: 0.3 } },
  ],
};

/** 三子派逐字（用户 3.3） */
export const POLITICAL_SUB_FACTIONS: readonly PoliticalSubFactionDef[] = [
  {
    id: 'conservative',
    name: '保守派',
    description: '循祖制、守成规，重农抑商；支持则官单优先，然商税随之加重。',
    color: '#6E5A3A',
    perk: { name: '官单优先', description: '保守派掌权，官府采买先记你家的名；然商税加征，利润被削去一成。' },
  },
  {
    id: 'reformist',
    name: '开明派',
    description: '倡通商、减税赋，扶持商贾；支持则商税得减，然每季须向派系上贡。',
    color: '#2E6FB7',
    perk: { name: '减税通商', description: '开明派掌权，商税减免一成；然每季须向派系上贡银两。' },
  },
  {
    id: 'eunuch',
    name: '宦官派',
    description: '掌内廷、通关节，可绕官府；支持则盘查豁免，然声名受损。',
    color: '#5B3A8E',
    perk: { name: '绕过官府', description: '宦官派掌权，官府盘查可通融；然朝野侧目，声望折损。' },
  },
];

/** 政令类型：税收 / 宵禁 / 互市 / 禁私 / 皇商招标 / 清查账目 */
export type DecreeType = 'tax' | 'curfew' | 'mutual_market' | 'smuggle' | 'imperial_bid' | 'audit';

/** 政令模板（用户 3.2 逐字；value 按类型语义） */
export interface DecreeTemplate {
  type: DecreeType;
  name: string;
  description: string;
  /** tax ±0.2 / curfew -0.2 / mutual_market -0.15 / smuggle 2 / imperial_bid 700 / audit 1 */
  value?: number;
}

/** 政令池（用户 3.2 逐字；每月初随机 1 条） */
export const DECREE_POOL: readonly DecreeTemplate[] = [
  { type: 'tax', name: '加征商税', description: '朝廷加征商税两成，买卖成本水涨船高。', value: 0.2 },
  { type: 'tax', name: '减免商税', description: '圣上开恩，减免商税两成，生意好做了些。', value: -0.2 },
  { type: 'curfew', name: '宵禁', description: '宵禁期间坊门紧闭，客流减两成。', value: -0.2 },
  { type: 'mutual_market', name: '互市收紧', description: '互市监管收紧，进货成本增一成五。', value: -0.15 },
  { type: 'smuggle', name: '禁私令', description: '严查私盐私货，走私风险翻倍。', value: 2 },
  { type: 'imperial_bid', name: '皇商招标', description: '朝廷招标皇商，信用≥700 者可参与。', value: 700 },
  { type: 'audit', name: '清查账目', description: '御史清查商税账目，偷税漏税者重罚。', value: 1 },
];

/** 政令查询（type → 模板） */
export const DECREE_TEMPLATE_MAP: Readonly<Record<DecreeType, DecreeTemplate>> = Object.fromEntries(
  DECREE_POOL.map((d) => [d.type, d])
) as Record<DecreeType, DecreeTemplate>;
