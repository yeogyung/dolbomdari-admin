<!-- 명부 관리 — 시니어·담당자·수요처 목록/검색/역할·상태 필터 + 신규 등록 (GET·POST /dbo-admin/directory) -->
<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import type { Column } from '~/types/table'
import type { DirectoryEntry, LifeStatus, Program, Worksite } from '~/types/dbo'

const api = useDboAdmin()
const toast = useToast()
const { setHeader } = useAdminHeader()
setHeader('명부 관리')

const rows = ref<DirectoryEntry[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const q = ref('')
const statusFilter = ref<'' | LifeStatus>('')
const roleFilter = ref<'' | 'senior' | 'manager' | 'worksite'>('')
const sortKey = ref('created_at')
const loading = ref(false)

const columns: Column[] = [
  { key: 'name', label: '이름', sortable: true, strong: true },
  { key: 'phone', label: '전화번호' },
  { key: 'role', label: '역할' },
  { key: 'status', label: '상태', sortable: true },
  { key: 'memo', label: '메모' },
  { key: 'created_at', label: '등록일', sortable: true },
]

async function load() {
  loading.value = true
  try {
    const res = await api.listDirectory({
      page: page.value,
      size: pageSize.value,
      q: q.value,
      sort: sortKey.value,
      status: statusFilter.value || undefined,
      role: roleFilter.value || undefined,
    })
    rows.value = res.items
    total.value = res.total
  } catch (e: any) {
    toast.add({ title: '명부 조회 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  load()
}

watch([statusFilter, roleFilter], search)

function toggleSort(key: string) {
  sortKey.value = key
  page.value = 1
  load()
}

/* 신규 등록 */
const createOpen = ref(false)
const saving = ref(false)
type CreateRole = 'senior' | 'manager' | 'worksite'
const emptyForm = () => ({
  name: '',
  phone: '',
  role: 'senior' as CreateRole,
  memo: '',
  /** 담당자 — 맡을 수요처들 */
  worksiteIds: [] as string[],
  /** 수요처 담당자 — 근무지 1곳 */
  worksiteId: null as string | null,
})
const form = ref(emptyForm())

/* 근무지·사업 — 담당자·수요처 담당자 등록에서 고른다. 처음 열 때 한 번 받는다 */
const worksites = ref<Worksite[]>([])
const programs = ref<Program[]>([])
const refsLoaded = ref(false)
const refsLoading = ref(false)

async function loadRefs() {
  if (refsLoaded.value || refsLoading.value) return
  refsLoading.value = true
  try {
    const [ws, pg] = await Promise.all([api.listAllWorksites(), api.listPrograms()])
    worksites.value = ws
    programs.value = pg.items.filter((p) => p.status === 'active')
    refsLoaded.value = true
  } catch (e: any) {
    toast.add({ title: '근무지 목록 조회 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    refsLoading.value = false
  }
}

/** 새 담당자에게 다른 담당자가 있던 근무지는 넘어온다 */
const takenByOther = (w: Worksite) => !!w.manager_directory_id

function openCreate() {
  form.value = emptyForm()
  createOpen.value = true
  loadRefs()
}

async function submitCreate() {
  const f = form.value
  if (!f.name.trim() || !f.phone.trim()) {
    toast.add({ title: '이름과 전화번호를 입력해 주세요.', color: 'warning' })
    return
  }
  if (f.role === 'worksite' && !f.worksiteId) {
    toast.add({ title: '수요처 담당자의 근무지를 선택해 주세요.', color: 'warning' })
    return
  }
  if (f.role === 'manager') {
    const moving = worksites.value.filter((w) => f.worksiteIds.includes(w.id) && takenByOther(w))
    if (
      moving.length &&
      !confirm(
        `${moving.map((w) => w.name).join(', ')} 은(는) 다른 담당자가 맡고 있습니다. 새 담당자로 옮기시겠습니까?`,
      )
    )
      return
  }
  saving.value = true
  try {
    await api.createDirectory({
      name: f.name.trim(),
      phone: f.phone.trim(),
      role: f.role,
      memo: f.memo.trim() || null,
      // 역할에 맞는 값만 보낸다 — 서버는 맞지 않는 값을 400 으로 거절한다
      ...(f.role === 'manager' ? { worksiteIds: f.worksiteIds } : {}),
      ...(f.role === 'worksite' ? { worksiteId: f.worksiteId! } : {}),
    })
    // 담당자 지정이 근무지 쪽 칸을 바꿨으므로 다음 등록 때 다시 받는다
    if (f.role === 'manager' && f.worksiteIds.length) refsLoaded.value = false
    toast.add({ title: '등록되었습니다.', color: 'success' })
    createOpen.value = false
    page.value = 1
    load()
  } catch (e: any) {
    toast.add({ title: '등록 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="flex min-h-[calc(100vh-8rem)] flex-col">
    <Teleport to="#admin-topbar-actions">
      <AppButton icon="i-lucide-user-plus" @click="openCreate">명부 등록</AppButton>
    </Teleport>

    <DataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :sort-key="sortKey"
      sort-dir="asc"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :page-size-options="[20, 50, 100]"
      empty-text="등록된 시니어·담당자가 없습니다."
      @sort="toggleSort"
      @update:page="(p) => { page = p; load() }"
      @update:page-size="(s) => { pageSize = s; page = 1; load() }"
    >
      <template #toolbar>
        <PillSearch v-model="q" placeholder="이름 또는 전화번호" @search="search" />
        <PillSelect
          v-model="roleFilter"
          :options="[
            { label: '역할 전체', value: '' },
            { label: '시니어', value: 'senior' },
            { label: '담당자', value: 'manager' },
            { label: '수요처', value: 'worksite' },
          ]"
        />
        <PillSelect
          v-model="statusFilter"
          :options="[
            { label: '상태 전체', value: '' },
            { label: '활성', value: 'active' },
            { label: '종료', value: 'ended' },
          ]"
        />
      </template>

      <template #toolbar-end>
        <span class="text-sm text-muted tabular-nums">전체 {{ total.toLocaleString() }}명</span>
      </template>

      <!-- 수요처 계정은 이메일로 로그인해 전화번호가 없을 수 있다 -->
      <template #cell-phone="{ row }">{{ row.phone ? fmtPhone(row.phone) : (row.email ?? '—') }}</template>
      <template #cell-role="{ row }">
        <Tag>{{ ROLE_LABELS[row.role] ?? row.role }}</Tag>
      </template>
      <template #cell-status="{ row }">
        <StatusBadge :tone="lifeStatusTone(row.status)">{{ lifeStatusLabel(row.status) }}</StatusBadge>
      </template>
      <template #cell-memo="{ row }">
        <span class="text-muted">{{ row.memo || '—' }}</span>
      </template>
      <template #cell-created_at="{ row }">{{ fmtStamp(row.created_at) }}</template>

      <template #actions="{ row }">
        <!-- 수요처 계정의 발급·수정은 계정·권한 화면 몫이다. 명부 상세는 시니어·담당자만 다룬다 -->
        <NuxtLink
          v-if="row.role === 'worksite'"
          to="/senior/accounts"
          class="text-sm font-medium text-brand-500 hover:underline"
        >
          계정·권한
        </NuxtLink>
        <NuxtLink v-else :to="`/senior/workers/${row.id}`" class="text-sm font-medium text-brand-500 hover:underline">
          상세
        </NuxtLink>
      </template>
    </DataTable>

    <!-- 등록 모달 -->
    <AppModal v-model:open="createOpen" title="명부 등록">
      <div class="space-y-4">
        <FormField label="이름" required>
          <TextField v-model="form.name" placeholder="홍길동" />
        </FormField>
        <FormField
          label="전화번호"
          required
          :hint="
            form.role === 'worksite'
              ? '어드민 로그인의 열쇠입니다. 이 번호로 문자 인증해 담당 근무지의 출퇴근 기록을 봅니다.'
              : '앱 로그인의 열쇠입니다. 이 번호로 본인 인증만 하면 바로 연결됩니다.'
          "
        >
          <TextField v-model="form.phone" placeholder="010-1234-5678" />
        </FormField>
        <FormField label="역할" required>
          <SelectField
            v-model="form.role"
            :options="[
              { label: '시니어', value: 'senior' },
              { label: '담당자', value: 'manager' },
              { label: '수요처 담당자', value: 'worksite' },
            ]"
          />
        </FormField>
        <p v-if="form.role === 'senior'" class="text-sm text-muted">
          근무지·요일·시간은 등록 후 상세 화면의 반복 배정에서 정합니다.
        </p>
        <FormField
          v-else
          :label="form.role === 'manager' ? '담당 근무지' : '근무지'"
          :required="form.role === 'worksite'"
          :hint="
            form.role === 'manager'
              ? '사업으로 좁혀 여러 곳을 고를 수 있습니다. 나중에 상세 화면에서 바꿀 수 있습니다.'
              : '수요처 담당자는 근무지 1곳만 맡습니다.'
          "
        >
          <AppSpinner v-if="refsLoading" label="근무지 불러오는 중…" />
          <WorksitePicker
            v-else-if="form.role === 'manager'"
            v-model="form.worksiteIds"
            :worksites="worksites"
            :programs="programs"
            :is-taken="takenByOther"
            multiple
          />
          <WorksitePicker v-else v-model="form.worksiteId" :worksites="worksites" :programs="programs" />
        </FormField>
        <FormField label="메모" hint="담당자 참고용. 앱에는 보이지 않습니다.">
          <AppTextarea v-model="form.memo" :rows="3" />
        </FormField>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" @click="createOpen = false">취소</AppButton>
        <AppButton size="sm" :loading="saving" @click="submitCreate">등록</AppButton>
      </template>
    </AppModal>
  </div>
</template>
