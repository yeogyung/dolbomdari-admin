<!-- AI 문서 등록 — md·docx·pdf 에서 텍스트 추출 → 담당자 검수·수정 → POST /dbo-admin/documents -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { DocumentCreateForm } from '~/utils/documentImport'

const api = useDboAdmin()
const toast = useToast()
const { extractText } = useDocumentExtract()
const { setHeader } = useAdminHeader()
setHeader('문서 등록', [{ label: 'AI 문서 관리', to: '/senior/documents' }])

const fileInput = ref<HTMLInputElement | null>(null)
const sourceName = ref('')
const sourceSize = ref(0)
const extracting = ref(false)
const saving = ref(false)
const form = ref<DocumentCreateForm | null>(null)

const charCount = computed(() => form.value?.body.length ?? 0)

async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // 같은 파일을 다시 골라도 change 가 나도록
  if (!file) return

  const kind = kindFromFilename(file.name)
  if (!kind) {
    toast.add({ title: '지원하지 않는 형식입니다.', description: 'md, docx, pdf 파일만 올릴 수 있습니다.', color: 'warning' })
    return
  }

  extracting.value = true
  try {
    const body = normalizeExtractedText(await extractText(file, kind))
    if (!body) {
      toast.add({
        title: '텍스트를 찾지 못했습니다.',
        description: kind === 'pdf' ? '스캔한 이미지 PDF는 글자를 읽을 수 없습니다.' : '빈 문서입니다.',
        color: 'warning',
      })
      return
    }
    sourceName.value = file.name
    sourceSize.value = file.size
    form.value = { filename: file.name, kind, version: '', body, effectiveDate: todaySeoul(), expiryDate: '' }
  } catch (err: any) {
    const description = err instanceof ExtractError ? err.message : '파일을 읽는 중 오류가 났습니다.'
    toast.add({ title: '추출 실패', description, color: 'error' })
  } finally {
    extracting.value = false
  }
}

async function submit() {
  if (!form.value) return
  const payload = buildCreatePayload(form.value)
  if (!payload.ok) {
    toast.add({ title: payload.reason, color: 'warning' })
    return
  }
  saving.value = true
  try {
    const res = await api.createDocument(payload.value)
    // 색인이 실패해도 저장은 됐다 — 크론이 다음 회차에 다시 색인한다(서버 설계 §4)
    if (res.indexed) toast.add({ title: '등록하고 색인했습니다.', color: 'success' })
    else toast.add({ title: '등록했지만 색인은 아직입니다.', description: '다음 색인 주기에 자동으로 다시 시도합니다.', color: 'warning' })
    await navigateTo(`/senior/documents/${res.id}`)
  } catch (e: any) {
    const status = e?.status ?? e?.statusCode
    if (status === 409) {
      toast.add({
        title: '같은 파일명의 문서가 이미 있습니다.',
        description: '파일명을 바꾸거나, 목록에서 기존 문서를 찾아 본문을 수정해 주세요.',
        color: 'warning',
      })
    } else {
      toast.add({ title: '등록 실패', description: dboErrorMessage(e), color: 'error' })
    }
  } finally {
    saving.value = false
  }
}

function reset() {
  if (form.value && !confirm('추출한 내용을 버리고 다른 파일을 고르시겠습니까?')) return
  form.value = null
  fileInput.value?.click()
}
</script>

<template>
  <div class="space-y-6">
    <Teleport to="#admin-topbar-actions">
      <AppButton variant="outline" color="neutral" icon="i-lucide-arrow-left" @click="navigateTo('/senior/documents')">
        목록
      </AppButton>
      <AppButton v-if="form" icon="i-lucide-upload" :loading="saving" @click="submit">등록</AppButton>
    </Teleport>

    <input ref="fileInput" type="file" class="hidden" :accept="IMPORT_ACCEPT" @change="onPick" />

    <!-- 1단계: 파일 선택 -->
    <AppCard v-if="!form" padding="lg">
      <button
        type="button"
        class="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-hairline py-16 text-center transition-colors hover:border-brand-500 hover:bg-brand-soft disabled:cursor-wait"
        :disabled="extracting"
        @click="fileInput?.click()"
      >
        <AppSpinner v-if="extracting" label="텍스트를 추출하는 중…" />
        <template v-else>
          <UIcon name="i-lucide-file-up" class="size-10 text-brand-500" />
          <span class="text-[15px] font-semibold text-ink">파일 선택</span>
          <span class="text-sm text-muted">md · docx · pdf (HWP는 지원하지 않습니다)</span>
        </template>
      </button>
      <p class="mt-4 text-sm text-muted">
        파일에서 텍스트만 뽑아 AI 검색용 본문으로 등록합니다. 원본 파일은 저장하지 않습니다. 다음 단계에서 추출된
        내용을 확인하고 고칠 수 있습니다.
      </p>
    </AppCard>

    <!-- 2단계: 검수·수정 -->
    <template v-else>
      <AppCard padding="lg">
        <template #header>
          <div class="flex items-center gap-3">
            <h2 class="text-[18px] font-semibold text-ink">문서 정보</h2>
            <Tag>{{ form.kind }}</Tag>
          </div>
          <div class="flex items-center gap-3 text-sm text-muted">
            <span>{{ sourceName }} · {{ fmtBytes(sourceSize) }}</span>
            <button type="button" class="font-medium text-brand-500 hover:underline" @click="reset">다른 파일</button>
          </div>
        </template>

        <div class="grid gap-5 md:grid-cols-2">
          <FormField label="파일명" required hint="AI 답변의 근거 표기에 쓰입니다. 같은 이름의 문서는 등록할 수 없습니다.">
            <TextField v-model="form.filename" />
          </FormField>
          <FormField label="버전">
            <TextField v-model="form.version" placeholder="예: v4" />
          </FormField>
          <FormField label="발효일" required hint="이 날부터 AI 답변 근거로 쓰입니다.">
            <DateField v-model="form.effectiveDate" />
          </FormField>
          <FormField label="종료일" hint="비우면 무기한입니다.">
            <DateField v-model="form.expiryDate" />
          </FormField>
        </div>
      </AppCard>

      <AppCard padding="lg">
        <template #header>
          <div>
            <h2 class="text-[18px] font-semibold text-ink">추출된 본문</h2>
            <p class="mt-0.5 text-sm text-muted">
              AI가 이 텍스트를 그대로 검색합니다. 표·머리글이 깨졌거나 불필요한 내용이 있으면 여기서 고쳐 주세요.
            </p>
          </div>
          <span class="text-sm text-muted tabular-nums">{{ charCount.toLocaleString() }}자</span>
        </template>
        <AppTextarea v-model="form.body" :rows="24" />
      </AppCard>
    </template>
  </div>
</template>
