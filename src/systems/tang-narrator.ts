/**
 * 《我在唐朝当掌柜》AI 叙事着色服务（Step 4）
 *
 * 铁律（用户明确）：
 * 1. AI 只做叙事着色，不碰规则裁决——所有数值由前端系统算完才喂给 AI；
 * 2. AI 输出仅展示，不解析、不回写游戏状态；
 * 3. AI 调用失败 → 降级预设模板，游戏正常运行；
 * 4. 离线模式跳过 AI 调用。
 *
 * 分层：
 * - 纯函数（可测）：buildSystemPrompt / buildFallbackTemplate / serializeContext / shouldSkipAi
 * - 异步主入口：generateNarration（守卫 → 组装 messages → streamChatCompletion → 失败降级）
 * 复用层（只 import 不修改）：OpenRouterClient、modeManager、LLMConfig/OpenRouterMessage。
 */
import { getStoredApiKey, hasStoredApiKey, OpenRouterClient } from '@/infrastructure/openrouter/client';
import { modeManager } from '@/infrastructure/mode/ModeManager';
import type { LLMConfig, OpenRouterMessage } from '@/systems/dialogue/types';
import { loadTangAiConfig } from '@/systems/tang-api-test';
import type { NarrationContext, NarrationType } from '@/types/tang-manager';
import { OPENING_LINES, pickTemplate } from '@/config/tang-dialogue-templates';
import { GUEST_TYPE_LABEL } from '@/config/tang-guest-content';
import { shopDisplayName } from '@/config/tang-shop-types';
import { buildGuestReply, MOOD_CONFIGS } from '@/systems/tang-dialogue-engine';
import type { Guest, ShopType } from '@/types/tang-manager';
import type { GuestMood } from '@/types/tang-dialogue';

/** AI 调用日志条目 */
export interface AiLogEntry {
  type: string;
  ok: boolean;
  latencyMs: number;
  source: 'ai' | 'template';
}

let aiLogSink: ((e: AiLogEntry) => void) | null = null;

/** 注册全局 AI 日志上报（store 初始化时调用；修复「AI 调用始终为 0」） */
export function setAiLogSink(fn: (e: AiLogEntry) => void): void {
  aiLogSink = fn;
}

/** 上报一条 AI 调用日志 */
export function reportAiLog(e: AiLogEntry): void {
  aiLogSink?.(e);
}

/** generateNarration 可选项（createClient 便于测试注入） */
export interface NarrationOptions {
  /** AI 调用日志类型（供全局日志 sink 上报） */
  logType?: string;
  /** 是否启用 AI 叙事（默认 true；false → 直接降级模板） */
  enabled?: boolean;
  /** 模型 id（默认 openai/gpt-4o-mini） */
  model?: string;
  /** 流式回调：SSE 增量 token 透传（可选，支持流式 UI） */
  onChunk?: (text: string) => void;
  /** 客户端工厂（测试注入 mock；默认 new OpenRouterClient） */
  createClient?: () => Pick<OpenRouterClient, 'streamChatCompletion'>;
}

const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const DEFAULT_TEMPERATURE = 0.9;
const DEFAULT_MAX_TOKENS = 300;
const DEFAULT_STREAM_TIMEOUT = 15000;

// ============================================================
// 纯函数：系统提示 / 降级模板 / 上下文序列化 / 守卫
// ============================================================

/** 四种叙事系统提示（用户规格原文，逐字保留；reception 为 5a 3.4） */
const SYSTEM_PROMPTS: Record<NarrationType, string> = {
  settlement:
    "你是一位唐朝说书人，用古风白话为一位长安店铺掌柜写一段'今日总结'。要求：- 80-120字 - 用括号包裹的旁白风格，如'（夜深了，掌柜的拨着算盘……）' - 提及今日的净收益、至少一位客人的故事 - 如果收益好，语气欣慰但不张扬；如果收益差，语气安抚但不说教 - 不要编造任何系统没给你的数字",
  event:
    '你是一位唐朝说书人，为一段店铺事件写场景描写。要求：- 60-100字 - 生动描写事件发生的场景、人物神态、气氛 - 基于玩家做出的选择展开 - 不要改变事件的结果，只做场景还原',
  achievement:
    '你是一位唐朝说书人，为掌柜解锁一项成就写一句旁白评语。要求：- 30-50字 - 一句即可 - 古风韵味，像手札上浮现的文字',
  reception:
    '你是一位唐朝说书人。为一位客人进店消费的场景写一句话描写（15-30字）。用旁白风格。基于给定的客人身份和故事标签展开，不要编造数字。',
};

/** 构建系统提示（纯函数） */
export function buildSystemPrompt(type: NarrationType): string {
  return SYSTEM_PROMPTS[type];
}

/**
 * 降级模板（用户规格原文，逐字保留；netIncome / name / 客人称呼插值）。
 * AI 关闭 / 离线 / 失败 / 空串时返回，保证视觉连贯且不阻塞流程。
 */
export function buildFallbackTemplate(type: NarrationType, context: NarrationContext): string {
  switch (type) {
    case 'settlement':
      return `（夜深人静，掌柜的合上账本。今日进账${context.settlement?.netIncome ?? 0}两，店里的灯油又熬干了一盏。）`;
    case 'event':
      return '（此事过后，掌柜的在手札上多记了一笔。）';
    case 'achievement':
      return `（手札微微发热，纸页上浮现出新的文字——你已达成「${context.achievement?.name ?? ''}」。）`;
    case 'reception': {
      // （{客人称呼}进店，{根据标签的简单描述}。）
      const r = context.reception;
      const sceneHint = r?.sceneHint ?? '随意寻了个座';
      return `（${r?.guestName ?? '客人'}进店，${sceneHint}。）`;
    }
  }
}

/**
 * 序列化上下文为结构化中文提示（纯函数），供 user message 使用。
 * 只含系统已算好的数值/事实，AI 不得新增数字。
 */
export function serializeContext(context: NarrationContext): string {
  const base = `今日是第${context.day}天，${context.playerName}掌柜经营的${context.shopName}（${context.shopType}）。`;
  switch (context.type) {
    case 'settlement': {
      const s = context.settlement;
      const highlights = s?.guestHighlights?.length
        ? `客人亮点：${s.guestHighlights.join('；')}。`
        : '';
      return `${base}今日净收益${s?.netIncome ?? 0}两，评分变动${s?.scoreChange ?? 0}，声望变动${s?.reputationChange ?? 0}。${highlights}`;
    }
    case 'event': {
      const e = context.event;
      return `${base}发生事件「${e?.title ?? ''}」：${e?.description ?? ''}。掌柜选择了「${e?.choiceLabel ?? ''}」，后果：${e?.consequence ?? ''}。`;
    }
    case 'achievement': {
      const a = context.achievement;
      return `${base}掌柜达成成就「${a?.name ?? ''}」：${a?.description ?? ''}。`;
    }
    case 'reception': {
      // 接待叙事（5a 3.4）：含客人名称/类型/故事标签/线索关键词（细节暗示，不强制触发）
      const r = context.reception;
      const tagPart = r?.storyTag ? `他心中藏着「${r.storyTag}」的心事。` : '';
      const cluePart = r?.clue ? `（细节暗示：${r.clue}）` : '';
      return `${base}一位${r?.guestTypeLabel ?? ''}客人${r?.guestName ?? ''}进店消费。${tagPart}${cluePart}`;
    }
  }
}

/** 守卫入参（纯函数便于单测） */
export interface SkipAiInput {
  enabled: boolean;
  online: boolean;
  hasKey: boolean;
}

/** 是否跳过 AI 调用（任一不满足 → 降级模板，不发起请求） */
export function shouldSkipAi(opts: NarrationOptions | undefined, online: boolean, hasKey: boolean): boolean {
  const enabled = opts?.enabled ?? true;
  return !enabled || !online || !hasKey;
}

// ============================================================
// 异步主入口
// ============================================================

/**
 * 生成叙事文本（主入口）。
 * 守卫：禁用 / 离线 / 无 API key → 立即 resolve 降级模板（不发起请求）。
 * 优先读天机阁配置（tang-ai-config：存在且 configured → 用其 apiKey+model）；
 * 否则向后兼容降级读凛冬要塞 key（getStoredApiKey，localStorage 'ai-narrator-openrouter-api-key'）。
 * 成功：返回 trim 后的完整文本（空串 → 降级）。
 * 失败（任何错误）→ console.warn + 降级模板，绝不 throw。
 */
export async function generateNarration(
  context: NarrationContext,
  opts: NarrationOptions = {}
): Promise<string> {
  // 天机阁配置优先（体验优化模块一：存在且 configured → 用其 apiKey + model）；
  // 否则向后兼容凛冬要塞 key（opts.model 优先，缺省用 DEFAULT_MODEL）。
  const tianji = await loadTangAiConfig();
  const tianjiReady = !!tianji?.configured && !!tianji?.apiKey;
  const hasKey = tianjiReady || hasStoredApiKey();
  if (shouldSkipAi(opts, modeManager.isOnline, hasKey)) {
    return buildFallbackTemplate(context.type, context);
  }

  const model = tianjiReady ? tianji!.model : (opts.model ?? DEFAULT_MODEL);
  const apiKey = tianjiReady ? tianji!.apiKey : (getStoredApiKey() ?? '');
  const messages: OpenRouterMessage[] = [
    { role: 'system', content: buildSystemPrompt(context.type) },
    { role: 'user', content: serializeContext(context) },
  ];
  const config: LLMConfig = {
    model,
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: DEFAULT_MAX_TOKENS,
    streamTimeout: DEFAULT_STREAM_TIMEOUT,
    enableTypingEffect: false,
  };

  let accumulated = '';
  const client = opts.createClient
    ? opts.createClient()
    : new OpenRouterClient({ apiKey });

  try {
    await client.streamChatCompletion(config, messages, (chunk) => {
      accumulated += chunk;
      opts.onChunk?.(chunk);
    });
    const text = accumulated.trim();
    return text.length > 0 ? text : buildFallbackTemplate(context.type, context);
  } catch (error) {
    console.warn('[tang-narrator] AI 叙事生成失败，降级模板：', error);
    return buildFallbackTemplate(context.type, context);
  }
}

// ============================================================
// 模块二 2.3 / 模块五 5.1-5.2：对话生成（开场白 / 回应 / 结果叙事）
// AI 不可用 / 离线 / 无 key / 超时（>8s）→ 预设模板兜底，绝不 throw。
// ============================================================

/** 对话 AI 流式超时（模块五 5.2：>8s 自动切换预设模板） */
const DIALOGUE_STREAM_TIMEOUT = 8000;

/** 对话 AI 公共执行（守卫 → 组装 messages → stream → 失败降级；与 generateNarration 同构） */
async function runDialogueAi(
  systemPrompt: string,
  userPrompt: string,
  fallback: string,
  opts: NarrationOptions
): Promise<string> {
  const startedAt = Date.now();
  const tianji = await loadTangAiConfig();
  const tianjiReady = !!tianji?.configured && !!tianji?.apiKey;
  const hasKey = tianjiReady || hasStoredApiKey();
  if (shouldSkipAi(opts, modeManager.isOnline, hasKey)) {
    reportAiLog({ type: opts.logType ?? 'narration', ok: true, latencyMs: Date.now() - startedAt, source: 'template' });
    return fallback;
  }
  const model = tianjiReady ? tianji!.model : (opts.model ?? DEFAULT_MODEL);
  const apiKey = tianjiReady ? tianji!.apiKey : (getStoredApiKey() ?? '');
  const messages: OpenRouterMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
  const config: LLMConfig = {
    model,
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: DEFAULT_MAX_TOKENS,
    streamTimeout: DIALOGUE_STREAM_TIMEOUT,
    enableTypingEffect: false,
  };
  let accumulated = '';
  const client = opts.createClient ? opts.createClient() : new OpenRouterClient({ apiKey });
  try {
    await client.streamChatCompletion(config, messages, (chunk) => {
      accumulated += chunk;
      opts.onChunk?.(chunk);
    });
    const text = accumulated.trim();
    const ok = text.length > 0;
    reportAiLog({ type: opts.logType ?? 'narration', ok, latencyMs: Date.now() - startedAt, source: ok ? 'ai' : 'template' });
    return ok ? text : fallback;
  } catch (error) {
    console.warn('[tang-narrator] 对话 AI 生成失败，降级模板：', error);
    reportAiLog({ type: opts.logType ?? 'narration', ok: false, latencyMs: Date.now() - startedAt, source: 'template' });
    return fallback;
  }
}

/** 客人开场白（2.3：每位客人到店时；AI 不可用 → OPENING_LINES 每店 10 套随机） */
export async function generateGuestGreeting(
  guest: Guest,
  shopType: ShopType,
  opts: NarrationOptions = {}
): Promise<string> {
  const fallback = pickTemplate(OPENING_LINES[shopType]);
  const prompt =
    '你是一位唐朝长安城的' + (GUEST_TYPE_LABEL[guest.type] ?? '客人') + '，到' + shopDisplayName(shopType) + '消费。' +
    '你的性格：' + (guest.storyTag ?? '寻常路人') + '。你的需求：' + guest.description + '。' +
    '请以你的身份说一句进店开场白，1-2句话，口语化，符合唐代市井语言风格。不要替掌柜做决定。不要编造系统没给你的数字。';
  return runDialogueAi('你是一位唐朝说书人，负责生成客人的进店台词。', prompt, fallback, opts);
}

/** 客人回应（2.3：玩家每次对话选择后；AI 不可用 → 按心情 GUEST_REPLIES 5 套随机） */
export async function generateGuestReply(
  guest: Guest,
  mood: GuestMood,
  playerLine: string,
  opts: NarrationOptions = {}
): Promise<string> {
  const fallback = buildGuestReply(mood, guest.name);
  const moodCfg = MOOD_CONFIGS[mood];
  const prompt =
    '你是一位唐朝长安城的' + (GUEST_TYPE_LABEL[guest.type] ?? '客人') + guest.name + '，今日心情：' + moodCfg.label +
    '（' + moodCfg.styleHint + '）。你的需求：' + guest.description + '。' +
    "掌柜的刚才对你说：'" + playerLine + "'。请以你的身份回应，1-3句话，口语化，符合唐代市井语言风格。不要替掌柜做决定。不要编造系统没给你的数字。";
  return runDialogueAi('你是一位唐朝说书人，负责生成客人的回应台词。', prompt, fallback, opts);
}

/** 结果叙事（2.3 / 模块一：成交/失败场景描写；fallback 由各店系统插值提供） */
export async function generateResolutionNarrative(
  guest: Guest,
  shopType: ShopType,
  ok: boolean,
  fallback: string,
  opts: NarrationOptions = {}
): Promise<string> {
  const prompt =
    '你是一位唐朝说书人，为' + shopDisplayName(shopType) + '的一次接待写结果场景描写。客人：' + guest.name +
    '（' + (GUEST_TYPE_LABEL[guest.type] ?? '客人') + '），本单' + (ok ? '成交' : '未成交') + '。' +
    '要求：3-5句，生动描写场景与人物神态，含一句客人关键台词（用引号包裹）。不要改变结果，不要编造系统没给你的数字。';
  return runDialogueAi('你是一位唐朝说书人，负责为接待结果写叙事。', prompt, fallback, opts);
}
