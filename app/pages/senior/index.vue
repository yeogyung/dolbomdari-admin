<!-- 시니어 어드민 대시보드 — 오늘 출결 현황 + 운영 규모 요약 (dbo-admin 목록 API 집계). 담당자는 맡은 근무지의 오늘 출결·날씨만 -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { AttendanceShift, Program, Worksite } from '~/types/dbo'

const api = useDboAdmin()
const toast = useToast()
const { setHeader } = useAdminHeader()
setHeader('대시보드')

/*
 * 담당자 대시보드(QA 2026-11-07 MGR-03, 결정 D4) — 같은 화면에서 master 전용 호출(운영 규모·사업 목록)만 뺀다.
 * 오늘 출결·근무지 목록은 서버가 담당자에게 연 dbo-admin 호출이라 맡은 근무지로 좁혀 온다(`managerMayCall`).
 * 날씨 카드는 RLS 가 맡은 근무지만 준다. 사업 이름은 받을 길이 없어 사업 필터 없이 근무지 필터만 둔다
 */
const isManager = computed(() => useAdminRole().me.value?.role === 'manager')

const today = todaySeoul()

const shifts = ref<AttendanceShift[]>([])
const loading = ref(true)
const scale = ref<{ seniors: number | null; managers: number | null; worksites: number | null; programs: number | null; rooms: number | null }>({
  seniors: null,
  managers: null,
  worksites: null,
  programs: null,
  rooms: null,
})

// 출퇴근 기록 화면과 같은 판정으로 센다 — 예정 시각 전 근무는 미기록이 아니다(QA 2026-11-02 ADM-03).
// 시각이 기준이라 받아 온 시각(`fetchedAt`)으로 판정한다. 5분 캐시 안에서 숫자와 「기준」 시각이 맞는다.
const judgedAt = computed(() => (fetchedAt.value ? new Date(fetchedAt.value) : new Date()))
const stat = computed(() => tallyDay(shifts.value, judgedAt.value))

/*
 * 「확인이 필요한 근무」 사업·근무지 필터(QA 2026-11-07 ADMIN-06). 오늘 근무는 이미 다 받아 두었으므로 화면에서 거른다.
 * 근무의 사업은 근무지의 사업으로 본다. 근무지 선택지는 오늘 근무가 있는 곳만 — 고르면 빈 목록인 곳은 뺀다
 */
const programFilter = ref('')
const worksiteFilter = ref('')
const worksites = ref<Worksite[]>([])
const programs = ref<Program[]>([])
const programOf = computed(() => new Map(worksites.value.map((w) => [w.id, w.program_id])))
const todayWorksites = computed(() => {
  const ids = new Set(shifts.value.map((s) => s.worksite_id))
  return worksites.value.filter((w) => ids.has(w.id))
})
const scoped = computed(() =>
  filterShiftsByScope(shifts.value, { programId: programFilter.value, worksiteId: worksiteFilter.value }, programOf.value),
)
const filtering = computed(() => !!(programFilter.value || worksiteFilter.value))

async function loadFilterRefs(force = false) {
  // 사업 목록은 규모 카드와 같은 키(programs)다. 새로고침에서는 규모 카드가 먼저 새로 받으므로 여기서는 force 하지 않는다
  const [ws, pg] = await Promise.allSettled([
    screenCache.get('senior-dashboard:allWorksites', () => api.listAllWorksites(), { force }),
    // 사업 목록은 master 전용이다 — 담당자는 부르지 않는다(403 알림만 뜬다)
    isManager.value ? Promise.resolve(null) : screenCache.get('senior-dashboard:programs', () => api.listPrograms()),
  ])
  if (ws.status === 'fulfilled') worksites.value = ws.value.value
  if (pg.status === 'fulfilled' && pg.value) programs.value = pg.value.value.items.filter((p) => p.status === 'active')
  const failed = [ws, pg].find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined
  // 목록은 그대로 보이지만 필터 선택지가 비거나 모자라다 — 조용히 넘기지 않는다
  const title = isManager.value ? '근무지 필터를 불러오지 못했습니다.' : '사업·근무지 필터를 불러오지 못했습니다.'
  if (failed) toast.add({ title, description: dboErrorMessage(failed.reason), color: 'warning' })
}

/** 「출퇴근 기록 전체 보기」 — 근무지를 골랐으면 그 근무지로 연다. 출퇴근 기록은 사업 필터를 받지 않는다 */
const attendanceLink = computed(() =>
  worksiteFilter.value ? { path: '/senior/attendance', query: { worksite: worksiteFilter.value } } : '/senior/attendance',
)

/** 확인이 필요한 근무 — 미출근·결석을 앞에 둔다. 출근 전 근무는 뒤로 */
const attention = computed(() =>
  [...scoped.value]
    .sort(
      (a, b) =>
        attentionRank(a, judgedAt.value) - attentionRank(b, judgedAt.value) ||
        a.planned_start.localeCompare(b.planned_start),
    )
    .slice(0, 10),
)

/** 오늘 출결을 받은 시각. 5분 캐시라 화면에 「HH:MM 기준」으로 적는다 */
const fetchedAt = ref<number | null>(null)

/** 오늘 근무는 100건 단위로 나눠 오므로 전량을 모은다. 키에 날짜를 넣어 자정을 넘기면 새로 받는다 */
async function loadToday(force = false) {
  try {
    const { value, at } = await screenCache.get(
      `senior-dashboard:today:${today}`,
      async () => {
        const all: AttendanceShift[] = []
        let page = 1
        for (;;) {
          const res = await api.listAttendance({ from: today, to: today, page, size: 100 })
          all.push(...res.items)
          if (all.length >= res.total || !res.items.length) break
          page++
        }
        return all
      },
      { force },
    )
    shifts.value = value
    fetchedAt.value = at
  } catch (e: any) {
    toast.add({ title: '오늘 출결 조회 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    loading.value = false
  }
}

/** 규모 카드 조회 중. 끝난 뒤의 「—」는 실패를 뜻한다 — 조회 중과 구분해 「…」을 보인다. 담당자는 부르지 않는다 */
const scaleLoading = ref(!isManager.value)

async function loadScale(force = false) {
  // 호출마다 따로 캐시한다 — 하나가 실패해도 나머지는 보관되고, 실패한 것만 다음에 다시 부른다
  const cached = <T,>(key: string, fetcher: () => Promise<T>) =>
    screenCache.get(`senior-dashboard:${key}`, fetcher, { force }).then((r) => r.value)
  const [seniors, managers, ws, pg, rooms] = await Promise.allSettled([
    cached('seniors', () => api.listDirectory({ size: 1, status: 'active', role: 'senior' })),
    cached('managers', () => api.listDirectory({ size: 1, status: 'active', role: 'manager' })),
    cached('worksites', () => api.listWorksites({ size: 1 })),
    cached('programs', () => api.listPrograms()),
    cached('rooms', () => api.listRooms({ size: 1 })),
  ])
  // 역할별로 서버에서 거른 total 을 쓴다. 명부에 수요처 계정도 섞여 첫 페이지로 세면 틀린다.
  if (seniors.status === 'fulfilled') scale.value.seniors = seniors.value.total
  if (managers.status === 'fulfilled') scale.value.managers = managers.value.total
  if (ws.status === 'fulfilled') scale.value.worksites = ws.value.total
  if (pg.status === 'fulfilled') scale.value.programs = pg.value.items.filter((p) => p.status === 'active').length
  if (rooms.status === 'fulfilled') scale.value.rooms = rooms.value.total
  scaleLoading.value = false
}

const show = (v: number | null) => (scaleLoading.value ? '…' : v === null ? '—' : v.toLocaleString())

onMounted(() => {
  loadToday()
  // 운영 규모는 기관 전체 숫자라 master 만 — 명부·사업·채팅방 목록이 master 전용이다
  if (!isManager.value) loadScale()
  loadFilterRefs()
})

/** 상단바 「새로고침」 — 캐시를 건너뛰고 다시 받는다 */
const refreshing = ref(false)
async function refresh() {
  refreshing.value = true
  await Promise.all([loadToday(true), isManager.value ? null : loadScale(true), loadFilterRefs(true)])
  refreshing.value = false
}
</script>

<template>
  <div class="space-y-8">
    <Teleport to="#admin-topbar-actions">
      <AppButton variant="outline" color="neutral" icon="i-lucide-refresh-cw" :loading="refreshing || loading || scaleLoading" @click="refresh">
        새로고침
      </AppButton>
    </Teleport>

    <!-- 오늘 출결 -->
    <section>
      <div class="mb-4 flex items-end justify-between">
        <div>
          <h2 class="text-[18px] font-semibold text-ink">오늘 출결</h2>
          <p class="mt-0.5 text-sm text-muted">
            {{ today }} (Asia/Seoul)<template v-if="isManager"> · 맡은 근무지</template><template v-if="fetchedAt"> · {{ cachedAtLabel(fetchedAt) }}</template>
          </p>
        </div>
        <NuxtLink :to="attendanceLink" class="text-sm font-medium text-brand-500 hover:underline">
          출퇴근 기록 전체 보기
        </NuxtLink>
      </div>
      <div class="grid grid-cols-2 gap-6 md:grid-cols-4">
        <StatCard label="오늘 근무" :value="loading ? '…' : stat.total" />
        <StatCard label="퇴근 완료" :value="loading ? '…' : stat.done" tone="up" />
        <StatCard label="근무 중" :value="loading ? '…' : stat.working" tone="primary" />
        <StatCard label="미기록·결근" :value="loading ? '…' : stat.missing + stat.absent" tone="down" />
      </div>
    </section>

    <!-- 확인이 필요한 근무 -->
    <section>
      <AppCard padding="none">
        <template #header>
          <div>
            <h2 class="text-[18px] font-semibold text-ink">확인이 필요한 근무</h2>
            <p class="mt-0.5 text-sm text-muted">미기록·결근을 먼저 보여 줍니다.</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <PillSelect
              v-if="!isManager"
              v-model="programFilter"
              :options="[{ label: '사업 전체', value: '' }, ...programs.map((p) => ({ label: p.name, value: p.id }))]"
            />
            <WorksiteFilter
              v-model="worksiteFilter"
              :worksites="todayWorksites"
              :program-id="programFilter"
              :programs="programs"
            />
          </div>
        </template>
        <div class="px-8 pt-2 pb-6">
          <AppSpinner v-if="loading" label="불러오는 중…" />
          <EmptyState
            v-else-if="!attention.length"
            :description="filtering && shifts.length ? '조건에 맞는 근무가 없습니다.' : '오늘 예정된 근무가 없습니다.'"
          />
          <table v-else class="w-full border-collapse">
            <thead>
              <tr class="text-[13px] font-semibold text-muted">
                <th class="pr-3 pb-3 text-left">이름</th>
                <th class="pr-3 pb-3 text-left">근무지</th>
                <th class="pr-3 pb-3 text-left">예정</th>
                <th class="pr-3 pb-3 text-left">상태</th>
                <th class="pr-3 pb-3 text-left">출근</th>
                <th class="pb-3 text-left">퇴근</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in attention" :key="row.id">
                <td class="border-t border-hairline py-[15px] pr-3 text-[15px] font-semibold text-ink">
                  {{ row.directory?.name ?? '—' }}
                </td>
                <td class="border-t border-hairline py-[15px] pr-3 text-[15px] text-body">
                  {{ row.worksite?.name ?? '—' }}
                </td>
                <td class="border-t border-hairline py-[15px] pr-3 text-[15px] text-body">
                  {{ hhmm(row.planned_start) }} – {{ hhmm(row.planned_end) }}
                </td>
                <td class="border-t border-hairline py-[15px] pr-3">
                  <StatusBadge :tone="attendanceTone(attendanceOf(row)?.status)">
                    {{ attendanceLabel(attendanceOf(row)?.status) }}
                  </StatusBadge>
                </td>
                <td class="border-t border-hairline py-[15px] pr-3 text-[15px] text-body">
                  {{ fmtClock(attendanceOf(row)?.started_at) }}
                </td>
                <td class="border-t border-hairline py-[15px] text-[15px] text-body">
                  {{ fmtClock(attendanceOf(row)?.ended_at) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </AppCard>
    </section>

    <!-- 운영 규모 — 기관 전체 숫자라 master 만 -->
    <section v-if="!isManager">
      <h2 class="mb-4 text-[18px] font-semibold text-ink">운영 규모</h2>
      <div class="grid grid-cols-2 gap-6 md:grid-cols-5">
        <NuxtLink to="/senior/workers" class="group">
          <StatCard label="활성 시니어" :value="show(scale.seniors)" />
        </NuxtLink>
        <NuxtLink to="/senior/workers" class="group">
          <StatCard label="활성 담당자" :value="show(scale.managers)" />
        </NuxtLink>
        <NuxtLink to="/senior/worksites" class="group">
          <StatCard label="근무지" :value="show(scale.worksites)" />
        </NuxtLink>
        <NuxtLink to="/senior/programs" class="group">
          <StatCard label="진행 사업" :value="show(scale.programs)" />
        </NuxtLink>
        <NuxtLink to="/senior/chat" class="group">
          <StatCard label="채팅방" :value="show(scale.rooms)" />
        </NuxtLink>
      </div>
      <p class="mt-3 text-xs text-muted">
        활성 시니어·담당자 수는 명부 첫 100건 기준입니다. 정확한 총원은 명부 관리에서 확인해 주세요.
      </p>
    </section>

    <!-- 날씨 — 담당자가 근무를 쉬게 할지 판단하는 근거(2026-10-22) -->
    <WeatherCard />
  </div>
</template>
