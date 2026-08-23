<!-- 유기체: 중앙 모달 다이얼로그 — 헤더/본문/푸터 슬롯 -->
<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue'

const props = defineProps<{ title?: string; width?: string }>()
const open = defineModel<boolean>('open', { default: false })

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

watch(open, (v) => {
  if (import.meta.client) {
    document.removeEventListener('keydown', onKey)
    if (v) document.addEventListener('keydown', onKey)
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
          class="relative flex w-full flex-col overflow-hidden rounded-[24px] border border-hairline bg-white shadow-[0_18px_44px_rgba(2,32,80,0.18)]"
          :class="width || 'max-w-md'"
        >
          <div class="flex items-center justify-between border-b border-hairline-soft px-6 py-4">
            <h2 class="text-[18px] font-semibold text-ink">{{ title }}</h2>
            <button
              type="button"
              class="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-soft"
              aria-label="닫기"
              @click="open = false"
            >
              <UIcon name="i-lucide-x" class="size-5" />
            </button>
          </div>
          <div class="px-6 py-5">
            <slot />
          </div>
          <div v-if="$slots.footer" class="flex justify-end gap-2 border-t border-hairline-soft px-6 py-4">
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
