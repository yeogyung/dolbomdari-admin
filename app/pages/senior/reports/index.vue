<!-- 월간 리포트 — 출결·인력·공지 월 집계 (master 전용, GET /dbo-admin/reports/monthly) -->
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { Column } from '~/types/table'
import type { MonthlyReport } from '~/types/dbo'
import { fmtMinutes, pct, recentMonths, throughLabel } from '~/utils/reports'

const api = useDboAdmin()
const { setHeader } = useAdminHeader()
setHeader('리포트')

const today = todaySeoul()
const months = recentMonths(today)
const month = ref(months[0]!.value)
const report = ref<MonthlyReport | null>(null)
const loading = ref(false)
const error = ref('')
/** 리포트를 받은 시각. 월별 5분 캐시라 화면에 「HH:MM 기준」으로 적는다 */
const fetchedAt = ref<number | null>(null)
let sequence = 0

async function load(force = false) {
  const current = ++sequence
  loading.value = true
  error.value = ''
  try {
    const res = await screenCache.get(`report:${month.value}`, () => api.getMonthlyReport(month.value), { force })
    if (current === sequence) {
      report.value = res.value
      fetchedAt.value = res.at
    }
  } catch (e) {
    if (current === sequence) {
      report.value = null
      error.value = dboErrorMessage(e, '리포트를 불러오지 못했습니다.')
    }
  } finally {
    if (current === sequence) loading.value = false
  }
}
watch(month, () => load())
onMounted(() => load())

const att = computed(() => report.value?.attendance)
const isCurrentMonth = computed(() => report.value?.month === months[0]!.value)

/** ③ 상태 분포 — 합계 = shifts. other 는 0 이면 숨긴다 */
const STATUS_SEGMENTS = [
  { key: 'present', label: '출근', cls: 'bg-up' },
  { key: 'late', label: '지각', cls: 'bg-amber-400' },
  { key: 'absent', label: '결석', cls: 'bg-down' },
  { key: 'excused', label: '인정 결석', cls: 'bg-slate-400' },
  { key: 'missing', label: '미기록', cls: 'bg-slate-300' },
  { key: 'other', label: '기타', cls: 'bg-slate-600' },
] as const
const segments = computed(() =>
  att.value
    ? STATUS_SEGMENTS.map((s) => ({ ...s, count: att.value!.byStatus[s.key] }))
        .filter((s) => s.key !== 'other' || s.count > 0)
    : [],
)

/** ④ 일별 — 아래부터 출근 기록·결석·미기록·그 외(인정 결석 등) */
const DAILY_SEGMENTS = [
  { label: '출근 기록', cls: 'bg-up' },
  { label: '결석', cls: 'bg-down' },
  { label: '미기록', cls: 'bg-slate-300' },
  { label: '그 외', cls: 'bg-slate-100' },
] as const

/** 높이 기준은 그달 하루 최대 예정 근무 */
const dailyMax = computed(() => Math.max(1, ...(att.value?.daily.map((d) => d.shifts) ?? [0])))

/** ⑤ 근무지별·사업별 */
const breakdownTab = ref<'worksite' | 'program'>('worksite')
const breakdownColumns: Column[] = [
  { key: 'name', label: '이름', strong: true },
  { key: 'shifts', label: '예정 근무', align: 'right' },
  { key: 'rate', label: '출근 기록률', align: 'right' },
  { key: 'late', label: '지각', align: 'right' },
  { key: 'absent', label: '결석', align: 'right' },
  { key: 'excused', label: '인정 결석', align: 'right' },
  { key: 'missing', label: '미기록', align: 'right' },
]
const breakdownRows = computed(() => {
  const list = breakdownTab.value === 'worksite' ? att.value?.byWorksite : att.value?.byProgram
  return (list ?? []).map((r) => ({
    ...r,
    id: 'worksiteId' in r ? r.worksiteId : (r.programId ?? 'none'),
    rate: pct(r.checkedIn, r.shifts),
  }))
})

/** ⑥ 결석·미기록 상위 */
const absenteeColumns: Column[] = [
  { key: 'name', label: '이름', strong: true },
  { key: 'worksiteName', label: '주 근무지' },
  { key: 'shifts', label: '예정 근무', align: 'right' },
  { key: 'absent', label: '결석', align: 'right' },
  { key: 'missing', label: '미기록', align: 'right' },
]

/** ⑧ 공지 */
const NOTICE_CATEGORIES = [
  { key: 'normal', label: '일반' },
  { key: 'special', label: '특별' },
  { key: 'urgent', label: '긴급' },
] as const
const avgRead = (sec: number | null) => (sec === null ? '—' : fmtMinutes(Math.round(sec / 60)))
</script>

<template>
  <div class="flex flex-col gap-6">
    <Teleport to="#admin-topbar-actions">
      <PillSelect v-model="month" :options="months" />
      <AppButton variant="outline" color="neutral" icon="i-lucide-refresh-cw" :loading="loading" @click="load(true)">
        새로고침
      </AppButton>
    </Teleport>

    <p v-if="error" role="alert" class="text-sm text-down">{{ error }}</p>
    <AppSpinner v-if="loading && !report" label="리포트 불러오는 중…" />

    <template v-if="report && att">
      <p class="text-sm text-muted">
        {{ report.firstDay }} ~ {{ report.through }} 집계<template v-if="isCurrentMonth"> · 이번 달은 {{ throughLabel(report.through) }}까지</template>
        <template v-if="fetchedAt"> · {{ cachedAtLabel(fetchedAt) }}</template>
        <span v-if="loading"> · 새로 불러오는 중…</span>
      </p>

      <!-- ② 요약 -->
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="예정 근무" :value="att.shifts.toLocaleString()" />
        <StatCard label="출근 기록률" :value="pct(att.checkedIn, att.shifts)" tone="primary" />
        <StatCard label="결석" :value="att.byStatus.absent.toLocaleString()" tone="down" />
        <StatCard label="미기록" :value="att.byStatus.missing.toLocaleString()" />
        <StatCard label="총 근무시간" :value="fmtMinutes(att.workedMinutes)" />
        <StatCard label="근무한 시니어" :value="report.people.workedSeniors.toLocaleString()" />
      </div>

      <EmptyState v-if="att.shifts === 0" description="이 달에는 예정된 근무가 없습니다." />

      <template v-else>
        <!-- ③ 출결 상태 분포 -->
        <AppCard>
          <h2 class="mb-4 text-[15px] font-semibold text-ink">출결 상태 분포</h2>
          <div class="flex h-4 w-full gap-[2px] overflow-hidden rounded-full" role="img" :aria-label="segments.map((s) => `${s.label} ${s.count}건`).join(', ')">
            <div
              v-for="s in segments.filter((x) => x.count > 0)"
              :key="s.key"
              :class="s.cls"
              :style="{ flexGrow: s.count }"
              :title="`${s.label} ${s.count.toLocaleString()}건 · ${pct(s.count, att.shifts)}`"
            />
          </div>
          <ul class="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <li v-for="s in segments" :key="s.key" class="flex items-center gap-2">
              <span class="size-3 rounded-full" :class="s.cls" />
              <span class="text-body">{{ s.label }}</span>
              <span class="tabular-nums text-muted">{{ s.count.toLocaleString() }}건 · {{ pct(s.count, att.shifts) }}</span>
            </li>
          </ul>
          <p class="mt-3 text-xs text-muted">
            인정 결석 {{ att.byStatus.excused }}건은 결석과 따로 셉니다. 기록 방법 QR {{ att.byMethod.qr }} · 대리 {{ att.byMethod.manual }}<template v-if="att.byMethod.other"> · 기타 {{ att.byMethod.other }}</template>.
            근무시간은 출근·퇴근이 모두 있는 {{ att.workedCount }}건 기준(건당 평균 {{ att.workedCount ? fmtMinutes(Math.round(att.workedMinutes / att.workedCount)) : '—' }}).
          </p>
        </AppCard>

        <!-- ④ 일별 추이 -->
        <AppCard>
          <h2 class="mb-4 text-[15px] font-semibold text-ink">일별 추이</h2>
          <ul class="mb-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <li v-for="s in DAILY_SEGMENTS" :key="s.label" class="flex items-center gap-2">
              <span class="size-3 rounded-full" :class="s.cls" />
              <span class="text-body">{{ s.label }}</span>
            </li>
          </ul>
          <div class="flex h-40 items-end gap-1 overflow-x-auto" role="img" aria-label="일별 예정 근무와 출근 기록·결석·미기록">
            <div
              v-for="d in att.daily"
              :key="d.date"
              class="flex min-w-3 flex-1 flex-col-reverse gap-[2px] overflow-hidden rounded-t"
              :style="{ height: `${(d.shifts / dailyMax) * 100}%` }"
              :title="`${d.date} 예정 ${d.shifts} · 출근 기록 ${d.checkedIn} · 결석 ${d.absent} · 미기록 ${d.missing}`"
            >
              <div v-if="d.checkedIn" class="bg-up" :style="{ flexGrow: d.checkedIn }" />
              <div v-if="d.absent" class="bg-down" :style="{ flexGrow: d.absent }" />
              <div v-if="d.missing" class="bg-slate-300" :style="{ flexGrow: d.missing }" />
              <div v-if="d.shifts - d.checkedIn - d.absent - d.missing > 0" class="bg-slate-100" :style="{ flexGrow: d.shifts - d.checkedIn - d.absent - d.missing }" />
            </div>
          </div>
          <div class="mt-2 flex justify-between text-xs text-muted tabular-nums">
            <span>{{ att.daily[0]?.date.slice(5) }}</span>
            <span>{{ att.daily.at(-1)?.date.slice(5) }}</span>
          </div>
        </AppCard>

        <!-- ⑤ 근무지별·사업별 -->
        <DataTable :columns="breakdownColumns" :rows="breakdownRows" :total="breakdownRows.length" :page-size="1000" empty-text="근무가 없습니다.">
          <template #toolbar>
            <PillSelect
              v-model="breakdownTab"
              :options="[{ label: '근무지별', value: 'worksite' }, { label: '사업별', value: 'program' }]"
            />
          </template>
          <template #cell-rate="{ row }"><span class="tabular-nums">{{ row.rate }}</span></template>
        </DataTable>

        <!-- ⑥ 결석·미기록 상위 -->
        <DataTable
          :columns="absenteeColumns"
          :rows="att.topAbsentees"
          row-key="directoryId"
          :total="att.topAbsentees.length"
          :page-size="1000"
          empty-text="결석·미기록이 없습니다."
        >
          <template #toolbar>
            <h2 class="text-[15px] font-semibold text-ink">결석·미기록 많은 시니어 (상위 10명)</h2>
          </template>
          <template #cell-name="{ row }">
            <NuxtLink :to="`/senior/workers/${row.directoryId}`" class="text-brand-500 hover:underline">{{ row.name }}</NuxtLink>
          </template>
        </DataTable>
      </template>

      <!-- ⑦ 인력·운영 규모 -->
      <AppCard>
        <h2 class="mb-1 text-[15px] font-semibold text-ink">인력·운영 규모</h2>
        <p class="mb-4 text-xs text-muted">활성 인원과 앱 가입은 지금 시점 값입니다. 신규 등록만 선택한 달 기준입니다.</p>
        <dl class="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <div><dt class="text-sm text-muted">활성 시니어</dt><dd class="text-2xl font-medium tabular-nums">{{ report.people.activeSeniors.toLocaleString() }}</dd></div>
          <div><dt class="text-sm text-muted">활성 담당자</dt><dd class="text-2xl font-medium tabular-nums">{{ report.people.activeManagers.toLocaleString() }}</dd></div>
          <div><dt class="text-sm text-muted">활성 근무지</dt><dd class="text-2xl font-medium tabular-nums">{{ report.people.activeWorksites.toLocaleString() }}</dd></div>
          <div>
            <dt class="text-sm text-muted">앱 가입률</dt>
            <dd class="text-2xl font-medium tabular-nums">{{ pct(report.people.seniorsWithApp, report.people.activeSeniors) }}</dd>
            <dd class="text-xs text-muted tabular-nums">{{ report.people.seniorsWithApp }} / {{ report.people.activeSeniors }}명</dd>
          </div>
          <div><dt class="text-sm text-muted">이 달 신규 등록</dt><dd class="text-2xl font-medium tabular-nums">{{ report.people.newSeniors.toLocaleString() }}</dd></div>
        </dl>
      </AppCard>

      <!-- ⑧ 공지 -->
      <AppCard>
        <h2 class="mb-1 text-[15px] font-semibold text-ink">공지</h2>
        <p class="mb-4 text-xs text-muted">
          열람률은 앱으로 읽을 수 있는 사람 기준이고, 긴급 공지는 「확인」을 누른 사람만 셉니다.
          <template v-if="report.notices.untracked"> 발송 이력이 없는 공지 {{ report.notices.untracked }}건은 열람률에서 뺐습니다.</template>
        </p>
        <div class="grid gap-4 lg:grid-cols-3">
          <div v-for="c in NOTICE_CATEGORIES" :key="c.key" class="rounded-2xl border border-hairline p-4">
            <p class="text-sm font-medium text-body">{{ c.label }} 공지 {{ report.notices[c.key].noticeCount }}건</p>
            <p class="mt-2 text-2xl font-medium tabular-nums">{{ pct(report.notices[c.key].read, report.notices[c.key].readable) }}</p>
            <p class="text-xs text-muted tabular-nums">
              {{ report.notices[c.key].read }} / {{ report.notices[c.key].readable }}명 · 평균 열람 {{ avgRead(report.notices[c.key].avgReadSeconds) }}
            </p>
          </div>
        </div>
        <p class="mt-4 text-sm text-body tabular-nums">
          문자 접수 {{ report.notices.delivery.sms.accepted }} · 실패 <span :class="report.notices.delivery.sms.failed ? 'text-down' : ''">{{ report.notices.delivery.sms.failed }}</span>
          &nbsp;/&nbsp; 푸시 접수 {{ report.notices.delivery.push.accepted }} · 실패 <span :class="report.notices.delivery.push.failed ? 'text-down' : ''">{{ report.notices.delivery.push.failed }}</span>
        </p>
        <div v-if="report.notices.lowest.length" class="mt-4">
          <p class="mb-2 text-sm font-medium text-body">열람률 낮은 공지</p>
          <ul class="divide-y divide-hairline">
            <li v-for="n in report.notices.lowest" :key="n.id" class="flex items-center justify-between gap-4 py-2 text-sm">
              <NuxtLink :to="`/senior/notices/${n.id}`" class="truncate text-brand-500 hover:underline">{{ n.title }}</NuxtLink>
              <span class="shrink-0 tabular-nums text-muted">{{ fmtStamp(n.publishedAt) }} · {{ n.read }}/{{ n.readable }} · {{ pct(n.read, n.readable) }}</span>
            </li>
          </ul>
        </div>
      </AppCard>
    </template>
  </div>
</template>
