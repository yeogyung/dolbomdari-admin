<!-- 근무 요일 고르기 — 요일 단추와 빠른 선택(평일·매일·주말). 명부 상세 배정과 여러 명 배정이 같이 쓴다(QA 2026-11-07 SHIFT-01 · SHIFT-02) -->
<script setup lang="ts">
/** 고른 요일(ISO 1=월 … 7=일) */
const model = defineModel<number[]>({ required: true })

function toggle(day: number) {
  model.value = model.value.includes(day) ? model.value.filter((d) => d !== day) : [...model.value, day]
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <button
      v-for="w in WEEKDAYS"
      :key="w.value"
      type="button"
      class="size-10 rounded-full border text-sm font-medium transition-colors"
      :class="
        model.includes(w.value)
          ? 'border-brand-500 bg-brand-500 text-white'
          : 'border-hairline bg-white text-body hover:bg-surface-soft'
      "
      @click="toggle(w.value)"
    >
      {{ w.label }}
    </button>
    <!-- 빠른 선택(QA 2026-11-07 SHIFT-01) — 누르면 고른 요일을 그 묶음으로 바꾼다 -->
    <span class="mx-1 h-6 w-px bg-hairline" aria-hidden="true" />
    <button
      v-for="p in WEEKDAY_PRESETS"
      :key="p.label"
      type="button"
      class="h-10 rounded-full border px-3 text-sm font-medium transition-colors"
      :class="
        sameWeekdays(model, p.days)
          ? 'border-brand-500 bg-brand-soft text-brand-500'
          : 'border-hairline bg-white text-body hover:bg-surface-soft'
      "
      :aria-pressed="sameWeekdays(model, p.days)"
      @click="model = [...p.days]"
    >
      {{ p.label }}
    </button>
  </div>
</template>
