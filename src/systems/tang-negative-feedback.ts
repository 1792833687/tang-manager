/**
 * 《我在唐朝当掌柜》负反馈系统（内容深化 TANG-CONT-D 模块七）
 * 纯函数（可测）：
 * - checkTreeAttractsWind(state, rng?)：树大招风（连续盈利 ≥15 天触发）
 * - checkCollectiveRaise(state, rng?)：集体涨薪要求（经营 >60 天且连续盈利 ≥30 天概率触发）
 * - checkNaturalDisaster(state, rng?)：自然灾害（约 2%/月：洪水夏季翻倍 / 火灾冬季翻倍 / 瘟疫）
 * - checkBetrayal(state, rng?)：人际背叛（员工被挖角 / 沈听澜使绊 / 阿昭偷钱）
 * - checkAccidentalLoss(state, rng?)：意外损失（赊账跑路随赊账额递增 / 钱庄挤兑 1%/月）
 * - checkNegativeFeedback(state, rng?)：统一入口，返回本次触发的负反馈事件列表
 * - applyNegativeChoice(event, optionId, state, rng?)：选项处理，返回变更建议（store 应用）
 * 铁律：古风措辞；纯函数不持有游戏状态；rng 可注入。
 */
import type {
  Employee,
  LedgerEntry,
  ShopItem,
  TangGameState,
} from '@/types/tang-manager';

// ============================================================
// 类型
// ============================================================

export type NegativeEventKind =
  | 'tree_wind' // 树大招风
  | 'collective_raise' // 集体涨薪要求
  | 'disaster' // 自然灾害
  | 'betrayal' // 人际背叛
  | 'accidental_loss'; // 意外损失

export interface NegativeEventOption {
  id: string;
  label: string;
  consequence: string;
}

export interface NegativeEvent {
  id: string;
  kind: NegativeEventKind;
  title: string;
  description: string;
  day: number;
  options: NegativeEventOption[];
  /** 附加数据（applyNegativeChoice 判定用；如被挖角员工 id / 灾害类型） */
  payload?: Record<string, unknown>;
}

/** 负反馈检查所需状态子集 */
export interface NegativeFeedbackState {
  day: number;
  silver: number;
  score: number;
  reputation: number;
  shopType?: string;
  consecutiveProfitDays: number;
  shenTinglanFavor: number;
  xiaoerFavor: number;
  xiaoerSatisfaction?: number;
  energy?: number;
  employees: Employee[];
  shopItems?: ShopItem[];
  tradeCredit?: number;
  deposits?: { amount: number }[];
  /** 沈听澜店铺评分（对质/使绊判定；默认 4.0） */
  shenShopScore?: number;
  /** 已拥有的线索 id（沈听澜使绊对质判定） */
  clueIds?: string[];
  /** 阿昭是否连续未涨月钱 ≥2 个月（阿昭偷钱判定；store 维护） */
  azhaoNoRaiseMonths?: number;
  /** 上月是否给阿昭涨过月钱 */
  azhaoRaisedLastMonth?: boolean;
  /** 经营策略（全员涨薪每月支出增近似：salaryMultiplier 由 store 应用） */
  salaryMultiplier?: number;
  /** 是否已触发过某类负反馈（按 kind 去重；同日只触发一次） */
  triggeredToday?: string[];
  /** 当前灾害类型（applyDisasterChoice 判定用） */
  disasterType?: 'flood' | 'fire' | 'plague';
  /** 被挖角员工 id（applyBetrayalChoice 判定用） */
  targetEmployeeId?: string;
  /** 被挖角员工名（applyBetrayalChoice 判定用） */
  targetEmployeeName?: string;
}

/** 选项处理结果（store 应用 changes + 追加 eventLog/ledger） */
export interface NegativeChoiceResult {
  ok: boolean;
  message: string;
  changes: Partial<TangGameState>;
  eventLog: string[];
  ledger?: LedgerEntry[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 月度（day/30 向上取整，用于季节判定） */
export function monthOf(day: number): number {
  return Math.max(1, Math.ceil(day / 30));
}

/** 夏季（第五至七月；洪水概率翻倍） */
export function isSummer(day: number): boolean {
  const m = monthOf(day);
  return m >= 5 && m <= 7;
}

/** 冬季（十一至一月；火灾概率翻倍） */
export function isWinter(day: number): boolean {
  const m = monthOf(day);
  return m >= 11 || m <= 1;
}

/** 按类目统计库存价值 */
export function categoryValue(items: readonly ShopItem[] | undefined, category: string): number {
  return (items ?? []).filter((it) => it.category === category).reduce((sum, it) => sum + (it.stock ?? 0) * (it.cost ?? 0), 0);
}

/** 洪水：食材全陈损（价值入账支出）+ 布匹损 20% */
function applyFlood(items: ShopItem[]): { items: ShopItem[]; loss: number } {
  let loss = 0;
  const next = items.map((it) => {
    if (it.category === '食材') {
      loss += (it.stock ?? 0) * (it.cost ?? 0);
      return { ...it, stock: 0, status: 'out_of_stock' as const };
    }
    if (it.category === '布匹') {
      const cut = Math.round((it.stock ?? 0) * 0.2 * 100) / 100;
      loss += cut * (it.cost ?? 0);
      return { ...it, stock: round2((it.stock ?? 0) - cut), status: (it.stock ?? 0) - cut <= 0 ? ('out_of_stock' as const) : it.status };
    }
    return it;
  });
  return { items: next, loss: round2(loss) };
}

/** 火灾：随机损 30-50% 库存价值 + 修缮 50 两 */
function applyFire(items: ShopItem[], rng: () => number): { items: ShopItem[]; loss: number; repair: number } {
  const rate = 0.3 + rng() * 0.2; // 30-50%
  let loss = 0;
  const next = items.map((it) => {
    const cut = Math.round((it.stock ?? 0) * rate * 100) / 100;
    loss += cut * (it.cost ?? 0);
    return { ...it, stock: round2((it.stock ?? 0) - cut), status: (it.stock ?? 0) - cut <= 0 ? ('out_of_stock' as const) : it.status };
  });
  return { items: next, loss: round2(loss), repair: 50 };
}

// ============================================================
// 模块七·1 树大招风
// ============================================================

/** 树大招风（连续盈利 ≥15 天触发）：A 去商会解释 / B 不予理会 */
export function checkTreeAttractsWind(
  state: NegativeFeedbackState,
  _rng: () => number = Math.random
): NegativeEvent | null {
  if ((state.consecutiveProfitDays ?? 0) < 15) return null;
  if ((state.triggeredToday ?? []).includes('tree_wind')) return null;
  return {
    id: 'neg-tree-wind',
    kind: 'tree_wind',
    title: '树大招风',
    description:
      '你铺子连月红火，东市商会的眼红之徒在背后嚼舌根：「那陆家小儿不知使了什么手段，把生意都抢了去！」流言四起，再不应对，恐生祸端。',
    day: state.day,
    options: [
      {
        id: 'explain',
        label: '去商会解释',
        consequence: '你备了礼去商会当面分说，又捐了些银两修坊桥，流言渐息。',
      },
      {
        id: 'ignore',
        label: '不予理会',
        consequence: '你嗤笑一声：「清者自清。」可商会那头，已有人记下了你的不敬。',
      },
    ],
  };
}

/** 树大招风选项处理（纯函数） */
export function applyTreeWindChoice(
  optionId: string,
  state: NegativeFeedbackState
): NegativeChoiceResult {
  if (optionId === 'explain') {
    return {
      ok: true,
      message: '你去商会解释清楚，又捐银修桥，声望见长，风波平息。',
      changes: {
        energy: Math.max(0, (state.energy ?? 100) - 20),
        silver: Math.max(0, state.silver - 20),
        reputation: Math.min(1000, state.reputation + 5),
      },
      eventLog: ['[负反馈] 树大招风·已解释：捐银 20 两，声望 +5，风波平息'],
      ledger: [{ day: state.day, project: '树大招风·捐银修桥', category: '支出', amount: -20 }],
    };
  }
  return {
    ok: true,
    message: '你未予理会，东市商会脸色微沉，怕是要暗中使绊。',
    changes: {
      // 商会关系 -15（store 以 eventLog 记录；对手可能进一步行动由后续事件体现）
      reputation: Math.max(0, state.reputation - 5),
    },
    eventLog: ['[负反馈] 树大招风·不予理会：商会关系 -15，竞争对手可能进一步行动'],
  };
}

// ============================================================
// 模块七·2 集体涨薪要求
// ============================================================

/** 集体涨薪要求（经营 >60 天且连续盈利 ≥30 天概率触发）：A 全体涨薪 / B 个别涨薪 / C 拒绝 */
export function checkCollectiveRaise(
  state: NegativeFeedbackState,
  rng: () => number = Math.random
): NegativeEvent | null {
  if (state.day <= 60 || (state.consecutiveProfitDays ?? 0) < 30) return null;
  if ((state.triggeredToday ?? []).includes('collective_raise')) return null;
  if (rng() >= 0.15) return null; // 概率触发（工程定值 15%/日，注释）
  return {
    id: 'neg-collective-raise',
    kind: 'collective_raise',
    title: '集体涨薪要求',
    description:
      '打烊后，几个伙计挤在柜前，由账房老赵领头：「掌柜的，铺子日进斗金，咱们的月钱却纹丝不动，心里头不是滋味。」众人齐刷刷望向你。',
    day: state.day,
    options: [
      {
        id: 'all_raise',
        label: '全体涨薪两成',
        consequence: '你当场应下，给所有人月钱加了两成。伙计们眉开眼笑，干活更有劲了。',
      },
      {
        id: 'partial_raise',
        label: '个别涨薪',
        consequence: '你只给干活最卖力的两位加了月钱，其余人嘴上不说，脸色却暗了下来。',
      },
      {
        id: 'refuse',
        label: '一口回绝',
        consequence: '你板起脸：「铺子不养闲人，嫌钱少大可另谋高就。」伙计们噤声散去，心里却种下不满。',
      },
    ],
  };
}

/** 集体涨薪选项处理（纯函数） */
export function applyCollectiveRaiseChoice(
  optionId: string,
  state: NegativeFeedbackState,
  rng: () => number = Math.random
): NegativeChoiceResult {
  const employees = state.employees ?? [];
  if (optionId === 'all_raise') {
    return {
      ok: true,
      message: '全体涨薪两成，伙计们喜笑颜开，铺子里一片和乐。',
      changes: {
        employees: employees.map((e) => ({
          ...e,
          salary: round2((e.salary ?? 0) * 1.2),
          satisfaction: Math.min(100, e.satisfaction + 15),
        })),
        salaryMultiplier: round2((state.salaryMultiplier ?? 1) * 1.2),
      },
      eventLog: ['[负反馈] 集体涨薪·全体：月钱 +20%，员工满意 +15，每月支出增'],
    };
  }
  if (optionId === 'partial_raise') {
    // 选 1-2 人（按满意度最高优先；工程定值，注释）：被选者 +10，其余 -10
    const sorted = [...employees].sort((a, b) => b.satisfaction - a.satisfaction);
    const picked = new Set(sorted.slice(0, 2).map((e) => e.id));
    return {
      ok: true,
      message: '你只给两位最卖力的伙计加了月钱，其余人脸色微沉。',
      changes: {
        employees: employees.map((e) =>
          picked.has(e.id)
            ? { ...e, salary: round2((e.salary ?? 0) * 1.15), satisfaction: Math.min(100, e.satisfaction + 10) }
            : { ...e, satisfaction: Math.max(0, e.satisfaction - 10) }
        ),
      },
      eventLog: ['[负反馈] 集体涨薪·个别：选 2 人涨薪 +10，其余满意 -10'],
    };
  }
  // 拒绝：全员 -20，30% 概率一位伙计赌气离职
  const quit = employees.length > 0 && rng() < 0.3;
  const quitId = quit ? employees[Math.floor(rng() * employees.length)]!.id : null;
  return {
    ok: true,
    message: quit
      ? '你一口回绝，众人敢怒不敢言。当夜，竟有一位伙计收拾包袱，赌气走了。'
      : '你一口回绝，伙计们闷闷不乐，铺子里气氛凝重。',
    changes: {
      employees: employees
        .filter((e) => e.id !== quitId)
        .map((e) => ({ ...e, satisfaction: Math.max(0, e.satisfaction - 20) })),
    },
    eventLog: quit
      ? ['[负反馈] 集体涨薪·拒绝：全员满意 -20，一名伙计赌气离职']
      : ['[负反馈] 集体涨薪·拒绝：全员满意 -20'],
  };
}

// ============================================================
// 模块七·3 自然灾害
// ============================================================

/** 自然灾害（约 2%/月；洪水夏季翻倍 / 火灾冬季翻倍 / 瘟疫随机） */
export function checkNaturalDisaster(
  state: NegativeFeedbackState,
  rng: () => number = Math.random
): NegativeEvent | null {
  if ((state.triggeredToday ?? []).includes('disaster')) return null;
  // 每月初判定一次（day%30===1 由 store 调用；此处仅按概率）
  let chance = 0.02;
  if (isSummer(state.day)) chance *= 2; // 夏季：洪水概率翻倍（约 4%）
  if (isWinter(state.day)) chance *= 2; // 冬季：火灾概率翻倍（约 4%）
  if (rng() >= chance) return null;
  const roll = rng();
  let kind: 'flood' | 'fire' | 'plague';
  let title: string;
  let description: string;
  if (roll < 0.4) {
    kind = 'flood';
    title = '连旬暴雨·水漫库房';
    description = '一连数日暴雨，坊间沟渠倒灌，你的库房进了水。米面药材泡汤大半，布匹也遭了殃。';
  } else if (roll < 0.75) {
    kind = 'fire';
    title = '夜半走水·火起库房';
    description = '半夜更夫急敲梆子：「走水了！走水了！」你披衣赶到，库房已烧去一角，货物付之一炬。';
  } else {
    kind = 'plague';
    title = '坊间时疫·行人绝迹';
    description = '坊间突生时疫，官府下令闭坊，街上行人绝迹。药铺的生意倒是兴隆，其余铺子门可罗雀。';
  }
  return {
    id: 'neg-disaster',
    kind: 'disaster',
    title,
    description,
    day: state.day,
    payload: { disasterType: kind },
    options: [
      {
        id: 'cope',
        label: '收拾残局',
        consequence: kind === 'flood'
          ? '你雇人淘水晾晒，清点损失，好歹把能救的救了出来。'
          : kind === 'fire'
            ? '你请工匠丈量损毁，又咬牙掏出修缮银子。'
            : '你紧闭店门，只留药铺照常开张，盼时疫早去。',
      },
    ],
  };
}

/** 自然灾害选项处理（纯函数）：洪水（食材全陈损+布匹损20%）/ 火灾（损30-50%库存+修缮50两）/ 瘟疫（客流减半7天，药铺翻倍） */
export function applyDisasterChoice(
  _optionId: string,
  state: NegativeFeedbackState,
  rng: () => number = Math.random
): NegativeChoiceResult {
  const kind = (state.disasterType ?? 'flood') as 'flood' | 'fire' | 'plague';
  const items = state.shopItems ?? [];
  const changes: Partial<TangGameState> = {};
  const ledger: LedgerEntry[] = [];
  let message: string;
  if (kind === 'flood') {
    const { items: next, loss } = applyFlood(items);
    changes.shopItems = next;
    if (loss > 0) {
      ledger.push({ day: state.day, project: '水患陈损', category: '支出', amount: -loss });
    }
    message = `水退之后，你清点库房：食材尽数泡汤，布匹损了两成，折银 ${round2(loss)} 两。`;
  } else if (kind === 'fire') {
    const { items: next, loss, repair } = applyFire(items, rng);
    changes.shopItems = next;
    changes.silver = Math.max(0, state.silver - repair);
    ledger.push({ day: state.day, project: '火患修缮', category: '支出', amount: -repair });
    if (loss > 0) {
      ledger.push({ day: state.day, project: '火患焚毁', category: '支出', amount: -loss });
    }
    message = `大火烧去库房三至五成货物，又花 ${repair} 两修缮屋舍，折银共 ${round2(loss + repair)} 两。`;
  } else {
    // 瘟疫：客流减半 7 天（store 在 startNewDay 按 disasterUntil 减客）；药铺店型收入翻倍由 settleDay 应用
    changes.disasterType = 'plague';
    changes.disasterUntil = state.day + 7;
    message = '时疫蔓延，你紧闭店门，盼七日疫散。药铺若还开着，倒是能赚上一笔。';
  }
  return { ok: true, message, changes, eventLog: [`[负反馈] 自然灾害·${kind === 'flood' ? '洪水' : kind === 'fire' ? '火灾' : '瘟疫'}`], ledger };
}

// ============================================================
// 模块七·4 人际背叛
// ============================================================

/** 员工被挖角（满意度≥80 忠诚拒 / 40-79 需匹配开价 / <40 直接离职带走熟客） */
export function buildPoachEvent(
  employee: Employee,
  day: number
): NegativeEvent {
  const sat = employee.satisfaction;
  if (sat >= 80) {
    return {
      id: 'neg-poach-loyal',
      kind: 'betrayal',
      title: '有人来挖角',
      description: `对门铺子托人捎话，要重金挖你的伙计${employee.name}。可${employee.name}一口回绝：「掌柜待我不薄，我不走。」`,
      day,
      payload: { employeeId: employee.id, employeeName: employee.name, tier: 'loyal' },
      options: [
        { id: 'thank', label: '好言嘉许', consequence: '你拍着他的肩夸了几句，他更死心塌地了。' },
      ],
    };
  }
  if (sat >= 40) {
    return {
      id: 'neg-poach-match',
      kind: 'betrayal',
      title: '有人来挖角',
      description: `对门铺子重金挖你的伙计${employee.name}，他犹豫不决，来找你拿主意：「掌柜的，那边开的月钱比咱们高出一截……」`,
      day,
      payload: { employeeId: employee.id, employeeName: employee.name, tier: 'match' },
      options: [
        { id: 'match', label: '匹配开价留人', consequence: '你给他加了月钱，他眉开眼笑，答应留下。' },
        { id: 'no_match', label: '不予理会', consequence: '你摆摆手：「要走便走。」他当真卷了包袱走了。' },
      ],
    };
  }
  return {
    id: 'neg-poach-leave',
    kind: 'betrayal',
    title: '有人来挖角',
    description: `对门铺子重金挖你的伙计${employee.name}。他本就不满，当夜便收拾包袱投奔对门，还带走了几个熟客。`,
    day,
    payload: { employeeId: employee.id, employeeName: employee.name, tier: 'leave' },
    options: [
      { id: 'accept', label: '由他去吧', consequence: '你叹口气，只当喂了白眼狼，把熟客再拉回来便是。' },
    ],
  };
}

/** 沈听澜暗中使绊（好感≥60 且你的评分超过他店铺）：某类进货价 +15% 15 天 */
export function buildShenSchemeEvent(state: NegativeFeedbackState): NegativeEvent | null {
  if ((state.shenTinglanFavor ?? 0) < 60) return null;
  if ((state.score ?? 0) <= (state.shenShopScore ?? 4.0)) return null;
  if ((state.triggeredToday ?? []).includes('shen_scheme')) return null;
  const hasClue = (state.clueIds ?? []).length > 0;
  return {
    id: 'neg-shen-scheme',
    kind: 'betrayal',
    title: '东市有人作梗',
    description:
      '近日进货，东市的货商总推说无货，好不容易进到的货，价码却涨了一截。你隐隐觉得，像是有人在背后打了招呼。',
    day: state.day,
    payload: { category: '食材', days: 15 },
    options: hasClue
      ? [
          { id: 'endure', label: '隐忍不发', consequence: '你咬咬牙认了这笔涨价，暗地记下这笔账。' },
          { id: 'confront', label: '拿线索对质', consequence: '你寻到蛛丝马迹，当面质问沈听澜，他脸色微变，松了口。' },
        ]
      : [
          { id: 'endure', label: '隐忍不发', consequence: '你咬咬牙认了这笔涨价，暗地记下这笔账。' },
        ],
  };
}

/** 阿昭偷钱（好感<30 且连续未涨月钱 ≥2 个月）：月偷 1-5 两 */
export function buildAzhaoStealEvent(state: NegativeFeedbackState): NegativeEvent | null {
  if ((state.xiaoerFavor ?? 0) >= 30) return null;
  if ((state.azhaoNoRaiseMonths ?? 0) < 2) return null;
  if (state.azhaoRaisedLastMonth === true) return null;
  if ((state.triggeredToday ?? []).includes('azhao_steal')) return null;
  return {
    id: 'neg-azhao-steal',
    kind: 'betrayal',
    title: '账上银子对不上',
    description:
      '月底对账，账房老赵皱着眉：「掌柜的，这几日账上总差些零头，说不上哪里去了。」你心里咯噔一下——阿昭这几日眼神躲闪。',
    day: state.day,
    payload: {},
    options: [
      { id: 'reprimand', label: '当众训诫', consequence: '你把阿昭叫到跟前训了一顿，她红着眼眶应了，再不敢伸手。' },
      { id: 'pretend', label: '装不知情', consequence: '你装作没瞧见，只在心里叹了口气。' },
    ],
  };
}

/** 人际背叛检查（统一入口）：优先员工被挖角（选满意度最低者） */
export function checkBetrayal(
  state: NegativeFeedbackState,
  rng: () => number = Math.random
): NegativeEvent | null {
  if ((state.triggeredToday ?? []).includes('betrayal')) return null;
  const employees = state.employees ?? [];
  // 员工被挖角（10% 概率，需有员工）
  if (employees.length > 0 && rng() < 0.1) {
    const target = [...employees].sort((a, b) => a.satisfaction - b.satisfaction)[0]!;
    return buildPoachEvent(target, state.day);
  }
  // 沈听澜使绊（15% 概率）
  if (rng() < 0.15) {
    const shen = buildShenSchemeEvent(state);
    if (shen) return shen;
  }
  // 阿昭偷钱（10% 概率）
  if (rng() < 0.1) {
    const azhao = buildAzhaoStealEvent(state);
    if (azhao) return azhao;
  }
  return null;
}

/** 人际背叛选项处理（纯函数；按事件 id 分支） */
export function applyBetrayalChoice(
  eventId: string,
  optionId: string,
  state: NegativeFeedbackState,
  rng: () => number = Math.random
): NegativeChoiceResult {
  const employees = state.employees ?? [];
  const targetId = (state.targetEmployeeId ?? '') as string;
  const targetName = (state.targetEmployeeName ?? '') as string;
  if (eventId === 'neg-poach-loyal') {
    return {
      ok: true,
      message: `${targetName}得了你的嘉许，更死心塌地了。`,
      changes: {
        employees: employees.map((e) => (e.id === targetId ? { ...e, satisfaction: Math.min(100, e.satisfaction + 5) } : e)),
      },
      eventLog: ['[负反馈] 挖角·忠诚拒：员工留任，满意 +5'],
    };
  }
  if (eventId === 'neg-poach-match') {
    if (optionId === 'match') {
      return {
        ok: true,
        message: `你给${targetName}加了月钱，他眉开眼笑地留下。`,
        changes: {
          employees: employees.map((e) =>
            e.id === targetId
              ? { ...e, salary: round2((e.salary ?? 0) * 1.2), satisfaction: Math.min(100, e.satisfaction + 10) }
              : e
          ),
        },
        eventLog: ['[负反馈] 挖角·匹配开价：员工留任，满意 +10，月钱 +20%'],
      };
    }
    return {
      ok: true,
      message: `${targetName}当真卷了包袱投奔对门，还带走几位熟客。`,
      changes: {
        employees: employees.filter((e) => e.id !== targetId),
        // 熟客流失 5%（客人数 -5% 10 天；store 以 eventLog 记录，近似）
        reputation: Math.max(0, state.reputation - 5),
      },
      eventLog: ['[负反馈] 挖角·未匹配：员工离职，熟客 -5%（10 天）'],
    };
  }
  if (eventId === 'neg-poach-leave') {
    return {
      ok: true,
      message: `${targetName}投奔对门，还带走了几个熟客。你叹口气，只当破财消灾。`,
      changes: {
        employees: employees.filter((e) => e.id !== targetId),
        reputation: Math.max(0, state.reputation - 5),
      },
      eventLog: ['[负反馈] 挖角·不满离职：员工离职，熟客 -5%（10 天）'],
    };
  }
  if (eventId === 'neg-shen-scheme') {
    if (optionId === 'confront') {
      return {
        ok: true,
        message: '你拿线索当面质问沈听澜，他脸色微变，松了口，进货价恢复如常。',
        changes: {
          shenTinglanFavor: Math.max(0, (state.shenTinglanFavor ?? 0) - 15),
          shenSchemeUntil: 0,
        },
        eventLog: ['[负反馈] 沈听澜使绊·对质：进货价恢复，沈好感 -15'],
      };
    }
    return {
      ok: true,
      message: '你咬牙认了这涨价，暗地记下这笔账。',
      changes: {
        // 某类进货价 +15% 15 天（store 以 shenSchemeUntil/shenSchemeCategory 应用）
        shenSchemeUntil: state.day + 15,
        shenSchemeCategory: '食材',
      },
      eventLog: ['[负反馈] 沈听澜使绊·隐忍：某类进货价 +15%（15 天）'],
    };
  }
  if (eventId === 'neg-azhao-steal') {
    const stolen = 1 + Math.floor(rng() * 5); // 月偷 1-5 两
    if (optionId === 'reprimand') {
      return {
        ok: true,
        message: `你训诫了阿昭，她红着眼眶应了，再不敢伸手。这几月共偷 ${stolen} 两，就此了结。`,
        changes: {
          silver: Math.max(0, state.silver - stolen),
          xiaoerFavor: Math.max(0, (state.xiaoerFavor ?? 0) - 10),
          xiaoerSatisfaction: Math.max(0, (state.xiaoerSatisfaction ?? 0) - 10),
          azhaoNoRaiseMonths: 0,
        },
        eventLog: [`[负反馈] 阿昭偷钱·训诫：扣银 ${stolen} 两，阿昭好感 -10`],
        ledger: [{ day: state.day, project: '账目不明支出', category: '支出', amount: -stolen }],
      };
    }
    return {
      ok: true,
      message: `你装作不知，只当没瞧见。可账上那 ${stolen} 两，终究是对不上。`,
      changes: {
        silver: Math.max(0, state.silver - stolen),
        azhaoNoRaiseMonths: 0,
      },
      eventLog: [`[负反馈] 阿昭偷钱·装不知：扣银 ${stolen} 两`],
      ledger: [{ day: state.day, project: '账目不明支出', category: '支出', amount: -stolen }],
    };
  }
  return { ok: false, message: '未知事件', changes: {}, eventLog: [] };
}

// ============================================================
// 模块七·5 意外损失
// ============================================================

/** 赊账跑路（概率随当月赊账总额递增：基础 5%，每 100 两 +5%） */
export function checkCreditRunaway(
  state: NegativeFeedbackState,
  rng: () => number = Math.random
): NegativeEvent | null {
  if ((state.triggeredToday ?? []).includes('credit_runaway')) return null;
  const tradeCredit = state.tradeCredit ?? 0;
  if (tradeCredit <= 0) return null;
  const chance = Math.min(0.5, 0.05 + Math.floor(tradeCredit / 100) * 0.05);
  if (rng() >= chance) return null;
  return {
    id: 'neg-credit-runaway',
    kind: 'accidental_loss',
    title: '赊账的跑了',
    description:
      '前些日赊账进货的一位行商，说要回乡办丧事，赊了一笔货便杳无音信。你托人去寻，只寻到空荡荡的落脚处。',
    day: state.day,
    options: [
      { id: 'accept', label: '自认倒霉', consequence: '你叹口气，只当花钱买个教训，赊账的生意往后要慎之又慎。' },
    ],
  };
}

/** 钱庄挤兑（约 1%/月：当月存款不可取，下月恢复但损半月利息） */
export function checkBankRun(
  state: NegativeFeedbackState,
  rng: () => number = Math.random
): NegativeEvent | null {
  if ((state.triggeredToday ?? []).includes('bank_run')) return null;
  if ((state.deposits ?? []).length === 0) return null;
  if (rng() >= 0.01) return null; // 约 1%/月
  return {
    id: 'neg-bank-run',
    kind: 'accidental_loss',
    title: '钱庄挤兑',
    description:
      '坊间传言钱庄掌柜卷款跑了，街坊蜂拥而至挤兑。钱庄东家满头大汗，请你通融：「本月存款暂且取不得，下月定当奉还本息。」',
    day: state.day,
    options: [
      { id: 'accept', label: '通融则个', consequence: '你应下了。钱庄东家千恩万谢，承诺下月奉还——只是利息怕要折损半月。' },
    ],
  };
}

/** 意外损失统一检查 */
export function checkAccidentalLoss(
  state: NegativeFeedbackState,
  rng: () => number = Math.random
): NegativeEvent | null {
  const runaway = checkCreditRunaway(state, rng);
  if (runaway) return runaway;
  return checkBankRun(state, rng);
}

/** 意外损失选项处理（纯函数） */
export function applyAccidentalLossChoice(
  eventId: string,
  _optionId: string,
  state: NegativeFeedbackState,
  rng: () => number = Math.random
): NegativeChoiceResult {
  if (eventId === 'neg-credit-runaway') {
    const tradeCredit = state.tradeCredit ?? 0;
    const lost = Math.min(tradeCredit, 10 + Math.floor(rng() * 21)); // 损 10-30 两赊账
    return {
      ok: true,
      message: `赊账的行商跑了，${lost} 两的货款打了水漂。`,
      changes: { tradeCredit: Math.max(0, tradeCredit - lost) },
      eventLog: [`[负反馈] 赊账跑路：损 ${lost} 两`],
      ledger: [{ day: state.day, project: '赊账跑路', category: '支出', amount: -lost }],
    };
  }
  // 钱庄挤兑：当月存款不可取（bankRunDays=30 由 store 应用；到期损半月利息）
  return {
    ok: true,
    message: '你通融了钱庄，本月存款暂且取不得，下月奉还本息——利息怕要折损半月。',
    changes: { bankRunDays: 30 },
    eventLog: ['[负反馈] 钱庄挤兑：当月存款不可取，下月恢复但损半月利息'],
  };
}

// ============================================================
// 统一入口
// ============================================================

/** 负反馈统一检查（纯函数）：返回本次触发的负反馈事件（通常 0-2 个） */
export function checkNegativeFeedback(
  state: NegativeFeedbackState,
  rng: () => number = Math.random
): NegativeEvent[] {
  const out: NegativeEvent[] = [];
  const treeWind = checkTreeAttractsWind(state, rng);
  if (treeWind) out.push(treeWind);
  const raise = checkCollectiveRaise(state, rng);
  if (raise) out.push(raise);
  // 自然灾害仅月初判定（约 2%/月；由调用方保证 day%30===1 才传入）
  if (state.day % 30 === 1) {
    const disaster = checkNaturalDisaster(state, rng);
    if (disaster) out.push(disaster);
  }
  const betrayal = checkBetrayal(state, rng);
  if (betrayal) out.push(betrayal);
  const loss = checkAccidentalLoss(state, rng);
  if (loss) out.push(loss);
  return out.slice(0, 2); // 同批最多 2 个，避免刷屏
}

/** 按事件 id/选项 id 应用负反馈选择（store 统一入口） */
export function applyNegativeChoice(
  event: NegativeEvent,
  optionId: string,
  state: NegativeFeedbackState,
  rng: () => number = Math.random
): NegativeChoiceResult {
  switch (event.kind) {
    case 'tree_wind':
      return applyTreeWindChoice(optionId, state);
    case 'collective_raise':
      return applyCollectiveRaiseChoice(optionId, state, rng);
    case 'disaster':
      return applyDisasterChoice(optionId, state, rng);
    case 'betrayal':
      return applyBetrayalChoice(
        event.id,
        optionId,
        {
          ...state,
          targetEmployeeId: event.payload?.employeeId as string | undefined,
          targetEmployeeName: event.payload?.employeeName as string | undefined,
          disasterType: undefined,
        },
        rng
      );
    case 'accidental_loss':
      return applyAccidentalLossChoice(event.id, optionId, state, rng);
    default:
      return { ok: false, message: '未知事件', changes: {}, eventLog: [] };
  }
}
