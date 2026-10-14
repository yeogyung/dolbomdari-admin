<!-- 상세 하단 기록 카드 — 제목·건수 태그와 번호 붙은 표(열마다 문구·링크 지정) -->
<script setup lang="ts">
export interface RelationColumn {
  label: string
  text: (row: Record<string, any>) => string
  /** 주면 이 열은 링크로 그린다 */
  to?: (row: Record<string, any>) => string
  nowrap?: boolean
}

defineProps<{
  title: string
  loading: boolean
  total: number
  rows: Record<string, any>[]
  columns: RelationColumn[]
}>()
</script>

<template>
  <AppCard>
    <template #header>
      <h3 class="text-[15px] font-semibold text-ink">{{ title }}</h3>
      <Tag>{{ loading ? '…' : total }}건</Tag>
    </template>

    <AppSpinner v-if="loading" size="sm" label="불러오는 중…" />
    <p v-else-if="!rows.length" class="py-6 text-center text-sm text-muted-soft">기록이 없습니다.</p>
    <div v-else class="overflow-x-auto">
      <table class="w-full border-collapse">
        <thead>
          <tr>
            <th class="w-12 pr-3 pb-2.5 text-left text-[13px] font-semibold whitespace-nowrap text-muted">No.</th>
            <th
              v-for="c in columns"
              :key="c.label"
              class="pr-3 pb-2.5 text-left text-[13px] font-semibold whitespace-nowrap text-muted"
            >
              {{ c.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in rows" :key="i">
            <td class="border-t border-hairline-soft py-2.5 pr-3 text-sm tabular-nums text-muted-soft">{{ i + 1 }}</td>
            <td
              v-for="c in columns"
              :key="c.label"
              class="border-t border-hairline-soft py-2.5 pr-3 text-sm"
              :class="c.nowrap ? 'whitespace-nowrap text-body' : ''"
            >
              <NuxtLink v-if="c.to" :to="c.to(row)" class="font-medium text-brand-500 hover:underline">
                {{ c.text(row) }}
              </NuxtLink>
              <template v-else>{{ c.text(row) }}</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AppCard>
</template>
