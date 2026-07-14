<!-- 단건 수정 페이지 -->
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
const submitting = ref(false)

const editable = computed(() => def.value?.mode === 'crud' && def.value.pk.length === 1)
const detailPath = computed(() => `/${tableName.value}/${encodeURIComponent(id.value)}`)

onMounted(async () => {
  if (!editable.value) {
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

async function onSubmit(payload: Record<string, any>) {
  submitting.value = true
  try {
    await api.update(tableName.value, id.value, payload)
    toast.add({ title: '저장되었습니다.', color: 'success' })
    await navigateTo(detailPath.value)
  } catch (e: any) {
    toast.add({ title: '저장 실패', description: e?.data?.statusMessage || e.message, color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div v-if="!editable">
    <p class="text-red-600">이 테이블은 수정할 수 없습니다.</p>
  </div>
  <div v-else class="max-w-2xl">
    <h1 class="mb-4 text-xl font-bold">{{ def!.label }} 수정</h1>

    <Spinner v-if="loading" label="불러오는 중…" />
    <UCard v-else-if="record">
      <RecordForm
        :def="def!"
        :initial="record"
        mode="edit"
        :submitting="submitting"
        @submit="onSubmit"
        @cancel="navigateTo(detailPath)"
      />
    </UCard>
  </div>
</template>
