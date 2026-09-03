<!-- 명부 관리 — 시니어·담당자 목록/검색/상태 필터 + 신규 등록 (GET·POST /dbo-admin/directory) -->
<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import type { Column } from '~/types/table'
import type { DirectoryEntry, LifeStatus } from '~/types/dbo'

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

watch(statusFilter, search)

function toggleSort(key: string) {
  sortKey.value = key
  page.value = 1
  load()
}

/* 신규 등록 */
const createOpen = ref(false)
const saving = ref(false)
const form = ref({ name: '', phone: '', role: 'senior' as 'senior' | 'manager', memo: '' })

function openCreate() {
  form.value = { name: '', phone: '', role: 'senior', memo: '' }
  createOpen.value = true
}

async function submitCreate() {
  if (!form.value.name.trim() || !form.value.phone.trim()) {
    toast.add({ title: '이름과 전화번호를 입력해 주세요.', color: 'warning' })
    return
  }
  saving.value = true
  try {
    await api.createDirectory({
      name: form.value.name.trim(),
      phone: form.value.phone.trim(),
      role: form.value.role,
      memo: form.value.memo.trim() || null,
    })
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

      <template #cell-phone="{ row }">{{ fmtPhone(row.phone) }}</template>
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
        <NuxtLink :to="`/senior/workers/${row.id}`" class="text-sm font-medium text-brand-500 hover:underline">
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
          hint="앱 로그인의 열쇠입니다. 시니어는 이 번호로 본인 인증만 하면 바로 연결됩니다."
        >
          <TextField v-model="form.phone" placeholder="010-1234-5678" />
        </FormField>
        <FormField label="역할" required>
          <SelectField
            v-model="form.role"
            :options="[
              { label: '시니어', value: 'senior' },
              { label: '담당자', value: 'manager' },
            ]"
          />
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
