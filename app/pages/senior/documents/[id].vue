<!-- AI 문서 상세 — 버전·발효일·종료일·본문 수정 + 색인 상태 + 근거에서 빼기 (GET·PATCH /dbo-admin/documents/{id}) -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { DocumentDetail, Worksite } from '~/types/dbo'
import type { DocumentFormValues } from '~/utils/documents'

const route = useRoute()
const api = useDboAdmin()
const toast = useToast()
const { setHeader } = useAdminHeader()

const id = computed(() => String(route.params.id))

const doc = ref<DocumentDetail | null>(null)
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const excluding = ref(false)
const worksites = ref<Worksite[]>([])

const emptyForm = (): DocumentFormValues => ({ body: '', version: '', effectiveDate: '', expiryDate: '' })
const original = ref<DocumentFormValues>(emptyForm())
const form = ref<DocumentFormValues>(emptyForm())

const patch = computed(() => buildDocumentPatch(original.value, form.value))
const dirty = computed(() => Object.keys(patch.value).length > 0)
const scopeNames = computed(() =>
  (doc.value?.dbo_document_worksites ?? []).map(
    (w) => worksites.value.find((ws) => ws.id === w.worksite_id)?.name ?? w.worksite_id,
  ),
)
// 이미 근거에서 빠진 상태(만료·미정·제외함)에서는 누를 이유가 없다
const canExclude = computed(() => doc.value?.state === '현행' || doc.value?.state === '발효예정')

async function loadDoc() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await api.getDocument(id.value)
    doc.value = res
    const values: DocumentFormValues = {
      body: res.body,
      version: res.version ?? '',
      effectiveDate: res.effective_date ?? '',
      expiryDate: res.expiry_date ?? '',
    }
    original.value = values
    form.value = { ...values }
    setHeader(res.filename, [{ label: 'AI 문서 관리', to: '/senior/documents' }])
  } catch (e: any) {
    // 다시 불러오다 실패하면 이전 카드가 남아 저장 전 값을 보여 준다 — 비운다
    doc.value = null
    loadError.value = dboErrorMessage(e)
    toast.add({ title: '문서 조회 실패', description: loadError.value, color: 'error' })
  } finally {
    loading.value = false
  }
}

async function loadWorksites() {
  try {
    worksites.value = (await api.listWorksites({ size: 100 })).items
  } catch {
    // 근무지 이름은 표기 편의다. 실패하면 id 로 보인다.
  }
}

async function save() {
  if (!dirty.value) return
  // 서버가 빈 본문을 400 으로 거절한다. 근거에서 빼려면 본문을 비우지 말고 「근거에서 빼기」다
  if (!form.value.body.trim()) {
    toast.add({ title: '본문을 비울 수 없습니다.', description: '근거에서 빼려면 「근거에서 빼기」를 눌러 주세요.', color: 'warning' })
    return
  }
  // 서버는 발효일을 지우는 PATCH 를 받지 않는다. buildDocumentPatch 가 빈 값을 조용히 빼므로 여기서 알린다
  if (original.value.effectiveDate && !form.value.effectiveDate) {
    toast.add({ title: '발효일은 지울 수 없습니다.', description: '근거에서 빼려면 「근거에서 빼기」를 눌러 주세요.', color: 'warning' })
    return
  }
  if (form.value.expiryDate && form.value.effectiveDate && form.value.expiryDate < form.value.effectiveDate) {
    toast.add({ title: '종료일은 발효일보다 앞설 수 없습니다.', color: 'warning' })
    return
  }
  saving.value = true
  try {
    const res = await api.updateDocument(id.value, patch.value)
    // 본문을 고친 경우에만 indexed 가 온다. false 여도 저장은 됐고 크론이 다시 색인한다
    if (res.indexed === false) {
      toast.add({
        title: '저장했지만 색인은 아직입니다.',
        description: '다음 색인 주기에 자동으로 다시 시도합니다.',
        color: 'warning',
      })
    } else {
      toast.add({ title: res.indexed ? '저장하고 다시 색인했습니다.' : '저장되었습니다.', color: 'success' })
    }
    await loadDoc()
  } catch (e: any) {
    toast.add({ title: '저장 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function excludeFromGrounding() {
  if (!doc.value) return
  if (dirty.value) {
    toast.add({ title: '저장하지 않은 수정이 있습니다.', description: '먼저 저장하거나 되돌려 주세요.', color: 'warning' })
    return
  }
  if (!confirm('이 문서를 AI 답변 근거에서 빼시겠습니까? 종료일을 어제로 바꾸며, 문서와 색인은 지우지 않습니다.'))
    return
  excluding.value = true
  try {
    const res = await api.updateDocument(id.value, { expiryDate: utcYesterday() })
    if (res.state === '만료') toast.add({ title: 'AI 답변 근거에서 뺐습니다.', color: 'success' })
    else toast.add({ title: `종료일을 바꿨지만 상태가 「${res.state}」입니다.`, description: '발효일과 종료일을 확인해 주세요.', color: 'warning' })
    await loadDoc()
  } catch (e: any) {
    toast.add({ title: '처리 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    excluding.value = false
  }
}

function resetForm() {
  form.value = { ...original.value }
}

setHeader('AI 문서 상세', [{ label: 'AI 문서 관리', to: '/senior/documents' }])
onMounted(() => {
  loadDoc()
  loadWorksites()
})
</script>

<template>
  <div class="space-y-6">
    <Teleport to="#admin-topbar-actions">
      <AppButton variant="outline" color="neutral" icon="i-lucide-arrow-left" @click="navigateTo('/senior/documents')">
        목록
      </AppButton>
      <AppButton
        v-if="doc && canExclude"
        variant="soft"
        color="down"
        icon="i-lucide-file-x"
        :loading="excluding"
        :disabled="saving"
        @click="excludeFromGrounding"
      >
        근거에서 빼기
      </AppButton>
    </Teleport>

    <AppSpinner v-if="loading" label="불러오는 중…" />

    <template v-else-if="doc">
      <!-- 문서 정보 -->
      <AppCard padding="lg">
        <template #header>
          <div class="flex items-center gap-3">
            <h2 class="text-[18px] font-semibold text-ink">문서 정보</h2>
            <Tag>{{ doc.kind || '—' }}</Tag>
            <StatusBadge :tone="docStateTone(doc.state)">{{ doc.state }}</StatusBadge>
          </div>
          <span class="text-sm text-muted">수정 {{ fmtStamp(doc.updated_at) }}</span>
        </template>

        <p v-if="doc.state === '제외함'" class="mb-5 rounded-lg bg-down-soft px-4 py-3 text-sm text-down">
          담당자가 앱에서 사용을 중지한 문서입니다({{ fmtStamp(doc.excluded_at) }}). 날짜를 고쳐도 AI 근거로
          돌아오지 않으며, 다시 쓰려면 앱에서 「다시 사용」을 눌러야 합니다.
        </p>
        <p v-else-if="doc.state === '미정'" class="mb-5 rounded-lg bg-[#fdf6e3] px-4 py-3 text-sm text-accent">
          발효일이 없어 AI 답변 근거로 쓰이지 않습니다. 발효일을 입력해 주세요.
        </p>

        <div class="grid gap-5 md:grid-cols-2">
          <FormField label="파일명" hint="AI 답변의 근거 표기에 쓰이는 이름입니다. 여기서 바꾸지 않습니다.">
            <TextField :model-value="doc.filename" readonly />
          </FormField>
          <FormField label="버전">
            <TextField v-model="form.version" placeholder="예: v4" />
          </FormField>
          <FormField label="발효일" required hint="이 날부터 AI 답변 근거로 쓰입니다.">
            <DateField v-model="form.effectiveDate" />
          </FormField>
          <FormField label="종료일" hint="비우면 무기한입니다. 이 날까지 근거로 쓰입니다.">
            <DateField v-model="form.expiryDate" />
          </FormField>
          <FormField label="적용 범위">
            <div class="flex min-h-10 flex-wrap items-center gap-1.5">
              <Tag v-if="!scopeNames.length">기관 전체</Tag>
              <Tag v-for="(name, i) in scopeNames" :key="i">{{ name }}</Tag>
            </div>
          </FormField>
          <FormField label="색인">
            <div class="flex min-h-10 items-center gap-2 text-[15px]">
              <StatusBadge :tone="doc.chunks > 0 ? 'green' : 'amber'">
                {{ doc.chunks > 0 ? '색인됨' : '색인 전' }}
              </StatusBadge>
              <span class="text-body tabular-nums">{{ doc.chunks }}개 청크 · 원본 {{ fmtBytes(doc.byte_size) }}</span>
            </div>
          </FormField>
        </div>
      </AppCard>

      <!-- 본문 -->
      <AppCard padding="lg">
        <template #header>
          <div>
            <h2 class="text-[18px] font-semibold text-ink">본문</h2>
            <p class="mt-0.5 text-sm text-muted">AI가 검색하는 텍스트입니다. 본문을 고치면 저장할 때 다시 색인합니다.</p>
          </div>
          <span class="text-sm text-muted tabular-nums">{{ form.body.length.toLocaleString() }}자</span>
        </template>
        <AppTextarea v-model="form.body" :rows="20" />

        <div class="mt-6 flex justify-end gap-2">
          <AppButton v-if="dirty" variant="outline" color="neutral" @click="resetForm">되돌리기</AppButton>
          <AppButton :loading="saving" :disabled="!dirty || excluding" @click="save">저장</AppButton>
        </div>
      </AppCard>
    </template>

    <EmptyState
      v-else-if="loadError"
      icon="i-lucide-triangle-alert"
      title="문서를 불러오지 못했습니다."
      :description="loadError"
    />
    <EmptyState v-else title="문서를 찾을 수 없습니다." />
  </div>
</template>
