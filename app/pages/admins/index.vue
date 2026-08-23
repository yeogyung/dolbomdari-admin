<!-- 관리자 — 어드민 접근 계정 목록 + 생성(추가)·권한 해제 -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Column } from '~/types/table'

const api = useAdminApi()
const toast = useToast()
const { setHeader } = useAdminHeader()
setHeader('관리자')

const rows = ref<Record<string, any>[]>([])
const loading = ref(true)

const columns: Column[] = [
  { key: 'email', label: '이메일', strong: true },
  { key: 'source', label: '구분' },
  { key: 'created_at', label: '생성일' },
  { key: 'last_sign_in_at', label: '마지막 로그인' },
]

function fmt(v: unknown): string {
  if (!v) return '—'
  return String(v).replace('T', ' ').slice(0, 16)
}

async function load() {
  loading.value = true
  try {
    const res = await api.listAdmins()
    rows.value = res.rows
  } catch (e: any) {
    toast.add({ title: '목록 조회 실패', description: e?.data?.statusMessage || e.message, color: 'error' })
  } finally {
    loading.value = false
  }
}

// ── 관리자 추가 ──
const showCreate = ref(false)
const email = ref('')
const password = ref('')
const saving = ref(false)

function openCreate() {
  email.value = ''
  password.value = ''
  showCreate.value = true
}

async function submit() {
  if (saving.value) return
  saving.value = true
  try {
    await api.createAdmin({ email: email.value.trim(), password: password.value })
    toast.add({ title: '관리자 계정이 생성되었습니다.', color: 'success' })
    showCreate.value = false
    await load()
  } catch (e: any) {
    toast.add({ title: '생성 실패', description: e?.data?.statusMessage || e.message, color: 'error' })
  } finally {
    saving.value = false
  }
}

async function revoke(row: Record<string, any>) {
  if (!confirm(`${row.email} 계정의 어드민 접근 권한을 해제할까요?`)) return
  try {
    await api.revokeAdmin(row.id)
    toast.add({ title: '권한을 해제했습니다.', color: 'success' })
    await load()
  } catch (e: any) {
    toast.add({ title: '해제 실패', description: e?.data?.statusMessage || e.message, color: 'error' })
  }
}

onMounted(load)
</script>

<template>
  <div class="flex min-h-[calc(100vh-8rem)] flex-col">
    <Teleport to="#admin-topbar-actions">
      <AppButton icon="i-lucide-plus" @click="openCreate">관리자 추가</AppButton>
    </Teleport>

    <DataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      row-key="id"
      :page="1"
      :page-size="100"
      :total="rows.length"
      empty-text="등록된 관리자가 없습니다."
    >
      <template #toolbar-end>
        <span class="text-sm text-muted tabular-nums">전체 {{ rows.length }}명</span>
      </template>

      <template #cell-source="{ value }">
        <StatusBadge :tone="value === '생성' ? 'blue' : 'gray'">{{ value }}</StatusBadge>
      </template>
      <template #cell-created_at="{ value }">{{ fmt(value) }}</template>
      <template #cell-last_sign_in_at="{ value }">{{ fmt(value) }}</template>

      <template #actions="{ row }">
        <button
          v-if="row.source === '생성'"
          type="button"
          class="text-sm font-medium text-down hover:underline"
          @click="revoke(row)"
        >
          권한 해제
        </button>
        <span v-else class="text-sm text-muted-soft">—</span>
      </template>
    </DataTable>

    <!-- 관리자 추가 모달 -->
    <AppModal v-model:open="showCreate" title="관리자 추가">
      <div class="space-y-4">
        <p class="text-sm text-muted">
          어드민에 로그인할 수 있는 계정을 만듭니다. 생성 후 이 이메일·비밀번호로 로그인하면 접근 권한이 부여됩니다.
        </p>
        <FormField label="이메일" required>
          <TextField v-model="email" type="email" placeholder="admin@example.com" />
        </FormField>
        <FormField label="비밀번호" required hint="8자 이상">
          <TextField v-model="password" type="password" placeholder="비밀번호" />
        </FormField>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" @click="showCreate = false">취소</AppButton>
        <AppButton :loading="saving" @click="submit">생성</AppButton>
      </template>
    </AppModal>
  </div>
</template>
