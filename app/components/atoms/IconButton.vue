<!-- 원자: 아이콘 전용 버튼 — 처리 중에는 다시 누를 수 없다 -->
<script setup lang="ts">
import { createClickGuard } from '~/utils/clickGuard'

const props = withDefaults(
  defineProps<{
    icon: string
    label?: string
    disabled?: boolean
    tone?: 'neutral' | 'danger'
    /** `@click` 은 여기로 들어온다. Promise 를 돌려주면 끝날 때까지 잠근다 */
    onClick?: (e: MouseEvent) => unknown
  }>(),
  { tone: 'neutral' },
)

const guard = createClickGuard()
function handleClick(e: MouseEvent) {
  if (props.disabled || guard.pending.value || !props.onClick) return
  return guard.run(() => props.onClick!(e))
}
</script>

<template>
  <button
    type="button"
    :disabled="disabled || guard.pending.value"
    :aria-busy="guard.pending.value"
    :aria-label="label"
    :title="label"
    class="inline-flex size-8 items-center justify-center rounded-lg transition-colors disabled:opacity-40"
    :class="tone === 'danger' ? 'text-brand-500 hover:bg-brand-50' : 'text-slate-500 hover:bg-slate-100'"
    @click="handleClick"
  >
    <UIcon v-if="guard.pending.value" name="i-lucide-loader-circle" class="size-4 animate-spin" />
    <UIcon v-else :name="icon" class="size-4" />
  </button>
</template>
