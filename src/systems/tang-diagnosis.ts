/**
 * 《我在唐朝当掌柜》药铺坐诊系统（2026-08-06 · 规格书模块二 2.3）
 * 纯函数：症状 → 正确诊断 → 模糊提示（随知识等级变化）→ 药方匹配度判定。
 * 全部 rng 可注入（默认 Math.random）；不持有状态。
 */
import { medicalKnowledgeLevel } from '@/config/tang-medical-books';

/** 病症定义（范围：common 常见 / internal 内科 / hard 疑难 / rare 罕见） */
export interface Diagnosis {
  id: string;
  name: string;
  /** 症状描述（客人口述） */
  symptoms: string;
  /** 正确药方（所需主/辅药材 id 列表） */
  requiredHerbs: string[];
  /** 药方名 */
  prescription: string;
  /** 所需知识等级（0-3） */
  minLevel: number;
  /** 精确脉案（Lv3 提示用） */
  precise: string;
}

/** 病症池（覆盖四个诊治范围） */
export const DIAGNOSES: readonly Diagnosis[] = [
  { id: 'feng_han', name: '风寒', symptoms: '恶寒发热，头项强痛，鼻塞流清涕', requiredHerbs: ['mahuang', 'guizhi'], prescription: '麻黄汤', minLevel: 0, precise: '脉浮紧而数，舌淡红，苔薄白微腻，无汗咳喘——麻黄汤证，宜麻黄、桂枝、杏仁、炙甘草。' },
  { id: 'wai_shang', name: '外伤', symptoms: '皮破血流，疼痛不止', requiredHerbs: ['sanqi', 'baiji'], prescription: '金疮药', minLevel: 0, precise: '伤口深可见骨，血色鲜红——金疮药合三七粉外敷内服。' },
  { id: 'xiaohua', name: '消化不良', symptoms: '脘腹胀满，嗳气泛酸，不思饮食', requiredHerbs: ['shanzha', 'shenqu'], prescription: '保和丸', minLevel: 0, precise: '脉滑，舌苔厚腻——食积中焦，宜保和丸消食导滞。' },
  { id: 'shimian', name: '失眠', symptoms: '夜不能寐，多梦易醒，心悸健忘', requiredHerbs: ['suanzaoren', 'fuling'], prescription: '酸枣仁汤', minLevel: 1, precise: '脉弦细，舌红少苔——肝血不足，宜酸枣仁汤养心安神。' },
  { id: 'xinji', name: '心悸', symptoms: '心中悸动不安，动辄尤甚，气短乏力', requiredHerbs: ['zhigancao', 'guizhi'], prescription: '炙甘草汤', minLevel: 1, precise: '脉结代，心动悸——炙甘草汤益气复脉。' },
  { id: 'weitung', name: '胃痛', symptoms: '胃脘冷痛，喜温喜按，得食则缓', requiredHerbs: ['renshen', 'ganjiang'], prescription: '理中汤', minLevel: 1, precise: '脉沉迟，舌淡苔白——中焦虚寒，宜理中汤温中散寒。' },
  { id: 'bi_zheng', name: '痹症', symptoms: '关节游走疼痛，遇寒加重，屈伸不利', requiredHerbs: ['duhuo', 'sangjisheng'], prescription: '独活寄生汤', minLevel: 2, precise: '脉弦紧，舌淡苔白腻——风寒湿痹，宜独活寄生汤祛风除湿。' },
  { id: 'xiaoke', name: '消渴', symptoms: '口渴多饮，多食易饥，尿频消瘦', requiredHerbs: ['shudihuang', 'shanyao'], prescription: '六味地黄丸', minLevel: 2, precise: '脉细数，舌红少津——阴虚燥热，宜六味地黄丸滋阴补肾。' },
  { id: 'zheng_chong', name: '怔忡', symptoms: '心胸躁动不安，时作时止，入夜尤甚', requiredHerbs: ['yuanzhi', 'suanzaoren'], prescription: '天王补心丹', minLevel: 2, precise: '脉细弱，舌红少苔——心阴不足，宜天王补心丹滋阴养心。' },
  { id: 'yi_bing', name: '疫病', symptoms: '壮热烦躁，口渴引饮，斑疹隐隐', requiredHerbs: ['shigao', 'zhimu'], prescription: '清瘟败毒饮', minLevel: 3, precise: '脉洪大，舌绛苔黄燥——气分热盛，宜清瘟败毒饮清热泻火。' },
  { id: 'zhong_du', name: '中毒', symptoms: '恶心呕吐，腹痛腹泻，四肢麻木', requiredHerbs: ['gancao', 'lvdou'], prescription: '甘草解毒汤', minLevel: 3, precise: '脉数而乱——毒邪入里，宜甘草绿豆解毒。' },
  { id: 'nei_shang', name: '内伤', symptoms: '神疲乏力，语声低微，气短自汗', requiredHerbs: ['huangqi', 'baizhu'], prescription: '补中益气汤', minLevel: 3, precise: '脉虚弱，舌淡苔白——中气下陷，宜补中益气汤升阳举陷。' },
];

/** 药材显示名（诊断面板用） */
export const HERB_LABELS: Record<string, string> = {
  mahuang: '麻黄', guizhi: '桂枝', xingren: '杏仁', zhigancao: '炙甘草',
  sanqi: '三七', baiji: '白及', shanzha: '山楂', shenqu: '神曲',
  suanzaoren: '酸枣仁', fuling: '茯苓', renshen: '人参', ganjiang: '干姜',
  duhuo: '独活', sangjisheng: '桑寄生', shudihuang: '熟地黄', shanyao: '山药',
  yuanzhi: '远志', shigao: '石膏', zhimu: '知母', gancao: '甘草', lvdou: '绿豆',
  huangqi: '黄芪', baizhu: '白术',
};
export function herbName(id: string): string {
  return HERB_LABELS[id] ?? id;
}

export const DIAGNOSIS_MAP: Readonly<Record<string, Diagnosis>> = Object.fromEntries(
  DIAGNOSES.map((d) => [d.id, d])
);

/** 症状 → 正确诊断（纯函数） */
export function matchDiagnosis(symptoms: string): Diagnosis | null {
  return DIAGNOSES.find((d) => d.symptoms === symptoms) ?? null;
}

/** 各等级模糊提示模板 */
const HINT_TEMPLATES: Record<number, (d: Diagnosis) => string[]> = {
  0: (d) => [
    `此人脉象浮紧，舌苔薄白——似有寒邪入体。具体是何症，还需斟酌。`,
    `观其面色，十有八九是${d.name}一类的病候，但也不排除别的。`,
  ],
  1: (d) => [`此人症状指向${d.name}。脉象、舌象略有印证，宜以${d.prescription}的思路诊治。`],
  2: (d) => [`脉${d.precise.slice(0, 8)}……此乃${d.name}。需对症下药，方见其效。`],
  3: (d) => [d.precise],
};

/** 各等级误导项池（等级越高误导越少） */
const FALSE_HINT_POOL: readonly string[] = [
  '可能只是劳累过度，歇两日便好。',
  '怕是风热犯肺，宜清宣肺热。',
  '似有湿热内蕴，需清热利湿。',
  '恐是气血两虚，当补气养血。',
  '或许是旧伤复发，活血化瘀为上。',
];

/**
 * 生成症状模糊提示（纯函数；规格书 2.3）。
 * 返回：hints（正确提示 + 误导项，已洗牌）+ correctDiagnosis id。
 */
export function generateSymptomHints(
  symptoms: string,
  ownedBooks: readonly string[] | undefined,
  rng: () => number = Math.random
): { hints: string[]; correctDiagnosis: string | null } {
  const knowledge = medicalKnowledgeLevel(ownedBooks);
  const correct = matchDiagnosis(symptoms);
  const baseHints = correct ? (HINT_TEMPLATES[knowledge]?.(correct) ?? []) : ['症状似是而非，一时难以断定。'];
  // 误导项数量：Lv0=2 / Lv1=1 / Lv2=1 / Lv3=0
  const falseCount = knowledge >= 3 ? 0 : knowledge >= 1 ? 1 : 2;
  const pool = [...FALSE_HINT_POOL];
  const falseHints: string[] = [];
  for (let i = 0; i < falseCount && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    falseHints.push(pool.splice(idx, 1)[0]!);
  }
  const all = [...baseHints, ...falseHints];
  // 洗牌
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = all[i]!;
    all[i] = all[j]!;
    all[j] = tmp;
  }
  return { hints: all, correctDiagnosis: correct?.id ?? null };
}

/** 药方匹配度（0-100；规格书 2.3）：基础匹配 + 知识加成（Lv≥2 每级 +10） */
export function evaluatePrescription(
  selectedHerbs: readonly string[],
  correctDiagnosis: Diagnosis | null,
  ownedBooks: readonly string[] | undefined
): number {
  if (!correctDiagnosis) return 0;
  const required = correctDiagnosis.requiredHerbs;
  if (required.length === 0) return 100;
  const selected = new Set(selectedHerbs);
  const matched = required.filter((h) => selected.has(h)).length;
  const baseMatch = (matched / required.length) * 100;
  const knowledge = medicalKnowledgeLevel(ownedBooks);
  const knowledgeBonus = Math.max(0, knowledge - 1) * 10;
  return Math.min(100, Math.round(baseMatch + knowledgeBonus));
}

/** 匹配度档位（规格书 2.3）：≥80 显著 / 50-79 一般 / <50 不佳 */
export function matchTier(match: number): 'great' | 'ok' | 'poor' {
  if (match >= 80) return 'great';
  if (match >= 50) return 'ok';
  return 'poor';
}
