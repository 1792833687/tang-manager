/**
 * 《我在唐朝当掌柜》AI 驱动对话决策（2026-08-06 · 规格书模块一）
 * 流程：AI 分析需求 → 生成 3 个对话选项（预估成交价/成交率/风险）
 *       → 玩家选择 → AI 生成客人回应（态度/最终价/附加条件/情绪变化）→ 成交/失败叙事。
 * 铁律：AI 可用优先，不可用/超时（8s）/解析失败 → 预设模板兜底，绝不阻塞、绝不 throw。
 * 纯函数（可测）：buildDialogueOptionsPrompt / parseDialogueOptionsJson / pickFallbackOptions /
 *                buildGuestResponsePrompt / parseGuestResponseJson / pickFallbackGuestResponse。
 */
import { getStoredApiKey, hasStoredApiKey, OpenRouterClient } from '@/infrastructure/openrouter/client';
import { modeManager } from '@/infrastructure/mode/ModeManager';
import type { LLMConfig, OpenRouterMessage } from '@/systems/dialogue/types';
import { loadTangAiConfig } from '@/systems/tang-api-test';
import { shouldSkipAi, reportAiLog } from '@/systems/tang-narrator';
import { shopDisplayName } from '@/config/tang-shop-types';
import { GUEST_TYPE_LABEL } from '@/config/tang-guest-content';
import { pickTemplate } from '@/config/tang-dialogue-templates';
import { pickDialogueOptionSet, type DialogueOptionSetTemplate } from '@/config/tang-dialogue-fallbacks';
import { pickArrivalTemplate } from '@/config/tang-dialogue-fallbacks';
import type { Guest, ShopType } from '@/types/tang-manager';

/** AI 返回的需求分析 + 选项（规格书 1.2） */
export interface DialogueOption {
  text: string;
  strategy: string;
  estimatedPrice: number;
  estimatedSuccessRate: number;
  risk: string;
}

export interface AIDialogueOptions {
  guestAnalysis: string;
  options: DialogueOption[];
}

/** AI 返回的客人回应 + 成交结果（规格书 1.2） */
export interface AIGuestResponse {
  response: string;
  attitude: 'accept' | 'hesitate' | 'reject';
  finalPrice?: number;
  extraCondition?: string;
  emotionChange: number;
}

export const AI_DIALOGUE_TIMEOUT = 8000;

const ARRIVAL_SYSTEM_PROMPT =
  '你是一位唐朝说书人，为一位客人走进店铺的场景写一小段旁白（2-4 句，古风市井口吻）。用括号包裹旁白，末尾接一句客人说的话。只输出旁白与客人一句话，不要多余文字。';


const OPTIONS_SYSTEM_PROMPT =
  '你是一位唐朝店铺的掌柜，正在接待一位客人。请分析客人真实需求并给出 3 个对话选项（品质/性价比/投其所好三种策略，价格与成交率要有明显差异）。只返回严格 JSON，不要任何额外文字。JSON 格式：{"guestAnalysis":"分析(1-2句)","options":[{"text":"掌柜对话","strategy":"策略","estimatedPrice":数字,"estimatedSuccessRate":0-100数字,"risk":"风险(1句)"}]}';

const RESPONSE_SYSTEM_PROMPT =
  '你是一位唐朝店铺的客人。请回应掌柜刚才的话，并给出对这笔交易的最终态度。只返回严格 JSON，不要任何额外文字。JSON 格式：{"response":"回应(1-3句)","attitude":"accept|hesitate|reject","finalPrice":数字(仅accept),"extraCondition":"(仅hesitate,如「再便宜五两」)","emotionChange":整数}';

/** 构建「需求分析+选项」prompt（纯函数；规格书 1.3） */
export function buildDialogueOptionsPrompt(
  guest: Pick<Guest, 'name' | 'type' | 'description'> | Guest,
  shopType: ShopType,
  state: { score?: number; signatureGoods?: string; stockSummary?: string } = {}
): string {
  const shop = shopDisplayName(shopType);
  const identity = GUEST_TYPE_LABEL[guest.type] ?? '普通';
  return [
    `你是一位唐朝${shop}的掌柜，正在接待一位客人。`,
    '',
    '客人信息：',
    `- 客官名讳：${guest.name}`,
    `- 身份：${identity}`,
    `- 性格：性情平和`,
    `- 需求描述：${guest.description ?? '来店里转转'}`,
    '',
    `当前店铺状态：评分 ${state.score ?? '—'}；招牌商品：${state.signatureGoods ?? '暂无'}`,
    '',
    '请分析这位客人的真实需求，并生成 3 个对话选项供掌柜选择。每个选项包含：选项文本（1句口语化唐代风格）、策略方向、预估成交价（两整数）、预估成交率（0-100）、风险提示（1句）。',
    '选项应有明显策略差异：A 主打品质和服务（价高率中）/ B 主打性价比和实在（价中率高）/ C 投其所好或剑走偏锋（波动大）。',
  ].join('\n');
}

/** 构建「客人回应」prompt（纯函数；规格书 1.3） */
export function buildGuestResponsePrompt(
  guest: Pick<Guest, 'name' | 'type'> | Guest,
  playerChoice: string,
  shopType: ShopType
): string {
  return [
    `你是一位唐朝${shopDisplayName(shopType)}的客人。`,
    '',
    `你的身份：${GUEST_TYPE_LABEL[guest.type] ?? '普通'}`,
    `你的性格：性情平和`,
    `掌柜刚才对你说：「${playerChoice}」`,
    '',
    '请生成你的回应（1-3句口语化唐代风格）、最终态度（accept接受/hesitate犹豫/reject拒绝）；若接受给最终价（两整数），若犹豫给额外条件（如"再便宜五两"），并给情绪变化（整数）。',
  ].join('\n');
}

/** 宽松解析选项 JSON（纯函数；容忍前后噪音） */
export function parseDialogueOptionsJson(text: string): AIDialogueOptions | null {
  const cleaned = text.replace(/^[^{]*/, '').replace(/}[^}]*$/, '}');
  try {
    const obj = JSON.parse(cleaned) as AIDialogueOptions;
    if (!obj || !Array.isArray(obj.options) || obj.options.length === 0) return null;
    const ok = obj.options.every(
      (o) => typeof o.text === 'string' && typeof o.strategy === 'string' && typeof o.estimatedPrice === 'number' && typeof o.estimatedSuccessRate === 'number'
    );
    return ok ? obj : null;
  } catch {
    return null;
  }
}

/** 宽松解析客人回应 JSON（纯函数） */
export function parseGuestResponseJson(text: string): AIGuestResponse | null {
  const cleaned = text.replace(/^[^{]*/, '').replace(/}[^}]*$/, '}');
  try {
    const obj = JSON.parse(cleaned) as AIGuestResponse;
    if (!obj || typeof obj.response !== 'string' || !['accept', 'hesitate', 'reject'].includes(obj.attitude)) return null;
    return obj;
  } catch {
    return null;
  }
}

/** 兜底：随机抽取一套三选项（纯函数；规格书 1.5） */
export function pickFallbackOptions(shopType: ShopType, rng: () => number = Math.random): AIDialogueOptions {
  const set: DialogueOptionSetTemplate = pickDialogueOptionSet(shopType, rng);
  return { guestAnalysis: set.guestAnalysis, options: set.options.map((o) => ({ ...o })) };
}

/** 兜底：客人回应（纯函数；基于既有回应池简化——生成一条中肯回应） */
export function pickFallbackGuestResponse(
  guest: Pick<Guest, 'name'> | Guest,
  rng: () => number = Math.random
): AIGuestResponse {
  const roll = rng();
  if (roll < 0.5) {
    return { response: `（${guest.name}沉吟片刻）罢了，就按掌柜说的办，价钱合适便成交。`, attitude: 'accept', finalPrice: Math.max(1, Math.round(rng() * 6) + 2), emotionChange: Math.round(rng() * 10) };
  }
  if (roll < 0.8) {
    return { response: `（${guest.name}面露难色）再想想……若是便宜些，或是添点什么，倒也可以。`, attitude: 'hesitate', extraCondition: '再便宜些，或送些添头', emotionChange: -Math.round(rng() * 5) };
  }
  return { response: `（${guest.name}摇头）不成，这价我可受不住，改日再说罢。`, attitude: 'reject', emotionChange: -Math.round(rng() * 8) - 2 };
}

/** AI 可用性检查（复用叙事层守卫） */
async function aiAvailable(): Promise<boolean> {
  const tianji = await loadTangAiConfig();
  const ready = !!tianji?.configured && !!tianji?.apiKey;
  const hasKey = ready || hasStoredApiKey();
  return !shouldSkipAi({ enabled: true }, modeManager.isOnline, hasKey);
}

/**
 * 生成对话选项（规格书 1.1/1.3）。
 * AI 可用 → 调用并解析 JSON；不可用/超时/解析失败 → 兜底模板。
 */
export async function generateDialogueOptions(
  guest: Guest,
  shopType: ShopType,
  state: { score?: number; signatureGoods?: string; stockSummary?: string } = {},
  opts: { enabled?: boolean } = {}
): Promise<AIDialogueOptions> {
  const enabled = opts.enabled ?? true;
  const t0 = Date.now();
  if (!enabled || !(await aiAvailable())) {
    reportAiLog({ type: 'dialogue_options', ok: true, latencyMs: Date.now() - t0, source: 'template' });
    return pickFallbackOptions(shopType);
  }
  const tianji = await loadTangAiConfig();
  const model = tianji?.configured && tianji?.apiKey ? tianji.model : 'openai/gpt-4o-mini';
  const apiKey = tianji?.configured && tianji?.apiKey ? tianji.apiKey : (getStoredApiKey() ?? '');
  const messages: OpenRouterMessage[] = [
    { role: 'system', content: OPTIONS_SYSTEM_PROMPT },
    { role: 'user', content: buildDialogueOptionsPrompt(guest, shopType, state) },
  ];
  const config: LLMConfig = { model, temperature: 0.8, maxTokens: 600, streamTimeout: AI_DIALOGUE_TIMEOUT, enableTypingEffect: false };
  let acc = '';
  try {
    await new OpenRouterClient({ apiKey }).streamChatCompletion(config, messages, (c) => { acc += c; });
    const parsed = parseDialogueOptionsJson(acc.trim());
    reportAiLog({ type: 'dialogue_options', ok: !!parsed, latencyMs: Date.now() - t0, source: parsed ? 'ai' : 'template' });
    return parsed ?? pickFallbackOptions(shopType);
  } catch {
    reportAiLog({ type: 'dialogue_options', ok: false, latencyMs: Date.now() - t0, source: 'template' });
    return pickFallbackOptions(shopType);
  }
}

/** 生成客人回应（规格书 1.1/1.3） */

/** 客人到店小场景（AI 叙事优先；不可用/超时 → 模板兜底；规格书：客人到店描述弹窗） */
export async function generateGuestArrival(
  guest: Pick<Guest, 'name' | 'type' | 'description'> | Guest,
  shopType: ShopType,
  opts: { enabled?: boolean } = {}
): Promise<{ content: string; source: 'ai' | 'template' }> {
  const enabled = opts.enabled ?? true;
  const t0 = Date.now();
  const fallbackContent = pickArrivalTemplate(shopType).replace('{guestName}', guest.name).replace('{description}', guest.description ?? '');
  if (!enabled || !(await aiAvailable())) {
    reportAiLog({ type: 'guest_arrival', ok: true, latencyMs: Date.now() - t0, source: 'template' });
    return { content: fallbackContent, source: 'template' };
  }
  const tianji = await loadTangAiConfig();
  const model = tianji?.configured && tianji?.apiKey ? tianji.model : 'openai/gpt-4o-mini';
  const apiKey = tianji?.configured && tianji?.apiKey ? tianji.apiKey : (getStoredApiKey() ?? '');
  const user = `客人：${guest.name}（${GUEST_TYPE_LABEL[guest.type] ?? '普通'}）。需求：${guest.description ?? ''}。店铺：${shopDisplayName(shopType)}。`;
  const messages: OpenRouterMessage[] = [
    { role: 'system', content: ARRIVAL_SYSTEM_PROMPT },
    { role: 'user', content: user },
  ];
  const config: LLMConfig = { model, temperature: 0.9, maxTokens: 200, streamTimeout: AI_DIALOGUE_TIMEOUT, enableTypingEffect: false };
  let acc = '';
  try {
    await new OpenRouterClient({ apiKey }).streamChatCompletion(config, messages, (c) => { acc += c; });
    const text = acc.trim();
    const ok = text.length > 0;
    reportAiLog({ type: 'guest_arrival', ok, latencyMs: Date.now() - t0, source: ok ? 'ai' : 'template' });
    return ok ? { content: text, source: 'ai' } : { content: fallbackContent, source: 'template' };
  } catch {
    reportAiLog({ type: 'guest_arrival', ok: false, latencyMs: Date.now() - t0, source: 'template' });
    return { content: fallbackContent, source: 'template' };
  }
}

export async function generateGuestResponse(
  guest: Guest,
  playerChoice: string,
  shopType: ShopType,
  opts: { enabled?: boolean } = {}
): Promise<AIGuestResponse> {
  const enabled = opts.enabled ?? true;
  const t0 = Date.now();
  if (!enabled || !(await aiAvailable())) {
    reportAiLog({ type: 'guest_response', ok: true, latencyMs: Date.now() - t0, source: 'template' });
    return pickFallbackGuestResponse(guest);
  }
  const tianji = await loadTangAiConfig();
  const model = tianji?.configured && tianji?.apiKey ? tianji.model : 'openai/gpt-4o-mini';
  const apiKey = tianji?.configured && tianji?.apiKey ? tianji.apiKey : (getStoredApiKey() ?? '');
  const messages: OpenRouterMessage[] = [
    { role: 'system', content: RESPONSE_SYSTEM_PROMPT },
    { role: 'user', content: buildGuestResponsePrompt(guest, playerChoice, shopType) },
  ];
  const config: LLMConfig = { model, temperature: 0.85, maxTokens: 300, streamTimeout: AI_DIALOGUE_TIMEOUT, enableTypingEffect: false };
  let acc = '';
  try {
    await new OpenRouterClient({ apiKey }).streamChatCompletion(config, messages, (c) => { acc += c; });
    const parsed = parseGuestResponseJson(acc.trim());
    reportAiLog({ type: 'guest_response', ok: !!parsed, latencyMs: Date.now() - t0, source: parsed ? 'ai' : 'template' });
    return parsed ?? pickFallbackGuestResponse(guest);
  } catch {
    reportAiLog({ type: 'guest_response', ok: false, latencyMs: Date.now() - t0, source: 'template' });
    return pickFallbackGuestResponse(guest);
  }
}
