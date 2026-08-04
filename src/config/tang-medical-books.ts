/**
 * 《我在唐朝当掌柜》医书配置（2026-08-06 · 规格书模块二 2.2）
 * 药铺坐诊：购买医书提升 medicalKnowledge（0-3 级），解锁病症范围并降低症状提示模糊度。
 * 纯数据，不依赖 store。
 */
export interface MedicalBook {
  id: string;
  name: string;
  /** 价格（两） */
  price: number;
  /** 知识点数（千金方 +2，其余 +1；等级按拥有本数另算） */
  knowledgeGain: number;
  /** 解锁病症类型 */
  unlocks: string[];
  description: string;
}

/** 医书全量（规格书 2.2 逐字） */
export const MEDICAL_BOOKS: readonly MedicalBook[] = [
  { id: 'shanghan', name: '《伤寒论》残卷', price: 80, knowledgeGain: 1, unlocks: ['风寒', '发热'], description: '医圣张仲景所著，虽为残卷，读之可通伤寒之理。' },
  { id: 'jinkui', name: '《金匮要略》抄本', price: 120, knowledgeGain: 1, unlocks: ['虚劳', '水肿'], description: '内科杂病之经典，抄本虽偶有讹误，仍不失为良师。' },
  { id: 'bencao', name: '《本草拾遗》', price: 150, knowledgeGain: 1, unlocks: ['精准提示'], description: '药王孙思邈遗作，详述数百种药材性味归经。读后辨药之能大增。' },
  { id: 'zhenjiu', name: '《针灸甲乙经》', price: 200, knowledgeGain: 1, unlocks: ['脉诊'], description: '皇甫谧所撰针灸专著，习之可通经络之理。' },
  { id: 'qianjin', name: '《千金方》手抄', price: 300, knowledgeGain: 2, unlocks: ['全部'], description: '药王毕生心血，千金不易。得此一书，可称良医。' },
];

export const MEDICAL_BOOK_MAP: Readonly<Record<string, MedicalBook>> = Object.fromEntries(
  MEDICAL_BOOKS.map((b) => [b.id, b])
);

/** 知识等级（0-3）：按拥有本数：0→Lv0 / 1-2→Lv1 / 3-4→Lv2 / 5→Lv3（规格书 2.2 表） */
export function medicalKnowledgeLevel(ownedBooks: readonly string[] | undefined): number {
  const count = ownedBooks?.length ?? 0;
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  return 3;
}

/** 各等级诊治范围标签 */
export const MEDICAL_LEVEL_LABEL: Record<number, string> = {
  0: '常见病症（风寒/外伤/消化不良）',
  1: '+内科病症（失眠/心悸/胃痛）',
  2: '+疑难杂症（痹症/消渴/怔忡）',
  3: '+罕见病症（疫病/中毒/内伤）',
};
