// 월간 리포트 엑셀 내려받기의 시트 구성 — 요약 지표 한 장과 응답에 있는 표마다 한 장(QA 2026-11-07 ADMIN-08, 결정 D19)
import type { MonthlyReport, ReportBreakdown } from '../types/dbo'
import { excelStamp, type ExcelColumn, type ExcelSheet } from './excel'
import { fmtMinutes, pct } from './reports'

/** 내려받는 파일 이름 — 「돌봄다리_리포트_2026-11.xlsx」 */
export function reportFileName(month: string): string {
  return `돌봄다리_리포트_${month}.xlsx`
}

const SUMMARY_COLUMNS: ExcelColumn[] = [
  { key: 'group', label: '구분' },
  { key: 'item', label: '항목' },
  { key: 'value', label: '값' },
]

const BREAKDOWN_COLUMNS: ExcelColumn[] = [
  { key: 'shifts', label: '예정 근무' },
  { key: 'checkedIn', label: '출근 기록' },
  { key: 'rate', label: '출근 기록률' },
  { key: 'late', label: '지각' },
  { key: 'absent', label: '결석' },
  { key: 'excused', label: '인정 결석' },
  { key: 'missing', label: '미기록' },
]

const NOTICE_CATEGORIES = [
  { key: 'normal', label: '일반' },
  { key: 'special', label: '특별' },
  { key: 'urgent', label: '긴급' },
] as const

/** 요약 시트 — 화면의 요약·상태 분포·인력·공지·AI 카드 숫자를 「구분 · 항목 · 값」 줄로 */
function summaryRows(r: MonthlyReport): Record<string, unknown>[] {
  const a = r.attendance
  const p = r.people
  const n = r.notices
  const rows: Record<string, unknown>[] = []
  const add = (group: string, item: string, value: unknown) => rows.push({ group, item, value })

  add('기간', '집계 기간', `${r.firstDay} ~ ${r.through}`)
  add('출결', '예정 근무', a.shifts)
  add('출결', '출근 기록', a.checkedIn)
  add('출결', '출근 기록률', pct(a.checkedIn, a.shifts))
  add('출결', '출근', a.byStatus.present)
  add('출결', '지각', a.byStatus.late)
  add('출결', '결석', a.byStatus.absent)
  add('출결', '인정 결석', a.byStatus.excused)
  add('출결', '미기록', a.byStatus.missing)
  if (a.byStatus.other) add('출결', '기타', a.byStatus.other)
  add('출결', '총 근무시간', fmtMinutes(a.workedMinutes))
  add('출결', '총 근무시간(분)', a.workedMinutes)
  add('출결', '근무시간 집계 건수(출근·퇴근 모두 있음)', a.workedCount)
  add('출결', '기록 방법 QR', a.byMethod.qr)
  add('출결', '기록 방법 대리', a.byMethod.manual)
  if (a.byMethod.other) add('출결', '기록 방법 기타', a.byMethod.other)

  add('인력·운영', '근무한 시니어', p.workedSeniors)
  add('인력·운영', '활성 시니어', p.activeSeniors)
  add('인력·운영', '활성 담당자', p.activeManagers)
  add('인력·운영', '활성 근무지', p.activeWorksites)
  add('인력·운영', '앱 가입 시니어', p.seniorsWithApp)
  add('인력·운영', '앱 가입률', pct(p.seniorsWithApp, p.activeSeniors))
  add('인력·운영', '이 달 신규 등록', p.newSeniors)

  for (const c of NOTICE_CATEGORIES) {
    const s = n[c.key]
    add('공지', `${c.label} 공지 건수`, s.noticeCount)
    add('공지', `${c.label} 공지 열람`, s.read)
    add('공지', `${c.label} 공지 열람 가능`, s.readable)
    add('공지', `${c.label} 공지 열람률`, pct(s.read, s.readable))
    add('공지', `${c.label} 공지 평균 열람`, s.avgReadSeconds === null ? '' : fmtMinutes(Math.round(s.avgReadSeconds / 60)))
  }
  if (n.untracked) add('공지', '발송 이력이 없어 열람률에서 뺀 공지', n.untracked)
  add('공지', '문자 접수', n.delivery.sms.accepted)
  add('공지', '문자 접수 실패', n.delivery.sms.failed)
  if (n.smsResults) {
    add('공지', '문자 실제 실패(접수 실패 + 수신 실패)', n.smsResults.failed + n.smsResults.rejected)
    add('공지', '문자 결과 확인 중', n.smsResults.pending)
    add('공지', '문자 결과 모름', n.smsResults.unknown)
  }
  add('공지', '푸시 접수', n.delivery.push.accepted)
  add('공지', '푸시 실패', n.delivery.push.failed)

  if (r.ai) {
    add('AI 자동응답', '받은 질문', r.ai.questions)
    add('AI 자동응답', '자동응답', r.ai.autoAnswered)
    add('AI 자동응답', '담당자 전환', r.ai.handedOver)
    add('AI 자동응답', 'AI 자동응답률', pct(r.ai.autoAnswered, r.ai.questions))
  }
  return rows
}

const breakdown = (b: ReportBreakdown) => ({ ...b, rate: pct(b.checkedIn, b.shifts) })

/**
 * 시트 목록 — 「요약」 한 장, 그리고 응답에 있는 표(근무지별·사업별·일별·결석·미기록 상위·열람률 낮은 공지)마다 한 장.
 * 빈 표는 시트를 만들지 않는다.
 */
export function reportSheets(r: MonthlyReport): ExcelSheet[] {
  const a = r.attendance
  const programName = new Map(a.byProgram.map((p) => [p.programId, p.name]))
  const sheets: ExcelSheet[] = [{ name: '요약', rows: summaryRows(r), columns: SUMMARY_COLUMNS }]
  const table = (name: string, rows: Record<string, unknown>[], columns: ExcelColumn[]) => {
    if (rows.length) sheets.push({ name, rows, columns })
  }

  table(
    '근무지별',
    a.byWorksite.map((w) => ({ ...breakdown(w), name: w.name, program: w.programId ? (programName.get(w.programId) ?? '') : '' })),
    [{ key: 'name', label: '근무지' }, { key: 'program', label: '사업' }, ...BREAKDOWN_COLUMNS],
  )
  table('사업별', a.byProgram.map((p) => ({ ...breakdown(p), name: p.name })), [
    { key: 'name', label: '사업' },
    ...BREAKDOWN_COLUMNS,
  ])
  table(
    '일별',
    a.daily.map((d) => ({ ...d, other: Math.max(0, d.shifts - d.checkedIn - d.absent - d.missing) })),
    [
      { key: 'date', label: '날짜' },
      { key: 'shifts', label: '예정 근무' },
      { key: 'checkedIn', label: '출근 기록' },
      { key: 'absent', label: '결석' },
      { key: 'missing', label: '미기록' },
      { key: 'other', label: '그 외' },
    ],
  )
  table('결석·미기록 상위', a.topAbsentees, [
    { key: 'name', label: '이름' },
    { key: 'worksiteName', label: '주 근무지' },
    { key: 'shifts', label: '예정 근무' },
    { key: 'absent', label: '결석' },
    { key: 'missing', label: '미기록' },
  ])
  table(
    '열람률 낮은 공지',
    r.notices.lowest.map((x) => ({ ...x, publishedAt: excelStamp(x.publishedAt), rate: pct(x.read, x.readable) })),
    [
      { key: 'title', label: '제목' },
      { key: 'publishedAt', label: '발송 시각' },
      { key: 'read', label: '열람' },
      { key: 'readable', label: '열람 가능' },
      { key: 'rate', label: '열람률' },
    ],
  )
  return sheets
}
