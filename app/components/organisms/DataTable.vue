<!-- 유기체: 데이터 테이블 — 툴바(검색·필터 슬롯) + 정렬 + 체크박스 + 페이지네이션 + N개씩 (시안 W2/W4 기준) -->
<script setup lang="ts">
import type { Column } from '~/types/table'

const props = withDefaults(
  defineProps<{
    columns: Column[]
    rows: Record<string, any>[]
    loading?: boolean
    rowKey?: string
    sortKey?: string
    sortDir?: 'asc' | 'desc'
    page?: number
    pageSize?: number
    total?: number
    pageSizeOptions?: number[]
    selectable?: boolean
    emptyText?: string
  }>(),
  {
    rowKey: 'id',
    page: 1,
    pageSize: 20,
    total: 0,
    pageSizeOptions: () => [20, 50, 100, 200],
    emptyText: '데이터가 없습니다.',
  },
)

const emit = defineEmits<{
  sort: [key: string]
  'update:page': [page: number]
  'update:pageSize': [size: number]
}>()

const rangeStart = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1))
const rangeEnd = computed(() => Math.min(props.page * props.pageSize, props.total))
const lastPage = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))

// 페이지 번호 목록 (양끝 + 현재 주변, 생략은 -1)
const pages = computed<number[]>(() => {
  const last = lastPage.value
  const cur = props.page
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)
  const set = new Set([1, 2, last - 1, last, cur - 1, cur, cur + 1])
  const arr = [...set].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b)
  const out: number[] = []
  let prev = 0
  for (const n of arr) {
    if (prev && n - prev > 1) out.push(-1)
    out.push(n)
    prev = n
  }
  return out
})

function go(p: number) {
  if (p < 1 || p > lastPage.value || p === props.page) return
  emit('update:page', p)
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'boolean') return v ? '✓' : '✗'
  if (typeof v === 'object') return JSON.stringify(v)
  const s = String(v)
  return s.length > 60 ? s.slice(0, 60) + '…' : s
}
</script>

<template>
  <div class="flex flex-1 flex-col gap-5">
    <!-- 툴바 -->
    <div v-if="$slots.toolbar || $slots['toolbar-end']" class="flex flex-wrap items-center gap-3">
      <slot name="toolbar" />
      <div v-if="$slots['toolbar-end']" class="ml-auto flex items-center gap-3">
        <slot name="toolbar-end" />
      </div>
    </div>

    <!-- 카드 -->
    <div class="flex flex-1 flex-col overflow-hidden rounded-[24px] border border-hairline bg-white px-8 pt-2 pb-6 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
      <div class="min-h-0 flex-1 overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr>
              <th v-if="selectable" class="w-11 pr-3 pb-3">
                <span class="block size-[18px] rounded border border-muted-soft" />
              </th>
              <th
                v-for="col in columns"
                :key="col.key"
                class="pr-3 pb-3 text-[13px] font-semibold whitespace-nowrap text-muted"
                :class="col.align === 'right' ? 'text-right' : 'text-left'"
              >
                <button
                  v-if="col.sortable"
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-body"
                  :class="col.align === 'right' ? 'flex-row-reverse' : ''"
                  @click="emit('sort', col.key)"
                >
                  {{ col.label }}
                  <UIcon
                    :name="
                      sortKey === col.key
                        ? sortDir === 'asc'
                          ? 'i-lucide-chevron-up'
                          : 'i-lucide-chevron-down'
                        : 'i-lucide-chevrons-up-down'
                    "
                    class="size-3.5"
                    :class="sortKey === col.key ? 'text-brand-500' : 'text-muted-soft'"
                  />
                </button>
                <span v-else>{{ col.label }}</span>
              </th>
              <th v-if="$slots.actions" class="pr-0 pb-3 text-right text-[13px] font-semibold whitespace-nowrap text-muted">
                관리
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row[rowKey]" class="align-middle">
              <td v-if="selectable" class="border-t border-hairline py-[15px] pr-3">
                <span class="block size-[18px] rounded border border-muted-soft" />
              </td>
              <td
                v-for="col in columns"
                :key="col.key"
                class="border-t border-hairline py-[15px] pr-3 text-[15px] whitespace-nowrap"
                :class="[
                  col.align === 'right' ? 'text-right' : 'text-left',
                  col.strong ? 'font-semibold text-ink' : 'text-body',
                ]"
              >
                <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">{{ fmt(row[col.key]) }}</slot>
              </td>
              <td v-if="$slots.actions" class="border-t border-hairline py-[15px] pr-0 text-right whitespace-nowrap">
                <slot name="actions" :row="row" />
              </td>
            </tr>
          </tbody>
        </table>

        <AppSpinner v-if="loading" label="불러오는 중…" />
        <EmptyState v-else-if="!rows.length" :description="emptyText" />
      </div>

      <!-- 페이지네이션 -->
      <div v-if="total > 0" class="mt-auto flex items-center justify-between pt-5">
        <span class="text-sm text-muted tabular-nums">
          {{ total.toLocaleString() }}건 중 {{ rangeStart }}–{{ rangeEnd }}
        </span>

        <div class="flex items-center gap-1.5">
          <button
            type="button"
            class="flex size-9 items-center justify-center rounded-full border border-hairline text-muted transition-colors hover:bg-surface-soft disabled:opacity-40"
            :disabled="page <= 1"
            @click="go(page - 1)"
          >
            <UIcon name="i-lucide-chevron-left" class="size-4" />
          </button>
          <template v-for="(p, i) in pages" :key="i">
            <span v-if="p === -1" class="flex size-9 items-center justify-center text-sm text-muted">…</span>
            <button
              v-else
              type="button"
              class="flex size-9 items-center justify-center rounded-full text-sm tabular-nums transition-colors"
              :class="p === page ? 'bg-brand-500 font-semibold text-white' : 'font-medium text-body hover:bg-surface-soft'"
              @click="go(p)"
            >
              {{ p }}
            </button>
          </template>
          <button
            type="button"
            class="flex size-9 items-center justify-center rounded-full border border-hairline text-body transition-colors hover:bg-surface-soft disabled:opacity-40"
            :disabled="page >= lastPage"
            @click="go(page + 1)"
          >
            <UIcon name="i-lucide-chevron-right" class="size-4" />
          </button>
        </div>

        <div class="relative">
          <select
            :value="pageSize"
            class="h-9 appearance-none rounded-full border border-hairline bg-white pr-8 pl-4 text-sm font-medium text-body outline-none tabular-nums focus:border-brand-500"
            @change="emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))"
          >
            <option v-for="n in pageSizeOptions" :key="n" :value="n">{{ n }}개씩</option>
          </select>
          <UIcon name="i-lucide-chevron-down" class="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-muted" />
        </div>
      </div>
    </div>
  </div>
</template>
