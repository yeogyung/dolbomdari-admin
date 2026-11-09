// 자주 쓰는 근무 시간 묶음 — 배정 창에서 고르면 시작·종료 시간이 채워진다(QA 2026-11-07 SHIFT-06 · 결정 D27). 표 없이 이 목록을 고쳐 바꾼다
//
// 값을 정한 근거(2026-11-09, 운영 배정 시간 분포를 읽기만 해서 셈):
// - 종일 09:00–18:00 — 배정 64건으로 가장 많다.
// - 오전 09:00–12:00 — 8건으로 두 번째다.
// - 오후 13:00–16:00 — 오후 배정(13:00–15:00, 14:00–16:00 각 1건)이 있어 점심 뒤 오전과 같은 3시간으로 두었다.
// 배정 창의 처음 값(09:00–11:00)은 그대로 둔다 — 목록은 고를 때만 채운다.

export type ShiftTimePreset = { label: string; start: string; end: string }

export const SHIFT_TIME_PRESETS: ShiftTimePreset[] = [
  { label: '오전', start: '09:00', end: '12:00' },
  { label: '오후', start: '13:00', end: '16:00' },
  { label: '종일', start: '09:00', end: '18:00' },
]

/** 지금 시간이 그 묶음과 같은가 — 단추를 눌린 모양으로 보인다 */
export function isShiftPreset(p: ShiftTimePreset, start: string, end: string): boolean {
  return p.start === start && p.end === end
}
