<!-- FAQ 상세 — 질문·답변·적용 범위 열람 + 승인·반려·질문·답변 수정·사용 안 함 (조회 supabase 직접, 쓰기 PATCH /dbo-admin/faqs/{id}) -->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { Faq, FaqStatus } from '~/types/dbo'
import type { FaqEditForm } from '~/utils/faqs'

const route = useRoute()
const faqs = useFaqs()
const api = useDboAdmin()
const toast = useToast()
const { setHeader } = useAdminHeader()
/** 「목록」 — 목록에서 왔으면 뒤로 가서 필터를 지킨다 */
const backToList = useBackToList('/senior/faqs')
setHeader('FAQ 상세', [{ label: 'FAQ 관리', to: '/senior/faqs' }])

const id = computed(() => String(route.params.id))

const faq = ref<Faq | null>(null)
const loading = ref(true)
const loadError = ref('')
const deciding = ref<FaqStatus | null>(null)

const scopeNames = computed(() => (faq.value ? faqScopeNames(faq.value) : []))

async function loadFaq() {
  loading.value = true
  loadError.value = ''
  try {
    faq.value = await faqs.getFaq(id.value)
  } catch (e: any) {
    // 승인 후 다시 불러오다 실패하면 이전 상태의 카드가 남아 결정 전 버튼을 보여 준다 — 비운다
    faq.value = null
    loadError.value = faqReadErrorMessage(e)
    toast.add({ title: 'FAQ 조회 실패', description: loadError.value, color: 'error' })
  } finally {
    loading.value = false
  }
}

// 승인하면 서버가 enabled 를 켜고, 반려하면 끈다 — 여기서는 status 만 보낸다
const CONFIRM: Record<'approved' | 'rejected', string> = {
  approved: '이 FAQ를 승인하시겠습니까? 승인하면 바로 AI 답변에 쓰입니다.',
  rejected: '이 FAQ를 반려하시겠습니까? 반려하면 AI 답변에 쓰이지 않습니다.',
}

async function decide(status: 'approved' | 'rejected') {
  if (!faq.value || !confirm(CONFIRM[status])) return
  deciding.value = status
  try {
    await api.updateFaqStatus(faq.value.id, status)
    toast.add({ title: status === 'approved' ? '승인되었습니다.' : '반려되었습니다.', color: 'success' })
    await loadFaq()
  } catch (e: any) {
    toast.add({ title: '처리 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    deciding.value = null
  }
}

/*
 * 「사용 안 함 · 다시 사용」(QA 2026-11-07 ADMIN-10, 결정 D21) — 지우지 않고 AI 답변에서만 뺀다(서버에 삭제가 없다).
 * 승인한 FAQ 만 켜고 끈다. 승인 대기·반려는 승인·반려가 켜고 끄며, AI 는 승인된 것만 쓴다
 */
const toggling = ref(false)
async function toggleEnabled() {
  const f = faq.value
  if (!f || toggling.value) return
  const next = !f.enabled
  const ask = next
    ? '이 FAQ를 다시 사용할까요? 바로 AI 답변에 쓰여요.'
    : '이 FAQ를 사용 안 함으로 바꿀까요? AI 답변에 쓰이지 않고, 지워지지는 않아요.'
  if (!confirm(ask)) return
  toggling.value = true
  try {
    await api.updateFaq(f.id, { enabled: next })
    toast.add({ title: next ? '다시 사용해요.' : '사용 안 함으로 바꿨어요.', color: 'success' })
    await loadFaq()
  } catch (e: any) {
    toast.add({ title: '처리 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    toggling.value = false
  }
}

/* 질문·답변 수정(QA 2026-11-07 ADMIN-10). 비슷한 질문은 서버가 받지 않아 고칠 수 없다 */
const editOpen = ref(false)
const saving = ref(false)
const editInitial = ref<FaqEditForm>({ question: '', answer: '' })
const editForm = ref<FaqEditForm>({ question: '', answer: '' })
const editErrors = ref<Partial<FaqEditForm>>({})

function openEdit() {
  if (!faq.value) return
  editInitial.value = { question: faq.value.question, answer: faq.value.answer }
  editForm.value = { ...editInitial.value }
  editErrors.value = {}
  editOpen.value = true
}

/**
 * 저장하지 않고 닫을 때 묻는다 — 출퇴근 기록의 수정 창과 같다(QA 2026-11-02 ADM-01, 결정 F8).
 * X·바깥 누르기·Esc·메뉴 이동이 모두 같은 확인 창을 본다
 */
const discardOpen = ref(false)
const discard = createPendingAnswer()
function confirmDiscardEdit(): boolean | Promise<boolean> {
  // 저장 중에는 닫지 않는다 — 닫혀도 저장은 들어가 「저장 안 했다」고 믿게 된다
  if (saving.value) return false
  if (!formChanged(editInitial.value, editForm.value)) return true
  discardOpen.value = true
  return discard.ask()
}
/** 확인 창을 먼저 내리고 답한다 — 확인 창이 포커스를 수정 창에 돌려준 뒤에 수정 창이 닫힌다 */
function answerDiscard(ok: boolean) {
  discardOpen.value = false
  discard.answer(ok)
}
// 확인 창을 X·바깥 누르기·Esc 로 닫으면 「계속 수정」이다
watch(discardOpen, (v) => {
  if (!v) discard.answer(false)
})
onBeforeRouteLeave(() => (editOpen.value ? confirmDiscardEdit() : true))

async function submitEdit() {
  const f = faq.value
  if (!f || saving.value) return
  const built = faqEditPatch(editInitial.value, editForm.value)
  if (!built.ok) {
    editErrors.value = built.errors
    return
  }
  editErrors.value = {}
  // 앞뒤 공백만 바뀌었으면 고칠 것이 없다 — 묻지 않고 닫는다
  if (!Object.keys(built.patch).length) {
    editOpen.value = false
    return
  }
  saving.value = true
  try {
    await api.updateFaq(f.id, built.patch)
    editOpen.value = false
    toast.add({ title: '저장했어요.', description: f.enabled && f.status === 'approved' ? '바로 AI 답변에 쓰여요.' : undefined, color: 'success' })
    await loadFaq()
  } catch (e: any) {
    // 창을 닫지 않는다 — 고친 내용이 남아 있어야 다시 저장할 수 있다
    toast.add({ title: '저장 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

onMounted(loadFaq)
</script>

<template>
  <div class="space-y-6">
    <Teleport to="#admin-topbar-actions">
      <AppButton variant="outline" color="neutral" icon="i-lucide-arrow-left" @click="backToList">
        목록
      </AppButton>
      <template v-if="faq">
        <AppButton variant="outline" color="neutral" icon="i-lucide-pencil" :disabled="!!deciding || toggling" @click="openEdit">
          수정
        </AppButton>
        <AppButton
          v-if="faq.status === 'approved'"
          variant="outline"
          color="neutral"
          :icon="faq.enabled ? 'i-lucide-eye-off' : 'i-lucide-eye'"
          :loading="toggling"
          :disabled="!!deciding"
          @click="toggleEnabled"
        >
          {{ faq.enabled ? '사용 안 함' : '다시 사용' }}
        </AppButton>
        <!-- 결정은 번복할 수 있다: 대기는 둘 다, 승인은 반려만, 반려는 승인만 -->
        <AppButton
          v-if="faq.status !== 'rejected'"
          variant="soft"
          color="down"
          icon="i-lucide-x"
          :loading="deciding === 'rejected'"
          :disabled="!!deciding"
          @click="decide('rejected')"
        >
          반려
        </AppButton>
        <AppButton
          v-if="faq.status !== 'approved'"
          icon="i-lucide-check"
          :loading="deciding === 'approved'"
          :disabled="!!deciding"
          @click="decide('approved')"
        >
          승인
        </AppButton>
      </template>
    </Teleport>

    <AppSpinner v-if="loading" label="불러오는 중…" />

    <AppCard v-else-if="faq" padding="lg">
      <template #header>
        <div class="flex items-center gap-3">
          <h2 class="text-[18px] font-semibold text-ink">FAQ</h2>
          <Tag v-if="faq.category">{{ faq.category }}</Tag>
          <StatusBadge :tone="faqStatusTone(faq.status)">{{ faqStatusLabel(faq.status) }}</StatusBadge>
        </div>
        <span class="text-sm text-muted">등록 {{ fmtStamp(faq.created_at) }}</span>
      </template>

      <div class="space-y-6">
        <section>
          <h3 class="mb-2 text-[13px] font-semibold text-muted">질문</h3>
          <p class="text-[15px] font-semibold whitespace-pre-line text-ink">{{ faq.question }}</p>
        </section>
        <!-- 비슷한 질문 — 저장돼 있고 AI 도 쓰는데 어드민이 읽지 않아 안 보였다(QA 2026-11-02 DOC-01) -->
        <section v-if="faq.paraphrases?.length">
          <h3 class="mb-2 text-[13px] font-semibold text-muted">비슷한 질문</h3>
          <ul class="list-disc space-y-1 pl-5 text-[15px] text-body">
            <li v-for="(p, i) in faq.paraphrases" :key="i">{{ p }}</li>
          </ul>
        </section>
        <section>
          <h3 class="mb-2 text-[13px] font-semibold text-muted">답변</h3>
          <p class="text-[15px] leading-relaxed whitespace-pre-line text-body">{{ faq.answer }}</p>
        </section>

        <div class="grid gap-5 border-t border-hairline pt-6 md:grid-cols-3">
          <section>
            <h3 class="mb-2 text-[13px] font-semibold text-muted">적용 범위</h3>
            <div class="flex flex-wrap gap-1.5">
              <Tag v-if="!scopeNames.length">기관 전체</Tag>
              <Tag v-for="(name, i) in scopeNames" :key="i">{{ name }}</Tag>
            </div>
          </section>
          <section>
            <h3 class="mb-2 text-[13px] font-semibold text-muted">AI 사용</h3>
            <p class="text-[15px]" :class="faq.enabled ? 'text-up' : 'text-muted'">
              {{ faq.enabled ? '사용 중' : '사용 안 함' }}
            </p>
          </section>
          <section>
            <h3 class="mb-2 text-[13px] font-semibold text-muted">순서</h3>
            <p class="text-[15px] text-body tabular-nums">{{ faq.sort }}</p>
          </section>
        </div>
      </div>
    </AppCard>

    <!-- 조회 실패와 「없음」을 구분한다 — 네트워크 오류를 삭제된 FAQ로 안내하지 않는다 -->
    <EmptyState
      v-else-if="loadError"
      icon="i-lucide-triangle-alert"
      title="FAQ를 불러오지 못했습니다."
      :description="loadError"
    />
    <EmptyState v-else title="FAQ를 찾을 수 없습니다." description="삭제되었거나 볼 권한이 없는 FAQ입니다." />

    <!-- 질문·답변 수정 — 모양은 출퇴근 기록의 「출결 기록 수정」 창을 따른다 -->
    <AppModal v-model:open="editOpen" title="FAQ 수정" width="max-w-2xl" :before-close="confirmDiscardEdit">
      <div class="space-y-4">
        <FormField label="질문" required :error="editErrors.question">
          <AppTextarea v-model="editForm.question" :rows="2" />
        </FormField>
        <FormField label="답변" required :error="editErrors.answer">
          <AppTextarea v-model="editForm.answer" :rows="8" />
        </FormField>
        <p class="text-xs text-muted">
          승인해 사용 중인 FAQ 는 저장하면 바로 AI 답변에 쓰여요. 비슷한 질문은 여기서 고칠 수 없어요.
        </p>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" :disabled="saving" @click="editOpen = false">취소</AppButton>
        <AppButton size="sm" :loading="saving" @click="submitEdit">저장</AppButton>
      </template>
    </AppModal>

    <!-- 저장하지 않고 닫기 확인. 수정 창 위에 뜨도록 뒤에 둔다 -->
    <AppModal v-model:open="discardOpen" title="저장하지 않고 닫을까요?" width="max-w-md">
      <p class="text-sm text-body">입력한 내용이 사라집니다.</p>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" @click="answerDiscard(false)">계속 수정</AppButton>
        <AppButton color="down" size="sm" @click="answerDiscard(true)">저장하지 않고 닫기</AppButton>
      </template>
    </AppModal>
  </div>
</template>
