<!-- 사람 고르기 — 이름·연락처로 찾아 여러 명을 고른다(WorksitePicker 모양). 고를 수 없는 사람은 회색으로 둔다 -->
<script setup lang="ts">
import { ref, computed, provide } from 'vue'
import { addAll, removeAll } from '~/utils/worksiteSelection'
import { filterPeople, type PickPerson } from '~/utils/personPick'

// 바깥 FormField 의 라벨 id 를 물려받으면 검색칸 id 가 겹친다 — 끊는다(WorksitePicker 와 같다)
provide('form-field-id', undefined)

const props = defineProps<{
  people: PickPerson[]
  /** 역할 칸을 보인다 — 시니어·담당자·수요처가 섞인 명단(채팅방 참여자) */
  showRole?: boolean
}>()
const model = defineModel<string[]>({ required: true })

const q = ref('')
const filtered = computed(() => filterPeople(props.people, q.value))
const selectable = computed(() => filtered.value.filter((p) => !p.disabled))

function toggle(p: PickPerson) {
  if (p.disabled) return
  model.value = model.value.includes(p.id) ? model.value.filter((x) => x !== p.id) : [...model.value, p.id]
}
/** 지금 보이는 사람 중 고를 수 있는 사람이 모두 골라져 있는가 */
const allVisibleSelected = computed(
  () => selectable.value.length > 0 && selectable.value.every((p) => model.value.includes(p.id)),
)
/** 보이는 사람만 한꺼번에 고르거나 푼다 — 검색 밖에서 고른 사람은 그대로 둔다 */
function toggleVisible() {
  const ids = selectable.value.map((p) => p.id)
  model.value = allVisibleSelected.value ? removeAll(model.value, ids) : addAll(model.value, ids)
}
// 검색으로 안 보여도 고른 사람은 남는다 — 누가 골라져 있는지 따로 보여 준다
const selectedPeople = computed(() => props.people.filter((p) => model.value.includes(p.id)))
const colspan = computed(() => (props.showRole ? 5 : 4))
</script>

<template>
  <div class="space-y-3">
    <!-- SearchInput 아톰은 폭이 w-64 로 고정이라 WorksitePicker 처럼 같은 모양으로 둔다 -->
    <div class="relative">
      <UIcon
        name="i-lucide-search"
        class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
      />
      <input
        v-model="q"
        placeholder="이름·연락처 검색"
        aria-label="이름·연락처 검색"
        class="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
    </div>

    <div class="flex items-center justify-between">
      <p class="text-xs text-muted">{{ filtered.length }}명 표시 중</p>
      <button
        v-if="selectable.length"
        type="button"
        class="text-xs font-medium text-brand-500 hover:underline"
        @click="toggleVisible"
      >
        {{ allVisibleSelected ? `표시된 ${selectable.length}명 선택 해제` : `표시된 ${selectable.length}명 모두 선택` }}
      </button>
    </div>
    <div class="max-h-[min(40vh,28rem)] overflow-y-auto rounded-lg border border-hairline">
      <table class="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col class="w-10" />
          <col class="w-[30%]" />
          <col v-if="showRole" class="w-20" />
          <col />
          <col class="w-36" />
        </colgroup>
        <thead class="sticky top-0 z-10 bg-surface-soft text-left text-xs font-semibold text-muted">
          <tr>
            <th class="w-10 px-3 py-2"><span class="sr-only">선택</span></th>
            <th class="px-3 py-2">이름</th>
            <th v-if="showRole" class="px-3 py-2">구분</th>
            <th class="px-3 py-2">연락처</th>
            <th class="px-3 py-2">비고</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!filtered.length">
            <td :colspan="colspan" class="px-3 py-6 text-center text-muted">조건에 맞는 사람이 없습니다.</td>
          </tr>
          <!-- 행 어디를 눌러도 고른다. 체크박스는 표시만 한다(WorksitePicker 와 같다) -->
          <tr
            v-for="p in filtered"
            :key="p.id"
            class="border-t border-hairline-soft transition-colors"
            :class="
              p.disabled
                ? 'cursor-not-allowed text-muted'
                : model.includes(p.id)
                  ? 'cursor-pointer bg-brand-soft'
                  : 'cursor-pointer hover:bg-surface-soft'
            "
            :aria-disabled="p.disabled || undefined"
            @click="toggle(p)"
          >
            <td class="px-3 py-2">
              <Checkbox
                :model-value="model.includes(p.id)"
                :disabled="p.disabled"
                class="pointer-events-none"
                tabindex="-1"
              />
            </td>
            <td class="truncate px-3 py-2 font-medium" :class="p.disabled ? 'text-muted' : 'text-ink'" :title="p.name">
              {{ p.name }}
            </td>
            <td v-if="showRole" class="truncate px-3 py-2 text-muted">{{ ROLE_LABELS[p.role ?? ''] ?? p.role ?? '—' }}</td>
            <td class="truncate px-3 py-2 text-muted tabular-nums">{{ p.phone ? fmtPhone(p.phone) : '—' }}</td>
            <td
              class="truncate px-3 py-2 text-xs"
              :class="p.alert ? 'font-medium text-down' : p.disabled ? 'text-muted' : 'text-body'"
              :title="p.note ?? undefined"
            >
              {{ p.note ?? '' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="selectedPeople.length" class="flex max-h-24 flex-wrap items-center gap-1.5 overflow-y-auto">
      <span class="text-sm text-muted">선택 {{ selectedPeople.length }}명</span>
      <Tag v-for="p in selectedPeople" :key="p.id">{{ p.name }}</Tag>
    </div>
  </div>
</template>
