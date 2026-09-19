<!-- 신규 생성 페이지 -->
<script setup lang="ts">
import { getTable } from '#shared/tables'

const route = useRoute()
const api = useAdminApi()
const toast = useToast()
const { setHeader } = useAdminHeader()

const tableName = computed(() => String(route.params.table))
const def = computed(() => getTable(tableName.value))
const submitting = ref(false)

// 주소를 직접 쳐도 열리지 않게 한다 — 목록에서 버튼을 감추는 것만으로는 부족하다
const { me } = useAdminRole()
const allowed = computed(
  () => me.value?.role === 'master' && def.value?.mode === 'crud' && def.value.canCreate,
)

watchEffect(() => {
  if (def.value) setHeader('새로 만들기', [{ label: def.value.label, to: `/${tableName.value}` }])
})

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
  <EmptyState
    v-if="!allowed"
    icon="i-lucide-lock"
    title="생성할 수 없는 테이블입니다."
    description="운영관리자만, 그리고 생성이 열려 있는 테이블만 만들 수 있습니다."
  />

  <div v-else class="max-w-3xl">
    <AppCard padding="lg">
      <template #header>
        <h2 class="text-[18px] font-semibold text-ink">{{ def!.label }} 생성</h2>
      </template>
      <RecordForm
        :def="def!"
        :initial="{}"
        mode="create"
        :submitting="submitting"
        @submit="onSubmit"
        @cancel="navigateTo(`/${tableName}`)"
      />
    </AppCard>
  </div>
</template>
