/**
 * 天机阁 API 配置（tang-api-test）单测（体验优化 · 模块一）
 * 覆盖：配置存储读写清除（tang-ai-config）、脱敏、连接测试成功/失败/超时、
 *       narrator 优先使用天机阁配置（apiKey+model）集成验证。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { modeManager } from '@/infrastructure/mode/ModeManager';
import { mockFetch } from '../../setup';
import {
  API_TEST_TIMEOUT_MS,
  clearTangAiConfig,
  loadTangAiConfig,
  maskApiKey,
  saveTangAiConfig,
  testApiConnection,
} from '@/systems/tang-api-test';
import { generateNarration } from '@/systems/tang-narrator';
import type { NarrationContext } from '@/types/tang-manager';

function makeContext(): NarrationContext {
  return {
    type: 'settlement',
    shopName: '陆记酒楼',
    shopType: '酒楼',
    playerName: '陆掌柜',
    day: 3,
    settlement: { netIncome: 120, guestHighlights: ['胡商消费 30 两'], scoreChange: 0.02, reputationChange: 2 },
  };
}

beforeEach(() => {
  modeManager.reportNetwork(true);
  // 防用例间泄漏：setup afterEach 不清 sessionStorage，天机阁配置会跨用例残留
  clearTangAiConfig();
  // secure-storage 依赖 IndexedDB mock，但该 mock 不自动触发 onsuccess → openDB 永不 resolve 会挂死。
  // 测试中令 indexedDB.open 抛错 → getOrCreateKey 走 sessionStorage 降级路径（与模块注释文档一致），
  // saveTangAiConfig/loadTangAiConfig 在测试环境即通过该降级路径完成读写清除。
  (globalThis as { indexedDB: { open: () => never } }).indexedDB.open = () => {
    throw new Error('test: indexedDB unavailable');
  };
});

describe('脱敏 maskApiKey', () => {
  it('长 Key：前8 + **** + 后4', () => {
    expect(maskApiKey('sk-abcdefghijklmnopqrstuvwxyz-12345678')).toBe('sk-abcde****5678');
  });
  it('短 Key（≤12）：前4 + **** + 后4', () => {
    expect(maskApiKey('abcdefghijkl')).toBe('abcd****ijkl');
  });
  it('空串返回空', () => {
    expect(maskApiKey('')).toBe('');
  });
});

describe('配置存储（tang-ai-config）', () => {
  it('无配置 → loadTangAiConfig 返回 null', async () => {
    expect(await loadTangAiConfig()).toBeNull();
  });

  it('save → load 往返一致（apiKey/model/configured）', async () => {
    const ok = await saveTangAiConfig({ apiKey: 'sk-tianji-1234', model: 'deepseek-reasoner', configured: true });
    expect(ok).toBe(true);
    const cfg = await loadTangAiConfig();
    expect(cfg).not.toBeNull();
    expect(cfg?.apiKey).toBe('sk-tianji-1234');
    expect(cfg?.model).toBe('deepseek-reasoner');
    expect(cfg?.configured).toBe(true);
  });

  it('损坏 JSON → 返回 null（不 throw）', async () => {
    // 直接写入加密层（测试环境降级 sessionStorage 明文），模拟脏数据
    sessionStorage.setItem('ai-narrator-sec:tang-ai-config', '{not-json');
    expect(await loadTangAiConfig()).toBeNull();
  });

  it('清除 → loadTangAiConfig 返回 null（彻底删除）', async () => {
    await saveTangAiConfig({ apiKey: 'sk-keep', model: 'deepseek-chat', configured: true });
    clearTangAiConfig();
    expect(await loadTangAiConfig()).toBeNull();
  });

  it('model 缺省 → 回退默认 deepseek-chat', async () => {
    await saveTangAiConfig({ apiKey: 'sk-x', model: '', configured: true });
    const cfg = await loadTangAiConfig();
    expect(cfg?.model).toBe('deepseek-chat');
  });
});

describe('连接测试 testApiConnection', () => {
  it('空令牌 → 直接失败（不发起请求）', async () => {
    const r = await testApiConnection('', 'deepseek-chat');
    expect(r.success).toBe(false);
    expect(r.message).toContain('令牌空缺');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('成功：fetch ok → 天机已通', async () => {
    mockFetch.mockResponseOnce({ ok: true, status: 200 });
    const r = await testApiConnection('sk-valid', 'deepseek-chat');
    expect(r.success).toBe(true);
    expect(r.message).toContain('天机已通');
    // 请求只含「你好」且走 DeepSeek 直连 endpoint
    const [url, init] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('api.deepseek.com');
    const body = JSON.parse(String(init.body));
    expect(body.messages).toEqual([{ role: 'user', content: '你好' }]);
  });

  it('失败：fetch 401 → 天机未应（401）', async () => {
    mockFetch.mockResponseOnce({ ok: false, status: 401 });
    const r = await testApiConnection('sk-bad', 'deepseek-chat');
    expect(r.success).toBe(false);
    expect(r.message).toContain('401');
  });

  it('网络错误：fetch reject → 天机未通（不 throw）', async () => {
    mockFetch.mockRejectOnce(new Error('network down'));
    const r = await testApiConnection('sk-valid', 'openai/gpt-4o-mini');
    expect(r.success).toBe(false);
    expect(r.message).toContain('天机未通');
  });

  it('超时：fetch 挂起 → 逾时十息（AbortController + race）', async () => {
    vi.useFakeTimers();
    try {
      mockFetch.mockImplementationOnce(() => new Promise<never>(() => {}));
      const promise = testApiConnection('sk-slow', 'deepseek-chat');
      await vi.advanceTimersByTimeAsync(API_TEST_TIMEOUT_MS + 50);
      const r = await promise;
      expect(r.success).toBe(false);
      expect(r.message).toContain('逾时');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('narrator 接入天机阁配置（集成）', () => {
  it('configured 天机阁配置优先 → 用其 apiKey+model，createClient 正常调用', async () => {
    await saveTangAiConfig({ apiKey: 'sk-tianji', model: 'deepseek-chat', configured: true });
    const streamChatCompletion = vi.fn(
      async (_c: unknown, _m: unknown, cb: (t: string) => void): Promise<unknown> => {
        cb('天机');
        return { content: '天机' };
      }
    );
    const text = await generateNarration(makeContext(), {
      createClient: () => ({ streamChatCompletion }),
    });
    expect(text).toBe('天机');
    const config = streamChatCompletion.mock.calls[0]?.[0] as { model: string };
    expect(config.model).toBe('deepseek-chat');
  });

  it('未配置天机阁 + 无凛冬要塞 key → 直接降级模板（不调用 createClient）', async () => {
    const createClient = vi.fn();
    const text = await generateNarration(makeContext(), { createClient });
    expect(text).toContain('夜深人静');
    expect(createClient).not.toHaveBeenCalled();
  });

  it('tianji 配置优先于 opts.model（避免 key/model 不匹配）', async () => {
    await saveTangAiConfig({ apiKey: 'sk-tianji', model: 'deepseek-reasoner', configured: true });
    const streamChatCompletion = vi.fn(async (): Promise<unknown> => ({ content: 'x' }));
    await generateNarration(makeContext(), {
      model: 'openai/gpt-4o-mini', // 旧存档残留模型 → 应被天机阁配置覆盖
      createClient: () => ({ streamChatCompletion }),
    });
    const config = streamChatCompletion.mock.calls[0]?.[0] as { model: string };
    expect(config.model).toBe('deepseek-reasoner');
  });
});
