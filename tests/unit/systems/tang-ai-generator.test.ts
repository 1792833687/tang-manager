/**
 * AI 文本生成统一调用层单测（v1.1 模块五 5.5）
 * 覆盖：关闭/离线/无 key → 模板降级；mock client 成功 → AI 文本；失败 → 静默降级；日志记录。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { modeManager } from '@/infrastructure/mode/ModeManager';
import { AI_SYSTEM_PROMPTS, generateAiNodeStory, generateAiReminderText, generateAiText } from '@/systems/tang-ai-generator';

function mockClient(text: string) {
  return {
    createClient: () => ({
      streamChatCompletion: async (_config: unknown, _msgs: unknown, onChunk: (c: string) => void) => {
        onChunk(text);
      },
    }),
  };
}

beforeEach(() => {
  modeManager.reportNetwork(true);
  (globalThis as { indexedDB: { open: () => never } }).indexedDB.open = () => {
    throw new Error('test: indexedDB unavailable');
  };
});

describe('generateAiText（降级路径）', () => {
  it('类型开关关闭 → 模板降级', async () => {
    const r = await generateAiText('greeting', { userPrompt: 'x', fallback: '模板开场白' }, { enabled: false });
    expect(r.source).toBe('template');
    expect(r.text).toBe('模板开场白');
  });
  it('AI 成功 → 返回 AI 文本', async () => {
    localStorage.setItem('ai-narrator-openrouter-api-key', 'test-key');
    const r = await generateAiText('reminder', { userPrompt: 'x', fallback: '兜底' }, mockClient('掌柜的，留神些。'));
    expect(r.source).toBe('ai');
    expect(r.text).toContain('留神');
  });
  it('AI 返回空串 → 模板降级', async () => {
    localStorage.setItem('ai-narrator-openrouter-api-key', 'test-key');
    const r = await generateAiText('reply', { userPrompt: 'x', fallback: '兜底回复' }, mockClient('   '));
    expect(r.source).toBe('template');
  });
  it('AI 抛错 → 静默降级（不 throw）', async () => {
    const r = await generateAiText(
      'event',
      { userPrompt: 'x', fallback: '事件兜底' },
      { createClient: () => ({ streamChatCompletion: async () => { throw new Error('boom'); } }) }
    );
    expect(r.source).toBe('template');
    expect(r.text).toBe('事件兜底');
  });
  it('日志回调记录成功/失败与来源', async () => {
    localStorage.setItem('ai-narrator-openrouter-api-key', 'test-key');
    const logs: Array<{ source: string; ok: boolean }> = [];
    await generateAiText('reminder', { userPrompt: 'x', fallback: 'f' }, { ...mockClient('好'), onLog: (e) => logs.push(e) });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0]!.source).toBe('ai');
    expect(logs[0]!.ok).toBe(true);
  });
});

describe('系统提示词 / 便捷方法', () => {
  it('各类型均有系统提示词', () => {
    expect(AI_SYSTEM_PROMPTS.greeting.length).toBeGreaterThan(10);
    expect(AI_SYSTEM_PROMPTS.monthly.length).toBeGreaterThan(10);
  });
  it('generateAiReminderText / generateAiNodeStory 降级返回兜底', async () => {
    const r1 = await generateAiReminderText('阿昭', '提醒内容', '照办', { enabled: false });
    expect(r1.text).toBe('提醒内容');
    const r2 = await generateAiNodeStory('波斯邸', '秋', '故事兜底', { enabled: false });
    expect(r2.text).toBe('故事兜底');
  });
});
