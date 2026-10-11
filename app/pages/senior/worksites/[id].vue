<!-- 근무지 상세 — 기본 정보와 이 근무지의 근무자·근무 시각(QA 2026-10-11). 이름을 누르면 인적사항 -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Assignment, DirectoryEntry, Program, Worksite } from '~/types/dbo'
import { fetchAllPages } from '~/utils/paging'
import { worksiteRoster } from '~/utils/worksiteRoster'

const route = useRoute()
const api = useDboAdmin()
const toast = useToast()
const { setHeader } = useAdminHeader()
const { me, load: loadMe } = useAdminRole()
/** 「목록」 — 목록에서 왔으면 뒤로 가서 필터를 지킨다 */
const backToList = useBackToList('/senior/worksites')
const id = computed(() => String(route.params.id))
setHeader('근무지 상세', [{ label: '근무지·수요처', to: '/senior/worksites' }])

const loading = ref(true)
const worksite = ref<Worksite | null>(null)
const programs = ref<Program[]>([])
const assignments = ref<Assignment[]>([])
/** 이 근무지에 이어진 명부 — 배정된 시니어 · 근무지 담당자 · 수요처 계정(서버 `worksiteId`) */
const people = ref<DirectoryEntry[]>([])

const roster = computed(() => worksiteRoster(assignments.value, people.value))
const programName = computed(() => {
  const pid = worksite.value?.program_id
  return pid ? (programs.value.find((p) => p.id === pid)?.name ?? pid) : '—'
})
const personName = (did: string | null) =>
  did ? (people.value.find((p) => p.id === did)?.name ?? did) : '—'

async function load() {
  loading.value = true
  try {
    // **master 전용 화면이다.** 근무자 이름을 주는 명부 조회가 master 만 받는다(서버 `masterOnly`).
    // 목록의 「상세」 링크도 master 에게만 보인다 — 주소로 들어온 다른 롤은 목록으로 돌려보낸다.
    const who = me.value ?? (await loadMe())
    if (who?.role !== 'master') {
      void navigateTo('/senior/worksites')
      return
    }
    // 근무지 단건 API 가 없다. 목록은 300곳 안팎이라 전부 받아 고른다.
    const [all, pg, asg, ppl] = await Promise.all([
      api.listAllWorksites(),
      api.listPrograms(),
      fetchAllPages(
        (page, size) => api.listAssignments({ page, size, worksiteId: id.value }),
        (a) => a.id,
      ),
      fetchAllPages(
        (page, size) => api.listDirectory({ page, size, worksiteId: id.value }),
        (d) => d.id,
      ),
    ])
    worksite.value = all.find((w) => w.id === id.value) ?? null
    programs.value = pg.items
    assignments.value = asg
    people.value = ppl
    if (worksite.value) {
      setHeader(worksite.value.name, [{ label: '근무지·수요처', to: '/senior/worksites' }])
    }
  } catch (e: any) {
    toast.add({ title: '근무지 조회 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <Teleport to="#admin-topbar-actions">
      <AppButton variant="outline" color="neutral" icon="i-lucide-arrow-left" @click="backToList">
        목록
      </AppButton>
    </Teleport>

    <AppSpinner v-if="loading" label="불러오는 중…" />
    <EmptyState v-else-if="!worksite" description="근무지를 찾을 수 없습니다." />

    <template v-else>
      <AppCard padding="lg">
        <template #header>
          <div class="flex items-center gap-3">
            <h2 class="text-[18px] font-semibold text-ink">기본 정보</h2>
            <StatusBadge :tone="lifeStatusTone(worksite.status)">
              {{ lifeStatusLabel(worksite.status) }}
            </StatusBadge>
          </div>
        </template>
        <dl class="grid gap-5 md:grid-cols-2">
          <div>
            <dt class="text-[13px] font-semibold text-muted">사업</dt>
            <dd class="mt-1 text-[15px] text-ink">{{ programName }}</dd>
          </div>
          <div>
            <dt class="text-[13px] font-semibold text-muted">주소</dt>
            <dd class="mt-1 text-[15px] text-ink">{{ worksite.address || '—' }}</dd>
          </div>
          <div>
            <dt class="text-[13px] font-semibold text-muted">근무지 담당자</dt>
            <dd class="mt-1 text-[15px] text-ink">{{ personName(worksite.care_manager_directory_id) }}</dd>
          </div>
          <div>
            <dt class="text-[13px] font-semibold text-muted">수요처 담당자</dt>
            <dd class="mt-1 text-[15px] text-ink">{{ personName(worksite.manager_directory_id) }}</dd>
          </div>
        </dl>
      </AppCard>

      <AppCard padding="none">
        <template #header>
          <h2 class="text-[18px] font-semibold text-ink">근무자</h2>
          <span class="text-sm text-muted tabular-nums">배정 {{ roster.length }}건</span>
        </template>
        <div class="px-8 pt-2 pb-6">
          <EmptyState v-if="!roster.length" description="이 근무지에 배정된 근무자가 없습니다." />
          <table v-else class="w-full border-collapse">
            <thead>
              <tr class="text-[13px] font-semibold text-muted">
                <th class="pr-3 pb-3 text-left">이름</th>
                <th class="pr-3 pb-3 text-left">요일</th>
                <th class="pr-3 pb-3 text-left">시간</th>
                <th class="pr-3 pb-3 text-left">기간</th>
                <th class="pb-3 text-left">명부 상태</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in roster" :key="r.assignment.id">
                <td class="border-t border-hairline py-[15px] pr-3 text-[15px] font-semibold">
                  <!-- 이름을 누르면 인적사항(명부 상세) -->
                  <NuxtLink
                    :to="`/senior/workers/${r.assignment.directory_id}`"
                    class="text-brand-500 hover:underline"
                  >
                    {{ r.name }}
                  </NuxtLink>
                </td>
                <td class="border-t border-hairline py-[15px] pr-3 text-[15px] text-body">
                  {{ weekdaysLabel(r.assignment.weekdays) }}
                </td>
                <td class="border-t border-hairline py-[15px] pr-3 text-[15px] text-body">
                  {{ hhmm(r.assignment.start_time) }} – {{ hhmm(r.assignment.end_time) }}
                </td>
                <td class="border-t border-hairline py-[15px] pr-3 text-[15px] text-body">
                  {{ r.assignment.period_start || '—' }} ~ {{ r.assignment.period_end || '무기한' }}
                </td>
                <td class="border-t border-hairline py-[15px] text-[15px]">
                  <StatusBadge v-if="r.status" :tone="lifeStatusTone(r.status)">
                    {{ lifeStatusLabel(r.status) }}
                  </StatusBadge>
                  <span v-else class="text-muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </AppCard>
    </template>
  </div>
</template>
