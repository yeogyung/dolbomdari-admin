<!-- 담당자의 명부(읽기 전용, 2026-11-11) — 맡은 근무지에 배정된 시니어. 명부는 RLS(dbo_can_read_directory), 근무지·배정은 dbo-admin(맡은 근무지로 좁힘). 이름을 누르면 정보·메모 창. Figma 없음 -->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { LifeStatus, Worksite } from '~/types/dbo'
import type { Column } from '~/types/table'
import { fetchAllPages } from '~/utils/paging'
import { firstAndMore } from '~/utils/rosterSites'
import { filterManagerWorkers, managerWorkerRows, type ManagerPerson, type ManagerWorkerRow } from '~/utils/managerWorkers'

const api = useDboAdmin()
const supabase = useSupabase()
const all = ref<ManagerWorkerRow[]>([])
const worksites = ref<Worksite[]>([])
const loading = ref(false)
const error = ref('')
const page = ref(1)
const PAGE_SIZE = 20
/* 거르기는 주소에 담지 않는다 — 같은 화면의 master 쪽 목록 조건(useListQuery)과 주소 쿼리 키가 겹친다 */
const q = ref('')
const worksiteFilter = ref('')
const statusFilter = ref<'' | LifeStatus>('')
const columns: Column[] = [
  { key: 'name', label: '이름', strong: true },
  { key: 'phone', label: '연락처' },
  { key: 'worksites', label: '근무지' },
  { key: 'status', label: '상태' },
]

const filtered = computed(() =>
  filterManagerWorkers(all.value, { q: q.value, worksiteId: worksiteFilter.value, status: statusFilter.value }),
)
const rows = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
const siteNames = (row: ManagerWorkerRow) => row.worksites.map((w) => w.name)
watch([q, worksiteFilter, statusFilter], () => (page.value = 1))

/** RLS 가 맡은 근무지에 배정된 사람만 준다(본인 명부도 오므로 시니어로 좁힌다). 서버 행 상한을 넘으면 쪽을 이어 받는다 */
function loadPeople(): Promise<ManagerPerson[]> {
  return fetchAllPages(
    async (p, size) => {
      const from = (p - 1) * size
      const { data, error: e, count } = await supabase
        .from('dbo_directory')
        .select('id, name, phone, status', { count: 'exact' })
        .eq('role', 'senior')
        .order('id')
        .range(from, from + size - 1)
      if (e) throw e
      return { items: (data ?? []) as ManagerPerson[], total: count ?? 0 }
    },
    (p) => p.id,
    1000,
  )
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [sites, assignments, people] = await Promise.all([
      api.listAllWorksites(),
      fetchAllPages((p, size) => api.listAssignments({ page: p, size }), (a) => a.id),
      loadPeople(),
    ])
    worksites.value = sites
    all.value = managerWorkerRows(people, assignments, sites, todaySeoul())
  } catch (e) {
    all.value = []
    error.value = dboErrorMessage(e, '명부를 불러오지 못했습니다.')
  } finally {
    loading.value = false
  }
}
onMounted(load)

const notesOpen = ref(false)
const notesFor = ref<ManagerWorkerRow | null>(null)
function openNotes(row: ManagerWorkerRow) {
  notesFor.value = row
  notesOpen.value = true
}
</script>

<template>
  <div class="space-y-5">
    <p class="text-sm text-muted">맡은 근무지에 배정된 분입니다. 이름을 누르면 연락처와 메모를 봅니다. 명부 정보는 운영관리자가 고칩니다.</p>
    <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
    <DataTable :columns="columns" :rows="rows" :loading="loading" :total="filtered.length" :page="page"
      :page-size="PAGE_SIZE" :page-size-options="[PAGE_SIZE]"
      :empty-text="all.length ? '조건에 맞는 분이 없습니다.' : '맡은 근무지에 배정된 분이 없습니다.'" @update:page="page = $event">
      <template #toolbar>
        <PillSearch v-model="q" placeholder="이름 또는 전화번호" />
        <PillSelect v-if="worksites.length > 1" v-model="worksiteFilter"
          :options="[{ label: '근무지 전체', value: '' }, ...worksites.map((w) => ({ label: w.name, value: w.id }))]" />
        <PillSelect v-model="statusFilter" :options="[
          { label: '상태 전체', value: '' },
          { label: '활성', value: 'active' },
          { label: '종료', value: 'ended' },
        ]" />
      </template>
      <template #toolbar-end>
        <span class="text-sm text-muted tabular-nums">전체 {{ filtered.length.toLocaleString() }}명</span>
      </template>
      <template #cell-name="{ row }">
        <button type="button" class="font-semibold text-brand-500 hover:underline" @click="openNotes(row as ManagerWorkerRow)">{{ row.name }}</button>
      </template>
      <template #cell-phone="{ row }">{{ row.phone ? fmtPhone(row.phone) : '—' }}</template>
      <!-- 지금 유효한 배정의 근무지. 여러 곳이면 첫 하나와 「외 N」, 전체는 마우스를 올려 본다 -->
      <template #cell-worksites="{ row }">
        <span :title="siteNames(row as ManagerWorkerRow).join(', ') || undefined">
          {{ firstAndMore(siteNames(row as ManagerWorkerRow)) }}
        </span>
      </template>
      <template #cell-status="{ row }">
        <StatusBadge :tone="lifeStatusTone(row.status)">{{ lifeStatusLabel(row.status) }}</StatusBadge>
      </template>
    </DataTable>
    <MemberNotesModal v-model:open="notesOpen" :directory-id="notesFor?.id ?? null" :name="notesFor?.name ?? ''" />
  </div>
</template>
