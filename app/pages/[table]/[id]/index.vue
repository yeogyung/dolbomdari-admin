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

function labelFor(col: string): string {
  return def.value?.fields.find((f) => f.name === col)?.label || col
}

/** 종사자 상세 — 이름·ID 는 머리에만, 사진 URL 숨김, 시각 yyyy.mm.dd hh:mm */
const isWorker = computed(() => tableName.value === 'users')
const HIDDEN_ON_WORKER = new Set(['photo_uri', 'id', 'name'])
/** 종사자의 회원(계정) 정보 칸. 나머지는 인적사항 카드로 간다 */
const WORKER_ACCOUNT = new Set(['phone', 'type', 'kakao_oauth_id', 'last_active_at', 'created_at', 'updated_at'])

function displayFull(value: unknown, key?: string): string {
  if (isWorker.value && key && def.value?.fields.find((f) => f.name === key)?.type === 'datetime') {
    return fmtDateTime(value as string | null)
  }
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
  return keys.filter((k) => !(isWorker.value && HIDDEN_ON_WORKER.has(k))).map((k) => [k, row[k]])
})

/** 화면에 그릴 카드들. 종사자는 회원 정보와 인적사항 두 장, 나머지 테이블은 한 장 */
const cards = computed<{ title: string; count?: number; entries: [string, unknown][] }[]>(() => {
  if (!isWorker.value) {
    return [{ title: `${def.value?.label} 정보`, count: entries.value.length, entries: entries.value }]
  }
  return [
    { title: '회원 정보', entries: entries.value.filter(([k]) => WORKER_ACCOUNT.has(k)) },
    { title: '인적사항', entries: entries.value.filter(([k]) => !WORKER_ACCOUNT.has(k)) },
  ]
})

// 2열 배치에서 긴 값은 두 칸을 합친다 — 반 칸에 넣으면 줄바꿈이 심해 읽기 어렵다
function isWide(value: unknown, key?: string): boolean {
  const text = displayFull(value, key)
  return text.includes('\n') || text.length > 60
}

watchEffect(() => {
  if (def.value) setHeader('상세', [{ label: def.value.label, to: `/${tableName.value}` }])
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
      <div v-if="isWorker" class="flex items-center gap-2">
        <h2 class="text-[20px] font-bold text-ink">{{ record.name || '이름 없음' }}</h2>
        <Tag class="font-mono tabular-nums">{{ id }}</Tag>
      </div>

      <AppCard v-for="card in cards" :key="card.title" padding="none">
        <template #header>
          <h2 class="text-[18px] font-semibold text-ink">{{ card.title }}</h2>
          <span v-if="card.count !== undefined" class="text-sm text-muted tabular-nums">{{ card.count }}개 항목</span>
        </template>
        <!-- 2열에서는 divide-y 가 칸 단위로 안 그려져 칸마다 border-b 를 준다.
             마지막 줄은 2칸일 수 있어 last: 로 못 지운다 — pb 로 카드 테두리와 떼어 겹선을 막는다 -->
        <dl class="grid grid-cols-1 px-6 pb-4 md:grid-flow-row-dense md:grid-cols-2 md:gap-x-8">
          <div
            v-for="[key, val] in card.entries"
            :key="key"
            class="grid grid-cols-[8rem_1fr] gap-4 border-b border-hairline-soft py-3.5 text-sm"
            :class="{ 'md:col-span-2': isWide(val, key) }"
          >
            <dt class="font-medium text-muted">{{ labelFor(key) }}</dt>
            <dd class="min-w-0 break-words whitespace-pre-wrap text-body">
              {{ displayFull(val, key) }}
            </dd>
          </div>
        </dl>
      </AppCard>

      <!-- 이력서: 서류 양식 뷰 -->
      <ResumeDocument v-if="tableName === 'resumes'" :resume="(record as any)" />

      <ResumeSharePanel
        v-if="tableName === 'resumes' && record"
        :resume-id="id"
        :user-id="String((record as any).user_id)"
      />

      <!-- 종사자: 북마크·공고 열람·연락처 확인 기록 -->
      <WorkerRelations v-if="tableName === 'users'" :user-id="id" />
      <JobRelations v-if="tableName === 'jobs'" :job-id="id" />
      <OrgRelations v-if="tableName === 'organization'" :organization-id="id" />
    </template>

    <EmptyState v-else icon="i-lucide-search-x" title="데이터를 찾을 수 없습니다." />
  </div>
</template>
