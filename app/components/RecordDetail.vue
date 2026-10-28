<!-- 구인구직 상세 카드 — 레지스트리 detail 설정대로 머리(제목·id 칩)와 카드 묶음을 그린다 -->
<script setup lang="ts">
import { TABLES, type TableDef } from '#shared/tables'
import { buildDetailView } from '~/utils/recordDetail'
import { RESUME_FIELD_TEXT } from '~/utils/resumeFields'

const props = defineProps<{ def: TableDef; record: Record<string, unknown>; id: string }>()

// 테이블별 칸 문구 — JSON 원문 대신 항목별 줄로 보인다
const FIELD_TEXT: Record<string, Record<string, (value: unknown) => string>> = {
  resumes: RESUME_FIELD_TEXT,
}

const view = computed(() => buildDetailView(props.def, props.record, TABLES, FIELD_TEXT[props.def.name]))
</script>

<template>
  <div class="space-y-6">
    <div v-if="view.title !== null" class="flex items-center gap-2">
      <h2 class="text-[20px] font-bold text-ink">{{ view.title }}</h2>
      <Tag class="font-mono tabular-nums">{{ id }}</Tag>
    </div>

    <AppCard v-for="card in view.cards" :key="card.title" padding="none">
      <template #header>
        <h2 class="text-[18px] font-semibold text-ink">{{ card.title }}</h2>
        <span v-if="card.count !== undefined" class="text-sm text-muted tabular-nums">{{ card.count }}개 항목</span>
      </template>
      <!-- 2열에서는 divide-y 가 칸 단위로 안 그려져 칸마다 border-b 를 준다.
           마지막 줄은 2칸일 수 있어 last: 로 못 지운다 — pb 로 카드 테두리와 떼어 겹선을 막는다 -->
      <dl class="grid grid-cols-1 px-6 pb-4 md:grid-flow-row-dense md:grid-cols-2 md:gap-x-8">
        <div
          v-for="e in card.entries"
          :key="e.key"
          class="grid grid-cols-[8rem_1fr] gap-4 border-b border-hairline-soft py-3.5 text-sm"
          :class="{ 'md:col-span-2': e.wide }"
        >
          <dt class="font-medium text-muted">{{ e.label }}</dt>
          <dd class="min-w-0 break-words whitespace-pre-wrap text-body">
            <NuxtLink v-if="e.to" :to="e.to" class="font-medium text-brand-500 hover:underline">{{ e.text }}</NuxtLink>
            <template v-else>{{ e.text }}</template>
          </dd>
        </div>
      </dl>
    </AppCard>
  </div>
</template>
