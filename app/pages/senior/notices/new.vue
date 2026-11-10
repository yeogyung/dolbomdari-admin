<!-- 공지 작성 — 근무지·유형·제목·내용을 골라 발송한다(앱 API POST /dbo/notices, QA 2026-10-14 15번) -->
<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import type { Program, Worksite } from '~/types/dbo'
import {
  BODY_MAX,
  NOTICE_IMAGE_ACCEPT,
  NOTICE_IMAGE_BUCKET,
  NOTICE_LEVELS,
  NOTICE_PEOPLE_MAX,
  TITLE_MAX,
  excludedNote,
  noticeImagePath,
  peopleCountFailure,
  peopleRecipientText,
  pickNoticeImage,
  isMissingRoute,
  recipientCountPlan,
  recipientSummary,
  recipientTotalSummary,
  withoutPushNote,
  type NoticeLevel,
  type PeopleCountFailure,
  type RecipientMode,
} from '~/utils/noticeCompose'
import { noticePeople, type PickPerson } from '~/utils/personPick'

const api = useDboAdmin()
const app = useDboApp()
const supabase = useSupabase()
/**
 * 담당자도 쓴다(QA 2026-11-07 MGR-01). 근무지 목록은 서버가 맡은 곳으로 좁히고, 사업 목록은 master 전용이라 읽지 않는다.
 * 개인 받는 사람은 RLS 로 읽히는 시니어(맡은 근무지에 배정된 분)다 — 발송도 서버가 같은 범위로 본다
 */
const isManager = computed(() => useAdminRole().me.value?.role === 'manager')
const toast = useToast()
useAdminHeader().setHeader('공지 작성', [{ label: '공지·미열람 관리', to: '/senior/notices' }])

const worksites = ref<Worksite[]>([])
const programs = ref<Program[]>([])
const refsLoading = ref(true)
const worksiteIds = ref<string[]>([])
const level = ref<NoticeLevel>('simple')
const title = ref('')
const body = ref('')
const sending = ref(false)
const confirmOpen = ref(false)
const error = ref('')
// 화면이 열릴 때 한 번 만든다. 응답이 끊겨 다시 눌러도 서버가 같은 공지로 묶는다
const requestId = crypto.randomUUID()

/*
 * 받는 사람 「근무지/개인」(QA 2026-11-02 ANOTICE-03, 결정 S1). 한 공지는 둘 중 하나다 — 개인이면 근무지는 싣지 않는다.
 * 두 쪽의 선택은 따로 남는다(바꿨다 돌아와도 그대로).
 */
const RECIPIENT_MODES: { value: RecipientMode; label: string }[] = [
  { value: 'worksite', label: '근무지' },
  { value: 'person', label: '개인' },
]
const mode = ref<RecipientMode>('worksite')
const directoryIds = ref<string[]>([])
const target = computed(() =>
  mode.value === 'person' ? { worksiteIds: [], directoryIds: directoryIds.value } : { worksiteIds: worksiteIds.value },
)
/**
 * 개인 공지를 모르는 서버다(받는 사람 수가 404·400 이었거나 발송이 400 bad_request). 이 화면에서는 개인 발송을 막는다 —
 * 옛 서버는 개인 칸을 버리고 근무지가 없다고 거절하므로 아무에게도 가지 않지만, 누를 때마다 같은 실패를 보게 된다
 */
const peopleUnsupported = ref(false)

const canSubmit = computed(
  () =>
    canSubmitNotice({ ...target.value, title: title.value, body: body.value }) &&
    !(mode.value === 'person' && peopleUnsupported.value),
)
const levelLabel = computed(() => NOTICE_LEVELS.find((l) => l.value === level.value)!.label)

/*
 * 받는 사람 수(QA 2026-11-02 ANOTICE-02). 고른 근무지를 **한 번에** 센다(`recipientTotal`, 서버 2026-11-04) — 두 곳
 * 이상에 배정된 분은 한 번만 센다(발송과 같다). 그 길이 없는 옛 서버(404)거나 100곳을 넘으면 예전처럼 근무지마다
 * 세어 「최대」로 적는다(`recipientCountPlan`).
 */
/** 한 번에 세는 길이 없는 서버다. 한 번 404 를 받으면 이 화면에서는 근무지마다 센다 */
const totalRouteMissing = ref(false)
/** 한 번에 센 수. undefined 면 오는 중, null 이면 못 셌다 */
const recipientTotal = ref<number | null | undefined>(undefined)
/** 그중 앱으로 못 받는 분(결정 D5). 값의 뜻은 recipientTotal 과 같다 */
const recipientWithoutPush = ref<number | null | undefined>(undefined)
/** 선택이 바뀔 때마다 올린다 — 늦게 온 앞 선택의 응답이 지금 수를 덮지 않게 */
let totalSequence = 0
let totalTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(totalTimer))
function countTotal(ids: string[]) {
  const current = totalSequence
  const list = [...ids]
  recipientTotal.value = undefined
  recipientWithoutPush.value = undefined
  // 근무지를 연달아 누르면 멈춘 뒤 한 번만 센다
  totalTimer = setTimeout(() => {
    app
      .recipientTotal(list)
      .then((r) => {
        if (current !== totalSequence) return
        recipientTotal.value = r.total
        recipientWithoutPush.value = r.withoutPush
      })
      .catch((e) => {
        if (current !== totalSequence) return
        recipientWithoutPush.value = null
        if (!isMissingRoute(e)) {
          recipientTotal.value = null
          return
        }
        totalRouteMissing.value = true
        countEach(worksiteIds.value)
      })
  }, 250)
}

/**
 * 근무지별 받는 사람 수(옛 서버·100곳 초과). 한 번 센 근무지는 기억해 두고, 새로 고른 곳만 센다.
 * 값이 undefined 면 오는 중, null 이면 못 셌다.
 */
const recipientCounts = ref(new Map<string, number | null | undefined>())
/**
 * 세야 할 근무지 줄. **동시에 `COUNT_CONCURRENCY` 개까지만** 보낸다 — 「전체 선택」으로 수백 곳을 고르면 요청이
 * 한꺼번에 몰리고, 요청마다 서버가 배정을 처음부터 훑는다.
 */
const countQueue: string[] = []
let counting = 0
const COUNT_CONCURRENCY = 4
function pumpCounts() {
  while (counting < COUNT_CONCURRENCY && countQueue.length > 0) {
    const id = countQueue.shift()!
    // 줄에 있는 사이에 선택을 풀었으면 세지 않는다
    if (!worksiteIds.value.includes(id)) {
      recipientCounts.value.delete(id)
      continue
    }
    counting++
    app
      .recipientCount(id)
      .then((r) => recipientCounts.value.set(id, r.total))
      .catch(() => recipientCounts.value.set(id, null))
      .finally(() => {
        counting--
        pumpCounts()
      })
  }
}
function countEach(ids: string[]) {
  // 선택을 푼 근무지의 실패는 지운다 — 다시 고르면 다시 센다
  for (const id of [...recipientCounts.value.keys()]) {
    if (!ids.includes(id) && recipientCounts.value.get(id) === null) recipientCounts.value.delete(id)
  }
  for (const id of ids) {
    if (recipientCounts.value.has(id)) continue
    recipientCounts.value.set(id, undefined)
    countQueue.push(id)
  }
  pumpCounts()
}
watch(
  worksiteIds,
  (ids) => {
    // 앞 선택의 한 번에 세기는 버린다
    clearTimeout(totalTimer)
    totalSequence++
    const plan = recipientCountPlan(ids.length, totalRouteMissing.value)
    if (plan === 'total') countTotal(ids)
    else if (plan === 'each') countEach(ids)
  },
  { deep: true },
)

/*
 * 개인 받는 사람 명단 — 활성 시니어 전부(`/dbo-admin/directory`, 서버 상한 100건씩 이어 받는다). 「개인」을 처음 누를 때 읽는다.
 */
const people = ref<PickPerson[]>([])
const peopleLoading = ref(false)
const peopleError = ref('')
let peopleLoaded = false
async function loadPeople() {
  if (peopleLoaded || peopleLoading.value) return
  peopleLoading.value = true
  peopleError.value = ''
  try {
    const rows = isManager.value
      ? await managerSeniors()
      : await fetchAllPages(
        (page, size) => api.listDirectory({ role: 'senior', status: 'active', page, size, sort: 'name' }),
        (d) => d.id,
      )
    people.value = noticePeople(rows)
    peopleLoaded = true
  } catch (e) {
    peopleError.value = dboErrorMessage(e, '명부를 불러오지 못했습니다.')
  } finally {
    peopleLoading.value = false
  }
}
watch(mode, (m) => {
  if (m === 'person') loadPeople()
})
/** 담당자가 읽을 수 있는 활동 중 시니어(RLS `dbo_can_read_directory` — 맡은 근무지에 배정된 분) */
async function managerSeniors() {
  const { data, error: e } = await supabase
    .from('dbo_directory')
    .select('id, name, phone')
    .eq('role', 'senior')
    .eq('status', 'active')
    .order('name')
  if (e) throw e
  return (data ?? []) as { id: string; name: string; phone: string | null }[]
}

/** 개인으로 고른 받는 사람 수. undefined 면 오는 중, null 이면 못 셌다(까닭은 peopleFailure) */
const peopleTotal = ref<number | null | undefined>(undefined)
/** 그중 앱으로 못 받는 분(결정 D5) */
const peopleWithoutPush = ref<number | null | undefined>(undefined)
const peopleFailure = ref<PeopleCountFailure | null>(null)
let peopleSequence = 0
let peopleTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(peopleTimer))
watch(
  [directoryIds, mode],
  ([ids, m]) => {
    // 앞 선택의 세기는 버린다
    clearTimeout(peopleTimer)
    const current = ++peopleSequence
    peopleTotal.value = undefined
    peopleWithoutPush.value = undefined
    peopleFailure.value = null
    if (m !== 'person' || peopleUnsupported.value || ids.length === 0 || ids.length > NOTICE_PEOPLE_MAX) return
    const list = [...ids]
    // 연달아 고르면 멈춘 뒤 한 번만 센다(근무지 세기와 같다)
    peopleTimer = setTimeout(() => {
      app
        .recipientTotalPeople(list)
        .then((r) => {
          if (current !== peopleSequence) return
          peopleTotal.value = r.total
          peopleWithoutPush.value = r.withoutPush
        })
        .catch((e) => {
          if (current !== peopleSequence) return
          const failure = peopleCountFailure(e)
          if (failure === 'unsupported') peopleUnsupported.value = true
          else peopleFailure.value = failure
          peopleTotal.value = null
          peopleWithoutPush.value = null
        })
    }, 250)
  },
  { deep: true },
)

const recipientText = computed(() => {
  if (mode.value === 'person') {
    return peopleRecipientText(
      directoryIds.value.length,
      peopleTotal.value,
      peopleUnsupported.value ? 'unsupported' : peopleFailure.value,
    )
  }
  const ids = worksiteIds.value
  const plan = recipientCountPlan(ids.length, totalRouteMissing.value)
  if (plan === 'none') return null
  if (plan === 'total') return recipientTotalSummary(recipientTotal.value)
  return recipientSummary(ids.map((id) => recipientCounts.value.get(id)))
})

/*
 * 앱으로 못 받는 분(QA 2026-11-07 NOTI-01, 결정 D5) — 문자는 긴급만이라 일반·특별이면 이분들은 받지 못한다. 발송 확인 창에서
 * 눈에 띄게 보인다. 근무지마다 세는 길(옛 서버·100곳 초과)은 두 곳에 배정된 분을 뺄 수 없어 정확한 수가 아니라 적지 않는다
 */
const pushNote = computed(() => {
  if (mode.value === 'person') return withoutPushNote(level.value, peopleWithoutPush.value)
  const plan = recipientCountPlan(worksiteIds.value.length, totalRouteMissing.value)
  return plan === 'total' ? withoutPushNote(level.value, recipientWithoutPush.value) : null
})

onMounted(async () => {
  try {
    const [ws, ps] = await Promise.all([
      api.listAllWorksites(),
      isManager.value ? Promise.resolve({ items: [] as Program[] }) : api.listPrograms(),
    ])
    worksites.value = ws.filter((w) => w.status !== 'ended')
    programs.value = ps.items
  } catch (e) {
    error.value = dboErrorMessage(e)
  } finally {
    refsLoading.value = false
  }
})

/*
 * 사진 한 장(QA 2026-11-02 ANOTICE-01, 결정 S6). 고르면 미리보기만 하고, **보낼 때 올린다** — 고르고 안 보낸 사진이
 * 버킷에 남지 않게. 한 번 올린 경로(`path`)는 다시 보낼 때 그대로 쓴다.
 * 파일은 반응형으로 감싸지 않는다(shallowRef) — 감싼 File 은 올리기에 넘길 수 없다.
 */
const imageInput = ref<HTMLInputElement | null>(null)
const image = shallowRef<{ file: File; url: string; path: string | null } | null>(null)

function clearImage() {
  if (image.value) URL.revokeObjectURL(image.value.url)
  image.value = null
}
onBeforeUnmount(clearImage)

function onPickImage(e: Event) {
  const input = e.target as HTMLInputElement
  const { file, notice } = pickNoticeImage(Array.from(input.files ?? []))
  input.value = ''
  if (notice) toast.add({ title: notice, color: file ? 'warning' : 'error' })
  if (!file) return
  clearImage()
  image.value = { file, url: URL.createObjectURL(file), path: null }
}

/** 고른 사진을 내 폴더에 올리고 경로를 준다. 버킷 정책은 첫 폴더가 로그인한 사람 id 일 때만 받는다 */
async function uploadImage(): Promise<string[]> {
  const img = image.value
  if (!img) return []
  if (img.path) return [img.path]
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('세션이 없습니다.')
  const path = noticeImagePath(session.user.id, img.file.type, crypto.randomUUID())
  if (!path) throw new Error(`올릴 수 없는 사진 종류: ${img.file.type}`)
  const { error: e } = await supabase.storage
    .from(NOTICE_IMAGE_BUCKET)
    .upload(path, img.file, { contentType: img.file.type })
  if (e) throw e
  image.value = { ...img, path }
  return [path]
}

async function send() {
  if (sending.value || !canSubmit.value) return
  sending.value = true
  error.value = ''
  // 확인 창에서 본 값으로 보낸다 — 사진을 올리는 사이 받는 사람·유형을 바꿔도 보낼 공지는 바뀌지 않게
  const sentMode = mode.value
  const draft = { level: level.value, ...target.value, title: title.value, body: body.value, requestId }
  try {
    let imagePaths: string[]
    try {
      imagePaths = await uploadImage()
    } catch (e) {
      console.error('[notices/new] 사진 올리기 실패', e)
      // 공지는 아직 만들지 않았다 — 그대로 다시 보내도 된다
      error.value = '사진을 올리지 못해 공지를 보내지 않았습니다. 잠시 뒤 다시 보내 주세요.'
      confirmOpen.value = false
      return
    }
    const res = await app.createNotice(buildNoticeBody({ ...draft, imagePaths }))
    toast.add({ title: res.duplicate ? '이미 발송된 공지입니다.' : '공지를 발송했습니다.', color: 'success' })
    // 개인 공지에서 고른 사람 중 받지 않은 분(계약 종료 등) — 조용히 빠지지 않게 알린다
    const excluded = excludedNote(res.excluded)
    if (excluded) toast.add({ title: excluded, color: 'warning' })
    await navigateTo(`/senior/notices/${res.id}`)
  } catch (e) {
    error.value = createNoticeErrorMessage(e, sentMode)
    if (sentMode === 'person' && peopleCountFailure(e) === 'unsupported') peopleUnsupported.value = true
    confirmOpen.value = false
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <Teleport to="#admin-topbar-actions">
      <AppButton variant="outline" color="neutral" icon="i-lucide-arrow-left" @click="navigateTo('/senior/notices')">
        목록
      </AppButton>
      <AppButton icon="i-lucide-send" :disabled="!canSubmit" @click="confirmOpen = true">발송</AppButton>
    </Teleport>

    <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>

    <AppCard padding="lg">
      <div class="space-y-5">
        <FormField
          label="받는 사람"
          required
          :hint="
            mode === 'person'
              ? `고른 분에게만 갑니다(${NOTICE_PEOPLE_MAX}명까지). 앱 미연결인 분은 긴급 공지만 문자로 받습니다.`
              : '고른 근무지에 배정된 시니어에게 갑니다.'
          "
        >
          <!-- 근무지/개인 전환 — 아래 「공지 유형」 알약 버튼 모양을 따른다 -->
          <div class="mb-3 flex gap-2" role="group" aria-label="받는 사람 고르는 방법">
            <button
              v-for="m in RECIPIENT_MODES"
              :key="m.value"
              type="button"
              class="rounded-full border px-4 py-1.5 text-sm font-medium transition-colors"
              :class="mode === m.value ? 'border-brand-500 bg-brand-500 text-white' : 'border-hairline text-body hover:bg-surface-soft'"
              :aria-pressed="mode === m.value"
              @click="mode = m.value"
            >
              {{ m.label }}
            </button>
          </div>
          <template v-if="mode === 'worksite'">
            <AppSpinner v-if="refsLoading" label="근무지 불러오는 중…" />
            <WorksitePicker v-else v-model="worksiteIds" :worksites="worksites" :programs="programs" multiple />
          </template>
          <template v-else>
            <AppSpinner v-if="peopleLoading" label="명부 불러오는 중…" />
            <div v-else-if="peopleError" class="flex items-center gap-3">
              <p role="alert" class="text-sm text-red-600">{{ peopleError }}</p>
              <AppButton size="sm" variant="outline" color="neutral" @click="loadPeople">다시 불러오기</AppButton>
            </div>
            <PersonPicker v-else v-model="directoryIds" :people="people" />
          </template>
          <p v-if="recipientText" class="mt-2 text-sm text-body tabular-nums">{{ recipientText }}</p>
          <p v-if="pushNote" class="mt-1 text-sm font-medium tabular-nums" :class="pushNote.tone === 'warning' ? 'text-down' : 'text-muted'">
            {{ pushNote.title }}<template v-if="pushNote.tone === 'warning'"> · 일반·특별 공지는 받지 못합니다</template>
          </p>
        </FormField>
        <FormField label="공지 유형" required>
          <div class="flex gap-2">
            <button
              v-for="l in NOTICE_LEVELS"
              :key="l.value"
              type="button"
              class="rounded-full border px-4 py-1.5 text-sm font-medium transition-colors"
              :class="level === l.value ? 'border-brand-500 bg-brand-500 text-white' : 'border-hairline text-body hover:bg-surface-soft'"
              @click="level = l.value"
            >
              {{ l.label }}
            </button>
          </div>
        </FormField>
        <FormField label="제목" required :hint="`${title.trim().length}/${TITLE_MAX}자`">
          <TextField v-model="title" :maxlength="TITLE_MAX" />
        </FormField>
        <FormField label="내용" required :hint="`${body.trim().length}/${BODY_MAX}자`">
          <AppTextarea v-model="body" :rows="8" :maxlength="BODY_MAX" />
        </FormField>
        <!-- 사진 — 넣기·빼기 버튼은 사업자등록증 등록(OrgDocumentRow)처럼 숨긴 파일 칸을 여는 테두리 버튼 -->
        <FormField label="사진" hint="JPG·PNG·WEBP 한 장, 10MB 까지. 앱 공지에만 붙고 문자에는 붙지 않습니다.">
          <input ref="imageInput" type="file" class="hidden" :accept="NOTICE_IMAGE_ACCEPT" multiple @change="onPickImage" />
          <div v-if="image" class="flex flex-wrap items-start gap-3">
            <img
              :src="image.url"
              alt="넣은 사진 미리보기"
              class="max-h-48 max-w-full rounded-lg border border-hairline object-contain"
            />
            <AppButton size="sm" variant="outline" color="neutral" icon="i-lucide-x" :disabled="sending" @click="clearImage">
              빼기
            </AppButton>
          </div>
          <AppButton
            v-else
            size="sm"
            variant="outline"
            color="neutral"
            icon="i-lucide-image-plus"
            @click="imageInput?.click()"
          >
            사진 넣기
          </AppButton>
        </FormField>
      </div>
    </AppCard>

    <!-- 보내는 중에는 닫지 않는다 — 닫혀도 발송은 계속되어 「취소했다」고 믿게 된다 -->
    <AppModal v-model:open="confirmOpen" title="이대로 보낼까요?" width="max-w-md" :before-close="() => !sending">
      <div class="space-y-2 text-sm text-body">
        <p v-if="mode === 'person'">고른 {{ directoryIds.length }}명에게 {{ levelLabel }} 공지를 보냅니다.</p>
        <p v-else>근무지 {{ worksiteIds.length }}곳에 {{ levelLabel }} 공지를 보냅니다.</p>
        <p v-if="recipientText" class="tabular-nums">{{ recipientText }}</p>
        <!-- 앱으로 못 받는 분(결정 D5) — 일반·특별은 받지 못하므로 경고 상자(출결 삭제 창의 경고 상자 모양), 긴급은 안내 상자 -->
        <div
          v-if="pushNote"
          class="rounded-lg border px-4 py-3"
          :class="pushNote.tone === 'warning' ? 'border-down bg-down-soft text-down' : 'border-hairline bg-surface-soft text-body'"
          :role="pushNote.tone === 'warning' ? 'alert' : undefined"
        >
          <p class="font-semibold tabular-nums">{{ pushNote.title }}</p>
          <p class="mt-0.5">{{ pushNote.detail }}</p>
        </div>
        <p v-if="image">사진 한 장을 함께 붙입니다.</p>
        <p v-if="level === 'urgent'" class="font-medium text-brand-500">
          긴급 공지는 모두에게 문자도 함께 나갑니다. 나간 문자는 회수할 수 없습니다.
        </p>
        <p v-else class="text-muted">문자는 나가지 않고 앱 알림으로만 갑니다.</p>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" :disabled="sending" @click="confirmOpen = false">취소</AppButton>
        <AppButton size="sm" :loading="sending" @click="send">보내기</AppButton>
      </template>
    </AppModal>
  </div>
</template>
