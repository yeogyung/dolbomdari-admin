<!-- 배정 근무 시간 입력 — 모든 요일 같은 시간 또는 요일마다 다르게 · 자주 쓰는 시간 묶음. 명부 상세 배정과 여러 명 배정이 같이 쓴다(QA 2026-11-07 SHIFT-04 · SHIFT-06, 결정 D26 · D27) -->
<script setup lang="ts">
// Figma 에 요일별 시간 입력·시간 묶음이 없어 기존 배정 창의 시간 칸·「공지 유형」 알약·요일 빠른 선택(WeekdayPicker) 모양을 그대로 쓴다.
import { computed } from 'vue'
import { dayTime, timeGroupLine, timeGroups, type DayTimes } from '~/utils/assignmentTimes'
import { SHIFT_TIME_PRESETS, isShiftPreset, type ShiftTimePreset } from '~/utils/shiftTimePresets'

const props = withDefaults(
  defineProps<{
    /** 고른 요일 — 요일마다 다르게면 이 요일마다 줄을 그린다 */
    weekdays: number[]
    /** 요일마다 다르게를 고를 수 있는가. 배정 수정은 배정 하나를 고치는 것이라 끈다 */
    allowPerDay?: boolean
    /** 같은 시간일 때의 오류 */
    error?: string
    /** 요일마다일 때 요일별 오류 */
    dayErrors?: Partial<Record<number, string>>
  }>(),
  { allowPerDay: true, error: undefined, dayErrors: undefined },
)
const startTime = defineModel<string>('startTime', { required: true })
const endTime = defineModel<string>('endTime', { required: true })
const perDay = defineModel<boolean>('perDay', { default: false })
const dayTimes = defineModel<DayTimes>('dayTimes', { default: () => ({}) })

const MODES = [
  { value: false, label: '모든 요일 같은 시간' },
  { value: true, label: '요일마다 다르게' },
]
const days = computed(() => [...props.weekdays].sort((a, b) => a - b))
const dayLabel = (d: number) => WEEKDAYS.find((w) => w.value === d)?.label ?? String(d)
const form = computed(() => ({
  weekdays: props.weekdays,
  startTime: startTime.value,
  endTime: endTime.value,
  perDay: perDay.value,
  dayTimes: dayTimes.value,
}))
/** 요일마다 다르게일 때 나눠질 배정 — 저장 전에 몇 개로 나뉘는지 보인다 */
const groups = computed(() => (perDay.value ? timeGroups(form.value) : []))

function setDay(day: number, key: 'start' | 'end', value: string | null | undefined) {
  const current = dayTime(form.value, day)
  dayTimes.value = { ...dayTimes.value, [day]: { ...current, [key]: value ?? '' } }
}

/** 시간 묶음(결정 D27) — 누르면 시작·종료 시간을 채운다. 요일마다 다르게면 그 요일 줄만 */
function applyPreset(p: ShiftTimePreset, day?: number) {
  if (day === undefined) {
    startTime.value = p.start
    endTime.value = p.end
    return
  }
  dayTimes.value = { ...dayTimes.value, [day]: { start: p.start, end: p.end } }
}
const presetCls = (on: boolean) =>
  on ? 'border-brand-500 bg-brand-soft text-brand-500' : 'border-hairline bg-white text-body hover:bg-surface-soft'
</script>

<template>
  <div class="space-y-3">
    <div v-if="allowPerDay" class="flex gap-2" role="group" aria-label="근무 시간 넣는 방법">
      <button
        v-for="m in MODES"
        :key="m.label"
        type="button"
        class="rounded-full border px-4 py-1.5 text-sm font-medium transition-colors"
        :class="perDay === m.value ? 'border-brand-500 bg-brand-500 text-white' : 'border-hairline text-body hover:bg-surface-soft'"
        :aria-pressed="perDay === m.value"
        @click="perDay = m.value"
      >
        {{ m.label }}
      </button>
    </div>

    <template v-if="!allowPerDay || !perDay">
      <!-- 자주 쓰는 시간(결정 D27) — 요일 빠른 선택과 같은 단추. 지금 시간과 같으면 눌린 모양 -->
      <div class="flex flex-wrap items-center gap-2" role="group" aria-label="자주 쓰는 근무 시간">
        <button
          v-for="p in SHIFT_TIME_PRESETS"
          :key="p.label"
          type="button"
          class="h-9 rounded-full border px-3 text-sm font-medium tabular-nums transition-colors"
          :class="presetCls(isShiftPreset(p, startTime, endTime))"
          :aria-pressed="isShiftPreset(p, startTime, endTime)"
          @click="applyPreset(p)"
        >
          {{ p.label }} {{ p.start }}–{{ p.end }}
        </button>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <FormField label="시작 시간" required :error="error">
          <DateField v-model="startTime" type="time" />
        </FormField>
        <FormField label="종료 시간" required>
          <DateField v-model="endTime" type="time" />
        </FormField>
      </div>
    </template>

    <!-- 요일마다 다르게 — 한 줄에 요일 하나. 칸이 여럿이라 FormField(라벨 하나에 입력 하나) 대신 칸마다 이름을 단다 -->
    <div v-else class="space-y-2">
      <p class="text-sm font-medium text-slate-700">요일별 근무 시간 <span class="text-brand-500">*</span></p>
      <p v-if="!days.length" class="text-sm text-muted">근무 요일을 먼저 골라 주세요.</p>
      <div v-for="d in days" :key="d" class="flex flex-wrap items-center gap-2">
        <span class="w-6 text-sm font-medium text-ink">{{ dayLabel(d) }}</span>
        <div class="w-32">
          <DateField
            :model-value="dayTime(form, d).start"
            type="time"
            :aria-label="`${dayLabel(d)}요일 시작 시간`"
            @update:model-value="setDay(d, 'start', $event)"
          />
        </div>
        <span class="text-muted">–</span>
        <div class="w-32">
          <DateField
            :model-value="dayTime(form, d).end"
            type="time"
            :aria-label="`${dayLabel(d)}요일 종료 시간`"
            @update:model-value="setDay(d, 'end', $event)"
          />
        </div>
        <!-- 자주 쓰는 시간 — 줄이 좁아 이름만, 시간은 단추에 올리면 보인다 -->
        <button
          v-for="p in SHIFT_TIME_PRESETS"
          :key="p.label"
          type="button"
          class="h-9 rounded-full border px-3 text-sm font-medium transition-colors"
          :class="presetCls(isShiftPreset(p, dayTime(form, d).start, dayTime(form, d).end))"
          :title="`${p.start}–${p.end}`"
          :aria-label="`${dayLabel(d)}요일 ${p.label} ${p.start}–${p.end}`"
          :aria-pressed="isShiftPreset(p, dayTime(form, d).start, dayTime(form, d).end)"
          @click="applyPreset(p, d)"
        >
          {{ p.label }}
        </button>
        <p v-if="dayErrors?.[d]" class="w-full pl-8 text-xs text-down">{{ dayErrors[d] }}</p>
      </div>
      <div v-if="groups.length > 1" class="rounded-lg border border-hairline bg-surface-soft px-4 py-3 text-sm text-body">
        <p class="font-medium tabular-nums">같은 시간인 요일끼리 묶어 배정 {{ groups.length }}개로 나눠 저장합니다.</p>
        <p class="mt-0.5 text-muted">배정 목록에 {{ groups.length }}줄이 생기고, 배정마다 시니어에게 알림이 갑니다.</p>
        <ul class="mt-1.5 list-disc space-y-0.5 pl-5 tabular-nums">
          <li v-for="g in groups" :key="timeGroupLine(g)">{{ timeGroupLine(g) }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>
