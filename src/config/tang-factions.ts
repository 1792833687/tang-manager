/**
 * 《我在唐朝当掌柜》名声关系网配置（TANG-SOC-001 模块五）
 * 长安五大势力逐字 + 特权阈值 20/40/60/80/100 + NPC 好感联动映射。
 * 纯数据，不依赖 store；systems/tang-factions.ts 消费本配置。
 */
import type { Faction, FactionPerk, NPCFavor } from '@/types/tang-factions';

/** 特权阈值档（五档，逐字） */
export const FACTION_PERK_THRESHOLDS = [20, 40, 60, 80, 100] as const;

/** 五势力配置（用户规格逐字：名称/首领/色） */
export const FIVE_FACTIONS: Faction[] = [
  {
    id: 'dongshi',
    name: '东市商会',
    type: 'guild',
    relationship: 20,
    description: '长安东市最大的行会，货源定价皆有其话事之权。',
    leader: '沈听澜',
    color: '#4A7C59', // 竹青
    perks: [
      { threshold: 20, name: '行会引荐', description: '东市商户见了名帖，愿与你互通有无。', effect: { type: 'supply', value: 0.05 } },
      { threshold: 40, name: '货源通融', description: '商会出面，紧俏货物分你一份。', effect: { type: 'supply', value: 0.1 } },
      { threshold: 60, name: '定价之权', description: '商会抬价，你家的货也跟着水涨船高。', effect: { type: 'price', value: 0.05 } },
      { threshold: 80, name: '龙头照拂', description: '沈听澜亲口照拂，东市无人敢欺。', effect: { type: 'protection', value: 0.2 } },
      { threshold: 100, name: '商会盟主', description: '商会上下以你马首是瞻，号令群商。', effect: { type: 'price', value: 0.1 } },
    ],
  },
  {
    id: 'xishi',
    name: '西市商团',
    type: 'commercial',
    relationship: 10,
    description: '胡商新兴的商团，专走西域稀货，路子野。',
    leader: '谢七',
    color: '#3B6FB6', // 蓝
    perks: [
      { threshold: 20, name: '胡商路子', description: '波斯邸的稀货，愿意赊你三分。', effect: { type: 'supply', value: 0.05 } },
      { threshold: 40, name: '驼队优先', description: '西市驼队到货，先紧着你的铺子挑。', effect: { type: 'supply', value: 0.1 } },
      { threshold: 60, name: '西域渠道', description: '西域珠宝香料，独此一家供你。', effect: { type: 'price', value: 0.05 } },
      { threshold: 80, name: '灰色人脉', description: '三教九流都买谢七的账，无人敢寻衅。', effect: { type: 'protection', value: 0.2 } },
      { threshold: 100, name: '商团盟主', description: '西市商团以你为尊，胡商争相来投。', effect: { type: 'price', value: 0.1 } },
    ],
  },
  {
    id: 'jingzhao',
    name: '京兆府',
    type: 'government',
    relationship: 20,
    description: '京兆府尹官吏，掌长安治安与官商照拂。',
    leader: '京兆府尹',
    color: '#C0392B', // 红
    perks: [
      { threshold: 20, name: '官面点头', description: '府衙差役见你，不再故意刁难。', effect: { type: 'protection', value: 0.1 } },
      { threshold: 40, name: '官单优先', description: '府衙采买，先记你家的名。', effect: { type: 'order', value: 0.1 } },
      { threshold: 60, name: '府尹照拂', description: '京兆府尹青眼有加，宵小不敢近门。', effect: { type: 'protection', value: 0.2 } },
      { threshold: 80, name: '官商一体', description: '官府庇佑，封条税吏皆绕道。', effect: { type: 'protection', value: 0.3 } },
      { threshold: 100, name: '府衙靠山', description: '京兆府上下为你撑腰，长安横着走。', effect: { type: 'protection', value: 0.5 } },
    ],
  },
  {
    id: 'underground',
    name: '地下势力',
    type: 'underground',
    relationship: 5,
    description: '赌场钱庄的暗股，灰色地带的执刀人。',
    leader: '神秘当家人',
    color: '#5B3A8E', // 暗紫
    perks: [
      { threshold: 20, name: '暗线消息', description: '市井传闻，先你一步知晓。', effect: { type: 'intel', value: 0.05 } },
      { threshold: 40, name: '钱庄暗股', description: '地下钱庄周转，利息低三分。', effect: { type: 'loan', value: 0.05 } },
      { threshold: 60, name: '打手护院', description: '有人闹事，自有人替你料理。', effect: { type: 'protection', value: 0.2 } },
      { threshold: 80, name: '赌场分红', description: '暗股分红，月月进账。', effect: { type: 'income', value: 0.1 } },
      { threshold: 100, name: '地下龙头', description: '长安灰色地带，你说了算。', effect: { type: 'income', value: 0.2 } },
    ],
  },
  {
    id: 'pingkang',
    name: '平康坊风月场',
    type: 'commercial',
    relationship: 10,
    description: '歌妓酒肆的幕后东家，消息灵通的销金窟。',
    leader: '坊主',
    color: '#D98BA6', // 桃粉
    perks: [
      { threshold: 20, name: '风月场入场', description: '平康坊的酒宴，愿请你赴席。', effect: { type: 'intel', value: 0.05 } },
      { threshold: 40, name: '贵客引荐', description: '歌妓酒肆的贵人，引到你铺子来。', effect: { type: 'guest', value: 0.1 } },
      { threshold: 60, name: '消息灵通', description: '酒肆歌馆的消息，快人一步。', effect: { type: 'intel', value: 0.1 } },
      { threshold: 80, name: '坊主照拂', description: '风月场主亲许，宴席用酒用布皆你家。', effect: { type: 'order', value: 0.2 } },
      { threshold: 100, name: '风月盟主', description: '平康坊的销金窟，任你往来。', effect: { type: 'guest', value: 0.2 } },
    ],
  },
];

/** 势力关系触发规则（模块五 6.1；纯映射：势力 id → 变动值） */
export const FACTION_TRIGGER_RULES: Record<string, Partial<Record<string, number>>> = {
  guild_task: { dongshi: 8 }, // 商会任务 +5~15（取中位 8，轻量）
  husi_trade: { xishi: 5 }, // 胡商交易 +3~8（取中位 5）
  tax_on_time: { jingzhao: 5 }, // 按时缴税 +5
  gray_means: { underground: 10, jingzhao: -10, dongshi: -5 }, // 灰色手段：地下+10 京兆-10 东市-5
  expose_rival: { dongshi: 10, xishi: -5 }, // 揭发同行：东市+10 西市-5
  guild_activity: { dongshi: 5 }, // 商会活动 +5
  government_fine: { jingzhao: -3 }, // 官府罚款 -3
};

/** NPC 好感联动映射（模块五 5.3；势力 id → 主理人/新增 NPC 好感） */
export const FACTION_NPC_MAP: Record<string, { npcId: string; npcName: string; stateKey: 'shenTinglanFavor' | 'xieQiFavor' | 'fuyinFavor' | 'zhaoYuanwaiFavor' }> = {
  dongshi: { npcId: 'shen-tinglan', npcName: '沈听澜', stateKey: 'shenTinglanFavor' },
  xishi: { npcId: 'xie-qi', npcName: '谢七', stateKey: 'xieQiFavor' },
  jingzhao: { npcId: 'fu-yin', npcName: '京兆府尹', stateKey: 'fuyinFavor' },
  pingkang: { npcId: 'zhao-yuanwai', npcName: '赵员外', stateKey: 'zhaoYuanwaiFavor' },
};

/** NPC 好感档位评语（按 favor：0/20/40/60/80） */
export function npcFavorVerdict(favor: number): string {
  if (favor >= 80) return '死党';
  if (favor >= 60) return '心腹';
  if (favor >= 40) return '熟络';
  if (favor >= 20) return '点头';
  return '陌路';
}

/** 由势力关系 + NPC 好感构建 NPCFavor 列表（store 初始化/刷新用） */
export function buildNpcFavors(
  favors: Record<'shenTinglanFavor' | 'xieQiFavor' | 'fuyinFavor' | 'zhaoYuanwaiFavor', number>
): NPCFavor[] {
  const entries = Object.values(FACTION_NPC_MAP);
  return entries.map((m) => {
    const favor = Math.min(100, Math.max(0, favors[m.stateKey] ?? 0));
    return {
      npcId: m.npcId,
      npcName: m.npcName,
      favor,
      factionId: Object.keys(FACTION_NPC_MAP).find((k) => FACTION_NPC_MAP[k]!.npcId === m.npcId),
      relationship: npcFavorVerdict(favor),
      unlockedPerks: FIVE_FACTIONS.flatMap((f) =>
        f.id === Object.keys(FACTION_NPC_MAP).find((k) => FACTION_NPC_MAP[k]!.npcId === m.npcId)
          ? f.perks.filter((p) => favor >= p.threshold).map((p) => p.name)
          : []
      ),
    };
  });
}

/** 势力关系评语（按 relationship：0/20/40/60/80） */
export function factionVerdict(relationship: number): string {
  if (relationship >= 80) return '生死之交';
  if (relationship >= 60) return '推心置腹';
  if (relationship >= 40) return '相交莫逆';
  if (relationship >= 20) return '初有来往';
  return '素不相识';
}

/** 查找势力（按 id；兜底东市商会） */
export function factionById(id: string): Faction {
  return FIVE_FACTIONS.find((f) => f.id === id) ?? FIVE_FACTIONS[0]!;
}

/** 按阈值过滤已解锁特权 */
export function perksUnlocked(faction: Faction): FactionPerk[] {
  return faction.perks.filter((p) => faction.relationship >= p.threshold);
}
