// 이력서 JSON 칸(경력·자격·훈련·학력·비상연락처·동의·서명)을 어드민 상세에서 항목별 줄로 펴는 문구 함수
import {
  ymRange,
  ymText,
  type Career,
  type Education,
  type ResumeQualification,
  type Signature,
  type Training,
} from '../../shared/resume-form'
import { fmtDateTime } from './datetime'

/** 빈 값은 빼고 ' · ' 로 잇는다 */
function joinParts(parts: (string | null | undefined)[]): string {
  return parts.filter((p) => p && p.trim()).join(' · ')
}

/** 객체 배열 칸 — 항목마다 한 줄. 배열이 아니거나 비면 빈 문자열(상세 화면이 「—」로 보인다) */
function lines<T>(value: unknown, line: (item: T) => string): string {
  if (!Array.isArray(value)) return ''
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => line(item as T))
    .filter(Boolean)
    .join('\n')
}

// 앱 이력서 작성 마지막 단계(dolbomdari app/resume/step5.tsx)의 동의 항목과 같은 순서·문구
const CONSENTS: [key: string, label: string][] = [
  ['personal_info', '[필수] 개인정보 수집·이용'],
  ['sensitive_info', '[필수] 민감정보(건강 등) 처리'],
  ['third_party', '[필수] 제3자 제공(지원 기관)'],
  ['org_change', '[선택] 근무 기관 변경 정보 수신'],
  ['marketing', '[선택] 마케팅 정보 수신'],
]

/** resumes 칸 이름 → 상세 문구. 열 순서는 서류 양식(RESUME_FORM)과 같다 */
export const RESUME_FIELD_TEXT: Record<string, (value: unknown) => string> = {
  careers: (v) => lines<Career>(v, (c) => joinParts([ymRange(c.start_ym, c.end_ym), c.company, c.duty])),
  qualifications: (v) =>
    lines<ResumeQualification>(v, (q) => joinParts([ymText(q.acquired_ym), q.name, q.issuer])),
  trainings: (v) => lines<Training>(v, (t) => joinParts([ymText(t.completed_ym), t.name, t.institution])),
  educations: (v) =>
    lines<Education>(v, (e) => joinParts([ymRange(e.start_ym, e.end_ym), e.school, e.major, e.status])),
  emergency_contact: (v) => {
    const c = v as { relation?: string; phone?: string } | null
    return c && typeof c === 'object' ? joinParts([c.relation, c.phone]) : ''
  },
  consents: (v) => {
    if (!v || typeof v !== 'object') return ''
    const c = v as Record<string, unknown>
    return CONSENTS.map(([key, label]) => `${label} — ${c[key] ? '동의' : '동의 안 함'}`).join('\n')
  },
  signature: (v) => {
    const s = v as Signature | null
    if (!s || typeof s !== 'object') return ''
    return joinParts([s.name, s.signed_at ? fmtDateTime(s.signed_at) : ''])
  },
}
