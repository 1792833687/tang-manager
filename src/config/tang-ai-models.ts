/**
 * 天机阁模型预设（体验优化 · 模块一天机阁 API 配置窗口）
 * 5 个逐字预设：deepseek-chat（推荐默认）/ deepseek-reasoner / openai/gpt-4o-mini
 * / anthropic/claude-3-haiku / google/gemini-flash。
 * deepseek-chat / deepseek-reasoner 走 DeepSeek 直连 endpoint；其余走 OpenRouter 代理
 * （与 src/infrastructure/openrouter/client.ts getBaseUrlForModel 判定一致）。
 * @module config/tang-ai-models
 */

export interface AiModelPreset {
  /** 模型 id（传给 API 的 model 字段） */
  id: string;
  /** 展示名 */
  name: string;
  /** 一句话备注（古风措辞） */
  note: string;
}

export const MODEL_PRESETS: readonly AiModelPreset[] = [
  { id: 'deepseek-chat', name: 'DeepSeek-V3', note: '推荐·价廉物美，古风文笔佳' },
  { id: 'deepseek-reasoner', name: 'DeepSeek-R1', note: '深思熟虑，逻辑缜密' },
  { id: 'openai/gpt-4o-mini', name: 'OpenAI', note: '轻量够用' },
  { id: 'anthropic/claude-3-haiku', name: 'Claude', note: '文风细腻' },
  { id: 'google/gemini-flash', name: 'Google', note: '免费额度' },
] as const;

/** 默认模型（列表第一个） */
export const DEFAULT_MODEL_ID: string = MODEL_PRESETS[0]?.id ?? 'deepseek-chat';

/** 按 id 取预设（未知 id 回退默认） */
export function getModelPreset(id: string): AiModelPreset {
  return (
    MODEL_PRESETS.find((m) => m.id === id) ??
    MODEL_PRESETS[0] ?? { id: 'deepseek-chat', name: 'DeepSeek-V3', note: '推荐·价廉物美，古风文笔佳' }
  );
}
