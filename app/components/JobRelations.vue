<!-- 공고 상세 하단 — 해당 공고의 조회·관심·전화확인·공유·추천 기록 (job_id 필터) -->
<script setup lang="ts">
const props = defineProps<{ jobId: string }>()
const api = useAdminApi()

interface Section {
  table: string
  title: string
  idCol: string // 대상 사용자/종사자 id 컬럼
  timeCol: string
  extraCol?: string // 추가 표시 컬럼 (예: 공유 채널)
}

const sections: Section[] = [
  { table: 'job_views', title: '조회', idCol: 'user_id', timeCol: 'viewed_at' },
  { table: 'bookmarks', title: '관심', idCol: 'user_id', timeCol: 'created_at' },
  { table: 'job_contact_views', title: '전화확인', idCol: 'user_id', timeCol: 'viewed_at' },
  { table: 'job_shares', title: '공유', idCol: 'user_id', timeCol: 'created_at', extraCol: 'channel' },
  { table: 'job_recommendations', title: '추천', idCol: 'worker_id', timeCol: 'created_at' },
]

const data = ref<Record<string, { rows: Record<string, any>[]; total: number }>>({})
const loading = ref(true)

function fmtTime(v: unknown): string {
  if (!v) return '—'
  return String(v).replace('T', ' ').slice(0, 19)
}

// ── 수동 추천 ──
const showRec = ref(false)
const search = ref('')
const results = ref<Record<string, any>[]>([])
const searching = ref(false)
const recMsg = ref('')

async function searchWorkers() {
  searching.value = true
  try {
    const res = await api.list('users', { q: search.value, pageSize: 10, sort: 'updated_at', dir: 'desc' })
    results.value = res.rows
  } catch {
    results.value = []
  }
  searching.value = false
}

async function recommend(workerId: string) {
  recMsg.value = ''
  try {
    const r = await api.action('recommend-job', { jobId: props.jobId, workerId })
    recMsg.value = r?.duplicated ? '이미 추천된 종사자입니다.' : '추천 완료 — 종사자에게 알림이 전송됩니다.'
    const res = await api.list('job_recommendations', { f: 'job_id', op: 'eq', v: props.jobId, pageSize: 1 })
    if (data.value['job_recommendations']) data.value['job_recommendations']!.total = res.total
  } catch (e: any) {
    recMsg.value = '추천 실패: ' + (e?.data?.statusMessage || e?.message || '오류')
  }
}

onMounted(async () => {
  await Promise.all(
    sections.map(async (s) => {
      try {
        const res = await api.list(s.table, {
          f: 'job_id',
          op: 'eq',
          v: props.jobId,
          sort: s.timeCol,
          dir: 'desc',
          pageSize: 100,
        })
        data.value[s.table] = { rows: res.rows, total: res.total }
      } catch {
        data.value[s.table] = { rows: [], total: 0 }
      }
    }),
  )
  loading.value = false
})
</script>

<template>
  <div class="space-y-6">
    <!-- 액션 -->
    <div class="flex justify-end">
      <AppButton icon="i-lucide-send" @click="showRec = true">종사자에게 추천</AppButton>
    </div>

    <!-- 요약 카운트 -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div
        v-for="s in sections"
        :key="s.table"
        class="flex flex-col gap-1.5 rounded-2xl border border-hairline bg-white p-4 text-center"
      >
        <span class="text-xs font-medium text-muted">{{ s.title }}</span>
        <span class="text-[22px] leading-none font-medium tabular-nums text-ink">
          {{ loading ? '…' : (data[s.table]?.total ?? 0) }}
        </span>
      </div>
    </div>

    <!-- 섹션별 목록 -->
    <AppCard v-for="s in sections" :key="s.table">
      <template #header>
        <h3 class="text-[15px] font-semibold text-ink">{{ s.title }}</h3>
        <Tag>{{ data[s.table]?.total ?? 0 }}건</Tag>
      </template>

      <AppSpinner v-if="loading" size="sm" label="불러오는 중…" />
      <p v-else-if="!data[s.table]?.rows.length" class="py-6 text-center text-sm text-muted-soft">
        기록이 없습니다.
      </p>
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr>
              <th class="w-12 pr-3 pb-2.5 text-left text-[13px] font-semibold whitespace-nowrap text-muted">No.</th>
              <th class="pr-3 pb-2.5 text-left text-[13px] font-semibold whitespace-nowrap text-muted">대상</th>
              <th v-if="s.extraCol" class="pr-3 pb-2.5 text-left text-[13px] font-semibold whitespace-nowrap text-muted">{{ s.extraCol }}</th>
              <th class="pr-3 pb-2.5 text-left text-[13px] font-semibold whitespace-nowrap text-muted">시각</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in data[s.table]!.rows" :key="i">
              <td class="border-t border-hairline-soft py-2.5 pr-3 text-sm tabular-nums text-muted-soft">{{ i + 1 }}</td>
              <td class="border-t border-hairline-soft py-2.5 pr-3 text-sm">
                <NuxtLink
                  v-if="row[s.idCol]"
                  :to="`/users/${encodeURIComponent(row[s.idCol])}`"
                  class="font-medium text-brand-500 hover:underline"
                >
                  {{ row[s.idCol] }}
                </NuxtLink>
                <span v-else class="text-muted-soft">비회원</span>
              </td>
              <td v-if="s.extraCol" class="border-t border-hairline-soft py-2.5 pr-3 text-sm text-body">{{ row[s.extraCol] ?? '—' }}</td>
              <td class="border-t border-hairline-soft py-2.5 pr-3 text-sm whitespace-nowrap text-body">{{ fmtTime(row[s.timeCol]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AppCard>

    <!-- 수동 추천 모달 -->
    <AppModal v-model:open="showRec" title="종사자에게 공고 추천" width="max-w-lg">
      <div class="space-y-4">
        <div class="flex gap-2">
          <TextField
            v-model="search"
            placeholder="이름·전화·직종 검색"
            class="flex-1"
            @keyup.enter="!searching && searchWorkers()"
          />
          <AppButton :loading="searching" @click="searchWorkers">검색</AppButton>
        </div>

        <p v-if="recMsg" class="rounded-lg bg-brand-soft px-3.5 py-2.5 text-sm text-brand-500">
          {{ recMsg }}
        </p>

        <div v-if="results.length" class="max-h-80 divide-y divide-hairline-soft overflow-y-auto">
          <div v-for="w in results" :key="w.id" class="flex items-center justify-between gap-3 py-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-ink">{{ w.name || w.id }}</p>
              <p class="truncate text-sm text-muted">{{ w.phone }} · {{ w.job_type }}</p>
            </div>
            <AppButton size="sm" variant="soft" @click="recommend(w.id)">추천</AppButton>
          </div>
        </div>
        <p v-else-if="!searching" class="py-6 text-center text-sm text-muted-soft">
          검색해 종사자를 선택하세요.
        </p>
      </div>
    </AppModal>
  </div>
</template>
