<!-- 대시보드 — 핵심 지표(KPI) + 테이블별 총 건수 카드 -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { TABLE_LIST } from '#shared/tables'

const api = useAdminApi()
const { setHeader } = useAdminHeader()
setHeader('대시보드')

const counts = ref<Record<string, number | null>>({})
const loading = ref(true)

const kpi = ref<Record<string, number> | null>(null)
const kpiCards: { key: string; label: string; tone?: 'ink' | 'up' | 'down' }[] = [
  { key: 'workersTotal', label: '종사자' },
  { key: 'jobSeekers', label: '구직중', tone: 'up' },
  { key: 'resumesTotal', label: '이력서' },
  { key: 'jobsActive', label: '활성 공고' },
  { key: 'recommendationsToday', label: '오늘 추천' },
  { key: 'sharesToday', label: '오늘 공유' },
  { key: 'contactViewsToday', label: '오늘 연락확인' },
  { key: 'unreadRecommendations', label: '미읽음 추천', tone: 'down' },
]

const tables = TABLE_LIST.filter((t) => !t.hideInNav)

onMounted(async () => {
  api
    .statsSummary()
    .then((res) => (kpi.value = res))
    .catch(() => (kpi.value = null))
  await Promise.all(
    tables.map(async (t) => {
      try {
        const res = await api.list(t.name, { page: 1, pageSize: 1 })
        counts.value[t.name] = res.total
      } catch {
        counts.value[t.name] = null
      }
    }),
  )
  loading.value = false
})
</script>

<template>
  <div class="space-y-8">
    <!-- 핵심 지표 -->
    <section>
      <h2 class="mb-4 text-[18px] font-semibold text-ink">핵심 지표</h2>
      <div class="grid grid-cols-2 gap-6 md:grid-cols-4">
        <StatCard
          v-for="c in kpiCards"
          :key="c.key"
          :label="c.label"
          :value="kpi ? (kpi[c.key] ?? 0).toLocaleString() : '…'"
          :tone="c.tone ?? 'ink'"
        />
      </div>
    </section>

    <!-- 테이블 바로가기 -->
    <section>
      <h2 class="mb-4 text-[18px] font-semibold text-ink">테이블</h2>
      <div class="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
        <NuxtLink v-for="t in tables" :key="t.name" :to="`/${t.name}`" class="group">
          <div class="flex flex-col gap-2.5 rounded-[24px] border border-hairline bg-white p-6 transition-colors group-hover:border-brand-300">
            <span class="text-sm font-medium text-muted">{{ t.label }}</span>
            <span class="text-[28px] leading-none font-medium tabular-nums text-ink">
              <template v-if="loading">…</template>
              <span v-else-if="counts[t.name] === null" class="text-down">오류</span>
              <template v-else>{{ counts[t.name]?.toLocaleString() }}</template>
            </span>
          </div>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
