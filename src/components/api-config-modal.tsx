/**
 * 天机阁 · API 配置窗口（体验优化 · 模块一）
 * 古风弹窗卡：Key 输入（竹青边框/宣纸底，已存 Key 脱敏 前8+****+后4）、模型下拉
 * （5 预设默认 deepseek-chat）、「试连接」（成功绿/失败红原因）、「保存/清除/关闭」、
 * 状态标识 ✅已配置 / ⚠️未配置用降级模板 / ❌令牌无效。
 * 存储经 tang-api-test（secure-storage 加密，key 'tang-ai-config'，与凛冬要塞隔离）。
 */
'use client';
import { useEffect, useState } from 'react';
import { DEFAULT_MODEL_ID, MODEL_PRESETS } from '@/config/tang-ai-models';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import type { TangAiConfig } from '@/systems/tang-api-test';
import {
  clearTangAiConfig,
  loadTangAiConfig,
  maskApiKey,
  saveTangAiConfig,
  testApiConnection,
} from '@/systems/tang-api-test';

export function ApiConfigModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): React.ReactElement | null {
  const setAiModel = useTangManagerStore((s) => s.setAiModel);
  const [inputKey, setInputKey] = useState('');
  const [model, setModel] = useState<string>(DEFAULT_MODEL_ID);
  const [existing, setExisting] = useState<TangAiConfig | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // 打开时载入已存配置；输入框保持为空，仅以 placeholder 脱敏展示旧令牌
  useEffect(() => {
    if (!open) return;
    setInputKey('');
    setTestResult(null);
    void loadTangAiConfig().then((cfg) => {
      setExisting(cfg);
      if (cfg?.configured && cfg.model) setModel(cfg.model);
    });
  }, [open]);

  if (!open) return null;

  const effectiveKey = inputKey.trim() || existing?.apiKey || '';
  const masked = existing?.apiKey ? maskApiKey(existing.apiKey) : '';
  const status = existing?.configured
    ? { icon: '✅', text: '已配置', color: ANCIENT.primary }
    : { icon: '⚠️', text: '未配置用降级模板', color: ANCIENT.secondary };

  const handleTest = async (): Promise<void> => {
    if (!effectiveKey) {
      setTestResult({ success: false, message: '令牌空缺，请先置入天机令牌。' });
      return;
    }
    setTesting(true);
    setTestResult(await testApiConnection(effectiveKey, model));
    setTesting(false);
  };

  const handleSave = async (): Promise<void> => {
    if (!effectiveKey) return;
    const ok = await saveTangAiConfig({ apiKey: effectiveKey, model, configured: true });
    if (ok) {
      setExisting({ apiKey: effectiveKey, model, configured: true });
      setInputKey('');
      setAiModel(model); // 同步手札叙事默认模型（store 字段向后兼容）
      setTestResult({ success: true, message: '已录入天机阁，文思从此可待。' });
    } else {
      setTestResult({ success: false, message: '天机阁落笔未成（存储失败）。' });
    }
  };

  const handleClear = (): void => {
    clearTangAiConfig();
    setExisting(null);
    setInputKey('');
    setTestResult({ success: true, message: '天机令牌已涤除，此后用降级模板。' });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(44,44,44,0.55)' }} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl px-5 py-5"
        style={{ backgroundColor: ANCIENT.card, border: `2px solid ${ANCIENT.border}`, boxShadow: `0 0 0 1px ${ANCIENT.gold} inset, 0 18px 40px rgba(60,40,20,0.35)` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-lg font-bold tracking-[0.2em]" style={{ color: ANCIENT.primary, fontFamily: 'var(--font-ancient-serif)' }}>
            天机阁 · 文思泉涌
          </h3>
          <span className="rounded px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: status.color, color: '#FFFFFF' }}>
            {status.icon} {status.text}
          </span>
        </div>
        <p className="mb-4 text-xs leading-relaxed tracking-widest" style={{ color: ANCIENT.secondary }}>
          接入天机，以助文思——AI叙事需调用天机阁文心，请置入天机令牌。
        </p>

        <label className="mb-1 block text-xs tracking-widest" style={{ color: ANCIENT.secondary }}>
          天机令牌（API Key）
        </label>
        <input
          type="password"
          value={inputKey}
          onChange={(e) => setInputKey(e.target.value)}
          placeholder={masked || 'sk-……'}
          autoComplete="off"
          className="w-full rounded-lg px-3 py-2 text-sm"
          style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.primary}`, color: ANCIENT.text }}
        />
        {masked !== '' && (
          <p className="mt-1 text-xs" style={{ color: ANCIENT.border }}>
            已存令牌 {masked}（重新输入即可更换）
          </p>
        )}

        <label className="mb-1 mt-3 block text-xs tracking-widest" style={{ color: ANCIENT.secondary }}>
          文心模型
        </label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm"
          style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.text }}
        >
          {MODEL_PRESETS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {m.note}
            </option>
          ))}
        </select>

        {testResult && (
          <p
            className="mt-3 rounded-md px-3 py-2 text-xs leading-relaxed"
            style={{ backgroundColor: ANCIENT.background, border: `1px solid ${testResult.success ? ANCIENT.primary : ANCIENT.accent}`, color: testResult.success ? ANCIENT.primary : ANCIENT.accent }}
          >
            {testResult.success ? '✅' : '❌'} {testResult.message}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testing || !effectiveKey}
            className="rounded-md px-4 py-2 text-xs font-bold tracking-widest text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: ANCIENT.primary }}
          >
            {testing ? '试连中……' : '试连接'}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!effectiveKey}
            className="rounded-md px-4 py-2 text-xs font-bold tracking-widest text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: ANCIENT.border }}
          >
            保存
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={!existing?.configured}
            className="rounded-md px-4 py-2 text-xs font-bold tracking-widest text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: ANCIENT.accent }}
          >
            清除
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-md px-4 py-2 text-xs font-bold tracking-widest"
            style={{ color: ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
