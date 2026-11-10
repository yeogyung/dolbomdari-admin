<!-- 담당자 AI 문서 목록(QA 2026-11-07 MGR-05) — 앱 「답변 자료」(db-operation-rn app/faq/index.tsx)와 같은 상태·제외/다시 사용. 읽기는 supabase dbo_documents 직접(RLS: 담당자·master), 쓰기는 앱 API. 삭제·상세·새 판은 master 몫이다. Figma 없음 -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Column } from '~/types/table'
import { byExcludedLast, isMaybeSaved, knowledgeErrorText, knowledgeScopeLabel, managerDocState, NotSentError } from '~/utils/managerKnowledge'

type Row = {
  id: string
  filename: string
  kind: string | null
  excluded_at: string | null
  effective_date: string | null
  expiry_date: string | null
  byte_size: number | null
  citation_count: number | null
  updated_at: string
  created_by_name: string | null
  dbo_document_worksites: { worksite_id: string }[] | null
}

const supabase = useSupabase()
const api = useDboAdmin()
const app = useDboApp()
const toast = useToast()
/** AI 가 아직 읽지 못한 문서(결정 D16). 못 받으면 비워 두고 `prepFailed` 로 알린다 — 목록은 막지 않는다 */
const preparing = ref(new Set<string>())
/** 준비 중 판정을 못 받았다 — 색인 전 문서도 「사용 중」으로 보일 수 있다 */
const prepFailed = ref(false)
const siteNamesLoaded = ref(false)
/** 맡은 근무지 이름 — 적용 범위 칸. 다른 담당자의 근무지는 RLS 로 이름을 못 읽어 「외」로 남는다 */
const siteNames = ref<Record<string, string>>({})
const rows = ref<Row[]>([])
const loading = ref(false)
const error = ref('')
const q = ref('')
const today = todaySeoul()
const columns: Column[] = [
  { key: 'filename', label: '파일명', strong: true },
  { key: 'kind', label: '형식' },
  { key: 'state', label: '상태' },
  { key: 'scope', label: '적용 범위' },
  { key: 'byte_size', label: '크기', align: 'right' },
  { key: 'citation_count', label: '인용', align: 'right' },
  { key: 'created_by_name', label: '올린 사람' },
  { key: 'updated_at', label: '수정일' },
]
const shown = computed(() => {
  const word = q.value.trim().toLowerCase()
  return word ? rows.value.filter((r) => r.filename.toLowerCase().includes(word)) : rows.value
})

async function loadSiteNames() {
  try {
    siteNames.value = Object.fromEntries((await api.listAllWorksites()).map((w) => [w.id, w.name]))
    siteNamesLoaded.value = true
  } catch (e) {
    console.error('[ManagerDocuments] 근무지 이름 조회 실패', e)
    toast.add({ title: '근무지 이름을 불러오지 못했습니다.', description: '적용 범위 칸이 「일부 근무지」로 보일 수 있습니다.', color: 'warning' })
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [{ data, error: e }, prep] = await Promise.all([
      supabase
        .from('dbo_documents')
        .select(
          'id, filename, kind, excluded_at, effective_date, expiry_date, byte_size, citation_count, updated_at, created_by_name, ' +
            'dbo_document_worksites(worksite_id)',
        )
        .order('updated_at', { ascending: false })
        .limit(500),
      app.preparingDocuments().catch((err) => {
        console.error('[ManagerDocuments] 준비 중 문서 조회 실패', err)
        return null
      }),
    ])
    if (e) throw e
    rows.value = ((data ?? []) as unknown as Row[]).sort(byExcludedLast)
    prepFailed.value = !prep
    preparing.value = new Set(prep?.ids ?? [])
  } catch (e) {
    rows.value = []
    error.value = dboErrorMessage(e, '문서를 불러오지 못했습니다.')
  } finally {
    loading.value = false
  }
}
const stateOf = (r: Row) => managerDocState(r, preparing.value.has(r.id), today)
const scopeOf = (r: Row) => knowledgeScopeLabel((r.dbo_document_worksites ?? []).map((w) => w.worksite_id), siteNames.value)
/** 새로고침 — 근무지 이름을 못 읽었으면 그것도 다시 읽는다 */
function refresh() {
  load()
  if (!siteNamesLoaded.value) loadSiteNames()
}
onMounted(() => {
  load()
  loadSiteNames()
})

/* 제외·다시 사용 — 제외는 묻고, 다시 사용은 바로 한다(앱과 같다). 한 번에 한 문서만 */
const toggling = ref<string | null>(null)
const excludeTarget = ref<Row | null>(null)
const excludeOpen = ref(false)
function askExclude(row: Row) {
  excludeTarget.value = row
  excludeOpen.value = true
}
async function setExcluded(row: Row, excluded: boolean) {
  if (toggling.value) return
  toggling.value = row.id
  try {
    await app.setDocumentExcluded(row.id, excluded)
    excludeOpen.value = false
    toast.add({ title: excluded ? '답변 근거에서 뺐습니다.' : '다시 답변 근거로 씁니다.', color: 'success' })
    await load()
  } catch (e: any) {
    excludeOpen.value = false
    // 응답이 끊겼으면 서버에서는 바뀌었을 수 있다 — 「못 바꿨다」고 단정하지 않고 다시 읽은 실제 상태를 보게 한다
    if (isMaybeSaved(e)) {
      toast.add({ title: '바뀌었는지 확인하지 못했습니다.', description: '목록을 다시 불러왔습니다. 상태 칸을 확인해 주세요.', color: 'warning' })
    } else {
      // 다시 해도 소용없는 이유(오프라인·세션 없음·로그인 만료·권한)만 적는다 — 그 밖의 코드에 「저장」 문구는 맞지 않는다
      const status = e?.status ?? e?.statusCode
      const sayWhy = e instanceof NotSentError || status === 401 || e?.data?.error === 'forbidden'
      const description = sayWhy ? knowledgeErrorText(e, 'document') : undefined
      toast.add({ title: '바꾸지 못했습니다.', description, color: 'error' })
    }
    await load()
  } finally {
    toggling.value = null
  }
}
</script>

<template>
  <div class="space-y-5">
    <Teleport to="#admin-topbar-actions">
      <AppButton icon="i-lucide-upload" @click="navigateTo('/senior/documents/new')">문서 올리기</AppButton>
    </Teleport>
    <p class="text-sm text-muted">
      기관 공용 자료입니다. 담당자 모두가 같은 자료를 보고, AI도 이 한 벌에서만 답합니다. 올린 문서는 AI 가 읽는 동안 「준비 중」으로 보입니다.
      「제외」를 누르면 답변 근거에서 빠지고, 「다시 사용」으로 되돌릴 수 있습니다. 삭제는 운영관리자가 합니다.
    </p>
    <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
    <p v-else-if="prepFailed" role="status" class="text-sm text-amber-700">
      AI 가 문서를 다 읽었는지 확인하지 못했습니다. 방금 올린 문서는 「사용 중」으로 보여도 아직 준비 중일 수 있습니다.
    </p>
    <DataTable :columns="columns" :rows="shown" :loading="loading" :total="shown.length" :page="1"
      :page-size="Math.max(shown.length, 1)" :page-size-options="[Math.max(shown.length, 1)]" empty-text="아직 올라온 자료가 없습니다">
      <template #toolbar>
        <form class="flex gap-2" @submit.prevent>
          <TextField v-model="q" placeholder="파일명 검색" aria-label="파일명 검색" />
        </form>
        <AppButton variant="outline" @click="refresh">새로고침</AppButton>
      </template>
      <template #cell-kind="{ row }">{{ row.kind ?? '—' }}</template>
      <template #cell-state="{ row }">
        <StatusBadge :tone="stateOf(row as Row).tone">{{ stateOf(row as Row).label }}</StatusBadge>
      </template>
      <template #cell-scope="{ row }">{{ scopeOf(row as Row) }}</template>
      <template #cell-byte_size="{ row }"><span class="tabular-nums">{{ fmtBytes(row.byte_size) }}</span></template>
      <template #cell-citation_count="{ row }">
        <span class="tabular-nums">{{ row.citation_count ? `${row.citation_count.toLocaleString()}회` : '—' }}</span>
      </template>
      <template #cell-created_by_name="{ row }">{{ row.created_by_name ?? '—' }}</template>
      <template #cell-updated_at="{ row }">{{ fmtStamp(row.updated_at) }}</template>
      <template #actions="{ row }">
        <div class="flex justify-end">
          <button
            v-if="row.excluded_at"
            type="button"
            class="text-sm font-medium text-brand-500 hover:underline disabled:opacity-50"
            :disabled="!!toggling"
            @click="setExcluded(row as Row, false)"
          >
            다시 사용
          </button>
          <button
            v-else
            type="button"
            class="text-sm font-medium text-body hover:text-ink disabled:opacity-50"
            :disabled="!!toggling"
            @click="askExclude(row as Row)"
          >
            제외
          </button>
        </div>
      </template>
    </DataTable>

    <AppModal v-model:open="excludeOpen" title="이 문서를 답변 근거에서 뺄까요?" width="max-w-md" :before-close="() => !toggling">
      <p class="text-sm text-body">
        <span class="font-semibold">{{ excludeTarget?.filename }}</span> — AI가 이 문서로 답하지 않습니다. 「다시 사용」을 누르면 되돌릴 수 있습니다.
      </p>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" :disabled="!!toggling" @click="excludeOpen = false">취소</AppButton>
        <AppButton size="sm" color="down" variant="soft" :loading="!!toggling" @click="excludeTarget && setExcluded(excludeTarget, true)">빼기</AppButton>
      </template>
    </AppModal>
  </div>
</template>
