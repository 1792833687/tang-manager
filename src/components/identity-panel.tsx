/**
 * 身份阶段（identity）面板
 * 家传手札四段 → 场景描写 → 阿昭台词 → 身份表单（姓名/性别/年龄）→ 确认。
 * 确认后：setPlayerIdentity + setPhase('shop-type')。
 */
'use client';
import { useState } from 'react';
import {
  AZHAO_IDENTITY_LINE,
  FAMILY_LEDGER_PARAGRAPHS,
  OPENING_SCENE,
} from '@/config/tang-narrative';
import { withBase } from '@/lib/utils/base-path';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT, ANCIENT_ASSETS } from '@/theme/tokens';
import type { AgeBand, Gender } from '@/types/tang-manager';
import { AncientCard } from './ancient-card';

const GENDER_OPTIONS: ReadonlyArray<{ value: Gender; label: string }> = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
];

const AGE_OPTIONS: ReadonlyArray<{ value: AgeBand; label: string }> = [
  { value: 'young', label: '少年' },
  { value: 'adult', label: '青年' },
  { value: 'middle', label: '中年' },
];

export function IdentityPanel(): React.ReactElement {
  const setPlayerIdentity = useTangManagerStore((s) => s.setPlayerIdentity);
  const setPhase = useTangManagerStore((s) => s.setPhase);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [age, setAge] = useState<AgeBand>('young');

  const canConfirm = name.trim().length > 0;

  const handleConfirm = (): void => {
    if (!canConfirm) {
      return;
    }
    setPlayerIdentity({ name: name.trim(), gender, age });
    setPhase('shop-type');
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {/* 家传手札 · 开场四段 */}
      <AncientCard title="家传手札" accent={ANCIENT.gold}>
        <div className="flex flex-col gap-3">
          {FAMILY_LEDGER_PARAGRAPHS.map((para) => (
            <p
              key={para}
              className="leading-loose tracking-wide"
              style={{ color: ANCIENT.text, textIndent: '2em' }}
            >
              {para}
            </p>
          ))}
        </div>
      </AncientCard>

      {/* 场景描写 */}
      <AncientCard>
        <p className="leading-loose tracking-wide" style={{ color: ANCIENT.text, textIndent: '2em' }}>
          {OPENING_SCENE}
        </p>
      </AncientCard>

      {/* 阿昭台词 */}
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
          {AZHAO_IDENTITY_LINE}
        </p>
      </div>

      {/* 身份表单 */}
      <AncientCard title="掌柜身份">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm tracking-widest" style={{ color: ANCIENT.secondary }}>
              姓名
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={8}
              placeholder="请输入掌柜名讳"
              className="rounded-lg px-3 py-3 outline-none"
              style={{
                backgroundColor: ANCIENT.background,
                border: `1px solid ${ANCIENT.border}`,
                color: ANCIENT.text,
              }}
            />
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-sm tracking-widest" style={{ color: ANCIENT.secondary }}>
              性别
            </span>
            <div className="flex gap-3">
              {GENDER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGender(opt.value)}
                  className="min-h-11 flex-1 rounded-lg py-2 tracking-widest transition-transform active:scale-[0.97]"
                  style={
                    gender === opt.value
                      ? { backgroundColor: ANCIENT.primary, color: '#FFFFFF', border: `1px solid ${ANCIENT.primary}` }
                      : { backgroundColor: ANCIENT.background, color: ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-sm tracking-widest" style={{ color: ANCIENT.secondary }}>
              年龄
            </span>
            <div className="flex gap-3">
              {AGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAge(opt.value)}
                  className="min-h-11 flex-1 rounded-lg py-2 tracking-widest transition-transform active:scale-[0.97]"
                  style={
                    age === opt.value
                      ? { backgroundColor: ANCIENT.primary, color: '#FFFFFF', border: `1px solid ${ANCIENT.primary}` }
                      : { backgroundColor: ANCIENT.background, color: ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="mt-1 min-h-11 rounded-lg py-3 text-base font-bold tracking-[0.4em] transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              backgroundColor: ANCIENT.primary,
              color: '#FFFFFF',
              backgroundImage: `url(${withBase(ANCIENT_ASSETS.btnBg)})`,
              backgroundSize: 'cover',
            }}
          >
            确认
          </button>
        </div>
      </AncientCard>
    </div>
  );
}
