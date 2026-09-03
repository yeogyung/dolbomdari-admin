<!-- 사업 관리 — 목록/등록/수정 (앱 상단 사업 전환 헤더의 원천, /dbo-admin/programs) -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Column } from '~/types/table'
import type { LifeStatus, Program } from '~/types/dbo'

const api = useDboAdmin()
const toast = useToast()
const { setHeader } = useAdminHeader()
setHeader('사업 관리')

const rows = ref<Program[]>([])
const loading = ref(false)

const columns: Column[] = [
  { key: 'name', label: '사업명', strong: true },
  { key: 'color', label: '색' },
  { key: 'status', label: '상태' },
  { key: 'created_at', label: '등록일' },
]

async function load() {
  loading.value = true
  try {
    const res = await api.listPrograms()
    rows.value = res.items
  } catch (e: any) {
    toast.add({ title: '사업 조회 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    loading.value = false
  }
}

const formOpen = ref(false)
const saving = ref(false)
const editing = ref<Program | null>(null)
const form = ref({ name: '', color: '#0370ff', status: 'active' as LifeStatus })

function openForm(row?: Program) {
  editing.value = row ?? null
  form.value = row
    ? { name: row.name, color: row.color || '#0370ff', status: row.status }
    : { name: '', color: '#0370ff', status: 'active' }
  formOpen.value = true
}

async function submitForm() {
  if (!form.value.name.trim()) {
    toast.add({ title: '사업명을 입력해 주세요.', color: 'warning' })
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await api.updateProgram(editing.value.id, {
        name: form.value.name.trim(),
        color: form.value.color,
        status: form.value.status,
      })
    } else {
      await api.createProgram({ name: form.value.name.trim(), color: form.value.color })
    }
    toast.add({ title: '저장되었습니다.', color: 'success' })
    formOpen.value = false
    load()
  } catch (e: any) {
    toast.add({ title: '저장 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="flex min-h-[calc(100vh-8rem)] flex-col">
    <Teleport to="#admin-topbar-actions">
      <AppButton icon="i-lucide-plus" @click="openForm()">사업 등록</AppButton>
    </Teleport>

    <DataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :total="rows.length"
      :page-size="100"
      empty-text="등록된 사업이 없습니다."
    >
      <template #toolbar-end>
        <span class="text-sm text-muted tabular-nums">전체 {{ rows.length }}개</span>
      </template>

      <template #cell-color="{ row }">
        <span class="inline-flex items-center gap-2">
          <span
            class="size-4 rounded-full border border-hairline"
            :style="{ backgroundColor: row.color }"
          />
          <span class="font-mono text-[13px] text-muted">{{ row.color }}</span>
        </span>
      </template>
      <template #cell-status="{ row }">
        <StatusBadge :tone="lifeStatusTone(row.status)">
          {{ lifeStatusLabel(row.status) }}
        </StatusBadge>
      </template>
      <template #cell-created_at="{ row }">{{ fmtStamp(row.created_at) }}</template>

      <template #actions="{ row }">
        <button
          type="button"
          class="text-sm font-medium text-brand-500 hover:underline"
          @click="openForm(row)"
        >
          수정
        </button>
      </template>
    </DataTable>

    <AppModal v-model:open="formOpen" :title="editing ? '사업 수정' : '사업 등록'">
      <div class="space-y-4">
        <FormField label="사업명" required>
          <TextField v-model="form.name" placeholder="예: 노인일자리 2026" />
        </FormField>
        <FormField label="구분 색" hint="앱과 어드민이 글자보다 색으로 먼저 사업을 구분합니다.">
          <div class="flex items-center gap-3">
            <input
              v-model="form.color"
              type="color"
              class="size-10 cursor-pointer rounded-lg border border-hairline bg-white"
            />
            <TextField v-model="form.color" placeholder="#0370ff" />
          </div>
        </FormField>
        <FormField v-if="editing" label="상태" hint="종료해도 기록은 지우지 않습니다.">
          <SelectField
            v-model="form.status"
            :options="[
              { label: '활성', value: 'active' },
              { label: '종료', value: 'ended' },
            ]"
          />
        </FormField>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" @click="formOpen = false">
          취소
        </AppButton>
        <AppButton size="sm" :loading="saving" @click="submitForm">저장</AppButton>
      </template>
    </AppModal>
  </div>
</template>
