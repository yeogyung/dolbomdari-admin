<!-- 신규 생성 페이지 -->
<script setup lang="ts">
import { getTable } from '#shared/tables'

const route = useRoute()
const api = useAdminApi()
const toast = useToast()

const tableName = computed(() => String(route.params.table))
const def = computed(() => getTable(tableName.value))
const submitting = ref(false)

const allowed = computed(() => def.value?.mode === 'crud' && def.value.canCreate)

async function onSubmit(payload: Record<string, any>) {
  submitting.value = true
  try {
    await api.create(tableName.value, payload)
    toast.add({ title: '생성되었습니다.', color: 'success' })
    await navigateTo(`/${tableName.value}`)
  } catch (e: any) {
    toast.add({ title: '생성 실패', description: e?.data?.statusMessage || e.message, color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div v-if="!allowed">
    <p class="text-red-600">이 테이블은 생성할 수 없습니다.</p>
  </div>
  <div v-else class="max-w-2xl">
    <h1 class="mb-4 text-xl font-bold">{{ def!.label }} 생성</h1>
    <UCard>
      <RecordForm
        :def="def!"
        :initial="{}"
        mode="create"
        :submitting="submitting"
        @submit="onSubmit"
        @cancel="navigateTo(`/${tableName}`)"
      />
    </UCard>
  </div>
</template>
