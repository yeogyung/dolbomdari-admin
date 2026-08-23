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
  <div class="space-y-4">
    <!-- 액션 -->
    <div class="flex justify-end">
      <UButton icon="i-lucide-send" color="primary" @click="showRec = true">
        종사자에게 추천
      </UButton>
    </div>

    <!-- 요약 카운트 -->
    <div class="grid grid-cols-5 gap-2">
      <div v-for="s in sections" :key="s.table" class="rounded-lg border border-gray-200 p-3 text-center">
        <div class="text-xs text-gray-500">{{ s.title }}</div>
        <div class="text-lg font-semibold">{{ loading ? '…' : (data[s.table]?.total ?? 0) }}</div>
      </div>
    </div>

    <!-- 섹션별 목록 -->
    <UCard v-for="s in sections" :key="s.table">
      <template #header>
        <div class="flex items-center gap-2">
          <span class="font-semibold">{{ s.title }}</span>
          <span class="text-sm text-gray-400">{{ data[s.table]?.total ?? 0 }}건</span>
        </div>
      </template>

      <Spinner v-if="loading" label="불러오는 중…" />
      <p v-else-if="!data[s.table]?.rows.length" class="py-4 text-center text-sm text-gray-400">
        기록이 없습니다.
      </p>
      <table v-else class="min-w-full text-sm">
        <thead class="text-left text-gray-500">
          <tr>
            <th class="w-12 py-1.5 font-medium">No.</th>
            <th class="py-1.5 font-medium">대상</th>
            <th v-if="s.extraCol" class="py-1.5 font-medium">{{ s.extraCol }}</th>
            <th class="py-1.5 font-medium">시각</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="(row, i) in data[s.table]!.rows" :key="i">
            <td class="py-1.5 text-gray-400">{{ i + 1 }}</td>
            <td class="py-1.5">
              <NuxtLink
                v-if="row[s.idCol]"
                :to="`/users/${encodeURIComponent(row[s.idCol])}`"
                class="text-primary-600 hover:underline"
              >
                {{ row[s.idCol] }}
              </NuxtLink>
              <span v-else class="text-gray-400">비회원</span>
            </td>
            <td v-if="s.extraCol" class="py-1.5 text-gray-600">{{ row[s.extraCol] ?? '—' }}</td>
            <td class="py-1.5 text-gray-600">{{ fmtTime(row[s.timeCol]) }}</td>
          </tr>
        </tbody>
      </table>
    </UCard>

    <!-- 수동 추천 모달 -->
    <UModal v-model:open="showRec" title="종사자에게 공고 추천">
      <template #body>
        <div class="space-y-3">
          <div class="flex gap-2">
            <UInput
              v-model="search"
              placeholder="이름·전화·직종 검색"
              class="flex-1"
              @keyup.enter="searchWorkers"
            />
            <UButton :loading="searching" @click="searchWorkers">검색</UButton>
          </div>
          <p v-if="recMsg" class="text-sm text-primary-600">{{ recMsg }}</p>
          <div v-if="results.length" class="max-h-80 divide-y divide-gray-100 overflow-y-auto">
            <div v-for="w in results" :key="w.id" class="flex items-center justify-between py-2 text-sm">
              <div>
                <div class="font-medium">{{ w.name || w.id }}</div>
                <div class="text-gray-500">{{ w.phone }} · {{ w.job_type }}</div>
              </div>
              <UButton size="xs" variant="soft" @click="recommend(w.id)">추천</UButton>
            </div>
          </div>
          <p v-else-if="!searching" class="py-4 text-center text-sm text-gray-400">
            검색해 종사자를 선택하세요.
          </p>
        </div>
      </template>
    </UModal>
  </div>
</template>
