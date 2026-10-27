<!-- 휴무 관리 — 날짜별 날씨 판정과 근무지 휴무 지정·취소 (앱 API dbo /holidays, master·담당자) -->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  filterWorksites,
  holidayErrorOf,
  hoursLabel,
  hitHours,
  nextDate,
  shortDate,
  type HolidayOverview,
  type HolidayWorksite,
} from '~/utils/holidays'

// 판정은 서버가 한다(폭염 30도 이상인 시각 · 한파 이틀 연속 영하 10도 이하, 기온 기준).
// 범위도 서버가 정한다 — master 는 전 근무지, 담당자는 맡은 근무지만. 어드민은 공지 발송처럼
// 앱 API(dbo)를 그대로 부른다(`useDboApp`). 지정·취소하면 그날 근무가 있는 시니어에게 앱 알림이 간다.
const app = useDboApp()
const toast = useToast()
const route = useRoute()
const router = useRouter()
useAdminHeader().setHeader('휴무 관리')

const today = todaySeoul()
const initial = typeof route.query.date === 'string' ? route.query.date : nextDate(today)
const date = ref<string | null>(initial)
const overview = ref<HolidayOverview | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const q = ref('')
const selected = ref(new Set<string>())
const busy = ref(false)

type Ask = { kind: 'create'; ids: string[]; people: number } | { kind: 'cancel'; site: HolidayWorksite }
const ask = ref<Ask | null>(null)
const askOpen = computed({
  get: () => ask.value !== null,
  set: (v: boolean) => {
    if (!v) ask.value = null
  },
})

/** 조회 순번 — 날짜를 빠르게 바꾸면 늦게 온 이전 응답이 새 결과를 덮지 않게 한다 */
let sequence = 0
async function load(keepSelection = false) {
  if (!date.value) return
  const current = ++sequence
  loading.value = true
  error.value = null
  try {
    const o = await app.holidayOverview(date.value)
    if (current !== sequence) return
    overview.value = o
    // 조건이 있는 날은 조건 근무지를 미리 고른다. 조건이 없는 날은 직접 고른다
    if (!keepSelection) {
      selected.value = new Set(o.worksites.filter((s) => !s.holiday && s.alert).map((s) => s.id))
    }
  } catch (e) {
    if (current !== sequence) return
    console.error('[holidays] 조회 실패', e)
    // 실패를 빈 목록으로 그리지 않는다 — 「근무 없음」으로 읽힌다
    overview.value = null
    error.value = holidayErrorOf(e)
  } finally {
    if (current === sequence) loading.value = false
  }
}

watch(date, (d) => {
  if (!d) return
  void router.replace({ query: { ...route.query, date: d } })
  q.value = ''
  void load()
})
onMounted(() => load())

const weather = computed(() => overview.value?.weather[0] ?? null)
const weatherTitle = computed(() => {
  const w = weather.value
  if (w?.kind === 'heat') return '폭염 조건 — 30도 이상인 시각이 있습니다'
  if (w?.kind === 'cold') return '한파 조건 — 이틀 연속 영하 10도 이하입니다'
  if (w?.days.length) return '폭염·한파 조건이 아닙니다. 직접 휴무를 정할 수 있습니다.'
  return '예보가 없는 날입니다. 직접 휴무를 정할 수 있습니다.'
})

const openAll = computed(() => (overview.value?.worksites ?? []).filter((s) => !s.holiday))
/** 조건 근무지를 먼저 */
const open = computed(() =>
  filterWorksites(openAll.value, q.value).sort((a, b) => Number(!!b.alert) - Number(!!a.alert)),
)
const closed = computed(() => (overview.value?.worksites ?? []).filter((s) => s.holiday))
const picked = computed(() => openAll.value.filter((s) => selected.value.has(s.id)))
const allVisiblePicked = computed(
  () => open.value.length > 0 && open.value.every((s) => selected.value.has(s.id)),
)

function toggle(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

/** 보이는(검색된) 근무지만 한꺼번에 고르거나 푼다 */
function toggleVisible() {
  const next = new Set(selected.value)
  const all = allVisiblePicked.value
  for (const s of open.value) {
    if (all) next.delete(s.id)
    else next.add(s.id)
  }
  selected.value = next
}

const REASON: Record<string, string> = { heat: '폭염', cold: '한파', manual: '직접 지정' }

async function run() {
  const current = ask.value
  if (!current || !date.value) return
  busy.value = true
  try {
    if (current.kind === 'create') {
      const r = await app.createHolidays(date.value, current.ids)
      const parts = [`${r.created.length}곳을 휴무로 정했습니다.`]
      if (r.skipped.length) parts.push(`${r.skipped.length}곳은 이미 휴무였습니다.`)
      if (r.push.failed) parts.push(`앱 알림 ${r.push.failed}건을 보내지 못했습니다.`)
      toast.add({ title: '휴무 지정', description: parts.join(' '), color: r.push.failed ? 'warning' : 'success' })
      selected.value = new Set()
    } else {
      await app.cancelHoliday(current.site.holiday!.id)
      toast.add({ title: '휴무 취소', description: `${current.site.name} 휴무를 취소했습니다.`, color: 'success' })
    }
  } catch (e) {
    console.error('[holidays] 처리 실패', e)
    toast.add({ title: '처리하지 못했습니다', description: holidayErrorOf(e), color: 'error' })
  } finally {
    busy.value = false
    ask.value = null
    // 성공이든 실패든 서버 상태로 다시 그린다 — 닿았는지 모르는 실패도 있다
    void load(true)
  }
}
</script>

<template>
  <div class="space-y-5">
    <AppCard>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="mb-1 text-sm font-medium text-ink">날짜</p>
          <DateField v-model="date" :min="nextDate(today)" class="w-48" />
          <p class="mt-1 text-xs text-muted">내일부터 지정·취소할 수 있습니다.</p>
        </div>
        <div v-if="overview?.upcoming.length" class="min-w-0 flex-1">
          <p class="mb-1 text-sm font-medium text-ink">앞으로의 휴무</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="u in overview.upcoming"
              :key="u.date"
              type="button"
              class="rounded-full border px-3 py-1 text-sm"
              :class="u.date === date ? 'border-brand-500 bg-brand-soft text-brand-500' : 'border-hairline text-body hover:bg-surface-soft'"
              @click="date = u.date"
            >
              {{ shortDate(u.date) }} · {{ u.worksites }}곳
            </button>
          </div>
        </div>
      </div>
    </AppCard>

    <div v-if="loading && !overview" class="py-10 text-center text-sm text-muted">불러오는 중…</div>
    <AppCard v-else-if="error">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-down">{{ error }}</p>
        <AppButton size="sm" variant="outline" color="neutral" @click="load()">다시 시도</AppButton>
      </div>
    </AppCard>

    <template v-else-if="overview">
      <!-- 판정 — 기준을 넘은 시각을 칠한다(폭염 빨강 · 한파 파랑) -->
      <AppCard>
        <p
          class="flex items-center gap-2 text-sm font-semibold"
          :class="weather?.kind === 'heat' ? 'text-down' : weather?.kind === 'cold' ? 'text-brand-500' : 'text-body'"
        >
          <UIcon
            :name="weather?.kind === 'heat' ? 'i-lucide-thermometer-sun' : weather?.kind === 'cold' ? 'i-lucide-snowflake' : 'i-lucide-info'"
            class="size-4"
          />
          {{ weatherTitle }}
        </p>
        <div v-for="d in weather?.days ?? []" :key="d.date" class="mt-3">
          <p class="mb-1 text-xs text-body">
            {{ d.date === today ? '오늘 ' : '' }}{{ shortDate(d.date) }} · 최저 {{ d.low }}° / 최고 {{ d.high }}°
            <span v-if="hitHours(d).length" class="ml-1 font-medium">· {{ hoursLabel(hitHours(d)) }}</span>
          </p>
          <div class="overflow-x-auto">
            <div class="flex gap-1">
              <div
                v-for="h in d.hours"
                :key="h.hour"
                class="min-w-12 rounded-md px-1 py-1 text-center text-xs tabular-nums"
                :class="
                  h.hit
                    ? weather?.kind === 'cold'
                      ? 'bg-brand-500 text-white'
                      : 'bg-down text-white'
                    : 'bg-surface-soft text-body'
                "
              >
                <p>{{ h.hour }}시</p>
                <p class="text-sm font-medium" :class="h.hit ? 'text-white' : 'text-ink'">{{ h.temp }}°</p>
              </div>
            </div>
          </div>
        </div>
        <p class="mt-3 text-xs text-muted">폭염: 30도 이상인 시각이 있는 날 · 한파: 이틀 연속 영하 10도 이하(기온, 기상청 단기예보)</p>
      </AppCard>

      <!-- 근무가 그대로인 근무지 -->
      <AppCard>
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-base font-semibold text-ink">
            근무 예정 {{ openAll.length }}곳
            <span class="ml-1 text-sm font-normal text-muted">{{ picked.length }}곳 선택</span>
          </h2>
          <div class="flex items-center gap-2">
            <SearchInput v-model="q" placeholder="근무지·사업 검색" class="w-56" />
            <AppButton size="sm" variant="ghost" color="neutral" :disabled="open.length === 0" @click="toggleVisible">
              {{ allVisiblePicked ? '보이는 곳 해제' : '보이는 곳 선택' }}
            </AppButton>
          </div>
        </div>

        <EmptyState
          v-if="openAll.length === 0"
          icon="i-lucide-calendar-check"
          :title="closed.length ? '모든 근무지가 휴무입니다.' : '이날 근무가 있는 근무지가 없습니다.'"
        />
        <p v-else-if="open.length === 0" class="py-6 text-center text-sm text-muted">검색 결과가 없습니다.</p>
        <ul v-else class="divide-y divide-hairline-soft">
          <li v-for="s in open" :key="s.id" class="flex items-center gap-3 py-2.5">
            <Checkbox
              :model-value="selected.has(s.id)"
              :aria-label="`${s.name} 선택`"
              @update:model-value="toggle(s.id)"
            />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm text-ink">{{ s.name }}</p>
              <p v-if="s.program" class="truncate text-xs text-muted">{{ s.program }}</p>
            </div>
            <StatusBadge v-if="s.alert" :tone="s.alert === 'heat' ? 'red' : 'blue'">
              {{ s.alert === 'heat' ? '폭염' : '한파' }}
            </StatusBadge>
            <span class="w-20 text-right text-sm text-body tabular-nums">근무 {{ s.people }}명</span>
          </li>
        </ul>

        <div v-if="openAll.length && overview.editable" class="mt-4 flex justify-end">
          <AppButton
            :disabled="picked.length === 0 || busy"
            @click="ask = { kind: 'create', ids: picked.map((s) => s.id), people: picked.reduce((n, s) => n + s.people, 0) }"
          >
            {{ shortDate(overview.date) }} {{ picked.length }}곳 휴무 지정
          </AppButton>
        </div>
        <p v-else-if="!overview.editable" class="mt-4 text-right text-sm text-muted">오늘과 지난 날은 바꿀 수 없습니다.</p>
      </AppCard>

      <!-- 휴무로 정한 근무지 -->
      <AppCard v-if="closed.length">
        <h2 class="mb-3 text-base font-semibold text-ink">휴무 지정됨 {{ closed.length }}곳</h2>
        <ul class="divide-y divide-hairline-soft">
          <li v-for="s in closed" :key="s.id" class="flex items-center gap-3 py-2.5">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm text-ink">{{ s.name }}</p>
              <p v-if="s.program" class="truncate text-xs text-muted">{{ s.program }}</p>
            </div>
            <StatusBadge tone="gray">{{ REASON[s.holiday!.reason] }}</StatusBadge>
            <span class="w-20 text-right text-sm text-body tabular-nums">시니어 {{ s.people }}명</span>
            <AppButton
              v-if="overview.editable"
              size="sm"
              variant="outline"
              color="neutral"
              :disabled="busy"
              @click="ask = { kind: 'cancel', site: s }"
            >
              휴무 취소
            </AppButton>
          </li>
        </ul>
      </AppCard>
    </template>

    <AppModal
      v-model:open="askOpen"
      :title="
        ask?.kind === 'cancel'
          ? `${ask.site.name} 휴무를 취소할까요?`
          : `${overview ? shortDate(overview.date) : ''} ${ask?.kind === 'create' ? ask.ids.length : 0}곳을 휴무로 정할까요?`
      "
      width="max-w-md"
    >
      <div class="space-y-2 text-sm text-body">
        <p v-if="ask?.kind === 'cancel'">시니어 {{ ask.site.people }}명의 근무가 원래대로 돌아갑니다.</p>
        <p v-else-if="ask?.kind === 'create'">시니어 {{ ask.people }}명의 근무가 휴무로 바뀌고 그날 출석 알림이 가지 않습니다.</p>
        <p class="text-muted">앱 알림을 켠 시니어에게 알림이 갑니다. 문자는 나가지 않습니다.</p>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" :disabled="busy" @click="askOpen = false">닫기</AppButton>
        <AppButton size="sm" :loading="busy" @click="run">
          {{ ask?.kind === 'cancel' ? '휴무 취소' : '휴무 지정' }}
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>
