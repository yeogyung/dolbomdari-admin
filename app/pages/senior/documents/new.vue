<!-- AI 문서 등록·새 판 올리기 — md·txt·docx·pdf·xlsx 에서 텍스트 추출 → 검수·수정 → POST /dbo-admin/documents(새 판은 /documents/{id}/versions). 담당자는 앱 API POST /dbo/documents -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { DocumentDetail } from '~/types/dbo'
import type { DocumentCreateBody, DocumentCreateForm } from '~/utils/documentImport'
import { isMaybeSaved, knowledgeErrorText, MAX_DOC_BODY_CHARS, MAX_DOC_FILENAME_CHARS } from '~/utils/managerKnowledge'

const api = useDboAdmin()
const app = useDboApp()
const toast = useToast()
/**
 * 담당자는 앱 「문서 올리기」와 같은 API·칸으로 올린다(QA 2026-11-07 MGR-05) — 파일명·적용 범위(기관 전체 / 맡은 근무지 하나).
 * 버전·발효일·종료일은 앱 API 가 받지 않아(서버가 정한다) 칸을 숨긴다. 상세는 master 몫이다
 */
const isManager = computed(() => useAdminRole().me.value?.role === 'manager')
/** 담당자 적용 범위 — '' 이면 기관 전체 */
const scope = ref('')
const scopeReady = ref(false)
const scopeFailed = ref(false)
/**
 * 저장됐는지 모른다(응답 없음·5xx). 다시 올리면 같은 이름이라 409 이고, 이름만 바꾸면 같은 글이 두 벌 색인된다 — 등록만 막는다.
 * 화면은 남긴다 — 저장이 안 됐으면 검수하며 고친 본문을 잃지 않게
 */
const docUnknown = ref(false)
const route = useRoute()
const { extractText } = useDocumentExtract()
const { setHeader } = useAdminHeader()
setHeader('문서 등록', [{ label: 'AI 문서 관리', to: '/senior/documents' }])

/*
 * 새 판 올리기(QA 2026-11-02 DOC-02) — 상세의 「새 판 올리기」가 `?from=<이전 판 id>` 로 연다. 등록과 같은 화면에서 파일을 고르고
 * 발효일을 받는다. 적용 범위는 서버가 이전 판에서 잇고, 이전 판 종료일은 새 판 발효 전날이 된다.
 */
const fromId = typeof route.query.from === 'string' ? route.query.from : ''
const prev = ref<DocumentDetail | null>(null)
const prevLoading = ref(!!fromId)
const prevError = ref('')
/** 확인 창을 연 순간의 본문 — 확인 창에 머무는 동안 칸이 바뀌어도 확인한 값으로 보낸다 */
const confirmBody = ref<DocumentCreateBody | null>(null)
const confirmOpen = ref(false)
/** 새 판 올리기 실패. 가야 할 문서(최신 판·남은 새 판)가 있으면 그 길을 함께 보인다 */
const failure = ref<ReturnType<typeof documentVersionError> | null>(null)
/** 파일 고르기·검수를 보여도 되는가 — 일반 등록이거나, 이전 판을 읽었고 새 판을 받는 서버일 때 */
const ready = computed(() => !fromId || (!!prev.value && versionUploadSupported(prev.value)))

async function loadPrev() {
  try {
    const res = await api.getDocument(fromId)
    prev.value = res
    setHeader('새 판 올리기', [
      { label: 'AI 문서 관리', to: '/senior/documents' },
      { label: res.filename, to: `/senior/documents/${res.id}` },
    ])
  } catch (e) {
    prevError.value = dboErrorMessage(e)
  } finally {
    prevLoading.value = false
  }
}
if (fromId) {
  setHeader('새 판 올리기', [{ label: 'AI 문서 관리', to: '/senior/documents' }])
  onMounted(loadPrev)
}

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
    toast.add({ title: '지원하지 않는 형식입니다.', description: 'md·txt·docx·pdf·xlsx 파일만 올릴 수 있습니다.', color: 'warning' })
    return
  }
  // 20MB 를 넘으면 읽기 전에 막는다(QA 2026-11-07 FAQ-03) — 서버도 too_large 로 거절한다
  if (fileTooLarge(file.size)) {
    toast.add({ title: TOO_LARGE_MESSAGE, description: `고른 파일은 ${fmtBytes(file.size)}예요.`, color: 'warning' })
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
    docUnknown.value = false
    form.value = { filename: file.name, kind, version: '', body, effectiveDate: todaySeoul(), expiryDate: '', byteSize: file.size }
  } catch (err: any) {
    // 문서 탓이 아닌 실패(배포 뒤 청크 404·코드 오류)도 여기로 온다 — 원인을 남긴다
    if (!(err instanceof ExtractError)) console.error('[documents/new] 추출 실패', kind, err)
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
  if (prev.value) {
    const early = versionEffectiveError(prev.value.effective_date, payload.value.effectiveDate)
    if (early) {
      toast.add({ title: early, color: 'warning' })
      return
    }
    confirmBody.value = payload.value
    confirmOpen.value = true
    return
  }
  if (isManager.value) {
    await submitAsManager(payload.value)
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
    if (isTooLargeError(e)) {
      toast.add({ title: TOO_LARGE_MESSAGE, color: 'warning' })
    } else if (status === 409) {
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

/**
 * 담당자 올리기 — 앱 API(`POST /dbo/documents`). 앱 API 는 파일명을 200자까지 받고 넘으면 이유 없이 bad_request 라 먼저 막는다.
 * 응답이 끊기거나 5xx 면 이미 저장됐을 수 있다 — 다시 누르면 같은 이름이라 409 이고, 이름만 바꿔 올리면 같은 글이 두 벌
 * 색인된다. 목록으로 보내 확인하게 한다(앱과 같다)
 */
async function submitAsManager(v: DocumentCreateBody) {
  if (!scopeReady.value || docUnknown.value) return
  if (v.filename.length > MAX_DOC_FILENAME_CHARS) {
    toast.add({ title: `파일명이 너무 깁니다. ${MAX_DOC_FILENAME_CHARS}자 아래로 줄여 주세요.`, color: 'warning' })
    return
  }
  if (v.body.length > MAX_DOC_BODY_CHARS) {
    toast.add({ title: '본문이 너무 깁니다.', description: `${MAX_DOC_BODY_CHARS.toLocaleString()}자까지 올릴 수 있습니다. 문서를 나눠 올려 주세요.`, color: 'warning' })
    return
  }
  // 문서는 승인 없이 올린 날부터 AI 답변 근거가 된다 — 근무지를 못 읽어 기관 전체로 갈 때는 한 번 더 묻는다
  if (scopeFailed.value && !confirm('근무지를 확인하지 못해 기관 전체로 올라갑니다. 올리면 바로 모든 근무지 시니어의 AI 답변 근거가 됩니다. 계속할까요?')) return
  saving.value = true
  try {
    await app.createDocument({
      filename: v.filename,
      body: v.body,
      kind: v.kind,
      byteSize: v.byteSize ?? null,
      worksiteIds: scope.value ? [scope.value] : [],
    })
    toast.add({ title: '문서를 올렸습니다.', description: 'AI 가 읽는 동안 목록에 「준비 중」으로 보입니다.', color: 'success' })
    await navigateTo('/senior/documents')
  } catch (e: any) {
    if (isMaybeSaved(e)) {
      docUnknown.value = true
    } else {
      // 같은 이름(409)은 응답이 끊긴 뒤 다시 누른 것일 수도 있다 — 이름부터 바꾸라고 하지 않는다(knowledgeErrorText)
      toast.add({ title: '문서를 올리지 못했습니다.', description: knowledgeErrorText(e, 'document'), color: 'warning' })
    }
  } finally {
    saving.value = false
  }
}

async function submitVersion() {
  const body = confirmBody.value
  const p = prev.value
  if (!body || !p) return
  saving.value = true
  failure.value = null
  try {
    const res = await api.createDocumentVersion(p.id, body)
    confirmOpen.value = false
    const ended = res.previous.expiry_date ? `이전 판은 ${throughLabel(res.previous.expiry_date)}에 끝납니다.` : undefined
    // 색인이 실패해도 새 판은 저장됐다 — 등록과 같이 크론이 다음 회차에 다시 색인한다
    if (res.indexed) toast.add({ title: '새 판을 올리고 색인했습니다.', description: ended, color: 'success' })
    else {
      toast.add({
        title: '새 판을 올렸지만 색인은 아직입니다.',
        description: `다음 색인 주기에 자동으로 다시 시도합니다.${ended ? ` ${ended}` : ''}`,
        color: 'warning',
      })
    }
    await navigateTo(`/senior/documents/${res.id}`)
  } catch (e) {
    confirmOpen.value = false
    failure.value = documentVersionError(e, p)
    toast.add({ title: '새 판 올리기 실패', description: failure.value.message, color: 'error' })
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
      <AppButton v-if="form && ready" icon="i-lucide-upload" :loading="saving" :disabled="isManager && (!scopeReady || docUnknown)" @click="submit">
        {{ prev ? '새 판 올리기' : '등록' }}
      </AppButton>
    </Teleport>

    <!-- 새 판 올리기 — 이전 판을 읽는 중·실패·옛 서버(새 판 칸이 없음) -->
    <AppSpinner v-if="prevLoading" label="이전 판 불러오는 중…" />
    <EmptyState
      v-else-if="prevError"
      icon="i-lucide-triangle-alert"
      title="이전 판을 불러오지 못했습니다."
      :description="prevError"
    />
    <EmptyState v-else-if="prev && !versionUploadSupported(prev)" icon="i-lucide-info" :title="VERSION_UNSUPPORTED" />

    <!-- 담당자 — 저장됐는지 모름. 등록은 막고 본문은 남긴다 -->
    <div v-if="docUnknown" role="alert" class="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
      저장됐는지 확인하지 못했습니다. 먼저 문서 목록에서 이 문서가 올라갔는지 확인해 주세요.
      <template v-if="scope">올라가 있으면 적용 범위가 고른 근무지인지도 봐 주세요 — 기관 전체로 올라가 있으면 「제외」하고 운영관리자에게 알려 주세요.</template>
      <div class="mt-2 flex flex-wrap gap-3">
        <NuxtLink to="/senior/documents" target="_blank" class="font-medium underline">문서 목록 새 창으로 보기</NuxtLink>
        <!-- 목록을 보고 없다고 확인한 뒤에만 다시 올린다 — 고친 본문은 그대로다 -->
        <button type="button" class="font-medium underline" @click="docUnknown = false">목록에 없어요, 다시 올리기</button>
      </div>
    </div>

    <!-- 모양은 상세의 「제외함」 안내 상자를 따른다 -->
    <div v-if="failure" role="alert" class="rounded-lg bg-down-soft px-4 py-3 text-sm text-down">
      {{ failure.message }}
      <NuxtLink v-if="failure.link" :to="failure.link.to" class="ml-2 font-medium underline">{{ failure.link.label }}</NuxtLink>
    </div>

    <AppCard v-if="prev && ready" padding="lg">
      <template #header>
        <div class="flex items-center gap-3">
          <h2 class="text-[18px] font-semibold text-ink">이전 판</h2>
          <StatusBadge :tone="docStateTone(prev.state)">{{ prev.state }}</StatusBadge>
        </div>
      </template>
      <p class="text-[15px] text-body">
        {{ prev.filename }}<template v-if="prev.version"> · {{ prev.version }}</template> ·
        {{ prev.effective_date || '—' }} ~ {{ prev.expiry_date || '무기한' }}
      </p>
      <p class="mt-2 text-sm text-muted">
        새 판은 이전 판의 적용 범위를 그대로 이어받습니다. 올리면 이전 판은 새 판 발효일 전날에 끝납니다.
      </p>
    </AppCard>

    <input ref="fileInput" type="file" class="hidden" :accept="IMPORT_ACCEPT" @change="onPick" />

    <!-- 1단계: 파일 선택 -->
    <AppCard v-if="ready && !form" padding="lg">
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
          <span class="text-sm text-muted">md · txt · docx · pdf · xlsx, 20MB까지 (HWP·doc·xls는 지원하지 않습니다)</span>
        </template>
      </button>
      <p class="mt-4 text-sm text-muted">
        파일에서 텍스트만 뽑아 AI 검색용 본문으로 등록합니다. 원본 파일은 저장하지 않습니다. 다음 단계에서 추출된
        내용을 확인하고 고칠 수 있습니다.
      </p>
    </AppCard>

    <!-- 2단계: 검수·수정 -->
    <template v-else-if="ready && form">
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
          <!-- 담당자는 앱과 같이 적용 범위만 고른다. 버전·발효일·종료일은 앱 API 가 받지 않는다 -->
          <KnowledgeScopeField v-if="isManager" v-model="scope" v-model:ready="scopeReady" v-model:failed="scopeFailed" />
          <template v-else>
            <FormField label="버전">
              <TextField v-model="form.version" placeholder="예: v4" />
            </FormField>
            <FormField label="발효일" required hint="이 날부터 AI 답변 근거로 쓰입니다.">
              <DateField v-model="form.effectiveDate" />
            </FormField>
            <FormField label="종료일" hint="비우면 무기한입니다.">
              <DateField v-model="form.expiryDate" />
            </FormField>
          </template>
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

    <!-- 새 판 확인 창 — 모양은 공지 발송 확인 창을 따른다. 올리는 중에는 닫지 않는다 -->
    <AppModal v-model:open="confirmOpen" title="새 판을 올릴까요?" width="max-w-md" :before-close="() => !saving">
      <div v-if="prev && confirmBody" class="space-y-2 text-sm text-body">
        <p>
          새 판 {{ confirmBody.filename }}<template v-if="confirmBody.version"> · {{ confirmBody.version }}</template>
          · {{ throughLabel(confirmBody.effectiveDate) }}부터
        </p>
        <p class="font-medium text-brand-500">{{ previousEndNote(prev, confirmBody.effectiveDate) }}</p>
        <p class="text-muted">적용 범위는 이전 판을 그대로 이어받습니다.</p>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" :disabled="saving" @click="confirmOpen = false">취소</AppButton>
        <AppButton size="sm" :loading="saving" @click="submitVersion">올리기</AppButton>
      </template>
    </AppModal>
  </div>
</template>
