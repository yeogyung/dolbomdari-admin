<!-- 원자: 공용 버튼 — 알약(pill) 형태, variant/color/size + 로딩·아이콘 -->
<script setup lang="ts">
type Variant = 'solid' | 'soft' | 'outline' | 'ghost'
type Color = 'primary' | 'neutral' | 'up' | 'down'
type Size = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    color?: Color
    size?: Size
    icon?: string
    trailingIcon?: string
    loading?: boolean
    disabled?: boolean
    block?: boolean
    type?: 'button' | 'submit'
  }>(),
  { variant: 'solid', color: 'primary', size: 'md', type: 'button' },
)

const sizeCls: Record<Size, string> = {
  sm: 'h-9 px-4 text-[13px] gap-1.5',
  md: 'h-11 px-[18px] text-sm gap-2',
  lg: 'h-12 px-6 text-[15px] gap-2',
}

const styles: Record<Variant, Record<Color, string>> = {
  solid: {
    primary: 'bg-brand-500 text-white hover:bg-brand-400',
    neutral: 'bg-ink text-white hover:bg-ink/90',
    up: 'bg-up text-white hover:brightness-95',
    down: 'bg-down text-white hover:brightness-95',
  },
  soft: {
    primary: 'bg-brand-soft text-brand-500 hover:bg-brand-100',
    neutral: 'bg-surface-strong text-body hover:bg-hairline',
    up: 'bg-up-soft text-up hover:brightness-95',
    down: 'bg-down-soft text-down hover:brightness-95',
  },
  outline: {
    primary: 'border border-brand-500 text-brand-500 hover:bg-brand-soft',
    neutral: 'border border-hairline bg-white text-body hover:bg-surface-soft',
    up: 'border border-up text-up hover:bg-up-soft',
    down: 'border border-down text-down hover:bg-down-soft',
  },
  ghost: {
    primary: 'text-brand-500 hover:bg-brand-soft',
    neutral: 'text-body hover:bg-surface-soft',
    up: 'text-up hover:bg-up-soft',
    down: 'text-down hover:bg-down-soft',
  },
}

const cls = computed(() => [
  'inline-flex items-center justify-center rounded-full whitespace-nowrap transition-colors select-none',
  props.variant === 'solid' ? 'font-semibold' : 'font-medium',
  'disabled:opacity-50 disabled:pointer-events-none',
  sizeCls[props.size],
  styles[props.variant][props.color],
  props.block ? 'w-full' : '',
])
</script>

<template>
  <button :type="type" :disabled="disabled || loading" :class="cls">
    <UIcon v-if="loading" name="i-lucide-loader-circle" class="size-4 animate-spin" />
    <UIcon v-else-if="icon" :name="icon" class="size-4" />
    <slot />
    <UIcon v-if="trailingIcon && !loading" :name="trailingIcon" class="size-4" />
  </button>
</template>
