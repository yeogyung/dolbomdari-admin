<!-- 근무지 고르기 — 검색·사업으로 좁혀 담당자는 여러 곳, 수요처 담당자는 1곳을 고른다 -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Program, Worksite } from '~/types/dbo'
import { addAll, removeAll } from '~/utils/worksiteSelection'

const props = defineProps<{
  worksites: Worksite[]
  programs: Program[]
  /** true 면 여러 곳(string[]), false 면 1곳(string | null) */
  multiple?: boolean
  /** 고르면 다른 사람에게서 넘어오는 근무지 — 옆에 표시만 한다 */
  isTaken?: (w: Worksite) => boolean
}>()
const model = defineModel<string[] | string | null>({ required: true })

// 검색·사업은 목록을 좁히는 데만 쓴다. 저장되는 것은 근무지다(담당 사업은 근무지의 사업으로 정해진다).
const q = ref('')
const programId = ref('')

const programName = (pid: string | null) =>
  pid ? (props.programs.find((p) => p.id === pid)?.name ?? '') : ''

const filtered = computed(() => {
  const needle = q.value.trim().toLowerCase()
  return props.worksites.filter(
    (w) =>
      (!programId.value || w.program_id === programId.value) &&
      (!needle ||
        w.name.toLowerCase().includes(needle) ||
        (w.address ?? '').toLowerCase().includes(needle)),
  )
})

const label = (w: Worksite) => (w.status === 'ended' ? `${w.name} (종료)` : w.name)

/* 여러 곳 */
const selected = computed(() => (Array.isArray(model.value) ? model.value : []))
function toggle(id: string) {
  const next = selected.value.includes(id)
    ? selected.value.filter((x) => x !== id)
    : [...selected.value, id]
  model.value = next
}
/** 지금 보이는 근무지(검색·사업으로 좁힌 결과)가 모두 골라져 있는가 */
const allVisibleSelected = computed(
  () => filtered.value.length > 0 && filtered.value.every((w) => selected.value.includes(w.id)),
)
/** 보이는 근무지만 한꺼번에 고르거나 푼다 — 다른 사업에서 고른 근무지는 그대로 둔다 */
function toggleVisible() {
  const ids = filtered.value.map((w) => w.id)
  model.value = allVisibleSelected.value
    ? removeAll(selected.value, ids)
    : addAll(selected.value, ids)
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
    <div class="grid gap-2 sm:grid-cols-2">
      <!-- SearchInput 아톰은 폭이 w-64 로 고정이라 모달 폭에 맞춰 같은 모양으로 둔다 -->
      <div class="relative">
        <UIcon
          name="i-lucide-search"
          class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
        />
        <input
          v-model="q"
          placeholder="근무지 이름·주소 검색"
          class="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </div>
      <SelectField
        v-model="programId"
        :options="[
          { label: `사업 전체 (근무지 ${worksites.length}곳)`, value: '' },
          ...programs.map((p) => ({ label: p.name, value: p.id })),
        ]"
      />
    </div>

    <SelectField
      v-if="!multiple"
      v-model="single"
      :options="singleOptions"
      :placeholder="filtered.length ? `근무지 선택 (${filtered.length}곳)` : '조건에 맞는 근무지가 없습니다'"
    />

    <template v-else>
      <div class="flex items-center justify-between">
        <p class="text-xs text-muted">{{ filtered.length }}곳 표시 중</p>
        <button
          v-if="filtered.length"
          type="button"
          class="text-xs font-medium text-brand-500 hover:underline"
          @click="toggleVisible"
        >
          {{ allVisibleSelected ? `표시된 ${filtered.length}곳 선택 해제` : `표시된 ${filtered.length}곳 모두 선택` }}
        </button>
      </div>
      <!-- 높이는 화면에 맞춰 줄어든다 — 모달 안에서 다른 입력칸과 함께 보이도록. 머리글은 스크롤해도 남는다 -->
      <div class="max-h-[min(40vh,28rem)] overflow-y-auto rounded-lg border border-hairline">
        <!-- table-fixed: 열 폭을 아래 colgroup 으로 고정한다. 긴 이름이 줄바꿈되거나 표를 넓히지 않고
             「…」로 잘린다(truncate). 잘린 전체는 title 로 본다 -->
        <table class="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col class="w-10" />
            <col class="w-[45%]" />
            <col />
            <col class="w-36" />
          </colgroup>
          <thead class="sticky top-0 z-10 bg-surface-soft text-left text-xs font-semibold text-muted">
            <tr>
              <th class="w-10 px-3 py-2"><span class="sr-only">선택</span></th>
              <th class="px-3 py-2">근무지</th>
              <th class="px-3 py-2">사업</th>
              <th class="px-3 py-2">비고</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!filtered.length">
              <td colspan="4" class="px-3 py-6 text-center text-muted">조건에 맞는 근무지가 없습니다.</td>
            </tr>
            <!-- 행 어디를 눌러도 고른다. 체크박스는 표시만 한다(pointer-events-none) — 체크박스와 행이
                 함께 받으면 한 번 눌러 두 번 토글된다 -->
            <tr
              v-for="w in filtered"
              :key="w.id"
              class="cursor-pointer border-t border-hairline-soft transition-colors"
              :class="selected.includes(w.id) ? 'bg-brand-soft' : 'hover:bg-surface-soft'"
              @click="toggle(w.id)"
            >
              <td class="px-3 py-2">
                <Checkbox :model-value="selected.includes(w.id)" class="pointer-events-none" />
              </td>
              <td class="truncate px-3 py-2 font-medium text-ink" :title="label(w)">{{ label(w) }}</td>
              <td class="truncate px-3 py-2 text-muted" :title="programName(w.program_id)">
                {{ programName(w.program_id) || '—' }}
              </td>
              <td class="truncate px-3 py-2 text-xs text-muted" :title="isTaken?.(w) ? '다른 담당자 지정됨' : undefined">
                {{ isTaken?.(w) ? '다른 담당자 지정됨' : '' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-if="selectedWorksites.length"
        class="flex max-h-24 flex-wrap items-center gap-1.5 overflow-y-auto"
      >
        <span class="text-sm text-muted">선택 {{ selectedWorksites.length }}곳</span>
        <Tag v-for="w in selectedWorksites" :key="w.id">{{ w.name }}</Tag>
      </div>
    </template>
  </div>
</template>
