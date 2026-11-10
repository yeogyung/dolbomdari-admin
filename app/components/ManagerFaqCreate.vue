<!-- 담당자 FAQ 등록 창(QA 2026-11-07 MGR-05) — 앱 「FAQ 등록」과 같은 API. 검토 중으로 저장되고 master 가 승인해야 AI 답변에 쓰인다. Figma 없음 -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Worksite } from '~/types/dbo'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [] }>()
const api = useDboAdmin()
const app = useDboApp()
const toast = useToast()

/** 앱 FAQ 분류와 같다(서버 CATEGORIES) */
const CATEGORIES = ['출퇴근', '급여', '공지', '앱 사용']

const question = ref('')
const answer = ref('')
const category = ref('')
const worksites = ref<Worksite[]>([])
const picked = ref<string[]>([])
const tried = ref(false)
const saving = ref(false)

watch(open, async (v) => {
  if (!v) return
  question.value = ''
  answer.value = ''
  category.value = ''
  tried.value = false
  if (!worksites.value.length) {
    try {
      // 서버가 맡은 근무지로 좁힌다
      worksites.value = (await api.listAllWorksites()).filter((w) => w.status !== 'ended')
    } catch (e) {
      toast.add({ title: '근무지를 불러오지 못했습니다.', description: dboErrorMessage(e), color: 'error' })
    }
  }
  picked.value = worksites.value.map((w) => w.id)
})

function toggle(id: string) {
  picked.value = picked.value.includes(id) ? picked.value.filter((x) => x !== id) : [...picked.value, id]
}

async function submit() {
  tried.value = true
  const q = question.value.trim()
  const a = answer.value.trim()
  if (!q || !a || q.length > 300 || a.length > 4000 || !picked.value.length) return
  saving.value = true
  try {
    await app.createFaq({ question: q, answer: a, category: category.value || null, worksiteIds: picked.value })
    toast.add({ title: 'FAQ 를 등록했습니다.', description: '운영관리자가 승인하면 AI 답변에 쓰입니다.', color: 'success' })
    open.value = false
    emit('created')
  } catch (e) {
    toast.add({ title: 'FAQ 를 등록하지 못했습니다.', description: dboErrorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal v-model:open="open" title="FAQ 등록" width="max-w-xl">
    <div class="space-y-4">
      <FormField label="질문" required :error="tried && !question.trim() ? '질문을 입력해 주세요' : question.length > 300 ? '300자까지입니다' : undefined">
        <TextField v-model="question" placeholder="예: 출근 QR 이 안 찍혀요" />
      </FormField>
      <FormField label="답변" required :error="tried && !answer.trim() ? '답변을 입력해 주세요' : answer.length > 4000 ? '4,000자까지입니다' : undefined">
        <AppTextarea v-model="answer" :rows="6" />
      </FormField>
      <FormField label="분류">
        <SelectField v-model="category" :options="[{ label: '분류 없음', value: '' }, ...CATEGORIES.map((c) => ({ label: c, value: c }))]" />
      </FormField>
      <FormField label="적용 근무지" required :error="tried && !picked.length ? '근무지를 하나 이상 골라 주세요' : undefined">
        <div class="flex flex-wrap gap-3">
          <Checkbox v-for="w in worksites" :key="w.id" :model-value="picked.includes(w.id)" :label="w.name" @update:model-value="toggle(w.id)" />
        </div>
      </FormField>
      <p class="text-xs text-muted">등록하면 「검토 중」으로 저장됩니다. 운영관리자가 승인하면 AI 답변에 쓰입니다.</p>
    </div>
    <template #footer>
      <AppButton variant="outline" color="neutral" size="sm" :disabled="saving" @click="open = false">취소</AppButton>
      <AppButton size="sm" :loading="saving" @click="submit">등록</AppButton>
    </template>
  </AppModal>
</template>
