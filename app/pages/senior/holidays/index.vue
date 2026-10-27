<!-- 휴무 관리 — 날짜별 날씨 판정과 근무지 휴무 지정·취소 (앱 API dbo /holidays, master·담당자) -->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  cancelNotice,
  channelLabel,
  contactCount,
  createNotice,
  filterWorksites,
  holidayErrorOf,
  hoursLabel,
  hitHours,
  nextDate,
  rainLabel,
  shortDate,
  sinceLabel,
  type HolidayContacts,
  type HolidayKind,
  type HolidayOverview,
  type HolidayWorksite,
} from '~/utils/holidays'

// 판정은 서버가 한다(폭염 30도 이상인 시각 · 한파 이틀 연속 영하 10도 이하 · 비 6~19시 시간당 10mm
// 이상, 근무지 구역 특보가 발효 중이어도 같은 조건).
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
/**
 * 지정·취소 뒤 직접 알릴 분. `aborted` 면 알림 단계가 멈춰 대상자 전원이다. `contacts` 가 null 이면
 * 서버가 명단을 못 읽었다. 날짜를 바꾸면 지운다
 */
const reach = ref<{ contacts: HolidayContacts | null; aborted: boolean } | null>(null)
/** 명단을 싣기 전 서버는 `contacts` 가 없다 — 빈 명단(그릴 것 없음). null 은 못 읽음이라 그대로 */
const contactsOf = (c: HolidayContacts | null | undefined) => (c === undefined ? [] : c)
const showReach = computed(
  () => !!reach.value && (reach.value.contacts === null || contactCount(reach.value.contacts) > 0),
)

/** 지정은 누른 순간 화면에 그려진 날짜(`overview.date`)를 싣는다 — 날짜를 바꾸는 사이 다른 날로 나가지 않게 */
type Ask =
  | { kind: 'create'; date: string; ids: string[]; people: number }
  | { kind: 'cancel'; site: HolidayWorksite }
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
  reach.value = null
  // 이전 날짜의 목록·버튼을 남겨 두지 않는다 — 새 목록이 오기 전에 누르면 다른 날짜가 지정된다
  overview.value = null
  void load()
})
onMounted(() => load())

const weather = computed(() => overview.value?.weather[0] ?? null)
/** 특보를 싣기 전 서버(2026-10-27 이전 배포)는 `warnings` 가 없다 */
const warnings = computed(() => weather.value?.warnings ?? [])
const KIND_NAME: Record<HolidayKind, string> = { heat: '폭염', cold: '한파', rain: '비' }
const FORECAST_TITLE: Record<HolidayKind, string> = {
  heat: '폭염 조건 — 30도 이상인 시각이 있습니다',
  cold: '한파 조건 — 이틀 연속 영하 10도 이하입니다',
  rain: '비 조건 — 시간당 10mm 이상 오는 시각이 있습니다',
}
/** 특보만으로 조건이 된 날은 특보를 말한다 — 앱 휴무 화면(`conditionTitle`)과 같은 규칙 */
const weatherTitle = computed(() => {
  const w = weather.value
  const kind = w?.kind ?? null
  if (!w || kind === null) {
    return w?.days.length
      ? '폭염·한파·비 조건이 아닙니다. 직접 휴무를 정할 수 있습니다.'
      : '예보가 없는 날입니다. 직접 휴무를 정할 수 있습니다.'
  }
  const warning = warnings.value.find((x) => x.kind === kind)
  const day = w.days.find((d) => d.date === overview.value?.date)
  const byForecast =
    kind === 'heat'
      ? !!day && day.high >= 30
      : kind === 'cold'
        ? w.days.length >= 2
        : !!day && day.hours.some((h) => h.hit)
  // 모르는 종류(서버가 새로 더한)는 「조건 아님」으로도, 다른 조건으로도 말하지 않는다
  if (!KIND_NAME[kind]) return '날씨 조건이 있습니다. 직접 휴무를 정할 수 있습니다.'
  if (warning && !byForecast) return `${KIND_NAME[kind]} 조건 — ${warning.zone} ${warning.name} 발효 중입니다`
  return FORECAST_TITLE[kind]
})
// 폭염 빨강 · 한파 파랑 · 비 노랑(accent, 글자는 검정 — 흰 글자는 대비가 모자라다)
const TITLE_CLS: Record<HolidayKind, string> = { heat: 'text-down', cold: 'text-brand-500', rain: 'text-ink' }
const ICON: Record<HolidayKind, { name: string; cls: string }> = {
  heat: { name: 'i-lucide-thermometer-sun', cls: '' },
  cold: { name: 'i-lucide-snowflake', cls: '' },
  rain: { name: 'i-lucide-cloud-rain', cls: 'text-accent' },
}
const HIT_CLS: Record<HolidayKind, string> = {
  heat: 'bg-down text-white',
  cold: 'bg-brand-500 text-white',
  rain: 'bg-accent text-ink',
}
const BADGE: Record<Exclude<HolidayKind, 'rain'>, 'red' | 'blue'> = { heat: 'red', cold: 'blue' }

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

const REASON: Record<string, string> = { heat: '폭염', cold: '한파', rain: '비', manual: '직접 지정' }

async function run() {
  const current = ask.value
  if (!current) return
  busy.value = true
  reach.value = null
  try {
    if (current.kind === 'create') {
      const r = await app.createHolidays(current.date, current.ids)
      const warn = r.push.aborted || r.push.failed > 0
      // 알림 도달 수는 담당자가 직접 연락할지 정하는 근거라 저절로 사라지지 않게 둔다
      toast.add({ title: '휴무 지정', description: createNotice(r), color: warn ? 'warning' : 'success', duration: 0 })
      reach.value = { contacts: contactsOf(r.contacts), aborted: r.push.aborted }
      selected.value = new Set()
    } else {
      const r = await app.cancelHoliday(current.site.holiday!.id)
      const push = r?.push ?? { pushed: 0, failed: 0, aborted: true }
      reach.value = { contacts: contactsOf(r?.contacts), aborted: push.aborted }
      const warn = push.aborted || push.failed > 0
      toast.add({
        title: '휴무 취소',
        description: cancelNotice(current.site.name, current.site.people, push),
        color: warn ? 'warning' : 'success',
        duration: 0,
      })
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

    <!-- 지정·취소 뒤 직접 알릴 분 — 앱 알림을 못 받거나 이번 알림이 실패한 시니어를 근무지별로.
         다시 읽기가 실패해도 남도록 판정·목록 분기 밖에 둔다 -->
    <AppCard v-if="reach && showReach">
      <template v-if="reach.contacts === null">
        <h2 class="text-base font-semibold text-ink">직접 알릴 분 명단을 불러오지 못했습니다.</h2>
        <p class="mt-1 text-sm text-body">앱 알림을 못 받는 분께는 직접 알려 주세요.</p>
      </template>
      <template v-else>
        <h2 class="text-base font-semibold text-ink">직접 알릴 분 {{ contactCount(reach.contacts) }}명</h2>
        <p class="mt-1 text-sm text-body">
          {{ reach.aborted ? '알림을 보내지 못했습니다. 전화로 알려 주세요.' : '앱 알림을 못 받는 분입니다. 전화로 알려 주세요.' }}
        </p>
        <div v-for="g in reach.contacts" :key="g.worksiteId" class="mt-3">
          <p class="mb-1 text-xs text-muted">{{ g.worksite }}</p>
          <ul class="divide-y divide-hairline-soft">
            <li v-for="p in g.people" :key="p.directoryId" class="flex items-center gap-3 py-2">
              <span class="min-w-0 flex-1 truncate text-sm text-ink">{{ p.name }}</span>
              <span class="w-28 text-xs text-body">{{ channelLabel(p.channel) }}</span>
              <a v-if="p.phone" :href="`tel:${p.phone}`" class="w-32 text-right text-sm text-brand-500 tabular-nums">{{ p.phone }}</a>
              <span v-else class="w-32 text-right text-sm text-muted">전화번호 없음</span>
            </li>
          </ul>
        </div>
      </template>
    </AppCard>

    <div v-if="loading && !overview" class="py-10 text-center text-sm text-muted">불러오는 중…</div>
    <AppCard v-else-if="error">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-down">{{ error }}</p>
        <AppButton size="sm" variant="outline" color="neutral" @click="load()">다시 시도</AppButton>
      </div>
    </AppCard>

    <template v-else-if="overview">
      <!-- 판정 — 기준을 넘은 시각을 칠한다(폭염 빨강 · 한파 파랑 · 비 노랑) -->
      <AppCard>
        <p
          class="flex items-center gap-2 text-sm font-semibold"
          :class="weather?.kind ? TITLE_CLS[weather.kind] : 'text-body'"
        >
          <UIcon
            :name="weather?.kind ? ICON[weather.kind].name : 'i-lucide-info'"
            class="size-4"
            :class="weather?.kind ? ICON[weather.kind].cls : ''"
          />
          {{ weatherTitle }}
        </p>
        <p v-for="w in warnings" :key="`${w.areaCode}:${w.name}`" class="mt-2 flex items-center gap-1 text-xs text-body">
          <UIcon name="i-lucide-triangle-alert" class="size-3.5" />
          {{ w.zone }} {{ w.name }}<template v-if="sinceLabel(w.since)"> · {{ sinceLabel(w.since) }}부터</template>
        </p>
        <div v-for="d in weather?.days ?? []" :key="d.date" class="mt-3">
          <p class="mb-1 text-xs text-body">
            {{ d.date === today ? '오늘 ' : '' }}{{ shortDate(d.date) }} · 최저 {{ d.low }}° / 최고 {{ d.high }}°
            <span v-if="hitHours(d).length" class="ml-1 font-medium">· {{ hoursLabel(hitHours(d)) }}</span>
            <span v-if="weather?.kind === 'rain'" class="ml-1">· 칸은 시간당 강수량(mm)</span>
          </p>
          <div class="overflow-x-auto">
            <div class="flex gap-1">
              <div
                v-for="h in d.hours"
                :key="h.hour"
                class="min-w-12 rounded-md px-1 py-1 text-center text-xs tabular-nums"
                :class="h.hit && weather?.kind ? HIT_CLS[weather.kind] : 'bg-surface-soft text-body'"
              >
                <p>{{ h.hour }}시</p>
                <p class="text-sm font-medium" :class="h.hit ? '' : 'text-ink'">
                  {{ weather?.kind === 'rain' ? rainLabel(h.rain) : `${h.temp}°` }}
                </p>
              </div>
            </div>
          </div>
        </div>
        <p class="mt-3 text-xs text-muted">
          폭염: 30도 이상인 시각이 있는 날 · 한파: 이틀 연속 영하 10도 이하 · 비: 6~19시에 시간당 10mm 이상 오는 날(기상청
          단기예보).
          <!-- 특보를 못 봤으면 특보까지 확인한 것처럼 읽히는 기준 문장 대신 그렇다고 말한다 -->
          {{
            overview.warningsStale
              ? '기상특보를 지금 확인하지 못해 예보로만 판정했습니다.'
              : '근무지 구역에 폭염·한파·호우 특보가 발효 중이어도 같은 조건입니다.'
          }}
        </p>
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
            <!-- 비는 StatusBadge 노랑(text-accent)이 옅은 면 위에서 대비가 모자라 글자만 검정으로 그린다 -->
            <span
              v-if="s.alert === 'rain'"
              class="inline-flex items-center rounded-full bg-[#fdf6e3] px-2.5 py-1.5 text-xs leading-none font-semibold whitespace-nowrap text-ink"
            >
              비
            </span>
            <StatusBadge v-else-if="s.alert && s.alert in BADGE" :tone="BADGE[s.alert as keyof typeof BADGE]">
              {{ KIND_NAME[s.alert] }}
            </StatusBadge>
            <span class="w-20 text-right text-sm text-body tabular-nums">근무 {{ s.people }}명</span>
          </li>
        </ul>

        <div v-if="openAll.length && overview.editable" class="mt-4 flex justify-end">
          <AppButton
            :disabled="picked.length === 0 || busy"
            @click="ask = { kind: 'create', date: overview.date, ids: picked.map((s) => s.id), people: picked.reduce((n, s) => n + s.people, 0) }"
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
          : ask?.kind === 'create'
            ? `${shortDate(ask.date)} ${ask.ids.length}곳을 휴무로 정할까요?`
            : ''
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
