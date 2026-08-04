/**
 * 地图视口锚点缩放纯函数（v1.0 打磨 TANG-POLISH-001 模块三；map-viewport）
 * P0 修复：滚轮/pinch 缩放以鼠标（或双指中点）为锚点，缩放后该点对应的世界坐标不变。
 * viewBox 0-100 百分比坐标；公式：
 *   屏幕坐标 = pan + world * scale
 *   缩放前后锚点 world 不变 → pan_new = anchor - (anchor - pan_old) * (newScale / oldScale)
 * 纯函数：便于单元测试验证「锚点保持」。
 */

/** 视口状态（pan 平移 + zoom 缩放倍数） */
export interface MapViewportState {
  panX: number;
  panY: number;
  zoom: number;
}

/** 缩放限制（与 map-view.tsx 保持一致） */
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 2.5;

/** 下一步 zoom（滚轮步进 ±0.1；pinch 用比例） */
export function nextZoomWheel(zoom: number, deltaY: number): number {
  const next = zoom + (deltaY < 0 ? 0.1 : -0.1);
  return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next)) * 100) / 100;
}

/** 锚点缩放：返回新的 pan（保持 anchor 处世界坐标不变）；ratio 由调用方按 nextZoom/oldZoom 计算 */
export function zoomAtAnchor(
  panX: number,
  panY: number,
  anchorX: number,
  anchorY: number,
  nextZoom: number,
  oldZoom: number
): { panX: number; panY: number } {
  const ratio = oldZoom > 0 ? nextZoom / oldZoom : 1;
  return {
    panX: anchorX - (anchorX - panX) * ratio,
    panY: anchorY - (anchorY - panY) * ratio,
  };
}

/** 校验锚点保持：缩放后 anchor 对应的世界坐标是否与缩放前一致（测试用） */
export function worldAt(pan: number, anchor: number, zoom: number): number {
  return (anchor - pan) / zoom;
}
