/**
 * 《我在唐朝当掌柜》AI 文本生成统一调用层（v1.1 模块五 5.5）
 * 覆盖全部文本输出类型：接待对话 / 事件叙事 / 店员提醒 / 客人评价 / 节点故事 / 月度总结。
 * 优先级检查：类型开关 → 在线状态 → API Key → 调用 AI（8s 超时）→ 降级模板。
 * 流式（对话类 SSE + onChunk）与非流式（叙事一次性）统一封装；所有异常静默降级，绝不 throw。
 */
import { getStoredApiKey, hasStoredApiKey, OpenRouterClient } from '@/infrastructure/openrouter/client';
import { modeManager } from '@/infrastructure/mode/ModeManager';
import type { LLMConfig, OpenRouterMessage } from '@/systems/dialogue/types';
import { loadTangAiConfig } from '@/systems/tang-api-test';
import { shouldSkipAi, type NarrationOptions } from '@/systems/tang-narrator';

/** AI 生成内容类型（5.1） */
export type AiContentType =
  | 'greeting' // 客人开场白
  | 'reply' // 客人回应
  | 'resolution' // 成交/失败叙事
  | 'event' // 事件叙事
  | 'reminder' // 店员提醒
  | 'review' // 客人评价（留言簿）
  | 'node_story' // 节点微型故事
  | 'monthly'; // 月度总结

/** 各场景系统提示词（5.2：AI 为唐朝说书人/百姓，熟悉长安地理物价，口语化偶有文采） */
export const AI_SYSTEM_PROMPTS: Record<AiContentType, string> = {
  greeting: '你是一位唐朝长安城的百姓，即将走进一家店铺消费。请以你的身份说一句进店开场白（1-2 句），口语化，符合唐代市井语言风格。不要替掌柜做决定，不要编造系统没给你的数字。',
  reply: '你是一位唐朝长安城的百姓，正在店里与掌柜说话。请以你的身份回应掌柜刚才的话（1-3 句），口语化，符合唐代市井语言风格。不要替掌柜做决定，不要编造系统没给你的数字。',
  resolution: '你是一位唐朝说书人，为一次店铺接待写结果场景描写（3-5 句，旁白风格，含一句客人关键台词）。基于给定的客人身份与结果展开，不要改变结果，不要编造数字。',
  event: '你是一位唐朝说书人，为一段店铺事件写场景描写（3-5 句，旁白风格，描写场景、人物神态、气氛）。基于玩家选择展开，不要改变事件结果。',
  reminder: '你是一位唐朝店铺里的伙计/账房/护卫，正在向掌柜提出一句简短的提醒或建议（1-2 句，含一句建议操作）。语气符合你的身份：阿昭活泼贴心、账房严谨细致、厨师专注、裁缝心细、药师仁和、护卫警觉干练。',
  review: '你是一位在店铺消费过的长安百姓，临走时在留言簿上写一句评价（1 句，10-20 字）。古风、实在、符合你的身份。',
  node_story: '你是一位唐朝说书人，为长安一处地点写一段所见所闻（3-5 句，旁白风格，描写景物、人物、气氛）。基于给定的节点、季节与店铺声望展开。',
  monthly: '你是一位唐朝说书人，为掌柜写一份月度总结（80-120 字，旁白风格，提及本月得失与展望）。不要编造系统没给你的数字。',
};

/** 生成选项 */
export interface AiGenerateOptions extends NarrationOptions {
  /** 超时（ms；缺省 8000 = v1.1 规格 8 秒） */
  timeoutMs?: number;
  /** 类型开关（aiContentToggles；缺省开启） */
  enabled?: boolean;
  /** 日志回调（5.6 调试：最近请求/成功率） */
  onLog?: (entry: { type: AiContentType; ok: boolean; latencyMs: number; source: 'ai' | 'template' }) => void;
}

export interface AiGenerateResult {
  text: string;
  source: 'ai' | 'template';
}

/** 统一生成入口（5.5：优先级检查 → AI（8s 超时）→ 静默降级模板） */
export async function generateAiText(
  type: AiContentType,
  params: { userPrompt: string; fallback: string },
  opts: AiGenerateOptions = {}
): Promise<AiGenerateResult> {
  const started = Date.now();
  const tianji = await loadTangAiConfig();
  const tianjiReady = !!tianji?.configured && !!tianji?.apiKey;
  const hasKey = tianjiReady || hasStoredApiKey();
  const enabled = opts.enabled ?? true;
  // 优先级：类型开关 → 在线 → API Key
  if (!enabled || shouldSkipAi({ enabled: true }, modeManager.isOnline, hasKey)) {
    opts.onLog?.({ type, ok: true, latencyMs: Date.now() - started, source: 'template' });
    return { text: params.fallback, source: 'template' };
  }

  const model = tianjiReady ? tianji!.model : (opts.model ?? 'openai/gpt-4o-mini');
  const apiKey = tianjiReady ? tianji!.apiKey : (getStoredApiKey() ?? '');
  const messages: OpenRouterMessage[] = [
    { role: 'system', content: AI_SYSTEM_PROMPTS[type] },
    { role: 'user', content: params.userPrompt },
  ];
  const config: LLMConfig = {
    model,
    temperature: 0.9,
    maxTokens: 300,
    streamTimeout: opts.timeoutMs ?? 8000,
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
    opts.onLog?.({ type, ok, latencyMs: Date.now() - started, source: ok ? 'ai' : 'template' });
    return ok ? { text, source: 'ai' } : { text: params.fallback, source: 'template' };
  } catch (error) {
    console.warn('[tang-ai-generator] AI 生成失败，降级模板：', error);
    opts.onLog?.({ type, ok: false, latencyMs: Date.now() - started, source: 'template' });
    return { text: params.fallback, source: 'template' };
  }
}

/** 便捷：店员提醒文本 AI 润色（5.1；fallback 为模板原文） */
export function generateAiReminderText(
  staffName: string,
  content: string,
  suggestion: string,
  opts: AiGenerateOptions = {}
): Promise<AiGenerateResult> {
  const userPrompt =
    '你在店里提醒掌柜：' + content + '（建议：' + suggestion + '）。请按' + staffName + '的身份与语气润色成一句简短提醒（保持原意与建议）。';
  return generateAiText('reminder', { userPrompt, fallback: content }, opts);
}

/** 便捷：客人评价 AI 生成（5.1；fallback 来自留言簿模板池） */
export function generateAiGuestReview(
  guestName: string,
  fallback: string,
  opts: AiGenerateOptions = {}
): Promise<AiGenerateResult> {
  const userPrompt = '你是客人' + guestName + '，在留言簿上写一句评价。';
  return generateAiText('review', { userPrompt, fallback }, opts);
}

/** 便捷：节点故事 AI 生成（5.1；fallback 为模板故事） */
export function generateAiNodeStory(
  nodeName: string,
  season: string,
  fallback: string,
  opts: AiGenerateOptions = {}
): Promise<AiGenerateResult> {
  const userPrompt = '地点：' + nodeName + '。当前季节：' + season + '。请写一段首次到访的所见所闻。';
  return generateAiText('node_story', { userPrompt, fallback }, opts);
}
