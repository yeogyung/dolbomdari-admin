<!-- 단건 수정 페이지 -->
<script setup lang="ts">
import { getTable } from '#shared/tables'

const route = useRoute()
const api = useAdminApi()
const toast = useToast()
const { setHeader } = useAdminHeader()

const tableName = computed(() => String(route.params.table))
const id = computed(() => String(route.params.id))
const def = computed(() => getTable(tableName.value))

const record = ref<Record<string, any> | null>(null)
const loading = ref(true)
const submitting = ref(false)

// 주소를 직접 쳐도 열리지 않게 한다
const { me } = useAdminRole()
const editable = computed(
  () => me.value?.role === 'master' && def.value?.mode === 'crud' && def.value.pk.length === 1,
)
const detailPath = computed(() => `/${tableName.value}/${encodeURIComponent(id.value)}`)

watchEffect(() => {
  if (def.value) setHeader('수정', [{ label: def.value.label, to: `/${tableName.value}` }])
})

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
  <EmptyState
    v-if="!editable"
    icon="i-lucide-lock"
    title="수정할 수 없는 테이블입니다."
    description="운영관리자만, 그리고 키가 하나인 테이블만 수정할 수 있습니다."
  />

  <div v-else class="max-w-3xl">
    <AppSpinner v-if="loading" label="불러오는 중…" />
    <AppCard v-else-if="record" padding="lg">
      <template #header>
        <h2 class="text-[18px] font-semibold text-ink">{{ def!.label }} 수정</h2>
      </template>
      <RecordForm
        :def="def!"
        :initial="record"
        mode="edit"
        :submitting="submitting"
        @submit="onSubmit"
        @cancel="navigateTo(detailPath)"
      />
    </AppCard>
  </div>
</template>
