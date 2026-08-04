/**
 * 《我在唐朝当掌柜》员工主动问候 / 打烊报告（店员互动提升 模块四）
 * - startNewDay：随机 1 位在岗员工向掌柜问候（每日开篇画面展示）
 * - settleDay：随机 1 位员工报告今日见闻（按满意度分积极/中性/消极）
 * 纯函数：rng 可注入；内容按员工性格与当日卦象微调。
 */
import type { EmployeeType } from '@/types/tang-manager';

/** 在岗员工摘要（pick 输入） */
export interface StaffDailyInput {
  employees: Array<{ id: string; name: string; type: EmployeeType; satisfaction: number }>;
  /** 阿昭满意度（阿昭常驻） */
  xiaoerSatisfaction: number;
  /** 今日卦象（可选，微调问候） */
  hexagram?: string | null;
}

/** 问候内容池（4.1；按员工类型） */
const GREETING_POOL: Record<EmployeeType | 'a_zhao', string[]> = {
  a_zhao: [
    '掌柜的早！灶上的水已经烧好了——今儿个又是好日子。',
    '早啊掌柜的！门板我擦得锃亮，就等客官上门了。',
  ],
  waiter: [
    '掌柜的早！堂前我都收拾利索了，随时能开张。',
    '早啊掌柜的，桌椅碗筷都备齐了。',
  ],
  accountant: [
    '东家早。昨日的账已核完——这是今月的收支预估。',
    '东家早，今日账册已备好，收支一目了然。',
  ],
  chef: [
    '掌柜的，今早市集上的羊肉特别新鲜——我多进了几斤。',
    '掌柜的早！灶上汤已吊好，客官进门就能上菜。',
  ],
  tailor: [
    '东家，昨儿赶工的那件锦袍做好了——就挂在里间。',
    '东家早，新裁的样衣已挂上，就等识货的客人。',
  ],
  pharmacist: [
    '掌柜的，新到的那批当归成色极好——要不要写个方子推荐给老主顾？',
    '掌柜的早，药材我已分拣妥当，坐堂可随时开诊。',
  ],
  guard: [
    '东家早。昨儿巡夜无事——坊里最近太平。',
    '东家早，前后门都查过了，无甚异常。',
  ],
};

/** 打烊报告池（4.2；按满意度分档） */
const REPORT_POOL: Record<'positive' | 'neutral' | 'negative', string[]> = {
  positive: [
    '今天那位客人走的时候夸了咱家好几句——我这心里也熨帖。',
    '今日宾客盈门，好几个都是回头客，掌柜的经营有道。',
    '今儿个虽累，但客人个个满意而归——值了。',
  ],
  neutral: [
    '今儿个一切照常，没什么特别的事。',
    '今日无甚波澜，一切按部就班。',
    '和往常一样，客来客往，账目清楚。',
  ],
  negative: [
    '（欲言又止）掌柜的……今日有位客官对咱家颇有微词，我没敢多应。',
    '（闷声）今儿个有位客官嫌咱家东西贵，甩脸走了。',
    '（低头擦着柜台）掌柜的，这几日店里冷清，我心里也不踏实。',
  ],
};

function pick<T>(arr: readonly T[], rng: () => number): T {
  const idx = Math.floor(rng() * arr.length);
  return arr[Math.min(idx, arr.length - 1)]!;
}

/** 候选员工列表（阿昭 + 在岗员工；纯函数） */
export function staffCandidates(input: StaffDailyInput): Array<{ id: string; name: string; type: EmployeeType | 'a_zhao'; satisfaction: number }> {
  return [
    { id: 'a_zhao', name: '阿昭', type: 'a_zhao', satisfaction: input.xiaoerSatisfaction },
    ...input.employees.map((e) => ({ id: e.id, name: e.name, type: e.type as EmployeeType | 'a_zhao', satisfaction: e.satisfaction })),
  ];
}

/** 随机一位在岗员工问候（纯函数；按卦象微调措辞） */
export function pickStaffGreeting(input: StaffDailyInput, rng: () => number = Math.random): { staffId: string; staffName: string; content: string } | null {
  const cands = staffCandidates(input);
  if (cands.length === 0) return null;
  const who = pick(cands, rng);
  const pool = GREETING_POOL[who.type];
  let content = pick(pool, rng);
  // 卦象微调（4.1：按性格与当日卦象）
  if (input.hexagram === 'kan') content += '（今日卦象坎坷，大家伙儿都留个心眼。）';
  else if (input.hexagram === 'li') content += '（今日卦象火爆，宜大干一场！）';
  return { staffId: who.type, staffName: who.name, content };
}

/** 满意度分档（纯函数） */
export function reportBand(satisfaction: number): 'positive' | 'neutral' | 'negative' {
  if (satisfaction >= 80) return 'positive';
  if (satisfaction >= 40) return 'neutral';
  return 'negative';
}

/** 随机一位员工打烊报告（纯函数；按满意度分档；<40 可能沉默） */
export function pickStaffReport(input: StaffDailyInput, rng: () => number = Math.random): { staffId: string; staffName: string; content: string; band: 'positive' | 'neutral' | 'negative' } | null {
  const cands = staffCandidates(input).filter((c) => c.id !== 'a_zhao' || input.xiaoerSatisfaction >= 0);
  if (cands.length === 0) return null;
  const who = pick(cands, rng);
  const band = reportBand(who.satisfaction);
  // <40 有 30% 概率沉默（消极或沉默）
  if (band === 'negative' && rng() < 0.3) return null;
  const content = pick(REPORT_POOL[band], rng);
  return { staffId: who.type, staffName: who.name, content, band };
}
