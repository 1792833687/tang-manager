/**
 * AI 对话决策（规格书模块一）验收测试 — 纯函数层
 * 覆盖：prompt 构建 / 宽松 JSON 解析（含噪音容错）/ 兜底三选项抽取（数量与字段）/ 兜底客人回应三态度。
 */
import { describe, expect, it } from 'vitest';
import {
  buildDialogueOptionsPrompt,
  buildGuestResponsePrompt,
  parseDialogueOptionsJson,
  parseGuestResponseJson,
  pickFallbackOptions,
  pickFallbackGuestResponse,
  type AIDialogueOptions,
  type AIGuestResponse,
} from '@/systems/tang-ai-dialogue';
import { DIALOGUE_OPTION_TEMPLATES } from '@/config/tang-dialogue-fallbacks';

const guest = { id: 'g1', name: '李四', type: 'normal' as const, description: '想扯几尺布做身新衣', personality: '性情平和' };

describe('buildDialogueOptionsPrompt / buildGuestResponsePrompt', () => {
  it('prompt 含店铺名、客人身份、需求描述', () => {
    const p = buildDialogueOptionsPrompt(guest, 'buzhuang', { score: 2.0, signatureGoods: '蜀锦' });
    expect(p).toContain('布庄');
    expect(p).toContain('李四');
    expect(p).toContain('想扯几尺布做身新衣');
    expect(p).toContain('评分 2');
  });
  it('回应 prompt 含掌柜对话文本', () => {
    const p = buildGuestResponsePrompt(guest, '给您挑匹耐穿的好料', 'buzhuang');
    expect(p).toContain('给您挑匹耐穿的好料');
  });
});

describe('parseDialogueOptionsJson', () => {
  it('解析合法 JSON', () => {
    const text = '{"guestAnalysis":"分析","options":[{"text":"a","strategy":"品质","estimatedPrice":10,"estimatedSuccessRate":60,"risk":"r"}]}';
    const r = parseDialogueOptionsJson(text);
    expect(r).not.toBeNull();
    expect(r!.options).toHaveLength(1);
    expect(r!.options[0]!.estimatedPrice).toBe(10);
  });
  it('容忍前后噪音（AI 常带前言/后注）', () => {
    const text = '好的，这是分析：{"guestAnalysis":"分析","options":[{"text":"a","strategy":"品质","estimatedPrice":5,"estimatedSuccessRate":70,"risk":"r"}]} 希望对您有帮助';
    const r = parseDialogueOptionsJson(text);
    expect(r).not.toBeNull();
  });
  it('非法 JSON / 缺字段 → null', () => {
    expect(parseDialogueOptionsJson('不是JSON')).toBeNull();
    expect(parseDialogueOptionsJson('{"guestAnalysis":"x"}')).toBeNull();
    expect(parseDialogueOptionsJson('{"guestAnalysis":"x","options":[{"text":"a"}]}')).toBeNull();
  });
});

describe('parseGuestResponseJson', () => {
  it('解析 accept / hesitate / reject', () => {
    expect(parseGuestResponseJson('{"response":"r","attitude":"accept","finalPrice":8,"emotionChange":2}')!.attitude).toBe('accept');
    expect(parseGuestResponseJson('{"response":"r","attitude":"hesitate","extraCondition":"再便宜五两","emotionChange":-1}')!.attitude).toBe('hesitate');
    expect(parseGuestResponseJson('{"response":"r","attitude":"reject","emotionChange":-5}')!.attitude).toBe('reject');
  });
  it('态度非法 → null', () => {
    expect(parseGuestResponseJson('{"response":"r","attitude":"maybe"}')).toBeNull();
  });
});

describe('pickFallbackOptions', () => {
  it('每店兜底均返回 3 个选项，字段完整', () => {
    for (const shop of ['jiulou', 'buzhuang', 'yaopu'] as const) {
      const r: AIDialogueOptions = pickFallbackOptions(shop, () => 0.5);
      expect(r.options).toHaveLength(3);
      for (const o of r.options) {
        expect(typeof o.text).toBe('string');
        expect(typeof o.strategy).toBe('string');
        expect(typeof o.estimatedPrice).toBe('number');
        expect(typeof o.estimatedSuccessRate).toBe('number');
        expect(typeof o.risk).toBe('string');
      }
    }
  });
  it('DIALOGUE_OPTION_TEMPLATES 每店 ≥5 套', () => {
    for (const shop of ['jiulou', 'buzhuang', 'yaopu'] as const) {
      expect(DIALOGUE_OPTION_TEMPLATES[shop].length).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('pickFallbackGuestResponse', () => {
  it('三种态度均可出现，字段类型正确', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const r: AIGuestResponse = pickFallbackGuestResponse({ name: '王五' }, () => Math.random());
      seen.add(r.attitude);
      expect(r.response.length).toBeGreaterThan(0);
    }
    expect(seen.has('accept')).toBe(true);
    expect(seen.has('hesitate')).toBe(true);
    expect(seen.has('reject')).toBe(true);
  });
});
