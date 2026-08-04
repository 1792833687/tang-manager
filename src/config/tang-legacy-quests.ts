/**
 * 《我在唐朝当掌柜》陆家遗命配置（TANG-ADD-001 模块四）
 * 遗命："遗命：陆氏先祖未竟之愿，浮现于手札之上。完成可得先祖福荫，或解锁隐藏故事。"
 * 4 遗命逐字：赎回西市分号 金5000+声望400 →解锁西市店+祖传招牌+nextQuest /
 * 寻找波斯故人 西市关系60+线索persian_jade →特殊路线+稀有货 /
 * 城外旧契 地图节点sang_yuan →丝绸自产 /
 * 三年之约 day90+破产0 →沈听澜自动邀+声望100。
 * 纯数据，不依赖 store；触发/完成纯函数在 systems/tang-legacy-quests.ts。
 */
import type { LegacyQuest } from '@/types/tang-manager';

/** 陆家遗命全量（顺序即前置链；nextQuest 指向下一遗命 id） */
export const LEGACY_QUESTS: readonly LegacyQuest[] = [
  {
    id: 'legacy-west-shop',
    title: '赎回西市分号',
    goal: '凑足五千两现银、攒下四百点声望，把先祖典当出去的西市分号赎回来。',
    condition: { minSilver: 5000, minReputation: 400 },
    reward: { unlockShop: true, unlockSign: true },
    nextQuest: 'legacy-persian',
    narrative:
      '你捧着手札，一字一句读完先祖的遗命，心中五味杂陈。西市那座挂着「陆记」老匾的分号，是先祖起家的根基——如今，该由你亲手赎回来了。',
  },
  {
    id: 'legacy-persian',
    title: '寻找波斯故人',
    goal: '与西市商团交好（关系≥60），并循着「波斯古玉」的线索，寻访先祖当年的波斯故人。',
    condition: { minFactionRelationship: 60, requiredClue: 'persian_jade', requiresQuest: 'legacy-west-shop' },
    reward: { specialRoute: true, rareGoods: true },
    narrative:
      '手札夹层里露出一角羊皮纸，写着一串弯弯曲曲的胡文。先祖当年与波斯客商立下盟约，如今那人的后人，仍在西市候着信物。',
  },
  {
    id: 'legacy-sang-yuan',
    title: '城外旧契',
    goal: '前往城外桑园（舆图节点 sang_yuan），寻回先祖遗留的桑田旧契。',
    condition: { requiredNode: 'sang_yuan', requiresQuest: 'legacy-persian' },
    reward: { silkSelfProduce: true },
    narrative:
      '先祖在城郊留了一片桑田，契书压在老箱底。有了它，陆记的丝绸便能自种自织，再不受布商掣肘。',
  },
  {
    id: 'legacy-three-years',
    title: '三年之约',
    goal: '经营满九十日，且从未破产，赴沈听澜的三载之约。',
    condition: { minDay: 90, requireNoBankruptcy: true, requiresQuest: 'legacy-sang-yuan' },
    reward: { shenInvite: true, reputation: 100 },
    narrative:
      '手札末页，先祖写道：「若吾孙能撑过三载，沈氏自会前来履约。」九十日寒暑已过，门外果然响起了沈听澜的叩门声。',
  },
];

/** id → 遗命 索引 */
export const LEGACY_QUEST_MAP: Readonly<Record<string, LegacyQuest>> = Object.fromEntries(
  LEGACY_QUESTS.map((q) => [q.id, q])
);

/** 遗命查询（id → 定义；不存在返回 null） */
export function legacyQuestById(id: string): LegacyQuest | null {
  return LEGACY_QUEST_MAP[id] ?? null;
}
