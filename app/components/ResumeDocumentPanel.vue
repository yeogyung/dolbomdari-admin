<!-- 이력서 서류 카드 — A4 서류 보기와 PDF·이미지 저장 -->
<script setup lang="ts">
import type { Resume } from '#shared/resume-form'

defineProps<{ resume: Resume }>()

const toast = useToast()
const doc = useTemplateRef<{ savePdf: () => Promise<void>; savePng: () => Promise<void> }>('doc')
const saving = ref<'pdf' | 'png' | null>(null)

async function save(kind: 'pdf' | 'png') {
  if (!doc.value || saving.value) return
  saving.value = kind
  try {
    await (kind === 'pdf' ? doc.value.savePdf() : doc.value.savePng())
  } catch (e: any) {
    toast.add({ title: '저장 실패', description: e?.message, color: 'error' })
  } finally {
    saving.value = null
  }
}
</script>

<template>
  <AppCard>
    <template #header>
      <h3 class="text-[15px] font-semibold text-ink">이력서 서류</h3>
      <div class="flex gap-2">
        <AppButton
          size="sm"
          variant="outline"
          color="neutral"
          icon="i-lucide-file-down"
          :loading="saving === 'pdf'"
          :disabled="saving !== null"
          @click="save('pdf')"
        >
          PDF 저장
        </AppButton>
        <AppButton
          size="sm"
          variant="outline"
          color="neutral"
          icon="i-lucide-image"
          :loading="saving === 'png'"
          :disabled="saving !== null"
          @click="save('png')"
        >
          이미지 저장
        </AppButton>
      </div>
    </template>
    <ResumeDocument ref="doc" :resume="resume" />
  </AppCard>
</template>
