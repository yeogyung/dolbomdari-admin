<!-- 단건 상세 보기 페이지 (읽기 전용) — 전체 컬럼 표시 + 수정/삭제 -->
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

// 쓰기는 master 만. 서버가 403 으로 막지만 버튼 자체를 보여 주지 않는다.
const { me } = useAdminRole()
const canWrite = computed(() => me.value?.role === 'master')
const canEdit = computed(
  () => canWrite.value && def.value?.mode === 'crud' && def.value!.pk.length === 1,
)

watchEffect(() => {
  if (def.value) setHeader('상세', [{ label: def.value.label, to: `/${tableName.value}` }])
})

async function loadRecord() {
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
}

onMounted(loadRecord)

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
  <EmptyState
    v-if="def && def.pk.length !== 1"
    icon="i-lucide-table-2"
    title="상세 화면을 지원하지 않습니다."
    description="키가 여러 개인 테이블은 목록에서만 확인할 수 있습니다."
  />

  <div v-else class="space-y-6">
    <Teleport to="#admin-topbar-actions">
      <AppButton
        variant="outline"
        color="neutral"
        icon="i-lucide-arrow-left"
        @click="navigateTo(`/${tableName}`)"
      >
        목록
      </AppButton>
      <AppButton
        v-if="canEdit"
        icon="i-lucide-pencil"
        @click="navigateTo(`/${tableName}/${encodeURIComponent(id)}/edit`)"
      >
        수정
      </AppButton>
      <AppButton v-if="canWrite" variant="soft" color="down" icon="i-lucide-trash-2" @click="onDelete">
        삭제
      </AppButton>
    </Teleport>

    <AppSpinner v-if="loading" label="불러오는 중…" />

    <template v-else-if="record">
      <!-- 기관 담당자: 가입 검토(승인·반려·서류) -->
      <OrgReviewPanel
        v-if="tableName === 'organization_manager'"
        :manager-id="id"
        :record="record"
        @changed="loadRecord"
      />

      <RecordDetail v-if="def" :def="def" :record="record" :id="id" />

      <!-- 이력서: 서류 양식 뷰 -->
      <ResumeDocument v-if="tableName === 'resumes'" :resume="(record as any)" />

      <ResumeSharePanel
        v-if="tableName === 'resumes' && record"
        :resume-id="id"
        :user-id="String((record as any).user_id)"
      />

      <!-- 종사자: 북마크·공고 열람·연락처 확인 기록. 기록 테이블은 master 만 조회할 수 있다(기관 계정은 매번 실패해 「불러오지 못함」만 보인다) -->
      <template v-if="canWrite">
        <WorkerRelations v-if="tableName === 'users'" :user-id="id" />
        <JobRelations v-if="tableName === 'jobs'" :job-id="id" />
        <OrgRelations v-if="tableName === 'organization'" :organization-id="id" />
      </template>
    </template>

    <EmptyState v-else icon="i-lucide-search-x" title="데이터를 찾을 수 없습니다." />
  </div>
</template>
