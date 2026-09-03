<!-- 계정·권한 — 운영관리자(master)·수요처(worksite) 계정 발급/수정/종료 (/dbo-admin/accounts) -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Column } from '~/types/table'
import type { AdminAccount, AdminRole, LifeStatus, Worksite } from '~/types/dbo'

const api = useDboAdmin()
const toast = useToast()
const { setHeader } = useAdminHeader()
setHeader('계정·권한')

const rows = ref<AdminAccount[]>([])
const loading = ref(false)
const worksites = ref<Worksite[]>([])

const worksiteName = (id: string | null) =>
  id ? (worksites.value.find((w) => w.id === id)?.name ?? id) : '—'

const columns: Column[] = [
  { key: 'name', label: '이름', strong: true },
  { key: 'email', label: '이메일' },
  { key: 'role', label: '권한' },
  { key: 'worksite_id', label: '담당 근무지' },
  { key: 'status', label: '상태' },
  { key: 'created_at', label: '발급일' },
]

async function load() {
  loading.value = true
  try {
    const res = await api.listAccounts()
    rows.value = res.items
  } catch (e: any) {
    toast.add({ title: '계정 조회 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    loading.value = false
  }
}

async function loadWorksites() {
  try {
    const res = await api.listWorksites({ size: 100, sort: 'name' })
    worksites.value = res.items
  } catch {
    // 근무지 목록은 선택 편의용이다.
  }
}

/* 신규 발급 */
const createOpen = ref(false)
const saving = ref(false)
const createForm = ref({
  name: '',
  email: '',
  password: '',
  role: 'worksite' as AdminRole,
  worksiteId: null as string | null,
})

const needsWorksite = computed(() => createForm.value.role === 'worksite')

function openCreate() {
  createForm.value = { name: '', email: '', password: '', role: 'worksite', worksiteId: null }
  createOpen.value = true
}

async function submitCreate() {
  const f = createForm.value
  if (!f.name.trim() || !f.email.trim() || f.password.length < 8) {
    toast.add({ title: '이름·이메일·비밀번호(8자 이상)를 확인해 주세요.', color: 'warning' })
    return
  }
  if (needsWorksite.value && !f.worksiteId) {
    toast.add({ title: '수요처 계정은 담당 근무지가 필요합니다.', color: 'warning' })
    return
  }
  saving.value = true
  try {
    await api.createAccount({
      name: f.name.trim(),
      email: f.email.trim(),
      password: f.password,
      role: f.role,
      worksiteId: needsWorksite.value ? f.worksiteId : null,
    })
    toast.add({ title: '계정이 발급되었습니다.', color: 'success' })
    createOpen.value = false
    load()
  } catch (e: any) {
    toast.add({ title: '발급 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

/* 수정 — 이메일·권한은 바꿀 수 없다 */
const editOpen = ref(false)
const editing = ref<AdminAccount | null>(null)
const editForm = ref({
  name: '',
  worksiteId: null as string | null,
  status: 'active' as LifeStatus,
})

function openEdit(row: AdminAccount) {
  editing.value = row
  editForm.value = { name: row.name, worksiteId: row.worksite_id, status: row.status }
  editOpen.value = true
}

async function submitEdit() {
  if (!editing.value) return
  saving.value = true
  try {
    await api.updateAccount(editing.value.id, {
      name: editForm.value.name.trim(),
      worksiteId: editing.value.role === 'worksite' ? editForm.value.worksiteId : null,
      status: editForm.value.status,
    })
    toast.add({ title: '저장되었습니다.', color: 'success' })
    editOpen.value = false
    load()
  } catch (e: any) {
    toast.add({ title: '저장 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function endAccount(row: AdminAccount) {
  if (!confirm(`${row.name} 계정을 종료하시겠습니까? 로그인만 막고 기록은 남습니다.`)) return
  try {
    await api.endAccount(row.id)
    toast.add({ title: '계정이 종료되었습니다.', color: 'success' })
    load()
  } catch (e: any) {
    toast.add({ title: '종료 실패', description: dboErrorMessage(e, '자기 자신은 종료할 수 없습니다.'), color: 'error' })
  }
}

onMounted(() => {
  load()
  loadWorksites()
})
</script>

<template>
  <div class="flex min-h-[calc(100vh-8rem)] flex-col">
    <Teleport to="#admin-topbar-actions">
      <AppButton icon="i-lucide-user-plus" @click="openCreate">계정 발급</AppButton>
    </Teleport>

    <DataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :total="rows.length"
      :page-size="100"
      empty-text="발급된 계정이 없습니다."
    >
      <template #toolbar-end>
        <span class="text-sm text-muted tabular-nums">전체 {{ rows.length }}개</span>
      </template>

      <template #cell-email="{ row }">
        <span class="text-muted">{{ row.email || '—' }}</span>
      </template>
      <template #cell-role="{ row }">
        <Tag>{{ ROLE_LABELS[row.role] ?? row.role }}</Tag>
      </template>
      <template #cell-worksite_id="{ row }">{{ worksiteName(row.worksite_id) }}</template>
      <template #cell-status="{ row }">
        <StatusBadge :tone="lifeStatusTone(row.status)">
          {{ lifeStatusLabel(row.status) }}
        </StatusBadge>
      </template>
      <template #cell-created_at="{ row }">{{ fmtStamp(row.created_at) }}</template>

      <template #actions="{ row }">
        <div class="flex justify-end gap-3">
          <button
            type="button"
            class="text-sm font-medium text-brand-500 hover:underline"
            @click="openEdit(row)"
          >
            수정
          </button>
          <button
            v-if="row.status === 'active'"
            type="button"
            class="text-sm font-medium text-down hover:underline"
            @click="endAccount(row)"
          >
            종료
          </button>
        </div>
      </template>
    </DataTable>

    <!-- 발급 -->
    <AppModal v-model:open="createOpen" title="계정 발급" width="max-w-lg">
      <div class="space-y-4">
        <FormField label="이름" required>
          <TextField v-model="createForm.name" placeholder="담당자 이름" />
        </FormField>
        <FormField label="이메일" required hint="이 이메일과 비밀번호로 어드민에 로그인합니다.">
          <TextField v-model="createForm.email" type="email" placeholder="name@example.com" />
        </FormField>
        <FormField label="비밀번호" required hint="8자 이상">
          <TextField v-model="createForm.password" type="password" />
        </FormField>
        <FormField label="권한" required>
          <SelectField
            v-model="createForm.role"
            :options="[
              { label: '수요처 (담당 근무지만)', value: 'worksite' },
              { label: '운영관리자 (전체)', value: 'master' },
            ]"
          />
        </FormField>
        <FormField
          v-if="needsWorksite"
          label="담당 근무지"
          required
          hint="수요처 계정은 이 근무지의 출결·배정만 볼 수 있습니다."
        >
          <SelectField
            v-model="createForm.worksiteId"
            :options="worksites.map((w) => ({ label: w.name, value: w.id }))"
            placeholder="근무지 선택"
          />
        </FormField>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" @click="createOpen = false">
          취소
        </AppButton>
        <AppButton size="sm" :loading="saving" @click="submitCreate">발급</AppButton>
      </template>
    </AppModal>

    <!-- 수정 -->
    <AppModal v-model:open="editOpen" title="계정 수정">
      <div v-if="editing" class="space-y-4">
        <FormField label="이메일" hint="이메일과 권한은 바꿀 수 없습니다.">
          <TextField :model-value="editing.email ?? '—'" readonly />
        </FormField>
        <FormField label="이름" required>
          <TextField v-model="editForm.name" />
        </FormField>
        <FormField v-if="editing.role === 'worksite'" label="담당 근무지">
          <SelectField
            v-model="editForm.worksiteId"
            :options="worksites.map((w) => ({ label: w.name, value: w.id }))"
            placeholder="근무지 선택"
          />
        </FormField>
        <FormField label="상태">
          <SelectField
            v-model="editForm.status"
            :options="[
              { label: '활성', value: 'active' },
              { label: '종료', value: 'ended' },
            ]"
          />
        </FormField>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" @click="editOpen = false">
          취소
        </AppButton>
        <AppButton size="sm" :loading="saving" @click="submitEdit">저장</AppButton>
      </template>
    </AppModal>
  </div>
</template>
