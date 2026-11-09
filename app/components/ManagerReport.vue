<!-- 담당자 월간 리포트 — 맡은 근무지의 출석률·주별 미기록·공지 열람. 앱 내정보 > 리포트와 같은 API·수치(QA 2026-11-07 MGR-04 · 결정 D4) -->
<script setup lang="ts">
// 앱 리포트 화면(`db-operation-rn/app/report.tsx`)의 카드 셋을 어드민 카드 모양으로 옮겼다. Figma 에 어드민 담당자 리포트가 없어
// master 리포트 화면의 카드·알약 셀렉트를 그대로 쓴다. 숫자 표기는 앱과 같은 함수(`utils/managerReport.ts`)로 낸다.
//
// 범위도 앱과 같은 「사업 › 근무지」다. 근무지 목록은 앱과 같은 조회(`dbo_worksites`, RLS 가 맡은 곳만 준다)로 받는다 —
// `dbo-admin` 근무지 목록에는 사업 이름이 없고, 사업 목록은 master 전용이다.
import { computed, onMounted, ref, watch } from 'vue'
import {
  MAX_REPORT_WORKSITES,
  attendanceRows,
  barLayout,
  formatPercent,
  isManagerReport,
  managerReportError,
  managerReportMonths,
  noticeLine,
  reportNotes,
  reportScopes,
  scopeWorksiteIds,
  type ManagerMonthlyReport,
  type NoticeCategory,
  type ReportWorksite,
} from '~/utils/managerReport'

const app = useDboApp()
const supabase = useSupabase()

const months = managerReportMonths(todaySeoul())
const month = ref(months[0]!.value)

/** 맡은 근무지. null 이면 오는 중 */
const mine = ref<ReportWorksite[] | null>(null)
const mineError = ref('')
const scope = ref('')
const scopes = computed(() => reportScopes(mine.value ?? []))

async function loadMine() {
  mineError.value = ''
  const { data, error } = await supabase
    .from('dbo_worksites')
    .select('id, name, program_id, program:dbo_programs(id, name)')
    .order('name')
  if (error) {
    console.error('[ManagerReport] 근무지 조회 실패:', error)
    // 「맡은 근무지가 없습니다」로 말하면 일시 오류가 사실 문장이 된다 — 못 읽었다고 말하고 다시 부를 길을 둔다
    mineError.value = '근무지 목록을 불러오지 못했습니다.'
    return
  }
  type Row = { id: string; name: string; program_id: string | null; program: { name: string | null } | { name: string | null }[] | null }
  mine.value = ((data ?? []) as unknown as Row[]).map((r) => {
    // 임베드는 객체로도 배열로도 온다
    const program = Array.isArray(r.program) ? r.program[0] : r.program
    return { id: r.id, name: r.name, programId: r.program_id, programName: program?.name ?? null }
  })
  // 처음에는 첫 사업의 전체(앱과 같다). 고른 범위가 목록에서 사라졌으면 첫 줄로 돌린다
  if (!scopes.value.some((s) => s.value === scope.value)) scope.value = scopes.value[0]?.value ?? ''
}

const report = ref<ManagerMonthlyReport | null>(null)
const loading = ref(false)
const failure = ref<{ message: string; retryable: boolean } | null>(null)
/** 리포트를 받은 시각. 5분 캐시라 화면에 「HH:MM 기준」으로 적는다 */
const fetchedAt = ref<number | null>(null)
let sequence = 0

async function load(force = false) {
  const ids = scopeWorksiteIds(scope.value, mine.value ?? [])
  if (!ids.length) return
  const current = ++sequence
  // 달이나 범위가 바뀌면 이전 숫자를 지운다 — 새 제목 아래 옛 숫자가 남으면 그것으로 읽힌다(앱과 같다)
  report.value = null
  failure.value = null
  if (ids.length > MAX_REPORT_WORKSITES) {
    // 앞 조회가 진행 중이었으면 그 조회의 마무리가 건너뛰어진다 — 여기서 로딩을 푼다(리뷰 반영)
    loading.value = false
    failure.value = { message: '근무지가 너무 많습니다. 근무지를 좁혀 주세요.', retryable: false }
    return
  }
  loading.value = true
  try {
    const key = `manager-report:${month.value}:${[...ids].sort().join(',')}`
    const res = await screenCache.get(
      key,
      async () => {
        const r = await app.monthlyReport(month.value, ids)
        // 모양이 다르면 캐시에 남기지 않고 오류로 — 화면 그리기에서 깨지는 대신 「다시 시도」를 보인다(리뷰 반영)
        if (!isManagerReport(r)) throw new Error('리포트 응답 모양이 다릅니다')
        return r
      },
      { force },
    )
    if (current !== sequence) return
    report.value = res.value
    fetchedAt.value = res.at
  } catch (e) {
    if (current !== sequence) return
    console.error('[ManagerReport] 리포트 조회 실패:', e)
    failure.value = managerReportError(e)
  } finally {
    if (current === sequence) loading.value = false
  }
}
watch([month, scope], () => load())
onMounted(loadMine)

const expanded = ref(false)
watch(report, () => (expanded.value = false))
const attendance = computed(() => (report.value ? attendanceRows(report.value.attendance.worksites, expanded.value) : null))

/** 주별 미기록 막대 최대 높이(px) */
const BAR_MAX = 120
const missedSum = computed(() => report.value?.weeks.reduce((s, w) => s + w.missed, 0) ?? 0)
const bars = computed(() => (report.value ? barLayout(report.value.weeks.map((w) => w.missed), BAR_MAX) : []))

const NOTICE_ROWS: { cat: NoticeCategory; label: string }[] = [
  { cat: 'normal', label: '일반' },
  { cat: 'special', label: '특별공지 표시' },
  { cat: 'urgent', label: '긴급' },
]
</script>

<template>
  <div class="flex flex-col gap-6">
    <Teleport to="#admin-topbar-actions">
      <!-- 고를 것이 둘 이상일 때만 — 한 곳만 맡았으면 이름만 아래 줄에 적는다 -->
      <PillSelect v-if="scopes.length > 1" v-model="scope" :options="scopes" />
      <PillSelect v-model="month" :options="months" />
      <AppButton variant="outline" color="neutral" icon="i-lucide-refresh-cw" :loading="loading" :disabled="!scope" @click="load(true)">
        새로고침
      </AppButton>
    </Teleport>

    <div v-if="mineError" class="flex items-center gap-3">
      <p role="alert" class="text-sm text-down">{{ mineError }}</p>
      <AppButton size="sm" variant="outline" color="neutral" @click="loadMine">다시 불러오기</AppButton>
    </div>
    <AppSpinner v-else-if="mine === null" label="근무지 불러오는 중…" />
    <EmptyState v-else-if="!scopes.length" title="맡은 근무지가 없습니다." description="근무지 담당자로 지정되면 리포트를 볼 수 있습니다." />

    <template v-else>
      <div v-if="failure" class="flex items-center gap-3">
        <p role="alert" class="text-sm text-down">{{ failure.message }}</p>
        <AppButton v-if="failure.retryable" size="sm" variant="outline" color="neutral" :loading="loading" @click="load(true)">
          다시 시도
        </AppButton>
      </div>
      <AppSpinner v-else-if="loading && !report" label="리포트 불러오는 중…" />

      <template v-if="report">
        <div class="space-y-1 text-sm">
          <p class="text-muted">
            <span v-if="scopes.length === 1" class="font-medium text-ink">{{ scopes[0]!.label }} · </span>
            {{ Number(report.month.slice(5, 7)) }}월 1일부터 {{ Number(report.through.slice(8, 10)) }}일까지 · 출근을 찍은 근무를 출석으로 셉니다
            <template v-if="fetchedAt"> · {{ cachedAtLabel(fetchedAt) }}</template>
          </p>
          <p v-for="n in reportNotes(report)" :key="n" class="text-body">{{ n }}</p>
        </div>

        <EmptyState v-if="report.attendance.total.total === 0" description="이 달에는 근무 기록이 없습니다." />

        <template v-else>
          <!-- 근무지별 출석률 — 앱 「활동 장소별 출석률」. 출석률 낮은 곳부터 -->
          <AppCard>
            <div class="mb-4 flex items-baseline justify-between gap-4">
              <h2 class="text-[15px] font-semibold text-ink">근무지별 출석률</h2>
              <p class="text-sm text-muted tabular-nums">
                전체 <span class="font-medium text-brand-500">{{ formatPercent(report.attendance.total.recorded, report.attendance.total.total, 1) }}</span>
                · {{ report.attendance.total.recorded.toLocaleString() }} / {{ report.attendance.total.total.toLocaleString() }}건
              </p>
            </div>
            <ul class="space-y-4">
              <li v-for="w in attendance!.rows" :key="w.worksiteId" class="space-y-1.5">
                <div class="flex justify-between gap-4 text-sm">
                  <span class="text-ink">{{ w.name }}</span>
                  <span class="tabular-nums">
                    <span class="font-medium text-brand-500">{{ formatPercent(w.recorded, w.total, 1) }}</span>
                    <span class="text-muted"> · {{ w.recorded.toLocaleString() }} / {{ w.total.toLocaleString() }}건</span>
                  </span>
                </div>
                <div class="h-2 rounded-full bg-surface-strong">
                  <div class="h-2 rounded-full bg-brand-500" :style="{ width: `${(w.recorded / w.total) * 100}%` }" />
                </div>
              </li>
            </ul>
            <button
              v-if="attendance!.hidden > 0 || expanded"
              type="button"
              class="mt-4 text-sm font-medium text-brand-500 hover:underline"
              @click="expanded = !expanded"
            >
              {{ expanded ? '접기' : `전체 보기 (${attendance!.hidden}곳 더)` }}
            </button>
          </AppCard>

          <!-- 주별 미기록 건수 — 앱과 같은 막대. 가장 많은 주를 진하게 -->
          <AppCard>
            <div class="mb-4 flex items-baseline justify-between gap-4">
              <h2 class="text-[15px] font-semibold text-ink">주별 미기록 건수</h2>
              <p class="text-sm text-muted tabular-nums">{{ Number(report.month.slice(5, 7)) }}월 합계 {{ missedSum.toLocaleString() }}건</p>
            </div>
            <p v-if="missedSum === 0" class="text-sm text-body">미기록이 없습니다.</p>
            <div v-else class="flex items-end gap-3" role="img" :aria-label="report.weeks.map((w) => `${w.week}주 ${w.missed}건`).join(', ')">
              <div v-for="(w, i) in report.weeks" :key="w.week" class="flex flex-1 flex-col items-center gap-1.5">
                <span class="text-xs text-body tabular-nums">{{ w.missed }}건</span>
                <div
                  class="w-full rounded"
                  :class="bars[i]!.highlight ? 'bg-brand-500' : 'bg-brand-soft'"
                  :style="{ height: `${bars[i]!.height}px` }"
                />
                <span class="text-xs text-body">{{ w.week }}주</span>
                <span class="text-[11px] text-muted tabular-nums">{{ w.startDay }}~{{ w.endDay }}일</span>
              </div>
            </div>
          </AppCard>
        </template>

        <!-- 공지 열람 지표 — 앱과 같은 세 줄. 긴급은 「확인」을 누른 사람만 센다 -->
        <AppCard>
          <h2 class="mb-4 text-[15px] font-semibold text-ink">공지 열람 지표</h2>
          <ul class="divide-y divide-hairline">
            <li v-for="row in NOTICE_ROWS" :key="row.cat" class="flex justify-between gap-4 py-3 text-sm first:pt-0 last:pb-0">
              <span class="text-body">{{ row.label }}<span v-if="report.notices[row.cat].noticeCount" class="text-muted"> · {{ report.notices[row.cat].noticeCount }}건</span></span>
              <span class="text-right text-ink tabular-nums">{{ noticeLine(row.cat, report.notices[row.cat]) }}</span>
            </li>
          </ul>
        </AppCard>
      </template>
    </template>
  </div>
</template>
