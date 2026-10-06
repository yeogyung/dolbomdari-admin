<!-- 근무지 고르기 — 사업으로 좁혀 담당자는 여러 곳, 수요처 담당자는 1곳을 고른다 -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Program, Worksite } from '~/types/dbo'

const props = defineProps<{
  worksites: Worksite[]
  programs: Program[]
  /** true 면 여러 곳(string[]), false 면 1곳(string | null) */
  multiple?: boolean
  /** 고르면 다른 사람에게서 넘어오는 근무지 — 옆에 표시만 한다 */
  isTaken?: (w: Worksite) => boolean
}>()
const model = defineModel<string[] | string | null>({ required: true })

// 사업은 목록을 좁히는 데만 쓴다. 저장되는 것은 근무지다(담당 사업은 근무지의 사업으로 정해진다).
const programId = ref('')

const programName = (pid: string | null) =>
  pid ? (props.programs.find((p) => p.id === pid)?.name ?? '') : ''

const filtered = computed(() =>
  programId.value ? props.worksites.filter((w) => w.program_id === programId.value) : props.worksites,
)

const label = (w: Worksite) => (w.status === 'ended' ? `${w.name} (종료)` : w.name)

/* 여러 곳 */
const selected = computed(() => (Array.isArray(model.value) ? model.value : []))
function toggle(id: string) {
  const next = selected.value.includes(id)
    ? selected.value.filter((x) => x !== id)
    : [...selected.value, id]
  model.value = next
}
// 사업을 바꿔 목록에서 안 보여도 고른 것은 남는다 — 무엇이 골라져 있는지 따로 보여 준다
const selectedWorksites = computed(() =>
  props.worksites.filter((w) => selected.value.includes(w.id)),
)

/* 1곳 — 고른 근무지가 지금 사업 밖이어도 셀렉트가 이름을 보여 주게 선택지에 남긴다 */
const singleOptions = computed(() => {
  const list = filtered.value.slice()
  const current = props.worksites.find((w) => w.id === model.value)
  if (current && !list.includes(current)) list.unshift(current)
  return list.map((w) => ({ label: label(w), value: w.id }))
})
const single = computed({
  get: () => (typeof model.value === 'string' ? model.value : null),
  set: (v: string | number | null) => {
    model.value = v === null ? null : String(v)
  },
})
</script>

<template>
  <div class="space-y-3">
    <SelectField
      v-model="programId"
      :options="[
        { label: `사업 전체 (근무지 ${worksites.length}곳)`, value: '' },
        ...programs.map((p) => ({ label: p.name, value: p.id })),
      ]"
    />

    <SelectField
      v-if="!multiple"
      v-model="single"
      :options="singleOptions"
      :placeholder="filtered.length ? '근무지 선택' : '이 사업에 근무지가 없습니다'"
    />

    <template v-else>
      <div class="max-h-56 overflow-y-auto rounded-lg border border-hairline p-3">
        <p v-if="!filtered.length" class="text-sm text-muted">이 사업에 근무지가 없습니다.</p>
        <div v-for="w in filtered" :key="w.id" class="flex items-center gap-2 py-1">
          <Checkbox
            :model-value="selected.includes(w.id)"
            :label="label(w)"
            @update:model-value="toggle(w.id)"
          />
          <span v-if="!programId && programName(w.program_id)" class="text-xs text-muted">
            {{ programName(w.program_id) }}
          </span>
          <span v-if="isTaken?.(w)" class="text-xs text-muted">· 다른 담당자 지정됨</span>
        </div>
      </div>
      <div v-if="selectedWorksites.length" class="flex flex-wrap items-center gap-1.5">
        <span class="text-sm text-muted">선택 {{ selectedWorksites.length }}곳</span>
        <Tag v-for="w in selectedWorksites" :key="w.id">{{ w.name }}</Tag>
      </div>
    </template>
  </div>
</template>
