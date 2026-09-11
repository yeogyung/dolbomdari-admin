// 이력서 서류 양식 정의 — 섹션 순서·라벨·기본 행 수와 표시 포맷 헬퍼
//
// ⚠ 이 양식은 세 곳에 복제돼 있다. 하나를 고치면 셋을 모두 고쳐야 한다.
//   · dolbomdari-admin/shared/resume-form.ts        (이 파일 — 원본)
//   · dolbomdari-link/shared/resume-form.ts         (복제)
//   · dolbomdari-admin/server/utils/resume-pdf.ts   (PDF 렌더러가 이 표를 따른다)
// 근거 양식: dolbomdari-link/docs/이력서_양식.hwp

export type Career = { company: string; start_ym: string; end_ym: string | null; duty: string }
export type ResumeQualification = { name: string; acquired_ym: string; issuer: string }
export type Training = { name: string; completed_ym: string | null; institution: string }
export type Education = {
  school: string
  major: string
  start_ym: string | null
  end_ym: string | null
  status: string
}
export type Signature = { name: string; signed_at: string }

export interface Resume {
  id: string
  user_id: string
  status: 'draft' | 'completed'
  name: string
  birth_date: string | null
  phone: string
  base_address: string
  detail_address: string
  careers: Career[]
  qualifications: ResumeQualification[]
  trainings: Training[]
  educations: Education[]
  signature: Signature | null
  updated_at: string
}

/** 섹션 하나 — 좌측 라벨, 열 셋, 양식상 기본 행 수 */
export interface FormSection {
  key: 'careers' | 'qualifications' | 'trainings' | 'educations'
  label: string
  columns: [string, string, string]
  minRows: number
}

export const RESUME_FORM: FormSection[] = [
  { key: 'careers', label: '경력 사항', columns: ['근무기간', '근무처', '업무내용'], minRows: 5 },
  {
    key: 'qualifications',
    label: '자격 사항',
    columns: ['취득년월일', '자격/면허증', '발행처'],
    minRows: 3,
  },
  { key: 'trainings', label: '훈련 사항', columns: ['훈련기간', '훈련명', '훈련기관'], minRows: 1 },
  { key: 'educations', label: '최종 학력', columns: ['기간', '학교명', '전공분야'], minRows: 1 },
]

/** 'YYYY-MM' → 'YYYY.MM'. 빈 값은 빈 문자열 */
export function ymText(v: string | null): string {
  if (!v) return ''
  return v.replace('-', '.')
}

/** 기간 표기. 끝이 없으면 재직중, 시작이 없으면 끝만 */
export function ymRange(start: string | null, end: string | null): string {
  const s = ymText(start)
  const e = ymText(end)
  if (!s && !e) return ''
  if (!s) return e
  return `${s} ~ ${e || '재직중'}`
}

/** 'YYYY-MM-DD' → 'YYYY년 M월 D일' */
export function birthText(v: string | null): string {
  if (!v) return ''
  const [y, m, d] = v.split('-')
  if (!y || !m || !d) return ''
  return `${y}년 ${Number(m)}월 ${Number(d)}일`
}

/** 기본주소 ＋ 상세주소 */
export function addressText(base: string, detail: string): string {
  return [base, detail].filter((s) => s && s.trim()).join(' ')
}

/**
 * 섹션의 행을 [1열, 2열, 3열] 문자열 배열로 만든다.
 * 세 렌더러(admin HTML · link HTML · PDF)가 모두 이 함수를 거쳐야 표기가 갈리지 않는다.
 *
 * 훈련 사항의 1열은 양식 헤더가 '훈련기간'이지만 수료년월만 넣는다 —
 * DB 에 시작일이 없고 수집하지 않기로 했다 (설계 D13).
 */
export function sectionRows(resume: Resume, key: FormSection['key']): [string, string, string][] {
  switch (key) {
    case 'careers':
      return (resume.careers ?? []).map((c) => [
        ymRange(c.start_ym, c.end_ym),
        c.company ?? '',
        c.duty ?? '',
      ])
    case 'qualifications':
      return (resume.qualifications ?? []).map((q) => [
        ymText(q.acquired_ym),
        q.name ?? '',
        q.issuer ?? '',
      ])
    case 'trainings':
      return (resume.trainings ?? []).map((t) => [
        ymText(t.completed_ym),
        t.name ?? '',
        t.institution ?? '',
      ])
    case 'educations':
      return (resume.educations ?? []).map((e) => [
        ymRange(e.start_ym, e.end_ym),
        e.school ?? '',
        e.major ?? '',
      ])
  }
}
