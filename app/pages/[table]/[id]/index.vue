<!-- 단건 상세 보기 페이지 (읽기 전용) — 전체 컬럼 표시 + 수정/삭제 -->
<script setup lang="ts">
import { getTable } from '#shared/tables'

const route = useRoute()
const api = useAdminApi()
const toast = useToast()

const tableName = computed(() => String(route.params.table))
const id = computed(() => String(route.params.id))
const def = computed(() => getTable(tableName.value))

const record = ref<Record<string, any> | null>(null)
const loading = ref(true)

const canEdit = computed(() => def.value?.mode === 'crud' && def.value!.pk.length === 1)

function labelFor(col: string): string {
  return def.value?.fields.find((f) => f.name === col)?.label || col
}

function displayFull(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? '✓' : '✗'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

// 표시 순서: 레지스트리 필드 순서 우선, 없으면 조회 결과 키 순서
const entries = computed<[string, unknown][]>(() => {
  if (!record.value) return []
  const row = record.value
  const fieldOrder = def.value?.fields.map((f) => f.name) || []
  const keys = [
    ...fieldOrder.filter((k) => k in row),
    ...Object.keys(row).filter((k) => !fieldOrder.includes(k)),
  ]
  return keys.map((k) => [k, row[k]])
})

onMounted(async () => {
  if (def.value && def.value.pk.length !== 1) {
    loading.value = false
    return
  }
  try {
    record.value = await api.get(tableName.value, id.value)
  } catch (e: any) {
    toast.add({ title: '조회 실패', description: e?.data?.statusMessage || e.message, color: 'error' })
  } finally {
    loading.value = false
  }
})

async function onDelete() {
  if (!def.value) return
  if (!confirm('정말 삭제하시겠습니까?')) return
  try {
    await api.remove(tableName.value, { [def.value.pk[0]!]: id.value })
    toast.add({ title: '삭제되었습니다.', color: 'success' })
    await navigateTo(`/${tableName.value}`)
  } catch (e: any) {
    toast.add({ title: '삭제 실패', description: e?.data?.statusMessage || e.message, color: 'error' })
  }
}
</script>

<template>
  <div v-if="def && def.pk.length !== 1">
    <p class="text-red-600">이 테이블은 상세 페이지를 지원하지 않습니다(복합키).</p>
  </div>
  <div v-else class="max-w-2xl">
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-xl font-bold">{{ def?.label }} 상세</h1>
      <div class="flex gap-2">
        <UButton variant="ghost" color="neutral" :to="`/${tableName}`">목록</UButton>
        <UButton v-if="canEdit" color="primary" :to="`/${tableName}/${encodeURIComponent(id)}/edit`">
          수정
        </UButton>
        <UButton color="error" variant="soft" @click="onDelete">삭제</UButton>
      </div>
    </div>

    <Spinner v-if="loading" label="불러오는 중…" />
    <template v-else-if="record">
      <UCard>
        <dl class="divide-y divide-gray-100 text-sm">
          <div v-for="[key, val] in entries" :key="key" class="grid grid-cols-3 gap-2 py-2">
            <dt class="col-span-1 text-gray-500">{{ labelFor(key) }}</dt>
            <dd class="col-span-2 whitespace-pre-wrap break-words text-gray-800">{{ displayFull(val) }}</dd>
          </div>
        </dl>
      </UCard>

      <!-- 종사자: 북마크·공고 열람·연락처 확인 기록 -->
      <WorkerRelations v-if="tableName === 'users'" :user-id="id" class="mt-4" />
    </template>
    <p v-else class="text-gray-400">데이터를 찾을 수 없습니다.</p>
  </div>
</template>
