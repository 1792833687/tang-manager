/**
 * 药铺坐诊面板（2026-08-06 · 规格书模块二）
 * 症状选择 → 模糊提示（随知识等级）→ 选药（主/辅/引）→ 开方 → 匹配度档位。
 * 全部 ANCIENT 令牌；只调 store action + 纯函数。
 */
'use client';
import { useMemo, useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { DIAGNOSES, generateSymptomHints, evaluatePrescription, matchTier, herbName } from '@/systems/tang-diagnosis';
import { MEDICAL_LEVEL_LABEL, medicalKnowledgeLevel, MEDICAL_BOOKS, MEDICAL_BOOK_MAP } from '@/config/tang-medical-books';
import { ANCIENT } from '@/theme/tokens';
import { pushActionFeedback } from '@/components/action-feedback';

export function DiagnosisPanel(): React.ReactElement {
  const s = useTangManagerStore();
  const knowledge = medicalKnowledgeLevel(s.ownedMedicalBooks);
  const [symptoms, setSymptoms] = useState(DIAGNOSES[0]!.symptoms);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<{ match: number; tier: 'great' | 'ok' | 'poor' } | null>(null);

  const hints = useMemo(() => generateSymptomHints(symptoms, s.ownedMedicalBooks), [symptoms, s.ownedMedicalBooks]);
  const correct = DIAGNOSES.find((d) => d.symptoms === symptoms) ?? null;
  const herbPool = useMemo(() => {
    const set = new Set<string>();
    for (const d of DIAGNOSES) d.requiredHerbs.forEach((h) => set.add(h));
    return [...set];
  }, []);

  const toggleHerb = (id: string): void => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setResult(null);
  };

  const prescribe = (): void => {
    const ok = s.performDiagnosis('diag');
    if (!ok.ok) { pushActionFeedback(ok.reason ?? '坐诊失败', 'warning'); return; }
    const match = evaluatePrescription(selected, correct, s.ownedMedicalBooks);
    const tier = matchTier(match);
    setResult({ match, tier });
    if (tier === 'great') { s.updateReputation(5); pushActionFeedback('药到病除，客人千恩万谢（声望+5）', 'success'); }
    else if (tier === 'poor') { pushActionFeedback('药不对症，客人摇头而去', 'warning'); }
    else { pushActionFeedback('疗效平平，尚可交代', 'success'); }
  };

  const tierLabel: Record<'great' | 'ok' | 'poor', { text: string; color: string }> = {
    great: { text: '疗效显著（声望+5）', color: ANCIENT.primary },
    ok: { text: '疗效一般', color: ANCIENT.secondary },
    poor: { text: '疗效不佳', color: ANCIENT.accent },
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* 知识等级 */}
      <div className="rounded-xl px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}` }}>
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold" style={{ color: ANCIENT.gold }}>医术 · Lv{knowledge}</span>
          <span style={{ color: ANCIENT.secondary }}>{MEDICAL_LEVEL_LABEL[knowledge]}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {MEDICAL_BOOKS.map((b) => {
            const owned = (s.ownedMedicalBooks ?? []).includes(b.id);
            return (
              <button key={b.id} type="button" disabled={owned} onClick={() => { const r = s.purchaseMedicalBook(b.id); pushActionFeedback(r.ok ? '已购 ' + b.name : (r.reason ?? '购买失败'), r.ok ? 'success' : 'warning'); }} className="rounded px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: owned ? ANCIENT.primary : ANCIENT.background, color: owned ? '#FFF' : ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}>{b.name}{owned ? ' ✓' : ''}</button>
            );
          })}
        </div>
      </div>

      {/* 症状选择 */}
      <div className="rounded-xl px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
        <div className="text-xs font-bold tracking-[0.3em]" style={{ color: ANCIENT.secondary }}>客述症状</div>
        <select value={symptoms} onChange={(e) => { setSymptoms(e.target.value); setResult(null); }} className="mt-1 w-full rounded px-2 py-1 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.text }}>
          {DIAGNOSES.map((d) => (<option key={d.id} value={d.symptoms}>{d.symptoms}</option>))}
        </select>
        <div className="mt-1.5 text-[11px] leading-5" style={{ color: ANCIENT.secondary }}>
          {hints.hints.map((h, i) => (<p key={i}>· {h}</p>))}
        </div>
      </div>

      {/* 选药 */}
      <div className="rounded-xl px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
        <div className="text-xs font-bold tracking-[0.3em]" style={{ color: ANCIENT.secondary }}>选配药材（主药+辅药+药引）</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {herbPool.map((h) => (
            <button key={h} type="button" onClick={() => toggleHerb(h)} className="rounded px-2 py-1 text-[11px]" style={{ backgroundColor: selected.includes(h) ? ANCIENT.gold : ANCIENT.background, color: selected.includes(h) ? '#FFF' : ANCIENT.text, border: `1px solid ${ANCIENT.border}` }}>{herbName(h)}</button>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <button type="button" onClick={prescribe} className="rounded-lg px-5 py-1.5 text-xs font-bold tracking-widest" style={{ backgroundColor: ANCIENT.primary, color: '#FFF' }}>开方（耗 10 精力）</button>
          {result && (
            <span className="text-xs font-bold" style={{ color: tierLabel[result.tier].color }}>
              {tierLabel[result.tier].text}（匹配 {result.match}%）
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
