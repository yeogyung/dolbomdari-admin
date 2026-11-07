<!-- 목록 툴바의 근무지 필터 — 글자를 쳐서 찾고, 사업을 고른 화면에서는 그 사업의 근무지만 보인다(QA 2026-11-07 ADMIN-04) -->
<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { worksiteChoices, worksiteOutsideProgram } from '~/utils/worksiteFilter'

type Site = { id: string; name: string; program_id: string | null; status?: string }

const props = withDefaults(
  defineProps<{
    worksites: Site[]
    /** 화면의 사업 필터 값. 주면 그 사업의 근무지만 고를 수 있고, 사업 밖 근무지를 골라 두었으면 선택을 푼다 */
    programId?: string
    /** 사업 이름 — 선택지 아래 줄에 적고 검색에도 쓴다. 이름이 같은 근무지가 여러 사업에 있다 */
    programs?: { id: string; name: string }[]
    allLabel?: string
    width?: string
  }>(),
  { programId: '', programs: () => [], allLabel: '근무지 전체', width: 'w-64' },
)
/** 고른 근무지 id. '' 은 전체 */
const model = defineModel<string>({ required: true })

const uid = useId()
const programName = (pid: string | null) => (pid ? (props.programs.find((p) => p.id === pid)?.name ?? null) : null)

const query = ref('')
const open = ref(false)
const activeIndex = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)

const choices = computed(() => worksiteChoices(props.worksites, query.value, props.programId, programName))
/** 맨 위 「근무지 전체」 줄 — 검색 중에는 빼서 Enter 가 첫 결과를 고르게 한다 */
const showAll = computed(() => !query.value.trim())
const optionCount = computed(() => choices.value.length + (showAll.value ? 1 : 0))

const selected = computed(() => props.worksites.find((w) => w.id === model.value) ?? null)
const ended = (w: Site) => (w.status === 'ended' ? ' (종료)' : '')
/** 닫혀 있을 때 칸에 적는 이름. 목록을 받기 전이면 id 대신 「선택한 근무지」 */
const selectedLabel = computed(() => {
  if (!model.value) return ''
  if (!selected.value) return '선택한 근무지'
  const sub = programName(selected.value.program_id)
  return `${selected.value.name}${ended(selected.value)}${sub ? ` · ${sub}` : ''}`
})

// 사업을 바꿨는데 고른 근무지가 그 사업 밖이면 선택을 푼다 — 보이지 않는 조건으로 걸러지지 않게
watch(
  () => [props.programId, props.worksites] as const,
  () => {
    if (worksiteOutsideProgram(props.worksites, model.value, props.programId)) model.value = ''
  },
)
watch(query, () => {
  activeIndex.value = 0
})
watch(activeIndex, async (i) => {
  await nextTick()
  document.getElementById(`${uid}-opt-${i}`)?.scrollIntoView({ block: 'nearest' })
})

function openList() {
  if (open.value) return
  query.value = ''
  // 고른 근무지가 있으면 그 줄에서 시작한다
  const at = choices.value.findIndex((w) => w.id === model.value)
  activeIndex.value = at >= 0 ? at + 1 : 0
  open.value = true
}

function pick(id: string) {
  model.value = id
  query.value = ''
  open.value = false
  inputEl.value?.blur()
}

/** i 번째 줄의 근무지 id — 검색어가 없으면 0번이 「전체」('') */
function idAt(i: number): string | undefined {
  if (showAll.value) return i === 0 ? '' : choices.value[i - 1]?.id
  return choices.value[i]?.id
}

function onKey(e: KeyboardEvent) {
  const n = optionCount.value
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!open.value) return openList()
    if (n) activeIndex.value = (activeIndex.value + 1) % n
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (n) activeIndex.value = (activeIndex.value - 1 + n) % n
  } else if (e.key === 'Enter') {
    if (!open.value) return
    e.preventDefault()
    const id = idAt(activeIndex.value)
    if (id !== undefined) pick(id)
  } else if (e.key === 'Escape') {
    open.value = false
    query.value = ''
  }
}
</script>

<template>
  <div class="relative max-w-full" :class="width">
    <UIcon
      name="i-lucide-map-pin"
      class="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted"
    />
    <input
      ref="inputEl"
      :value="open ? query : selectedLabel"
      type="text"
      role="combobox"
      aria-label="근무지 필터"
      aria-autocomplete="list"
      :aria-controls="`${uid}-list`"
      :aria-expanded="open"
      :aria-activedescendant="open && optionCount ? `${uid}-opt-${activeIndex}` : undefined"
      :placeholder="open ? '근무지 이름 검색' : allLabel"
      :title="selectedLabel || allLabel"
      autocomplete="off"
      class="h-11 w-full truncate rounded-full border border-hairline bg-white pr-9 pl-10 text-[15px] font-medium text-ink outline-none transition-colors placeholder:text-ink focus:border-brand-500 focus:placeholder:text-muted"
      @focus="openList"
      @click="openList"
      @input="
        (e) => {
          query = (e.target as HTMLInputElement).value
          open = true
        }
      "
      @blur="
        () => {
          open = false
          query = ''
        }
      "
      @keydown="onKey"
    />
    <!-- 고른 근무지가 있으면 X 로 바로 푼다. mousedown 에서 막아 입력칸 blur 보다 먼저 받는다 -->
    <button
      v-if="model && !open"
      type="button"
      class="absolute top-1/2 right-3 -translate-y-1/2 text-muted hover:text-ink"
      aria-label="근무지 선택 풀기"
      @mousedown.prevent="pick('')"
    >
      <UIcon name="i-lucide-x" class="size-4" />
    </button>
    <UIcon
      v-else
      name="i-lucide-chevron-down"
      class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
    />

    <ul
      v-if="open"
      :id="`${uid}-list`"
      role="listbox"
      class="absolute top-full left-0 z-30 mt-1 max-h-80 w-max max-w-[min(28rem,90vw)] min-w-full overflow-y-auto rounded-lg border border-hairline bg-canvas py-1 shadow-lg"
    >
      <li
        v-if="showAll"
        :id="`${uid}-opt-0`"
        role="option"
        :aria-selected="activeIndex === 0"
        class="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm"
        :class="activeIndex === 0 ? 'bg-brand-50 text-ink' : 'text-body hover:bg-surface-soft'"
        @mousedown.prevent="pick('')"
        @mouseenter="activeIndex = 0"
      >
        <span>{{ allLabel }}<template v-if="programId"> ({{ choices.length }}곳)</template></span>
        <UIcon v-if="!model" name="i-lucide-check" class="size-4 shrink-0 text-brand-500" />
      </li>
      <li
        v-for="(w, i) in choices"
        :id="`${uid}-opt-${i + (showAll ? 1 : 0)}`"
        :key="w.id"
        role="option"
        :aria-selected="activeIndex === i + (showAll ? 1 : 0)"
        class="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm"
        :class="activeIndex === i + (showAll ? 1 : 0) ? 'bg-brand-50 text-ink' : 'text-body hover:bg-surface-soft'"
        @mousedown.prevent="pick(w.id)"
        @mouseenter="activeIndex = i + (showAll ? 1 : 0)"
      >
        <span class="min-w-0">
          <span class="block truncate">{{ w.name }}{{ ended(w) }}</span>
          <span v-if="programName(w.program_id)" class="block truncate text-xs text-muted">
            {{ programName(w.program_id) }}
          </span>
        </span>
        <UIcon v-if="w.id === model" name="i-lucide-check" class="size-4 shrink-0 text-brand-500" />
      </li>
      <li v-if="!choices.length" class="px-3 py-2 text-sm text-muted">
        {{ query.trim() ? '검색 결과가 없습니다.' : '고를 근무지가 없습니다.' }}
      </li>
    </ul>
  </div>
</template>
