<!-- 유기체: 중앙 모달 다이얼로그 — 헤더/본문/푸터 슬롯 -->
<script setup lang="ts">
import { watch, nextTick, onBeforeUnmount, useId, useTemplateRef } from 'vue'

const props = defineProps<{ title?: string; width?: string }>()
const open = defineModel<boolean>('open', { default: false })

const titleId = useId()
const panel = useTemplateRef<HTMLElement>('panel')
/** 열기 전 포커스 — 닫으면 그 자리로 돌려준다(키보드 사용자가 위치를 잃지 않게) */
let lastFocus: HTMLElement | null = null

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

watch(open, async (v) => {
  if (import.meta.client) {
    document.removeEventListener('keydown', onKey)
    if (v) document.addEventListener('keydown', onKey)
    if (v) {
      lastFocus = document.activeElement as HTMLElement | null
      await nextTick()
      // 본문 안에서 스스로 포커스를 잡은 입력칸(autofocus)이 있으면 그대로 둔다
      if (panel.value && !panel.value.contains(document.activeElement)) panel.value.focus()
    } else {
      lastFocus?.focus()
      lastFocus = null
    }
  }
})
onBeforeUnmount(() => {
  if (import.meta.client) document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/40" @click="open = false" />
        <div
          ref="panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? titleId : undefined"
          tabindex="-1"
          class="relative flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-[24px] outline-none border border-hairline bg-white shadow-[0_18px_44px_rgba(2,32,80,0.18)]"
          :class="width || 'max-w-md'"
        >
          <!-- 화면보다 길어지면 본문만 스크롤한다 — 제목과 버튼(푸터)은 늘 보인다 -->
          <div class="flex shrink-0 items-center justify-between border-b border-hairline-soft px-6 py-4">
            <h2 :id="titleId" class="text-[18px] font-semibold text-ink">{{ title }}</h2>
            <button
              type="button"
              class="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-soft"
              aria-label="닫기"
              @click="open = false"
            >
              <UIcon name="i-lucide-x" class="size-5" />
            </button>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <slot />
          </div>
          <div v-if="$slots.footer" class="flex shrink-0 justify-end gap-2 border-t border-hairline-soft px-6 py-4">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
