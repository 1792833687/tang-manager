/**
 * AI 叙事着色服务单测（tang-narrator · Step 4 4.6）
 * 覆盖：系统提示三模板、降级模板插值、上下文序列化、守卫逻辑、
 *       generateNarration 正常/失败/空串/离线降级路径。
 * 铁律验证：AI 只读展示，失败/离线/禁用一律降级且不阻塞、不 throw。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { modeManager } from '@/infrastructure/mode/ModeManager';
import type { LLMResponse } from '@/systems/dialogue/types';
import {
  buildFallbackTemplate,
  buildSystemPrompt,
  generateNarration,
  serializeContext,
  shouldSkipAi,
} from '@/systems/tang-narrator';
import type { NarrationContext } from '@/types/tang-manager';

const API_KEY = 'ai-narrator-openrouter-api-key';

function makeContext(overrides: Partial<NarrationContext> = {}): NarrationContext {
  return {
    type: 'settlement',
    shopName: '陆记酒楼',
    shopType: '酒楼',
    playerName: '陆掌柜',
    day: 3,
    settlement: {
      netIncome: 120,
      guestHighlights: ['胡商（#大单）消费 30.0 两'],
      scoreChange: 0.02,
      reputationChange: 2,
    },
    ...overrides,
  };
}

function okResponse(content: string): LLMResponse {
  return {
    id: 'mock-1',
    model: 'openai/gpt-4o-mini',
    content,
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    latency: 10,
    timeToFirstToken: 5,
  };
}

beforeEach(() => {
  // 默认在线（syncing 亦视为 online）；单测按需覆盖
  modeManager.reportNetwork(true);
  // secure-storage 依赖 IndexedDB mock，但该 mock 不自动触发 onsuccess → openDB 永不 resolve 会挂死。
  // 测试中令 indexedDB.open 抛错 → getOrCreateKey 走 sessionStorage 降级路径（与模块注释文档一致），
  // loadTangAiConfig 快速返回 null，generateNarration 随后回退凛冬要塞 key 逻辑不变。
  (globalThis as { indexedDB: { open: () => never } }).indexedDB.open = () => {
    throw new Error('test: indexedDB unavailable');
  };
});

describe('纯函数：buildSystemPrompt', () => {
  it('三 type 返回不同且均含关键约束词「说书人」', () => {
    const s = buildSystemPrompt('settlement');
    const e = buildSystemPrompt('event');
    const a = buildSystemPrompt('achievement');
    expect(s).toContain('说书人');
    expect(e).toContain('说书人');
    expect(a).toContain('说书人');
    expect(s).not.toBe(e);
    expect(e).not.toBe(a);
    expect(a).not.toBe(s);
    // 各模板关键约束词
    expect(s).toContain('净收益');
    expect(s).toContain('不要编造任何系统没给你的数字');
    expect(e).toContain('场景');
    expect(e).toContain('不要改变事件的结果');
    expect(a).toContain('手札');
  });
});

describe('纯函数：buildFallbackTemplate', () => {
  it('三 type 正确；结算含 netIncome 插值、成就含 name 插值、事件为固定句', () => {
    const s = buildFallbackTemplate('settlement', makeContext());
    expect(s).toContain('120');
    expect(s).toContain('两');
    expect(s).toContain('夜深人静');

    const e = buildFallbackTemplate('event', {
      ...makeContext(),
      type: 'event',
      event: { title: '债主上门', description: '债主讨债', choiceLabel: '还钱', consequence: '月息照付' },
    });
    expect(e).toBe('（此事过后，掌柜的在手札上多记了一笔。）');

    const a = buildFallbackTemplate('achievement', {
      ...makeContext(),
      type: 'achievement',
      achievement: { name: '第一桶金', description: '单日净收益达到 100 两' },
    });
    expect(a).toContain('第一桶金');
    expect(a).toContain('手札微微发热');
  });
});

describe('纯函数：serializeContext', () => {
  it('结算/事件/成就均含各自关键字段', () => {
    const s = serializeContext(makeContext());
    expect(s).toContain('陆记酒楼');
    expect(s).toContain('第3天');
    expect(s).toContain('120');
    expect(s).toContain('胡商');

    const e = serializeContext({
      ...makeContext(),
      type: 'event',
      event: { title: '债主上门', description: '债主讨债', choiceLabel: '还钱', consequence: '月息照付' },
    });
    expect(e).toContain('债主上门');
    expect(e).toContain('还钱');

    const a = serializeContext({
      ...makeContext(),
      type: 'achievement',
      achievement: { name: '第一桶金', description: '单日净收益达到 100 两' },
    });
    expect(a).toContain('第一桶金');
  });
});

describe('纯函数：shouldSkipAi 守卫', () => {
  it('离线 → 跳过', () => {
    expect(shouldSkipAi(undefined, false, true)).toBe(true);
  });
  it('无 key → 跳过', () => {
    expect(shouldSkipAi(undefined, true, false)).toBe(true);
  });
  it('enabled=false → 跳过', () => {
    expect(shouldSkipAi({ enabled: false }, true, true)).toBe(true);
  });
  it('在线 + 有 key + 启用 → 不跳过', () => {
    expect(shouldSkipAi(undefined, true, true)).toBe(false);
  });
});

describe('generateNarration 主入口', () => {
  it('正常：mock createClient 累积 onChunk 返回文本并透传流式回调', async () => {
    localStorage.setItem(API_KEY, 'test-key');
    const onChunk = vi.fn();
    const streamChatCompletion = vi.fn(
      async (_c: unknown, _m: unknown, cb: (t: string) => void): Promise<LLMResponse> => {
        cb('夜深');
        cb('了');
        return okResponse('夜深了');
      }
    );
    const text = await generateNarration(makeContext(), {
      onChunk,
      createClient: () => ({ streamChatCompletion }),
    });
    expect(text).toBe('夜深了');
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, '夜深');
    expect(onChunk).toHaveBeenNthCalledWith(2, '了');
  });

  it('调用失败：mock reject → resolve 降级模板（不 throw）', async () => {
    localStorage.setItem(API_KEY, 'test-key');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const streamChatCompletion = vi.fn(async () => {
      throw new Error('network down');
    });
    const text = await generateNarration(makeContext(), {
      createClient: () => ({ streamChatCompletion }),
    });
    expect(text).toBe(buildFallbackTemplate('settlement', makeContext()));
    warnSpy.mockRestore();
  });

  it('空串返回降级模板', async () => {
    localStorage.setItem(API_KEY, 'test-key');
    const streamChatCompletion = vi.fn(
      async (): Promise<LLMResponse> => okResponse('   ')
    );
    const text = await generateNarration(makeContext(), {
      createClient: () => ({ streamChatCompletion }),
    });
    expect(text).toBe(buildFallbackTemplate('settlement', makeContext()));
  });

  it('离线：跳过 AI 调用，直接降级，createClient 不应被调用', async () => {
    modeManager.reportNetwork(false);
    localStorage.setItem(API_KEY, 'test-key');
    const createClient = vi.fn();
    const text = await generateNarration(makeContext(), { createClient });
    expect(text).toBe(buildFallbackTemplate('settlement', makeContext()));
    expect(createClient).not.toHaveBeenCalled();
  });

  it('无 API key：直接降级，createClient 不应被调用', async () => {
    const createClient = vi.fn();
    const text = await generateNarration(makeContext(), { createClient });
    expect(text).toBe(buildFallbackTemplate('settlement', makeContext()));
    expect(createClient).not.toHaveBeenCalled();
  });

  it('enabled=false：直接降级，createClient 不应被调用', async () => {
    localStorage.setItem(API_KEY, 'test-key');
    const createClient = vi.fn();
    const text = await generateNarration(makeContext(), { enabled: false, createClient });
    expect(text).toBe(buildFallbackTemplate('settlement', makeContext()));
    expect(createClient).not.toHaveBeenCalled();
  });
});

// ============================================================
// Step 5a 3.4：接待叙事（reception）
// ============================================================

function receptionContext(overrides: Partial<NarrationContext> = {}): NarrationContext {
  return {
    type: 'reception',
    shopName: '陆记酒楼',
    shopType: '酒楼',
    playerName: '陆掌柜',
    day: 3,
    reception: {
      guestName: '李四',
      guestTypeLabel: '#普通',
      storyTag: '试探',
      sceneHint: '目光在店堂间来回打量，话里有话',
      clue: '沈氏商号',
    },
    ...overrides,
  };
}

describe('接待叙事（reception）', () => {
  it('buildSystemPrompt：reception 模板含「说书人」「15-30字」「不编造数字」', () => {
    const p = buildSystemPrompt('reception');
    expect(p).toContain('说书人');
    expect(p).toContain('15-30字');
    expect(p).toContain('不要编造数字');
    expect(p).toContain('旁白');
  });

  it('buildFallbackTemplate：reception 降级为（{客人称呼}进店，{根据标签的简单描述}。）', () => {
    const t = buildFallbackTemplate('reception', receptionContext());
    expect(t).toBe('（李四进店，目光在店堂间来回打量，话里有话。）');
  });

  it('serializeContext：reception 含客人名称/类型/故事标签/线索关键词', () => {
    const s = serializeContext(receptionContext());
    expect(s).toContain('李四');
    expect(s).toContain('#普通');
    expect(s).toContain('试探');
    expect(s).toContain('沈氏商号');
    expect(s).toContain('细节暗示');
  });

  it('generateNarration：离线时 reception 走降级模板且不调用 createClient', async () => {
    modeManager.reportNetwork(false);
    const createClient = vi.fn();
    const text = await generateNarration(receptionContext(), { createClient });
    expect(text).toBe(buildFallbackTemplate('reception', receptionContext()));
    expect(createClient).not.toHaveBeenCalled();
  });
});
