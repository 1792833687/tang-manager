/**
 * 天机阁 API 连接测试与配置存储（体验优化 · 模块一）
 * - 配置存储：key 'tang-ai-config'，内容 { apiKey, model, configured }，经 secure-storage
 *   （AES-GCM 加密）落盘；与凛冬要塞 'ai-narrator-openrouter-api-key' 完全隔离。
 *   工程决策：优先复用 crypto 层（secureSet/secureGet/secureRemove）——该层在 IndexedDB
 *   不可用时自动降级 sessionStorage、Tauri 环境密文落本地文件，无需本模块重复实现。
 * - testApiConnection：极简请求（messages 只含「你好」）、10s 超时（AbortController + race）。
 *   纯前端直连，失败仅返回 { success, message }，绝不 throw。
 * @module systems/tang-api-test
 */
import { DEFAULT_MODEL_ID } from '@/config/tang-ai-models';
import { secureGet, secureRemove, secureSet } from '@/infrastructure/crypto/secure-storage';
import { DEEPSEEK_BASE_URL, OPENROUTER_BASE_URL } from '@/lib/constants';

// ============================================================
// 配置存储（天机阁专用；与凛冬要塞 key 隔离）
// ============================================================

/** 天机阁配置存储 key（与凛冬要塞 'ai-narrator-openrouter-api-key' 完全隔离） */
export const TANG_AI_CONFIG_KEY = 'tang-ai-config';

/** 天机阁配置内容 */
export interface TangAiConfig {
  apiKey: string;
  model: string;
  /** 是否已配置完成（保存成功置 true；清除后整体删除） */
  configured: boolean;
}

/** 读取天机阁配置；无配置/损坏返回 null（不 throw） */
export async function loadTangAiConfig(): Promise<TangAiConfig | null> {
  try {
    const raw = await secureGet(TANG_AI_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TangAiConfig>;
    if (!parsed || typeof parsed.apiKey !== 'string' || parsed.apiKey === '') return null;
    return {
      apiKey: parsed.apiKey,
      model: typeof parsed.model === 'string' && parsed.model !== '' ? parsed.model : DEFAULT_MODEL_ID,
      configured: parsed.configured !== false,
    };
  } catch {
    return null;
  }
}

/** 保存天机阁配置（加密存储；返回是否成功） */
export async function saveTangAiConfig(cfg: TangAiConfig): Promise<boolean> {
  return secureSet(TANG_AI_CONFIG_KEY, JSON.stringify(cfg));
}

/** 清除天机阁配置（彻底删除该 key） */
export function clearTangAiConfig(): void {
  secureRemove(TANG_AI_CONFIG_KEY);
}

/** 已存 Key 脱敏：前8 + **** + 后4（短 Key 缩为 前4+****+后4） */
export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 12) return `${key.slice(0, 4)}****${key.slice(-4)}`;
  return `${key.slice(0, 8)}****${key.slice(-4)}`;
}

// ============================================================
// 连接测试
// ============================================================

/** 连接测试结果 */
export interface ApiTestResult {
  success: boolean;
  message: string;
}

/** 连接测试超时（10s） */
export const API_TEST_TIMEOUT_MS = 10_000;

/** 模型 → endpoint（与 openrouter client getBaseUrlForModel 判定一致） */
export function apiBaseUrlFor(model: string): string {
  return model === 'deepseek-chat' || model === 'deepseek-reasoner' ? DEEPSEEK_BASE_URL : OPENROUTER_BASE_URL;
}

/**
 * 试连接天机阁：极简请求（messages 只含「你好」），10s 超时。
 * 成功 → { success: true, message: '天机已通，文思可待。' }；失败 → 中文原因（不 throw）。
 */
export async function testApiConnection(apiKey: string, model: string): Promise<ApiTestResult> {
  const key = apiKey.trim();
  if (key === '') {
    return { success: false, message: '令牌空缺，请先置入天机令牌。' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TEST_TIMEOUT_MS);
  // 超时以 race 实现：即使 fetch 实现忽略 signal（如测试 mock），abort 仍能立即拒绝
  const timeoutPromise = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  try {
    const fetchPromise = fetch(`${apiBaseUrlFor(model)}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: '你好' }],
        max_tokens: 8,
        stream: false,
      }),
      signal: controller.signal,
    });
    const res = await Promise.race([fetchPromise, timeoutPromise]);
    if (res.ok) {
      return { success: true, message: '天机已通，文思可待。' };
    }
    return { success: false, message: `天机未应（${res.status}）` };
  } catch (err) {
    if (controller.signal.aborted) {
      return { success: false, message: '天机迟迟不应（逾时十息）' };
    }
    return { success: false, message: `天机未通：${err instanceof Error ? err.message : '未知缘由'}` };
  } finally {
    clearTimeout(timer);
  }
}
