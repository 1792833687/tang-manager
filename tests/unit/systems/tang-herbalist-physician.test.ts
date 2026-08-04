/** 药铺·坐堂医单测（产业系统 模块三 3.1） */
import { describe, expect, it } from 'vitest';
import { generatePhysician, maxPhysicians, physicianDailyPatients, physicianMistake, physicianPrescription, physicianSatisfactionChange, stockMatchesPrescription } from '@/systems/tang-herbalist-physician';

function rngSeq(seq: number[]): () => number { let i = 0; return () => seq[i++ % seq.length]!; }

describe('generatePhysician', () => {
  it('医术越高月薪越高、病人越多', () => {
    const p1 = generatePhysician(rngSeq([0, 0, 0]));
    const p5 = generatePhysician(rngSeq([0.99, 0.99, 0.99]));
    expect(p5.skill).toBeGreaterThan(p1.skill);
    expect(p5.salary).toBeGreaterThan(p1.salary);
    expect(p5.patientsPerDay).toBeGreaterThan(p1.patientsPerDay);
  });
});

describe('physicianDailyPatients / prescription / stock', () => {
  it('Lv5 病人翻倍', () => {
    const p = generatePhysician(rngSeq([0.5, 0.5, 0.5]));
    expect(physicianDailyPatients(p, 5)).toBe(p.patientsPerDay * 2);
  });
  it('开方药材与库存匹配判定', () => {
    const p = generatePhysician(rngSeq([0.5, 0.5, 0.5]));
    const rx = physicianPrescription(p, rngSeq([0]));
    expect(rx.length).toBeGreaterThanOrEqual(1);
    expect(stockMatchesPrescription(rx, { 人参: 1, 甘草: 1, 当归: 1, 黄连: 1, 枸杞: 1 })).toBe(true);
    expect(stockMatchesPrescription(rx, {})).toBe(false);
  });
});

describe('满意度/误诊/名额', () => {
  it('常缺药满意度下降；鼓励上升', () => {
    expect(physicianSatisfactionChange({ satisfaction: 60 } as never, 3, false)).toBeLessThan(0);
    expect(physicianSatisfactionChange({ satisfaction: 60 } as never, 0, true)).toBe(10);
  });
  it('低医术有误诊概率', () => {
    expect(physicianMistake({ skill: 1 } as never, rngSeq([0]))).toBe(true);
    expect(physicianMistake({ skill: 4 } as never, rngSeq([0]))).toBe(false);
  });
  it('名额：Lv1-2 一位，Lv3 起两位', () => {
    expect(maxPhysicians(1)).toBe(1);
    expect(maxPhysicians(3)).toBe(2);
  });
});
