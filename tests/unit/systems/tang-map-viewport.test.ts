/**
 * TANG-POLISH-001 模块三：BUG 修复 — 地图滚轮锚点（P0）验收测试
 *
 * 验证 points（systems/tang-map-viewport.ts）：
 * 1. 滚轮缩放以鼠标为锚点：缩放后锚点处世界坐标不变（P0 验收标准）
 * 2. 缩放上下限 clamp（0.6-2.5）
 * 3. 放大/缩小/跨方向均保持锚点
 * 4. 锚点在任意位置（角落/中心/偏点）均保持
 */
import { describe, expect, it } from 'vitest';
import { nextZoomWheel, worldAt, zoomAtAnchor, ZOOM_MAX, ZOOM_MIN } from '../../../src/systems/tang-map-viewport';

describe('TANG-POLISH-001 模块三：地图滚轮缩放以鼠标为锚点（P0）', () => {
  it('放大（zoom 1→1.1）：鼠标所指世界坐标保持不变', () => {
    const panX = 10, panY = 20;
    const anchorX = 50, anchorY = 40;
    const oldZoom = 1, nextZoom = 1.1;
    // 缩放前锚点世界坐标
    const wxBefore = worldAt(panX, anchorX, oldZoom);
    const wyBefore = worldAt(panY, anchorY, oldZoom);
    const { panX: nx, panY: ny } = zoomAtAnchor(panX, panY, anchorX, anchorY, nextZoom, oldZoom);
    // 缩放后同一锚点世界坐标
    const wxAfter = worldAt(nx, anchorX, nextZoom);
    const wyAfter = worldAt(ny, anchorY, nextZoom);
    expect(wxAfter).toBeCloseTo(wxBefore, 6);
    expect(wyAfter).toBeCloseTo(wyBefore, 6);
  });

  it('缩小（zoom 1→0.9）：鼠标所指世界坐标保持不变', () => {
    const panX = -5, panY = 8;
    const anchorX = 30, anchorY = 70;
    const oldZoom = 1, nextZoom = 0.9;
    const wxBefore = worldAt(panX, anchorX, oldZoom);
    const wyBefore = worldAt(panY, anchorY, oldZoom);
    const { panX: nx, panY: ny } = zoomAtAnchor(panX, panY, anchorX, anchorY, nextZoom, oldZoom);
    expect(worldAt(nx, anchorX, nextZoom)).toBeCloseTo(wxBefore, 6);
    expect(worldAt(ny, anchorY, nextZoom)).toBeCloseTo(wyBefore, 6);
  });

  it('锚点在任意位置（中心/角落/偏点）均保持', () => {
    const panX = 15, panY = -10;
    for (const [ax, ay] of [[50, 50], [0, 0], [100, 100], [23, 87]] as const) {
      const oldZoom = 1.2, nextZoom = 1.5;
      const wxBefore = worldAt(panX, ax, oldZoom);
      const wyBefore = worldAt(panY, ay, oldZoom);
      const { panX: nx, panY: ny } = zoomAtAnchor(panX, panY, ax, ay, nextZoom, oldZoom);
      expect(worldAt(nx, ax, nextZoom)).toBeCloseTo(wxBefore, 6);
      expect(worldAt(ny, ay, nextZoom)).toBeCloseTo(wyBefore, 6);
    }
  });

  it('连续多次缩放后锚点累积保持（不漂移）', () => {
    let panX = 0, panY = 0;
    let zoom = 1;
    const anchorX = 60, anchorY = 35;
    const steps = [1.1, 0.95, 1.2, 0.8, 1.05];
    for (const z of steps) {
      const next = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * z)) * 100) / 100;
      const { panX: nx, panY: ny } = zoomAtAnchor(panX, panY, anchorX, anchorY, next, zoom);
      panX = nx; panY = ny; zoom = next;
    }
    // 锚点世界坐标在初始（pan=0, zoom=1）为 (60, 35)，多次缩放后应保持不变
    expect(worldAt(panX, anchorX, zoom)).toBeCloseTo(60, 5);
    expect(worldAt(panY, anchorY, zoom)).toBeCloseTo(35, 5);
  });

  it('nextZoomWheel：向上滚（deltaY<0）放大、向下滚缩小，且 clamp 0.6-2.5', () => {
    expect(nextZoomWheel(1, -100)).toBe(1.1);
    expect(nextZoomWheel(1, 100)).toBe(0.9);
    expect(nextZoomWheel(2.45, -100)).toBeLessThanOrEqual(ZOOM_MAX);
    expect(nextZoomWheel(0.65, 100)).toBeGreaterThanOrEqual(ZOOM_MIN);
    // clamp 到边界
    expect(nextZoomWheel(2.5, -100)).toBe(ZOOM_MAX);
    expect(nextZoomWheel(0.6, 100)).toBe(ZOOM_MIN);
  });
});
