<!-- 대시보드 하단 날씨 — 근무지 검색·선택 + 3일(오늘·내일·모레) × 0~23시 가로 표 -->
<script setup lang="ts">
// 주 용도는 담당자가 예보를 보고 그날 근무를 쉬게 할지 판단하는 것이다(2026-10-22 사용자 결정).
// 그래서 비·눈 칸을 파랗게 칠하고, 날짜 칸에 최저·최고와 비·눈 시간대를 붙인다.
//
// **근무지 범위는 RLS 가 정한다.** `dbo_worksites` 의 `dbo_can_read_worksite` 가 master 는 전부,
// 담당자는 맡은 곳, 수요처는 자기 근무지 한 곳만 준다 — 셀렉터 범위와 정확히 같다.
// 예보(`dbo_weather_forecasts`)는 로그인 사용자 누구나 읽는다. 서버 API 를 거치지 않는다.
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { DaySummary, ForecastRow, HourSlot, WeatherKind } from '~/utils/weather'
import { searchByName } from '~/utils/nameSearch'
import { useDebounced } from '~/composables/useDebounced'
import { alertHeadline } from '~/utils/holidays'

/** `sub` 는 사업 이름 — 같은 이름의 근무지가 여러 사업에 있어(서대문시니어클럽 6곳 등) 이것으로 구별한다 */
type Site = { id: string; name: string; grid_nx: number; grid_ny: number; sub: string | null }

const supabase = useSupabase()

const sites = ref<Site[]>([])
const selectedId = ref<string | null>(null)
const q = ref('')
const slots = ref<HourSlot[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const selected = computed(() => sites.value.find((s) => s.id === selectedId.value) ?? null)
/** 고를 곳이 둘 이상일 때만 검색·선택을 보인다(수요처, 한 곳만 맡은 담당자는 이름만) */
const choosable = computed(() => sites.value.length > 1)
/** 이름이 겹치는 근무지 이름 — 셀렉트·부제목에서만 사업 이름을 붙여 구별한다 */
const duplicateNames = computed(() => {
  const seen = new Map<string, number>()
  for (const s of sites.value) seen.set(s.name, (seen.get(s.name) ?? 0) + 1)
  return new Set([...seen].filter(([, n]) => n > 1).map(([name]) => name))
})
const siteLabel = (s: Site) => (duplicateNames.value.has(s.name) && s.sub ? `${s.name} (${s.sub})` : s.name)

/** 오른쪽 셀렉트는 언제나 범위 안 전체. 좁혀 찾기는 왼쪽 검색칸 목록이 맡는다 */
const options = computed(() => sites.value.map((s) => ({ label: siteLabel(s), value: s.id })))

/*
 * 근무지 검색 — 입력이 250ms 멈추면 입력칸 아래에 결과 목록을 띄운다.
 * 띄어쓰기·대소문자를 무시하고, 이름이 검색어로 시작하는 곳을 앞에 둔다(`utils/nameSearch.ts`).
 * ↑↓ 로 옮기고 Enter 로 고른다. Esc·바깥 클릭으로 닫는다.
 */
const term = useDebounced(q, 250)
const found = computed(() => searchByName(sites.value, term.value, 8))
const listOpen = ref(false)
const activeIndex = ref(0)
const showList = computed(() => listOpen.value && term.value.trim() !== '')
watch(term, () => {
  activeIndex.value = 0
})

/*
 * 카드가 대시보드 맨 아래라 화면 아래쪽에서 목록이 열리면 잘린다. 열릴 때 목록이 다 보이도록
 * 필요한 만큼만 스크롤하고, ↑↓ 로 옮기면 고른 줄이 목록 안에서 보이게 따라간다.
 */
const resultsEl = ref<HTMLElement | null>(null)
watch(showList, async (open) => {
  if (!open) return
  await nextTick()
  resultsEl.value?.scrollIntoView({ block: 'nearest' })
})
watch(activeIndex, async (i) => {
  await nextTick()
  document.getElementById(`weather-site-${i}`)?.scrollIntoView({ block: 'nearest' })
})

function onSearchKey(e: KeyboardEvent) {
  const n = found.value.items.length
  if (e.key === 'ArrowDown' && n) {
    e.preventDefault()
    listOpen.value = true
    activeIndex.value = (activeIndex.value + 1) % n
  } else if (e.key === 'ArrowUp' && n) {
    e.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + n) % n
  } else if (e.key === 'Enter') {
    // 디바운스 전에 Enter 를 눌러도 지금 입력값으로 고른다
    const hit = searchByName(sites.value, q.value, 8).items[term.value === q.value ? activeIndex.value : 0]
    if (hit) pickSite(hit.id)
  } else if (e.key === 'Escape') {
    listOpen.value = false
  }
}

function pickSite(id: string) {
  selectedId.value = id
  q.value = ''
  listOpen.value = false
}

const DAYS = 3
const dates = ref<string[]>(seoulDates(DAYS))
const today = computed(() => dates.value[0]!)
const nowHour = ref(currentSeoulHour())

function currentSeoulHour() {
  return new Date(Date.now() + 9 * 3600_000).getUTCHours()
}

/** 같은 격자를 10분 안에 다시 부르지 않는다. 예보는 3시간마다 바뀐다 */
const cache = new Map<string, { at: number; rows: Promise<ForecastRow[]> }>()

function fetchRows(site: Site): Promise<ForecastRow[]> {
  // 날짜를 키에 넣는다 — 자정을 넘기면 받는 범위(오늘 0시부터)가 달라진다
  const key = `${site.grid_nx},${site.grid_ny},${dates.value[0]}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.rows
  // 오늘 0시(서울)부터 3일. 지난 시간도 흐리게 보여 주므로 오늘 0시부터 받는다
  const from = new Date(`${dates.value[0]}T00:00:00+09:00`).toISOString()
  const to = new Date(Date.parse(from) + DAYS * 86_400_000).toISOString()
  const rows = (async () => {
    const { data, error: e } = await supabase
      .from('dbo_weather_forecasts')
      .select('fcst_at, category, value')
      .eq('nx', site.grid_nx)
      .eq('ny', site.grid_ny)
      .in('category', ['TMP', 'SKY', 'PTY', 'POP'])
      .gte('fcst_at', from)
      .lt('fcst_at', to)
      .order('fcst_at')
    if (e) throw e
    return (data ?? []) as ForecastRow[]
  })()
  const entry = { at: Date.now(), rows }
  cache.set(key, entry)
  rows.catch(() => {
    if (cache.get(key) === entry) cache.delete(key)
  })
  return rows
}

let sequence = 0
/** 마지막으로 예보를 받은 시각. 띄워 둔 채 10분이 지나면 다시 받는다 */
let loadedAt = 0
async function loadForecast() {
  const site = selected.value
  if (!site) return
  const current = ++sequence
  loading.value = true
  error.value = null
  dates.value = seoulDates(DAYS)
  nowHour.value = currentSeoulHour()
  try {
    const rows = await fetchRows(site)
    if (current !== sequence) return
    slots.value = buildHourly(rows)
    loadedAt = Date.now()
  } catch (e) {
    if (current !== sequence) return
    console.error('[WeatherCard] 예보 조회 실패:', e)
    error.value = '날씨를 불러오지 못했습니다.'
    slots.value = []
  } finally {
    if (current === sequence) loading.value = false
  }
}

watch(selectedId, loadForecast)

/*
 * 대시보드는 몇 시간씩 띄워 둔다. 1분마다 지금 시각을 맞추고, 날짜가 바뀌었거나 받은 지
 * 10분이 지났으면 다시 받는다 — 지금 시각 테두리·지난 시간 흐림·「오늘」이 낡지 않게.
 */
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    nowHour.value = currentSeoulHour()
    const dayChanged = seoulDates(1)[0] !== dates.value[0]
    if (selected.value && (dayChanged || Date.now() - loadedAt > 10 * 60_000)) loadForecast()
  }, 60_000)
})
onUnmounted(() => clearInterval(timer))

/*
 * 내일 폭염·한파인 근무지가 남아 있으면 「휴무 관리」로 가는 띠를 띄운다(2026-10-27). 판정은 서버가 한다.
 * 대시보드의 부가 정보라 실패하면 띠를 그리지 않고 로그만 남긴다 — 날씨 표는 그대로 보인다.
 */
const holidayAlert = ref<{ date: string; title: string; detail: string; count: number } | null>(null)
onMounted(async () => {
  try {
    const o = await useDboApp().holidayOverview()
    const h = alertHeadline(o)
    holidayAlert.value = h ? { date: o.date, title: h.title, detail: h.detail, count: h.count } : null
  } catch (e) {
    console.error('[WeatherCard] 휴무 판정 조회 실패', e)
  }
})

onMounted(async () => {
  const { data, error: e } = await supabase
    .from('dbo_worksites')
    .select('id, name, grid_nx, grid_ny, program:dbo_programs(name)')
    .not('grid_nx', 'is', null)
    .not('grid_ny', 'is', null)
    // 크론이 활동 근무지 격자만 모은다. 종료된 곳은 예보가 영영 없어 고를 이유가 없다
    .eq('status', 'active')
    .order('name')
  if (e) {
    console.error('[WeatherCard] 근무지 조회 실패:', e)
    error.value = '근무지를 불러오지 못했습니다.'
    loading.value = false
    return
  }
  type Row = Omit<Site, 'sub'> & { program: { name: string } | { name: string }[] | null }
  sites.value = ((data ?? []) as unknown as Row[]).map(({ program, ...rest }) => ({
    ...rest,
    // 임베드는 객체로도 배열로도 온다
    sub: (Array.isArray(program) ? program[0]?.name : program?.name) ?? null,
  }))
  // 기본은 범위 안 이름순 첫 근무지 — 담당자는 맡은 곳, master 는 전체 가운데 첫 곳
  selectedId.value = sites.value[0]?.id ?? null
  if (!selectedId.value) loading.value = false
})

const rows = computed(() =>
  dates.value.map((date) => ({
    date,
    name: dayName(date, today.value),
    summary: daySummaries(
      slots.value.filter((s) => s.date === date),
      today.value,
    )[0] as DaySummary | undefined,
    cells: hourRow(slots.value, date),
  })),
)
const hasAny = computed(() => slots.value.length > 0)

const ICON: Record<WeatherKind, { name: string; cls: string }> = {
  clear: { name: 'i-lucide-sun', cls: 'text-accent' },
  'clear-night': { name: 'i-lucide-moon', cls: 'text-body' },
  partly: { name: 'i-lucide-cloud-sun', cls: 'text-muted-soft' },
  cloudy: { name: 'i-lucide-cloud', cls: 'text-muted-soft' },
  rain: { name: 'i-lucide-cloud-rain', cls: 'text-brand-500' },
  shower: { name: 'i-lucide-cloud-drizzle', cls: 'text-brand-500' },
  sleet: { name: 'i-lucide-cloud-snow', cls: 'text-brand-300' },
  snow: { name: 'i-lucide-cloud-snow', cls: 'text-brand-300' },
}

const isPast = (date: string, hour: number) => date === today.value && hour < nowHour.value
const isNow = (date: string, hour: number) => date === today.value && hour === nowHour.value
const cellTitle = (s: HourSlot) =>
  `${s.hour}시 ${weatherLabel(s.kind)} ${s.temp}°${s.pop !== null ? ` · 강수 확률 ${s.pop}%` : ''}`
</script>

<template>
  <section>
    <NuxtLink
      v-if="holidayAlert"
      :to="{ path: '/senior/holidays', query: { date: holidayAlert.date } }"
      class="mb-4 flex items-center justify-between gap-3 rounded-lg bg-down-soft px-4 py-3 text-sm text-down hover:opacity-90"
    >
      <span>
        <span class="font-semibold">{{ holidayAlert.title }}</span>
        · {{ holidayAlert.detail }} · 근무지 {{ holidayAlert.count }}곳
      </span>
      <span class="shrink-0 font-medium">휴무 관리 →</span>
    </NuxtLink>
    <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-[18px] font-semibold text-ink">날씨</h2>
        <p class="mt-0.5 text-sm text-muted">
          {{ selected ? siteLabel(selected) : '근무지' }} · 기상청 단기예보, 3시간마다 갱신
        </p>
      </div>
      <div v-if="choosable" class="flex flex-wrap items-center gap-2">
        <!-- 검색 — 결과는 입력칸 바로 아래 목록. 목록 클릭은 mousedown 에서 막아 blur 보다 먼저 고른다 -->
        <div class="relative w-64 max-w-full">
          <UIcon
            name="i-lucide-search"
            class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
          />
          <input
            v-model="q"
            type="search"
            role="combobox"
            aria-label="근무지 검색"
            aria-autocomplete="list"
            aria-controls="weather-site-results"
            :aria-expanded="showList"
            :aria-activedescendant="showList && found.items.length ? `weather-site-${activeIndex}` : undefined"
            placeholder="근무지 검색"
            autocomplete="off"
            class="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            @input="listOpen = true"
            @focus="listOpen = true"
            @blur="listOpen = false"
            @keydown="onSearchKey"
          />
          <ul
            v-if="showList"
            id="weather-site-results"
            ref="resultsEl"
            role="listbox"
            class="absolute top-full right-0 left-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-hairline bg-canvas py-1 shadow-lg"
          >
            <li
              v-for="(site, i) in found.items"
              :id="`weather-site-${i}`"
              :key="site.id"
              role="option"
              :aria-selected="i === activeIndex"
              class="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm"
              :class="i === activeIndex ? 'bg-brand-50 text-ink' : 'text-body hover:bg-surface-soft'"
              @mousedown.prevent="pickSite(site.id)"
              @mouseenter="activeIndex = i"
            >
              <span class="min-w-0">
                <span class="block truncate">{{ site.name }}</span>
                <span v-if="site.sub" class="block truncate text-xs text-muted">{{ site.sub }}</span>
              </span>
              <UIcon v-if="site.id === selectedId" name="i-lucide-check" class="size-4 shrink-0 text-brand-500" />
            </li>
            <li v-if="found.items.length === 0" class="px-3 py-2 text-sm text-muted">검색 결과가 없습니다.</li>
            <li v-else-if="found.more" class="px-3 py-1.5 text-xs text-muted">외 {{ found.more }}곳 — 이름을 더 입력해 주세요</li>
          </ul>
        </div>
        <SelectField v-model="selectedId" :options="options" class="w-56" />
      </div>
    </div>

    <AppCard>
      <div v-if="loading" class="py-10 text-center text-sm text-muted">날씨를 불러오는 중…</div>
      <div v-else-if="error" class="py-10 text-center text-sm text-down">{{ error }}</div>
      <div v-else-if="!selected" class="py-10 text-center text-sm text-muted">
        날씨를 볼 수 있는 근무지가 없습니다.
      </div>
      <div v-else-if="!hasAny" class="py-10 text-center text-sm text-muted">
        이 근무지의 날씨 예보가 아직 없습니다.
      </div>
      <template v-else>
        <div class="overflow-x-auto">
          <table class="w-full border-separate border-spacing-0 text-center text-sm">
            <thead>
              <tr>
                <th scope="col" class="sticky left-0 z-10 min-w-40 bg-canvas px-3 py-2 text-left font-medium text-muted">날짜</th>
                <th v-for="h in 24" :key="h" scope="col" class="min-w-14 px-1 py-2 font-medium text-muted tabular-nums">
                  {{ h - 1 }}시
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.date">
                <!-- 날짜 칸은 고정 — 가로로 넘겨도 무슨 날인지 보인다 -->
                <th
                  scope="row"
                  class="sticky left-0 z-10 border-t border-hairline-soft bg-canvas px-3 py-2 text-left align-middle font-normal"
                >
                  <p class="font-semibold text-ink">{{ row.name }}</p>
                  <template v-if="row.summary">
                    <p class="text-xs text-body tabular-nums">{{ row.summary.min }}° / {{ row.summary.max }}°</p>
                    <p class="text-xs" :class="row.summary.wetHours.length ? 'font-medium text-brand-500' : 'text-muted'">
                      {{ wetHoursLabel(row.summary.wetHours) }}
                    </p>
                  </template>
                  <p v-else class="text-xs text-muted">예보 없음</p>
                </th>
                <td
                  v-for="(cell, h) in row.cells"
                  :key="h"
                  class="border-t border-hairline-soft px-1 py-2 align-middle"
                  :class="[
                    cell && isWet(cell) ? 'bg-brand-50' : '',
                    isPast(row.date, h) ? 'opacity-40' : '',
                    isNow(row.date, h) ? 'rounded-md ring-2 ring-brand-500 ring-inset' : '',
                  ]"
                  :title="cell ? cellTitle(cell) : undefined"
                >
                  <template v-if="cell">
                    <UIcon :name="ICON[cell.kind].name" class="mx-auto size-5" :class="ICON[cell.kind].cls" aria-hidden="true" />
                    <span class="sr-only">{{ weatherLabel(cell.kind) }}</span>
                    <p class="mt-0.5 font-medium text-ink tabular-nums">{{ cell.temp }}°</p>
                    <p class="text-xs tabular-nums" :class="isWet(cell) ? 'text-brand-500' : 'text-muted'">
                      {{ cell.pop !== null ? `${cell.pop}%` : '' }}
                    </p>
                  </template>
                  <span v-else class="text-muted-soft">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="mt-3 text-xs text-muted">
          파란 칸은 비·눈이 오거나 강수 확률이 30% 이상인 시간입니다. 지금 시각은 테두리로 표시합니다.
        </p>
      </template>
    </AppCard>
  </section>
</template>
