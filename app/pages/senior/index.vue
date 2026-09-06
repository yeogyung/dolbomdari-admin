<!-- 시니어 어드민 대시보드 — 오늘 출결 현황 + 운영 규모 요약 (dbo-admin 목록 API 집계) -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { AttendanceRecord, AttendanceShift } from '~/types/dbo'

const api = useDboAdmin()
const toast = useToast()
const { setHeader } = useAdminHeader()
setHeader('대시보드')

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

const recordOf = (row: AttendanceShift): AttendanceRecord | null => row.attendance?.[0] ?? null

const stat = computed(() => {
  const out = { total: shifts.value.length, done: 0, working: 0, absent: 0, missing: 0 }
  for (const row of shifts.value) {
    const rec = recordOf(row)
    if (!rec) out.missing++
    // 완료는 ended_at 으로 판정한다 — status 는 퇴근해도 present 그대로다.
    else if (rec.status === 'absent') out.absent++
    else if (rec.ended_at) out.done++
    else out.working++
  }
  return out
})

/** 확인이 필요한 근무 — 미기록·결근을 앞에 둔다 */
const attention = computed(() =>
  [...shifts.value]
    .sort((a, b) => {
      const rank = (row: AttendanceShift) => {
        const s = recordOf(row)?.status
        if (!s) return 0
        if (s === 'absent') return 1
        if (s === 'late') return 2
        return 3
      }
      return rank(a) - rank(b) || a.planned_start.localeCompare(b.planned_start)
    })
    .slice(0, 10),
)

/** 오늘 근무는 100건 단위로 나눠 오므로 전량을 모은다 */
async function loadToday() {
  try {
    const all: AttendanceShift[] = []
    let page = 1
    for (;;) {
      const res = await api.listAttendance({ from: today, to: today, page, size: 100 })
      all.push(...res.items)
      if (all.length >= res.total || !res.items.length) break
      page++
    }
    shifts.value = all
  } catch (e: any) {
    toast.add({ title: '오늘 출결 조회 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    loading.value = false
  }
}

async function loadScale() {
  const [dir, ws, pg, rooms] = await Promise.allSettled([
    api.listDirectory({ size: 100, status: 'active' }),
    api.listWorksites({ size: 1 }),
    api.listPrograms(),
    api.listRooms({ size: 1 }),
  ])
  if (dir.status === 'fulfilled') {
    // 역할별 수는 첫 100건 기준이다. 총원은 total 을 쓴다.
    scale.value.seniors = dir.value.items.filter((d) => d.role === 'senior').length
    scale.value.managers = dir.value.items.filter((d) => d.role === 'manager').length
  }
  if (ws.status === 'fulfilled') scale.value.worksites = ws.value.total
  if (pg.status === 'fulfilled') scale.value.programs = pg.value.items.filter((p) => p.status === 'active').length
  if (rooms.status === 'fulfilled') scale.value.rooms = rooms.value.total
}

const show = (v: number | null) => (v === null ? '—' : v.toLocaleString())

onMounted(() => {
  loadToday()
  loadScale()
})
</script>

<template>
  <div class="space-y-8">
    <!-- 오늘 출결 -->
    <section>
      <div class="mb-4 flex items-end justify-between">
        <div>
          <h2 class="text-[18px] font-semibold text-ink">오늘 출결</h2>
          <p class="mt-0.5 text-sm text-muted">{{ today }} (Asia/Seoul) 기준</p>
        </div>
        <NuxtLink to="/senior/attendance" class="text-sm font-medium text-brand-500 hover:underline">
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
        </template>
        <div class="px-8 pt-2 pb-6">
          <AppSpinner v-if="loading" label="불러오는 중…" />
          <EmptyState v-else-if="!attention.length" description="오늘 예정된 근무가 없습니다." />
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
                  <StatusBadge :tone="attendanceTone(recordOf(row)?.status)">
                    {{ attendanceLabel(recordOf(row)?.status) }}
                  </StatusBadge>
                </td>
                <td class="border-t border-hairline py-[15px] pr-3 text-[15px] text-body">
                  {{ fmtClock(recordOf(row)?.started_at) }}
                </td>
                <td class="border-t border-hairline py-[15px] text-[15px] text-body">
                  {{ fmtClock(recordOf(row)?.ended_at) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </AppCard>
    </section>

    <!-- 운영 규모 -->
    <section>
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
  </div>
</template>
