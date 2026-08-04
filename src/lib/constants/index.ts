/**
 * 全局常量 — 《我在唐朝当掌柜》独立项目
 *
 * 说明：源仓库 lib/constants/index.ts 为「凛冬要塞」与唐朝掌柜共用的全局常量文件，
 * 其中大量常量（APP_NAME/WORLD_NAME/地图/存档等）为凛冬要塞独有，提取独立项目时
 * 仅保留唐朝掌柜代码实际引用的常量（经 grep 核对：src 下引用仅以下 5 个）。
 *
 * 校验依据：
 * - src/systems/tang-api-test.ts          → DEEPSEEK_BASE_URL, OPENROUTER_BASE_URL
 * - src/infrastructure/openrouter/client.ts → LLM_MAX_RETRIES, LLM_REQUEST_TIMEOUT_MS,
 *                                              LLM_RETRY_BASE_DELAY_MS, OPENROUTER_BASE_URL, DEEPSEEK_BASE_URL
 */

/** 重试策略：最大次数 */
export const LLM_MAX_RETRIES = 3;

/** LLM 请求超时 (ms) */
export const LLM_REQUEST_TIMEOUT_MS = 30000;

/** 重试策略：基础退避 (ms) */
export const LLM_RETRY_BASE_DELAY_MS = 1000;

/** OpenRouter API 端点（代理模型走这里） */
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1' as const;

/** DeepSeek 直连端点（deepseek-chat / deepseek-reasoner 走这里） */
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1' as const;
