<!-- 담당자 FAQ 등록 창(QA 2026-11-07 MGR-05) — 앱 「FAQ 등록」(db-operation-rn app/faq/new.tsx)과 같은 칸·API. 검토 중으로 저장되고 master 가 승인해야 AI 답변에 쓰인다. Figma 없음 -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { addParaphrase, isMaybeSaved, knowledgeErrorText, MAX_PARAPHRASE_CHARS, MAX_PARAPHRASES } from '~/utils/managerKnowledge'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [] }>()
const app = useDboApp()
const toast = useToast()

/** 앱 FAQ 분류와 같다(서버 CATEGORIES) */
const CATEGORIES = ['출퇴근', '급여', '공지', '앱 사용']

const question = ref('')
const answer = ref('')
const category = ref('')
/** 비슷한 질문(AI 인식용) — 시니어가 같은 뜻을 다르게 물어도 찾게 한다 */
const paraphrases = ref<string[]>([])
const draft = ref('')
/** '' = 기관 전체 */
const scope = ref('')
const scopeReady = ref(false)
const tried = ref(false)
const saving = ref(false)
/**
 * 저장됐는지 모른다(응답 없음·5xx). 다시 누르면 같은 FAQ 가 두 벌 쌓여(멱등 키가 없다) 등록만 막는다.
 * 창과 쓴 내용은 남긴다 — 저장이 안 됐으면 내용을 옮겨 다시 써야 한다(앱과 같다)
 */
const unknown = ref(false)

watch(open, (v) => {
  if (!v) return
  question.value = ''
  answer.value = ''
  category.value = ''
  paraphrases.value = []
  draft.value = ''
  scope.value = ''
  tried.value = false
  unknown.value = false
})

/** 한글 조합 중의 Enter 는 넘긴다 — 마지막 글자가 빠진 칩이 생기고, 조합이 끝나며 한 번 더 들어온다 */
function onDraftEnter(e: KeyboardEvent) {
  if (e.isComposing) return
  e.preventDefault()
  addDraft()
}
function addDraft() {
  const next = addParaphrase(paraphrases.value, draft.value)
  if (next !== paraphrases.value) draft.value = ''
  paraphrases.value = next
}
function removeParaphrase(p: string) {
  paraphrases.value = paraphrases.value.filter((x) => x !== p)
}

async function submit() {
  tried.value = true
  const q = question.value.trim()
  const a = answer.value.trim()
  // 입력칸에 남은 비슷한 질문이 200자를 넘으면 싣지 못한다 — 말없이 빼고 닫지 않는다
  if (!q || !a || q.length > 300 || a.length > 4000 || draft.value.trim().length > MAX_PARAPHRASE_CHARS) return
  if (!scopeReady.value || unknown.value) return
  saving.value = true
  try {
    await app.createFaq({
      question: q,
      answer: a,
      category: category.value || null,
      // 「추가」를 누르지 않고 입력칸에 남은 것도 싣는다 — 등록을 누르면 바로 닫혀 빠진 줄 모른다
      paraphrases: addParaphrase(paraphrases.value, draft.value),
      worksiteIds: scope.value ? [scope.value] : [],
    })
    toast.add({ title: 'FAQ 를 등록했습니다.', description: '운영관리자가 승인하면 AI 답변에 쓰입니다.', color: 'success' })
    open.value = false
    emit('created')
  } catch (e) {
    if (isMaybeSaved(e)) {
      unknown.value = true
      // 뒤의 목록을 다시 읽어 둔다 — 창을 닫으면 바로 확인할 수 있게
      emit('created')
    } else {
      // 입력은 지우지 않는다 — 길게 쓴 답변이 사라지면 다시 쓰기 어렵다
      toast.add({ title: 'FAQ 를 등록하지 못했습니다.', description: knowledgeErrorText(e, 'faq'), color: 'error' })
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal v-model:open="open" title="FAQ 등록" width="max-w-xl" :before-close="() => !saving">
    <div class="space-y-4">
      <FormField label="분류">
        <SelectField v-model="category" :options="[{ label: '분류 없음', value: '' }, ...CATEGORIES.map((c) => ({ label: c, value: c }))]" />
      </FormField>
      <FormField label="질문" required :error="tried && !question.trim() ? '질문을 입력해 주세요' : question.length > 300 ? '300자까지입니다' : undefined">
        <TextField v-model="question" placeholder="예: QR이 안 찍히면 어떻게 해요?" />
      </FormField>
      <FormField label="답변" required :error="tried && !answer.trim() ? '답변을 입력해 주세요' : answer.length > 4000 ? '4,000자까지입니다' : undefined">
        <AppTextarea v-model="answer" :rows="6" placeholder="시니어가 그대로 읽어도 되는 말로 적어 주세요." />
      </FormField>
      <FormField
        label="비슷한 질문 (AI 인식용)"
        :hint="`같은 뜻의 다른 말을 ${MAX_PARAPHRASES}개까지 넣을 수 있습니다.`"
        :error="draft.trim().length > MAX_PARAPHRASE_CHARS ? `${MAX_PARAPHRASE_CHARS}자까지입니다` : undefined"
      >
        <div class="space-y-2">
          <div class="flex gap-2">
            <TextField
              v-model="draft"
              placeholder="예: 큐알 안 찍혀요"
              :disabled="paraphrases.length >= MAX_PARAPHRASES"
              @keydown.enter="onDraftEnter"
            />
            <AppButton variant="outline" color="neutral" size="sm" :disabled="!draft.trim() || paraphrases.length >= MAX_PARAPHRASES" @click="addDraft">
              추가
            </AppButton>
          </div>
          <ul v-if="paraphrases.length" class="flex flex-wrap gap-2">
            <li v-for="p in paraphrases" :key="p" class="flex items-center gap-1 rounded-full bg-surface-soft py-1 pr-1 pl-3 text-sm text-body">
              {{ p }}
              <button type="button" class="inline-flex size-6 items-center justify-center rounded-full text-muted hover:bg-surface-strong" :aria-label="`${p} 빼기`" @click="removeParaphrase(p)">
                <UIcon name="i-lucide-x" class="size-3.5" />
              </button>
            </li>
          </ul>
        </div>
      </FormField>
      <KnowledgeScopeField v-model="scope" v-model:ready="scopeReady" />
      <p class="text-xs text-muted">FAQ는 기관 하나의 공용 지식베이스에 저장됩니다. 저장하면 「검토 중」으로 올라가고, 운영관리자가 승인해야 AI 답변에 쓰입니다.</p>
      <p v-if="unknown" role="alert" class="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        저장됐는지 확인하지 못했습니다. FAQ 목록에서 이 질문이 올라갔는지 먼저 확인해 주세요.
        <template v-if="scope">목록에 있으면 적용 범위가 고른 근무지인지도 봐 주세요 — 기관 전체로 올라가 있으면 운영관리자에게 알려 주세요.</template>
        <span class="mt-2 flex flex-wrap gap-3">
          <NuxtLink to="/senior/faqs" target="_blank" class="font-medium underline">FAQ 목록 새 창으로 보기</NuxtLink>
          <!-- 목록을 보고 없다고 확인한 뒤에만 다시 등록한다 — 쓴 내용은 그대로다 -->
          <button type="button" class="font-medium underline" @click="unknown = false">목록에 없어요, 다시 등록하기</button>
        </span>
      </p>
    </div>
    <template #footer>
      <AppButton variant="outline" color="neutral" size="sm" :disabled="saving" @click="open = false">취소</AppButton>
      <AppButton size="sm" :loading="saving" :disabled="!scopeReady || unknown" @click="submit">등록</AppButton>
    </template>
  </AppModal>
</template>
