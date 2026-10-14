/** 월간 리포트 — GET /dbo-admin/reports/monthly. 원값만 온다(비율은 utils/reports.ts) */
export interface ReportBreakdown {
  shifts: number
  checkedIn: number
  late: number
  absent: number
  excused: number
  missing: number
}
export interface NoticeCategoryStats {
  noticeCount: number
  readable: number
  read: number
  avgReadSeconds: number | null
}
export interface MonthlyReport {
  month: string
  firstDay: string
  through: string
  attendance: {
    shifts: number
    byStatus: { present: number; late: number; absent: number; excused: number; missing: number; other: number }
    checkedIn: number
    workedMinutes: number
    workedCount: number
    byMethod: { qr: number; manual: number; other: number }
    daily: { date: string; shifts: number; checkedIn: number; absent: number; missing: number }[]
    byWorksite: (ReportBreakdown & { worksiteId: string; name: string; programId: string | null })[]
    byProgram: (ReportBreakdown & { programId: string | null; name: string })[]
    topAbsentees: { directoryId: string; name: string; worksiteName: string; shifts: number; absent: number; missing: number }[]
  }
  people: {
    activeSeniors: number
    activeManagers: number
    activeWorksites: number
    seniorsWithApp: number
    workedSeniors: number
    newSeniors: number
  }
  notices: {
    untracked: number
    normal: NoticeCategoryStats
    special: NoticeCategoryStats
    urgent: NoticeCategoryStats
    delivery: { sms: { accepted: number; failed: number }; push: { accepted: number; failed: number } }
    lowest: { id: string; title: string; publishedAt: string; readable: number; read: number }[]
  }
}
