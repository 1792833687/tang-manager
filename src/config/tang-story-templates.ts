/**
 * 《我在唐朝当掌柜》事件故事弹窗叙事模板池（模块四 4.3）
 * 每种事件类型预设 ≥3 套叙事；AI 不可用时随机抽取兜底。
 * 占位符：{title} 事件名 / {description} 事件描述。
 */
import type { StoryNarrative } from '@/types/tang-dialogue';

/** 事件叙事模板（按事件类型分类；每类 ≥3 套） */
export const STORY_TEMPLATES: Record<string, string[]> = {
  debt_collection: [
    '（门外传来急促的脚步声，{title}的债主带着伙计堵在门口。堂里的客人纷纷侧目，气氛一时凝滞。你定了定神，迎上前去。）',
    '（账本上那笔{title}又到了日子。债主敲着算盘，神色不善。你赔着笑脸，心里盘算着对策。）',
    '（{title}上门讨债，街坊们探头探脑。你压低了声音，好说歹说，先把人请进了后院。）',
  ],
  regular_customer: [
    '（{title}推门进来，熟门熟路地寻了老位子坐下。阿昭笑着迎上去：' + "'您可有些日子没来了。'）",
    '（老主顾{title}又来了，还带了一位新客。他拍着胸脯说：' + "'这家的东西，我信得过。'）",
    '（{title}如约而至，寒暄几句便入了正题。你心下一暖——这年头，肯回头的人不多了。）',
  ],
  shen_tinglan: [
    '（一顶青帷小轿停在门前，{title}摇着折扇款款而入。他目光如电，在货架上扫了一圈，微微一笑。）',
    '（{title}负手立在堂中，周身气度不凡。他开口便是生意，却句句藏着机锋。）',
    '（{title}来了，店里的空气都静了三分。他示意随从退下，单独与你说话。）',
  ],
  xie_qi: [
    '（{title}趿着鞋晃进店里，嘴里叼着根草茎，笑嘻嘻地摸出一枚骰子：' + "'掌柜的，玩一把？'）",
    '（{title}来了，带着一身市井气。他凑近压低声音，说有一桩' + "'稳赚不赔'的买卖。）",
    '（{title}倚在柜台边，把玩着银锭，说想跟你' + "'交个朋友'。你深知这人沾不得，又不好明着得罪。）",
  ],
  random: [
    '（{title}。此事来得突然，堂中一时议论纷纷。你沉住气，先稳住场面再做计较。）',
    '（{title}。阿昭凑过来小声问该怎么办，你摆摆手，示意她先招呼好客人。）',
    '（{title}。你略一思量，已有计较——做生意最怕乱，乱中更要定。）',
  ],
  inventory: [
    '（库房里传来伙计的惊呼：{title}。你赶过去一看，果然出了岔子。）',
    '（{title}。你盘点了存货，眉头紧锁——这笔账得算清楚。）',
    '（{title}。好在发现得早，还来得及补救。你让人记下这一笔，下回进货留个心眼。）',
  ],
  event: [
    '（{title}。此事过后，你把手札翻到新的一页，记下了这一笔。）',
    '（{title}。堂前的灯笼晃了晃，像是有话要说。你按下心思，照常经营。）',
    '（{title}。日子还长，这一桩终究要有个说法。）',
  ],
};

/** 事件类型 → 模板分类映射（未命中回退 event） */
export function storyCategoryFor(eventType: string | undefined): string {
  const t = eventType ?? '';
  if (t.includes('debt')) return 'debt_collection';
  if (t.includes('regular') || t.includes('customer')) return 'regular_customer';
  if (t.includes('shen')) return 'shen_tinglan';
  if (t.includes('xie_qi') || t === 'xie_qi') return 'xie_qi';
  if (t.includes('inv') || t.includes('inventory')) return 'inventory';
  if (t === 'random') return 'random';
  return 'event';
}

/** 随机抽一套事件叙事模板（纯函数；rng 可注入） */
export function pickStoryTemplate(eventType: string | undefined, rng: () => number = Math.random): string {
  const pool = STORY_TEMPLATES[storyCategoryFor(eventType)] ?? STORY_TEMPLATES.event!;
  const idx = Math.floor(rng() * pool.length);
  return pool[Math.min(idx, pool.length - 1)]!;
}

/** 插值模板（{title}/{description} 等占位符） */
export function fillStoryTemplate(tpl: string, vars: Record<string, string>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v ?? '');
  }
  return out;
}

/** 生成事件故事叙事（模板兜底路径；AI 成功时由调用方覆盖 body） */
export function buildStoryNarrativeFallback(
  title: string,
  description: string,
  eventType: string | undefined,
  numbers: string[],
  npcLine?: string,
  rng: () => number = Math.random
): StoryNarrative {
  const tpl = pickStoryTemplate(eventType, rng);
  return {
    title,
    body: fillStoryTemplate(tpl, { title, description }),
    npcLine,
    numbers,
    source: 'template',
  };
}

/** 事件结果叙事（模块五 5.2：正面/负面结果各 ≥3 套；AI 不可用时兜底） */
export const RESULT_TEMPLATES: Record<'positive' | 'negative', string[]> = {
  positive: [
    '（此事了结，你心里一块石头落了地。堂前的客人们有说有笑，店里的气氛也松快了许多。）',
    '（你处理得妥帖，围观的人纷纷点头。阿昭悄悄说：掌柜的，今儿这事办得漂亮。）',
    '（风波过后，生意反而更红火了。你合上账本，觉得这一日的辛苦都值了。）',
  ],
  negative: [
    '（此事办得欠妥，你心里堵得慌。客人散去后，你独坐堂中，把今日的事来回想了几遍。）',
    '（围观的人摇着头散了。阿昭欲言又止，最后只是默默收拾了柜台。）',
    '（这一回吃了暗亏，你记下了。夜里掌灯，你在手札上添了一笔。）',
  ],
};

/** 随机抽取事件结果叙事（纯函数） */
export function pickResultTemplate(positive: boolean, rng: () => number = Math.random): string {
  const pool = RESULT_TEMPLATES[positive ? 'positive' : 'negative'];
  const idx = Math.floor(rng() * pool.length);
  return pool[Math.min(idx, pool.length - 1)]!;
}
