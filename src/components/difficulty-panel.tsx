/**
 * 难度阶段（difficulty）面板
 * 阿昭引导语 → 三张难度卡片（A 绿 / B 金 / C 红，各含标签、格言与特性）
 * → 选中高亮 → 确认 → initByDifficulty（数值来自 DIFFICULTY_PARAMS）+ 进入 playing。
 */
'use client';
import { useState } from 'react';
import { difficultyTraitLines, getDifficultyParams } from '@/config/tang-difficulty';
import { AZHAO_DIFFICULTY_LINE } from '@/config/tang-narrative';
import { withBase } from '@/lib/utils/base-path';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT, ANCIENT_ASSETS } from '@/theme/tokens';
import type { Difficulty } from '@/types/tang-manager';
import { AncientCard } from './ancient-card';

const DIFFICULTY_ORDER: readonly Difficulty[] = ['A', 'B', 'C'];

/** 难度 → 主题色（A 竹青 / B 描金 / C 朱砂） */
const DIFFICULTY_ACCENT: Record<Difficulty, string> = {
  A: ANCIENT.primary,
  B: ANCIENT.gold,
  C: ANCIENT.accent,
};

export function DifficultyPanel(): React.ReactElement {
  const initByDifficulty = useTangManagerStore((s) => s.initByDifficulty);
  const [selected, setSelected] = useState<Difficulty | null>(null);

  const handleConfirm = (): void => {
    if (selected === null) {
      return;
    }
    initByDifficulty(selected);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {/* 阿昭引导语 */}
      <div
        className="rounded-xl px-6 py-4"
        style={{
          backgroundColor: ANCIENT.primary,
          color: '#FFFFFF',
          border: `2px solid ${ANCIENT.border}`,
        }}
      >
        <p className="text-base tracking-widest">
          <span className="mr-2">阿昭：</span>
          {AZHAO_DIFFICULTY_LINE}
        </p>
      </div>

      {/* 三张难度卡片 */}
      <div className="grid gap-4 sm:grid-cols-3">
        {DIFFICULTY_ORDER.map((diff) => {
          const params = getDifficultyParams(diff);
          const accent = DIFFICULTY_ACCENT[diff];
          const isSelected = selected === diff;
          return (
            <button
              key={diff}
              type="button"
              onClick={() => setSelected(diff)}
              className="flex flex-col gap-3 rounded-xl px-4 py-5 text-left transition-transform hover:-translate-y-1"
              style={{
                backgroundColor: ANCIENT.card,
                border: isSelected ? `3px solid ${accent}` : `2px solid ${accent}`,
                boxShadow: isSelected ? `0 0 0 1px ${ANCIENT.gold} inset, 0 8px 18px rgba(60,40,20,0.14)` : undefined,
                opacity: selected !== null && !isSelected ? 0.6 : 1,
              }}
            >
              <span className="text-xs tracking-[0.3em]" style={{ color: accent }}>
                {diff} 档
              </span>
              <span className="text-lg font-bold tracking-[0.15em]" style={{ color: ANCIENT.text }}>
                {params.label}
              </span>
              <span className="text-sm font-semibold leading-snug" style={{ color: accent }}>
                {params.tagline}
              </span>
              <ul className="flex flex-col gap-1.5">
                {difficultyTraitLines(params).map((line) => (
                  <li key={line} className="text-xs leading-relaxed" style={{ color: ANCIENT.secondary }}>
                    · {line}
                  </li>
                ))}
              </ul>
              {isSelected && (
                <span className="mt-1 text-sm font-bold tracking-widest" style={{ color: accent }}>
                  ✓ 已选中
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 确认按钮 */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={selected === null}
          className="w-full min-h-11 rounded-lg px-10 py-3 text-base font-bold tracking-[0.4em] transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 md:w-auto"
          style={{
            backgroundColor: ANCIENT.primary,
            color: '#FFFFFF',
            backgroundImage: `url(${withBase(ANCIENT_ASSETS.btnBg)})`,
            backgroundSize: 'cover',
          }}
        >
          开张
        </button>
      </div>
    </div>
  );
}
