<!-- 출퇴근 기록 — 기간·근무지·이름 조회 + 대리 기록 수정 + 엑셀 내보내기 (/dbo-admin/attendance) -->
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { downloadExcel, type ExcelColumn } from '~/utils/excel'
import type { Column } from '~/types/table'
import type { AttendanceChange, AttendanceShift, AttendanceSummary, Program, Worksite } from '~/types/dbo'
import type { AttendanceDisplay } from '~/utils/attendanceState'
import { programFilterAllowed, programFilterOptions, worksiteOutsideProgram } from '~/utils/worksiteFilter'
import { attendanceRowName, bulkEditErrorMessage, bulkEditTargets, canSelectAttendance, type BulkSplit } from '~/utils/attendanceBulk'
import { failureLines, runSequential } from '~/utils/bulkRun'

const api = useDboAdmin()
const { listChangesByShifts } = useAttendanceChanges()
const toast = useToast()
const { setHeader } = useAdminHeader()
const { me } = useAdminRole()
setHeader('출퇴근 기록')

/**
 * 「삭제 기록」 탭은 master 만 본다. 서버도 master 가 아니면 403 이다.
 * 「내 요청」 탭은 수요처만 본다 — 보낸 조정 요청과 처리 결과(QA 2026-11-02 PARTNER-01)
 */
const tab = ref<'records' | 'deletions' | 'requests'>('records')

const rows = ref<AttendanceShift[]>([])
const total = ref(0)
// 검색·기간·근무지·정렬·페이지는 주소에 담는다 — 다른 화면에 다녀와도 조회 조건이 그대로다.
// 검색어·기간은 「조회」를 눌러야 정해지는 칸이라 commit() 때 싣는다
const lq = useListQuery(
  { page: 1, size: 20, q: '', from: todaySeoul(), to: todaySeoul(), program: '', worksite: '', display: '', sort: 'work_date' },
  { committed: ['q', 'from', 'to'] },
)
const page = lq.page
const pageSize = lq.size
const q = lq.q
const from = lq.from
const to = lq.to
const worksiteId = lq.worksite
/**
 * 사업 필터(QA 2026-11-07 ADMIN-04). 서버(`programId`)가 걸러 집계도 같은 조건이다. 사업 목록이 운영관리자 전용이라
 * 담당자·수요처에게는 숨기고 보내지도 않는다 — 주소에 남은 값이 보이지 않는 조건으로 걸리지 않게
 */
const programFilter = lq.program
const canProgram = computed(() => programFilterAllowed(me.value?.role))
const programId = computed(() => (canProgram.value && programFilter.value) || undefined)
/** 표시 상태 필터. 서버가 같은 규칙(dbo_display_state)으로 걸러 페이지·건수가 맞는다 */
const display = lq.display
const sortKey = lq.sort
const loading = ref(false)
const { exporting, startExport, finishExport } = useExcelExport()

const worksites = ref<Worksite[]>([])
const programs = ref<Program[]>([])

const columns: Column[] = [
  { key: 'work_date', label: '근무일', sortable: true, strong: true },
  { key: 'name', label: '이름' },
  { key: 'worksite', label: '근무지' },
  { key: 'planned', label: '예정' },
  { key: 'status', label: '상태' },
  { key: 'started_at', label: '출근' },
  { key: 'ended_at', label: '퇴근' },
  { key: 'worked', label: '근무시간' },
  { key: 'method', label: '기록 방법' },
  // 사람이 고친 흔적. 변경 이력(dbo_attendance_changes)으로 판정한다 — updated_by 는 QR 도 채운다.
  { key: 'edited', label: '수정 이력' },
  { key: 'memo', label: '메모' },
]

/** 조회 순번 — 조건을 빠르게 바꾸면 늦게 온 이전 응답이 새 결과를 덮지 않게 마지막 요청만 반영한다 */
let sequence = 0
/** 목록과 이력을 이 조회로 바꿨으면 true. 실패했거나 더 새 조회에 밀렸으면 false — 목록이 낡은 채다 */
async function load(): Promise<boolean> {
  const current = ++sequence
  loading.value = true
  try {
    const res = await api.listAttendance({
      page: page.value,
      size: pageSize.value,
      q: lq.committedOf('q'),
      sort: sortKey.value,
      from: lq.committedOf('from'),
      to: lq.committedOf('to'),
      worksiteId: worksiteId.value || undefined,
      programId: programId.value,
      display: (display.value || undefined) as AttendanceDisplay | undefined,
      summary: '1',
    })
    if (current !== sequence) return false
    rows.value = res.items
    total.value = res.total
    // 고른 행은 지금 보이는 쪽에서만 유지한다 — 쪽·조건을 바꾸면 안 보이는 기록이 선택에 남지 않게
    selectedIds.value = selectedIds.value.filter((id) => res.items.some((r) => r.id === id))
    // 집계를 모르는 서버(배포 순서가 어긋남)여도 화면이 깨지지 않게 0 으로 둔다
    summary.value = res.summary ?? EMPTY_SUMMARY
    // 목록이 바뀐 순간부터 이력이 올 때까지는 기준을 모른다. 그 사이에 연 창은 동시 수정 검사를 하지 않는다 —
    // 옛 이력을 기준으로 삼으면 방금 내가 저장한 것을 「다른 곳에서 고쳤다」로 본다(ADM-02 리뷰)
    changesKnown = new Set()
    const changes = await fetchChanges(res.items)
    if (current !== sequence) return false
    changesByShift.value = changes ?? new Map()
    changesKnown = changes ? new Set(res.items.map((r) => r.id)) : new Set()
    return true
  } catch (e: any) {
    if (current === sequence) toast.add({ title: '출결 조회 실패', description: dboErrorMessage(e), color: 'error' })
    return false
  } finally {
    if (current === sequence) loading.value = false
  }
}

/* 행 선택(QA 2026-11-07 ADMIN-05 · ADMIN-15) — 고친·지울 수 있는 운영관리자·담당자만. 지금 보이는 쪽에서 고른다 */
const selectable = computed(() => canSelectAttendance(me.value?.role))
const selectedIds = ref<string[]>([])
const selectedRows = computed(() => rows.value.filter((r) => selectedIds.value.includes(r.id)))

/* 변경 이력 — 페이지마다 한 번에 읽어 「수정됨」 판정과 이력 창에 쓴다 */
const changesByShift = ref(new Map<string, AttendanceChange[]>())

/**
 * 지금 보이는 목록에서 이력을 제대로 받은 근무. 동시 수정 검사는 여기 든 근무만 한다(`changedSince`).
 * 고치지 않고 통째로 갈아 끼운다 — 늦게 끝난 옛 조회가 섞이지 않게 순번 검사 안에서만 바꾼다.
 */
let changesKnown = new Set<string>()

/** 이력을 받는다. 실패하면 알리고 null — 목록은 그대로 보여 준다. 그때 「수정됨」은 method 로만 판정된다 */
async function fetchChanges(items: AttendanceShift[]) {
  try {
    return groupChangesByShift(await listChangesByShifts(items.map((r) => r.id)))
  } catch (e: any) {
    toast.add({ title: '변경 이력 조회 실패', description: dboErrorMessage(e), color: 'warning' })
    return null
  }
}

/** 엑셀처럼 실패해도 빈 이력으로 이어 가는 곳이 쓴다 */
async function loadChanges(items: AttendanceShift[]) {
  return (await fetchChanges(items)) ?? new Map<string, AttendanceChange[]>()
}

function editedOf(row: AttendanceShift) {
  const changes = changesByShift.value.get(row.id)
  const kind = isHumanEdited(changes, attendanceOf(row))
  const last = changes?.find((c) => c.changed_by_role !== 'senior')
  return { kind, last }
}

const historyOpen = ref(false)
const historyTarget = ref<AttendanceShift | null>(null)
const historyLines = computed(() =>
  (historyTarget.value ? (changesByShift.value.get(historyTarget.value.id) ?? []) : []).map(describeChange),
)

function openHistory(row: AttendanceShift) {
  historyTarget.value = row
  historyOpen.value = true
}

/** 사업 필터 선택지 — 운영관리자만 읽을 수 있다(다른 역할은 403) */
async function loadPrograms() {
  if (!canProgram.value) return
  try {
    programs.value = (await api.listPrograms()).items
  } catch (e: any) {
    toast.add({ title: '사업 목록을 불러오지 못했습니다.', description: dboErrorMessage(e), color: 'warning' })
  }
}

async function loadWorksites() {
  try {
    // 근무지는 300곳 가까이 되는데 한 페이지는 100곳까지다 — 끝까지 받는다
    worksites.value = await api.listAllWorksites()
  } catch (e: any) {
    // 출결 조회는 그대로 되지만 필터 선택지가 비거나 모자라다 — 조용히 넘기지 않는다
    toast.add({ title: '근무지 목록을 불러오지 못했습니다.', description: dboErrorMessage(e), color: 'warning' })
  }
}

// 조회 Promise 를 돌려준다 — 조회 버튼(AppButton)이 끝날 때까지 다시 눌리지 않게
function search() {
  page.value = 1
  lq.commit()
  return load()
}

function setRange(days: number) {
  to.value = todaySeoul()
  from.value = days === 0 ? todaySeoul() : daysAgoSeoul(days)
  return search()
}

function toggleSort(key: string) {
  sortKey.value = key
  page.value = 1
  load()
}

// 사업을 바꿨는데 고른 근무지가 그 사업 밖이면 푼다. 아래 조회 감시보다 먼저 두어 조회가 한 번만 나간다
watch(programFilter, () => {
  if (worksiteOutsideProgram(worksites.value, worksiteId.value, programId.value ?? '')) worksiteId.value = ''
})
watch([programFilter, worksiteId, display], search)

/* 집계 — 서버가 조회 조건 **전체**를 표시 상태(dbo_display_state)로 세어 준다.
 * 퇴근 완료 = 정상 + 지각, 미기록·결근 = 미출근 + 결석. 인정 결석·출근 전은 어디에도 세지 않는다.
 * 예전에는 받은 한 페이지만 셌다 — 오늘 활동이 1,000건을 넘자 근무 중인 사람이 다른 페이지에
 * 있으면 「근무 중 0」이 됐다(2026-10-21). */
const EMPTY_SUMMARY: AttendanceSummary = { done: 0, working: 0, missingCheckout: 0, missing: 0 }
const summary = ref<AttendanceSummary>(EMPTY_SUMMARY)

/* 대리 기록 수정 */
const editOpen = ref(false)
const saving = ref(false)
const target = ref<AttendanceShift | null>(null)
const form = ref({
  status: 'present',
  startedAt: null as string | null,
  endedAt: null as string | null,
  memo: '',
})

const editErrors = ref<{ memo?: string; endedAt?: string }>({})

/**
 * 창을 열 때 본 가장 최근 이력 id. 저장 직전에 다시 읽어 비교한다(QA 2026-11-02 ADM-02).
 * 서버 검사(`editVersion`)가 배포되기 전의 방어다 — 옛 서버는 그 칸을 버리고 덮어쓴다.
 */
const editBaseline = ref<string | null | undefined>(undefined)
/** 창을 열 때 본 출결의 갱신 시각. 저장 본문의 `expectedUpdatedAt` 으로 보낸다(`attendanceVersion`) */
const editVersion = ref<string | null | undefined>(undefined)

/**
 * 저장하지 않고 닫을 때 묻는다(QA 2026-11-02 ADM-01). 사유를 적고 X 로 닫으면 말없이 사라졌다.
 * 확인은 브라우저 기본 창이 아니라 어드민 확인 창(AppModal)이다(결정 F8). X·바깥 누르기·Esc·메뉴 이동이 모두 같은 창을 본다.
 */
const editInitial = ref<typeof form.value | null>(null)
const discardOpen = ref(false)
const discard = createPendingAnswer()
function confirmDiscardEdit(): boolean | Promise<boolean> {
  if (!editInitial.value || !formChanged(editInitial.value, form.value)) return true
  discardOpen.value = true
  return discard.ask()
}
/** 확인 창을 먼저 내리고 답한다 — 확인 창이 포커스를 수정 창에 돌려준 뒤에 수정 창이 닫힌다 */
function answerDiscard(ok: boolean) {
  discardOpen.value = false
  discard.answer(ok)
}
// 확인 창을 X·바깥 누르기·Esc 로 닫으면 「계속 수정」이다
watch(discardOpen, (v) => {
  if (!v) discard.answer(false)
})
// 창이 열린 채 메뉴로 다른 화면에 갈 때도 같다
onBeforeRouteLeave(() => (editOpen.value ? confirmDiscardEdit() : true))

function openEdit(row: AttendanceShift) {
  if (!canEditAttendance(me.value?.role, row.work_date, todaySeoul())) return
  const rec = attendanceOf(row)
  target.value = row
  editBaseline.value = changesKnown.has(row.id) ? (changesByShift.value.get(row.id)?.[0]?.id ?? null) : undefined
  editVersion.value = attendanceVersion(row)
  // 사유는 빈칸으로 시작한다. 이전 메모를 채워 두면 그대로 저장해도 필수 검사를
  // 통과하고, 수정 이력에도 옛 사유가 이번 변경의 사유처럼 남는다(QA 2026-10-14 6번).
  form.value = {
    status: editDefaultStatus(row),
    startedAt: toLocalInput(rec?.started_at),
    endedAt: toLocalInput(rec?.ended_at),
    memo: '',
  }
  editInitial.value = { ...form.value }
  editErrors.value = {}
  editOpen.value = true
}

/** 등록된 상태 코드가 화면 어휘에 없으면 선택지에 그대로 더한다 */
const statusOptions = computed(() => {
  const base = ATTENDANCE_STATUSES.map((s) => ({ label: s.label, value: s.value as string }))
  const cur = form.value.status
  if (cur && !base.some((o) => o.value === cur)) base.push({ label: cur, value: cur })
  return base
})

/**
 * 다른 곳에서 먼저 고친 기록이다 — 저장하지 않았다. 최신 기록으로 창을 다시 열고 적던 사유는 남긴다.
 * 화면 검사(이력 비교)와 서버의 409 `attendance_conflict` 가 같은 길을 탄다.
 *
 * @param latest 그 근무의 최신 이력(최근 것부터). 못 읽었으면 null
 */
async function reopenAfterConflict(shiftId: string, latest: AttendanceChange[] | null) {
  const memo = form.value.memo
  // 다시 읽지 못했으면 목록이 낡았다. 그 행으로 다시 열면 기준도 낡아 저장이 매번 다시 막힌다(리뷰 반영).
  // 창과 입력·기준은 그대로 둔다 — 다시 저장하면 같은 충돌로 이리 와서 다시 읽는다
  if (!(await load())) {
    toast.add({
      title: '다른 곳에서 먼저 고친 기록입니다',
      description: '최신 기록을 불러오지 못했습니다. 잠시 뒤 다시 저장하면 다시 불러옵니다.',
      color: 'warning',
    })
    return
  }
  const fresh = rows.value.find((r) => r.id === shiftId)
  if (fresh) {
    toast.add({
      title: '다른 곳에서 먼저 고친 기록입니다',
      description: '최신 기록을 다시 불러왔습니다. 확인한 뒤 다시 저장해 주세요.',
      color: 'warning',
    })
    openEdit(fresh)
    form.value.memo = memo
    return
  }
  // 바뀐 기록이 지금 조회 조건에서 빠졌다(예: 「미출근」을 보는데 그새 QR 출근). 창을 닫으면 적던 사유가
  // 사라진다 — 창과 입력은 그대로 두고, 바뀐 내용을 알린 뒤 기준을 새 이력으로 옮긴다. 다시 저장하면 지금
  // 입력한 내용으로 고친다(알고 덮는 것이라 조용히 덮는 것이 아니다).
  const last = latest?.[0] ? describeChange(latest[0]) : null
  toast.add({
    title: '다른 곳에서 먼저 고친 기록입니다',
    description: `${last ? `${last.who} · ${last.what}. ` : ''}이 기록은 지금 조회 조건에서 빠졌습니다. 다시 저장하면 지금 입력한 내용으로 바뀝니다.`,
    color: 'warning',
  })
  editBaseline.value = latest ? (latest[0]?.id ?? null) : undefined
  // 새 기록의 갱신 시각은 목록에서 빠져 알 수 없다. 다음 저장은 서버 검사 없이 보낸다(알고 덮는 것)
  editVersion.value = undefined
}

async function submitEdit() {
  if (!target.value) return
  editErrors.value = attendanceEditErrors(form.value)
  if (Object.keys(editErrors.value).length > 0) return
  saving.value = true
  const shiftId = target.value.id
  try {
    // **조용히 덮어쓰지 않는다.** 창을 연 뒤 다른 곳에서 고쳤으면 저장하지 않고 최신 기록으로 다시 연다.
    // 다시 읽기가 실패하면 저장을 막지 않는다 — 검사 때문에 저장을 못 하는 쪽이 더 나쁘다.
    const latest = await listChangesByShifts([shiftId]).catch(() => null)
    if (latest && changedSince(editBaseline.value, latest)) {
      await reopenAfterConflict(shiftId, latest)
      return
    }
    await api.patchAttendance(shiftId, {
      status: form.value.status,
      startedAt: fromLocalInput(form.value.startedAt),
      endedAt: fromLocalInput(form.value.endedAt),
      method: 'manual',
      memo: form.value.memo.trim(),
      // 다시 읽기와 저장 사이의 틈은 서버가 막는다. undefined 면 JSON 에서 빠져 예전처럼 검사 없이 저장된다
      expectedUpdatedAt: editVersion.value,
    })
    toast.add({ title: '출결 기록을 저장했습니다.', color: 'success' })
    editOpen.value = false
    load()
  } catch (e: any) {
    if (isAttendanceConflict(e)) {
      await reopenAfterConflict(shiftId, await listChangesByShifts([shiftId]).catch(() => null))
      return
    }
    toast.add({ title: '저장 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

/*
 * 출결 일괄 상태 변경(QA 2026-11-07 ADMIN-05, 결정 D17) — 고른 여러 건에 같은 상태·사유를 적용한다. 출근·퇴근 시각은
 * 보내지 않아 그대로 남는다(시각은 건별 「기록 수정」만). 일괄 API 가 없어 건별 수정을 차례로 부른다 — 건마다 수정 이력이
 * 서버에 지금처럼 남는다. 창을 열 때 본 갱신 시각을 함께 보내 그사이 다른 곳에서 고친 기록은 덮지 않고 실패로 둔다
 */
const bulkEditOpen = ref(false)
const bulkEditSplit = ref<BulkSplit<AttendanceShift>>({ targets: [], skipped: [] })
const bulkEditForm = ref({ status: '', memo: '' })
const bulkEditErrors = ref<{ status?: string; memo?: string }>({})
const bulkRunning = ref(false)
const bulkProgress = ref<{ finished: number; total: number } | null>(null)
const bulkResult = ref<{ done: number; failed: { name: string; reason: string }[] } | null>(null)
const skippedLines = (split: BulkSplit<AttendanceShift>) =>
  split.skipped.map((s) => ({ name: attendanceRowName(s.row), reason: s.reason }))

function openBulkEdit() {
  if (bulkRunning.value) return
  bulkEditSplit.value = bulkEditTargets(selectedRows.value, me.value?.role, todaySeoul())
  bulkEditForm.value = { status: '', memo: '' }
  bulkEditErrors.value = {}
  bulkProgress.value = null
  bulkResult.value = null
  bulkEditOpen.value = true
}

async function submitBulkEdit() {
  const { status, memo } = bulkEditForm.value
  bulkEditErrors.value = {
    ...(status ? {} : { status: '적용할 상태를 골라 주세요.' }),
    ...(memo.trim() ? {} : { memo: '수정 사유를 입력해 주세요.' }),
  }
  if (Object.keys(bulkEditErrors.value).length > 0) return
  const targets = bulkEditSplit.value.targets
  bulkRunning.value = true
  bulkProgress.value = { finished: 0, total: targets.length }
  try {
    const result = await runSequential(
      targets,
      (row) =>
        api.patchAttendance(row.id, {
          status,
          method: 'manual',
          memo: memo.trim(),
          expectedUpdatedAt: attendanceVersion(row),
        }),
      (finished, total) => (bulkProgress.value = { finished, total }),
    )
    bulkResult.value = {
      done: result.done.length,
      failed: failureLines(result.failed, attendanceRowName, (e) => bulkEditErrorMessage(e) ?? dboErrorMessage(e)),
    }
  } finally {
    bulkRunning.value = false
  }
  load()
}

/* 출결 삭제 — master·담당자, 오늘 활동만. 지운 내용·삭제자·사유가 삭제 기록에 남는다 */
const deleteOpen = ref(false)
const deleting = ref(false)
const deleteTarget = ref<AttendanceShift | null>(null)
const deleteReason = ref('')
const deleteError = ref<string | null>(null)

function canDelete(row: AttendanceShift) {
  return canDeleteAttendance(me.value?.role, row, todaySeoul())
}

function openDelete(row: AttendanceShift) {
  // 앞 요청이 끝나기 전에는 새 창을 열지 않는다. 창 상태를 한 벌만 두기 때문이다
  if (deleting.value || !canDelete(row)) return
  deleteTarget.value = row
  deleteReason.value = ''
  deleteError.value = null
  deleteOpen.value = true
}

/** 다시 눌러도 같은 결과인 실패. 목록이 낡은 것이라 새로 읽는다 */
const STALE_DELETE_ERRORS = ['attendance_not_found', 'not_found', 'not_today']

async function submitDelete() {
  const target = deleteTarget.value
  if (!target) return
  deleteError.value = deleteReasonError(deleteReason.value)
  if (deleteError.value) return
  deleting.value = true
  try {
    await api.deleteAttendance(target.id, deleteReason.value.trim())
    toast.add({ title: '출결 기록을 삭제했습니다.', color: 'success' })
    if (deleteTarget.value === target) deleteOpen.value = false
    load()
  } catch (e: any) {
    // 창을 닫지 않는다. 적은 사유가 그대로 남아 있어야 다시 시도할 수 있다
    if (deleteTarget.value === target) {
      deleteError.value = deleteErrorMessage(e) ?? dboErrorMessage(e, '출결을 삭제하지 못했습니다.')
    }
    if (STALE_DELETE_ERRORS.includes(e?.data?.error)) load()
  } finally {
    deleting.value = false
  }
}

/*
 * 조정 요청(QA 2026-11-02 PARTNER-01) — 수요처는 기록을 고치지 못하고(D9) 「기록 수정」 자리의 「조정 요청」으로 담당자에게 보낸다.
 * 조정 요청 목록을 한 번 읽어 서버가 경로를 아는지 본다. 옛 서버(404)면 창을 열지 않고 안내만 한다.
 */
const requestOpen = ref(false)
const requestTarget = ref<AttendanceShift | null>(null)
/** 조정 요청을 받는 서버인가. 모르면(확인 중·다른 오류) null — 열어 보고 서버 답을 따른다 */
const requestsSupported = ref<boolean | null>(null)

function probeRequests() {
  api
    .listAttendanceRequests({ size: 1 })
    .then(() => (requestsSupported.value = true))
    .catch((e) => (requestsSupported.value = requestsUnsupported(e) ? false : null))
}

function openRequest(row: AttendanceShift) {
  if (!canRequestAdjustment(me.value?.role, row.work_date, todaySeoul())) return
  if (requestsSupported.value === false) {
    toast.add({ title: REQUESTS_UNSUPPORTED, color: 'warning' })
    return
  }
  requestTarget.value = row
  requestOpen.value = true
}

/* 엑셀 — 조회 조건 전체를 100건씩 순회해 모은다 */
const EXCEL_COLUMNS: ExcelColumn[] = [
  { key: 'work_date', label: '근무일' },
  { key: 'name', label: '이름' },
  { key: 'phone', label: '전화번호' },
  { key: 'worksite', label: '근무지' },
  { key: 'planned_start', label: '예정 출근' },
  { key: 'planned_end', label: '예정 퇴근' },
  { key: 'status', label: '상태' },
  { key: 'started_at', label: '출근 시각' },
  { key: 'ended_at', label: '퇴근 시각' },
  { key: 'worked', label: '근무시간' },
  { key: 'method', label: '기록 방법' },
  { key: 'edited', label: '수정 이력' },
  { key: 'memo', label: '메모' },
]

function toExcelRow(row: AttendanceShift) {
  const rec = attendanceOf(row)
  const { kind, last } = editedOf(row)
  return {
    work_date: row.work_date,
    name: row.directory?.name ?? '',
    phone: row.directory?.phone ?? '',
    worksite: row.worksite?.name ?? '',
    planned_start: hhmm(row.planned_start),
    planned_end: hhmm(row.planned_end),
    status: attendanceDisplayLabel(attendanceDisplay(row)),
    started_at: fmtStamp(rec?.started_at),
    ended_at: fmtStamp(rec?.ended_at),
    worked: workedDuration(rec?.started_at, rec?.ended_at),
    method: rec?.method ?? '',
    edited:
      kind === 'edited' && last
        ? `수정됨 ${describeChange(last).who} ${fmtStamp(last.created_at)}`
        : kind === 'legacy'
          ? '수정됨(이력 없음)'
          : '',
    memo: rec?.memo ?? '',
  }
}

async function exportExcel() {
  await startExport()
  try {
    const all: AttendanceShift[] = []
    let p = 1
    // size 상한이 100이므로 페이지를 순회한다
    for (;;) {
      const res = await api.listAttendance({
        page: p,
        size: 100,
        q: lq.committedOf('q'),
        sort: sortKey.value,
        from: lq.committedOf('from'),
        to: lq.committedOf('to'),
        worksiteId: worksiteId.value || undefined,
        programId: programId.value,
        display: (display.value || undefined) as AttendanceDisplay | undefined,
      })
      all.push(...res.items)
      // 「수정 이력」 칸도 목록과 같은 기준으로 채운다. 이 페이지 몫의 이력을 함께 읽는다
      for (const [id, list] of await loadChanges(res.items)) changesByShift.value.set(id, list)
      if (all.length >= res.total || !res.items.length) break
      p++
    }
    if (!all.length) {
      toast.add({ title: '내보낼 기록이 없습니다.', color: 'warning' })
      return
    }
    downloadExcel(`출퇴근기록_${lq.committedOf('from')}_${lq.committedOf('to')}`, all.map(toExcelRow), EXCEL_COLUMNS)
  } catch (e: any) {
    toast.add({ title: '엑셀 내보내기 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    finishExport()
  }
}

onMounted(() => {
  load()
  loadWorksites()
  loadPrograms()
  if (me.value?.role === 'worksite') probeRequests()
})
</script>

<template>
  <div class="flex min-h-[calc(100vh-8rem)] flex-col gap-6">
    <div v-if="me?.role === 'master' || me?.role === 'worksite'" class="flex gap-2" role="tablist">
      <AppButton
        size="sm"
        role="tab"
        :aria-selected="tab === 'records'"
        :variant="tab === 'records' ? 'solid' : 'outline'"
        :color="tab === 'records' ? 'primary' : 'neutral'"
        @click="tab = 'records'"
      >
        출결
      </AppButton>
      <AppButton
        v-if="me?.role === 'master'"
        size="sm"
        role="tab"
        :aria-selected="tab === 'deletions'"
        :variant="tab === 'deletions' ? 'solid' : 'outline'"
        :color="tab === 'deletions' ? 'primary' : 'neutral'"
        @click="tab = 'deletions'"
      >
        삭제 기록
      </AppButton>
      <AppButton
        v-else
        size="sm"
        role="tab"
        :aria-selected="tab === 'requests'"
        :variant="tab === 'requests' ? 'solid' : 'outline'"
        :color="tab === 'requests' ? 'primary' : 'neutral'"
        @click="tab = 'requests'"
      >
        내 요청
      </AppButton>
    </div>

    <AttendanceDeletionsPanel v-if="tab === 'deletions' && me?.role === 'master'" />
    <AttendanceRequestsPanel v-else-if="tab === 'requests' && me?.role === 'worksite'" />

    <template v-else>
    <Teleport to="#admin-topbar-actions">
      <AppButton
        variant="outline"
        color="neutral"
        icon="i-lucide-download"
        :loading="exporting"
        @click="exportExcel"
      >
        엑셀 다운로드
      </AppButton>
    </Teleport>

    <!-- 조회 조건 -->
    <AppCard>
      <div class="flex flex-wrap items-end gap-4">
        <FormField label="시작일">
          <DateField v-model="from" />
        </FormField>
        <FormField label="종료일">
          <DateField v-model="to" />
        </FormField>
        <AppButton size="sm" icon="i-lucide-search" @click="search">조회</AppButton>
        <div class="ml-auto flex gap-2">
          <AppButton variant="outline" color="neutral" size="sm" @click="setRange(0)">오늘</AppButton>
          <AppButton variant="outline" color="neutral" size="sm" @click="setRange(6)">최근 7일</AppButton>
          <AppButton variant="outline" color="neutral" size="sm" @click="setRange(29)">최근 30일</AppButton>
        </div>
      </div>
    </AppCard>

    <!-- 조회 결과 집계 -->
    <div class="grid grid-cols-2 gap-6 md:grid-cols-5">
      <!-- 조회 중에는 0 대신 「…」 — 0 은 「기록이 없다」로 읽힌다 -->
      <StatCard label="조회된 근무" :value="loading ? '…' : total.toLocaleString()" />
      <StatCard label="퇴근 완료" :value="loading ? '…' : summary.done" tone="up" />
      <StatCard label="근무 중" :value="loading ? '…' : summary.working" tone="primary" />
      <StatCard label="퇴근 누락" :value="loading ? '…' : summary.missingCheckout" tone="down" />
      <StatCard label="미기록·결근" :value="loading ? '…' : summary.missing" tone="down" />
    </div>

    <DataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :sort-key="sortKey"
      sort-dir="asc"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :page-size-options="[20, 50, 100]"
      :selectable="selectable"
      v-model:selected="selectedIds"
      empty-text="해당 조건의 근무가 없습니다."
      @sort="toggleSort"
      @update:page="
        (p) => {
          page = p
          load()
        }
      "
      @update:page-size="
        (s) => {
          pageSize = s
          page = 1
          load()
        }
      "
    >
      <template #toolbar>
        <PillSearch v-model="q" placeholder="이름 또는 전화번호" @search="search" />
        <PillSelect v-if="canProgram" v-model="programFilter" :options="programFilterOptions(programs)" />
        <WorksiteFilter
          v-model="worksiteId"
          :worksites="worksites"
          :program-id="programId ?? ''"
          :programs="programs"
        />
        <PillSelect
          v-model="display"
          :options="[{ label: '상태 전체', value: '' }, ...ATTENDANCE_DISPLAY_OPTIONS]"
        />
      </template>
      <template #toolbar-end>
        <!-- 고른 기록 일괄 처리(QA 2026-11-07 ADMIN-05 · ADMIN-15) -->
        <template v-if="selectedIds.length">
          <span class="text-sm font-medium text-ink tabular-nums">선택 {{ selectedIds.length }}건</span>
          <AppButton size="sm" variant="outline" color="neutral" icon="i-lucide-list-checks" @click="openBulkEdit">
            상태 일괄 변경
          </AppButton>
          <button type="button" class="text-sm font-medium text-brand-500 hover:underline" @click="selectedIds = []">
            선택 해제
          </button>
        </template>
        <span class="text-sm text-muted tabular-nums">{{ from }} ~ {{ to }}</span>
      </template>

      <template #cell-name="{ row }">
        <span class="font-medium text-ink">{{ row.directory?.name ?? '—' }}</span>
        <span class="ml-1.5 text-muted">{{ fmtPhone(row.directory?.phone) }}</span>
      </template>
      <template #cell-worksite="{ row }">{{ row.worksite?.name ?? '—' }}</template>
      <template #cell-planned="{ row }">
        {{ hhmm(row.planned_start) }} – {{ hhmm(row.planned_end) }}
      </template>
      <template #cell-status="{ row }">
        <StatusBadge :tone="attendanceDisplayTone(attendanceDisplay(row as AttendanceShift))">
          {{ attendanceDisplayLabel(attendanceDisplay(row as AttendanceShift)) }}
        </StatusBadge>
      </template>
      <template #cell-started_at="{ row }">{{ fmtClock(attendanceOf(row)?.started_at) }}</template>
      <template #cell-ended_at="{ row }">{{ fmtClock(attendanceOf(row)?.ended_at) }}</template>
      <template #cell-worked="{ row }">
        <span class="tabular-nums">
          {{ workedDuration(attendanceOf(row)?.started_at, attendanceOf(row)?.ended_at) }}
        </span>
      </template>
      <template #cell-method="{ row }">
        <span class="text-muted">{{ attendanceOf(row)?.method ?? '—' }}</span>
      </template>
      <!-- 누르면 변경 이력 창. 고친 사람·시각은 변경 이력에서 가져온다 -->
      <template #cell-edited="{ row }">
        <button
          v-if="editedOf(row as AttendanceShift).kind"
          type="button"
          class="text-sm text-brand-500 hover:underline"
          @click="openHistory(row as AttendanceShift)"
        >
          <template v-if="editedOf(row as AttendanceShift).last">
            수정됨 · {{ editedOf(row as AttendanceShift).last!.changed_by_name ?? '알 수 없음' }} ·
            {{ fmtStamp(editedOf(row as AttendanceShift).last!.created_at) }}
          </template>
          <template v-else>수정됨 (이력 없음)</template>
        </button>
        <span v-else class="text-muted">—</span>
      </template>
      <template #cell-memo="{ row }">
        <span class="text-muted">{{ attendanceOf(row)?.memo ?? '—' }}</span>
      </template>

      <!-- 휴대폰 폭 카드(QA 2026-11-02 MOBILE-01, 결정 F6). 칸은 표와 같고, 모양은 이 화면 창들의 기록 상자를 따른다.
           기록 수정·삭제 버튼은 DataTable 이 카드 아래에 붙인다 -->
      <template #card="{ row }">
        <div class="space-y-1.5 text-sm">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate">
                <span class="font-medium text-ink">{{ row.directory?.name ?? '—' }}</span>
                <span class="ml-1.5 text-muted">{{ fmtPhone(row.directory?.phone) }}</span>
              </p>
              <p class="mt-0.5 truncate text-body">{{ row.worksite?.name ?? '—' }}</p>
            </div>
            <StatusBadge :tone="attendanceDisplayTone(attendanceDisplay(row as AttendanceShift))">
              {{ attendanceDisplayLabel(attendanceDisplay(row as AttendanceShift)) }}
            </StatusBadge>
          </div>
          <p class="text-muted tabular-nums">
            {{ row.work_date }} · 예정 {{ hhmm(row.planned_start) }} – {{ hhmm(row.planned_end) }}
          </p>
          <p class="text-body tabular-nums">
            출근 {{ fmtClock(attendanceOf(row as AttendanceShift)?.started_at) }} · 퇴근
            {{ fmtClock(attendanceOf(row as AttendanceShift)?.ended_at) }} · 근무
            {{ workedDuration(attendanceOf(row as AttendanceShift)?.started_at, attendanceOf(row as AttendanceShift)?.ended_at) }}
            <span v-if="attendanceOf(row as AttendanceShift)?.method" class="text-muted">
              · {{ attendanceOf(row as AttendanceShift)?.method }}
            </span>
          </p>
          <button
            v-if="editedOf(row as AttendanceShift).kind"
            type="button"
            class="text-left text-brand-500 hover:underline"
            @click="openHistory(row as AttendanceShift)"
          >
            <template v-if="editedOf(row as AttendanceShift).last">
              수정됨 · {{ editedOf(row as AttendanceShift).last!.changed_by_name ?? '알 수 없음' }} ·
              {{ fmtStamp(editedOf(row as AttendanceShift).last!.created_at) }}
            </template>
            <template v-else>수정됨 (이력 없음)</template>
          </button>
          <p v-if="attendanceOf(row as AttendanceShift)?.memo" class="text-muted">
            메모: {{ attendanceOf(row as AttendanceShift)?.memo }}
          </p>
        </div>
      </template>

      <template #actions="{ row }">
        <div class="flex items-center gap-3">
          <button
            v-if="canEditAttendance(me?.role, row.work_date, todaySeoul())"
            type="button"
            class="text-sm font-medium text-brand-500 hover:underline"
            @click="openEdit(row)"
          >
            기록 수정
          </button>
          <!-- 수요처는 고치지 못하고 조정을 요청한다(QA PARTNER-01) -->
          <button
            v-else-if="canRequestAdjustment(me?.role, row.work_date, todaySeoul())"
            type="button"
            class="text-sm font-medium text-brand-500 hover:underline"
            @click="openRequest(row as AttendanceShift)"
          >
            조정 요청
          </button>
          <span v-else-if="row.work_date > todaySeoul()" class="text-sm text-muted">예정</span>
          <button
            v-if="canDelete(row as AttendanceShift)"
            type="button"
            class="text-sm font-medium text-down hover:underline"
            @click="openDelete(row as AttendanceShift)"
          >
            삭제
          </button>
        </div>
      </template>
    </DataTable>

    <!-- 대리 기록 -->
    <AppModal v-model:open="editOpen" title="출결 기록 수정" width="max-w-lg" :before-close="confirmDiscardEdit">
      <div v-if="target" class="space-y-4">
        <div class="rounded-lg border border-hairline bg-surface-soft px-4 py-3 text-sm">
          <p class="font-semibold text-ink">
            {{ target.directory?.name ?? '—' }} · {{ target.worksite?.name ?? '—' }}
          </p>
          <p class="mt-0.5 text-muted">
            {{ target.work_date }} 예정 {{ hhmm(target.planned_start) }} –
            {{ hhmm(target.planned_end) }}
          </p>
        </div>
        <FormField label="상태" required>
          <SelectField v-model="form.status" :options="statusOptions" />
        </FormField>
        <!-- 휴대폰 폭에서는 날짜·시각 칸이 좁아 한 줄에 하나씩 -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="출근 시각">
            <DateField v-model="form.startedAt" type="datetime-local" />
          </FormField>
          <FormField label="퇴근 시각" :error="editErrors.endedAt">
            <DateField v-model="form.endedAt" type="datetime-local" />
          </FormField>
        </div>
        <FormField
          label="수정 사유"
          required
          :hint="attendanceOf(target)?.memo ? `이전 메모: ${attendanceOf(target)?.memo}` : undefined"
          :error="editErrors.memo"
        >
          <AppTextarea v-model="form.memo" :rows="3" />
        </FormField>
        <p class="text-xs text-muted">
          저장하면 기록 방법이 <span class="font-medium text-body">manual</span>(관리자 대리 기록)로
          남습니다.
        </p>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" @click="editOpen = false">
          취소
        </AppButton>
        <AppButton size="sm" :loading="saving" @click="submitEdit">저장</AppButton>
      </template>
    </AppModal>

    <!-- 수요처의 조정 요청(QA PARTNER-01) -->
    <AttendanceRequestModal v-model:open="requestOpen" :shift="requestTarget" :route-known="requestsSupported === true" />

    <!-- 저장하지 않고 닫기 확인(결정 F8). 수정 창 위에 뜨도록 뒤에 둔다. 모양은 휴무 관리·공지 발송의 확인 창을 따른다 -->
    <AppModal v-model:open="discardOpen" title="저장하지 않고 닫을까요?" width="max-w-md">
      <p class="text-sm text-body">입력한 내용이 사라집니다.</p>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" @click="answerDiscard(false)">계속 수정</AppButton>
        <AppButton color="down" size="sm" @click="answerDiscard(true)">저장하지 않고 닫기</AppButton>
      </template>
    </AppModal>

    <!-- 출결 삭제. 임금과 이어진 기록이라 경고를 먼저 보이고 사유를 받는다 -->
    <AppModal v-model:open="deleteOpen" title="출결 기록 삭제" width="max-w-lg">
      <div v-if="deleteTarget" class="space-y-4">
        <div class="rounded-lg border border-down bg-down-soft px-4 py-3 text-sm text-down" role="alert">
          <p class="font-semibold">삭제하기 전에 확인해 주세요.</p>
          <ul class="mt-1.5 list-disc space-y-0.5 pl-5">
            <li>이 활동의 출근·퇴근 기록이 사라지고, <b>활동비(임금) 정산에 그대로 반영</b>됩니다.</li>
            <li>삭제한 사람과 사유는 기록으로 남으며, 되돌리거나 지울 수 없습니다.</li>
            <li>삭제한 뒤에도 시니어는 오늘 QR 출근을 다시 찍을 수 있습니다.</li>
          </ul>
        </div>
        <div class="rounded-lg border border-hairline bg-surface-soft px-4 py-3 text-sm">
          <p class="font-semibold text-ink">
            {{ deleteTarget.directory?.name ?? '—' }} · {{ deleteTarget.worksite?.name ?? '—' }}
          </p>
          <p class="mt-0.5 text-muted tabular-nums">
            {{ deleteTarget.work_date }} ·
            {{ attendanceDisplayLabel(attendanceDisplay(deleteTarget)) }} · 출근
            {{ fmtClock(attendanceOf(deleteTarget)?.started_at) }} · 퇴근
            {{ fmtClock(attendanceOf(deleteTarget)?.ended_at) }}
          </p>
        </div>
        <FormField label="삭제 사유" required :error="deleteError ?? undefined">
          <AppTextarea
            v-model="deleteReason"
            :rows="3"
            :maxlength="DELETE_REASON_MAX"
            placeholder="예: 현장 확인 결과 미출근(허위 출결)"
          />
        </FormField>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" @click="deleteOpen = false">
          취소
        </AppButton>
        <AppButton
          color="down"
          size="sm"
          :loading="deleting"
          :disabled="!deleteReason.trim()"
          @click="submitDelete"
        >
          삭제
        </AppButton>
      </template>
    </AppModal>

    <!-- 출결 일괄 상태 변경(QA 2026-11-07 ADMIN-05). 처리하는 동안은 닫지 않는다 — 어디까지 됐는지 결과를 봐야 한다 -->
    <AppModal v-model:open="bulkEditOpen" title="출결 일괄 수정" width="max-w-lg" :before-close="() => !bulkRunning">
      <div class="space-y-4">
        <template v-if="!bulkResult">
          <div class="rounded-lg border border-hairline bg-surface-soft px-4 py-3 text-sm">
            <p class="font-semibold text-ink tabular-nums">
              고른 {{ bulkEditSplit.targets.length + bulkEditSplit.skipped.length }}건 중
              {{ bulkEditSplit.targets.length }}건에 같은 상태·사유를 적용합니다.
            </p>
            <p class="mt-0.5 text-muted">
              출근·퇴근 시각은 바꾸지 않습니다. 시각은 건마다 「기록 수정」에서 고쳐 주세요. 건마다 수정 이력이 남습니다.
            </p>
          </div>
          <BulkSkippedList :items="skippedLines(bulkEditSplit)" />
          <FormField label="상태" required :error="bulkEditErrors.status">
            <SelectField
              v-model="bulkEditForm.status"
              :options="ATTENDANCE_STATUSES.map((s) => ({ label: s.label, value: s.value as string }))"
              placeholder="상태 선택"
            />
          </FormField>
          <FormField label="수정 사유" required :error="bulkEditErrors.memo">
            <AppTextarea v-model="bulkEditForm.memo" :rows="3" />
          </FormField>
          <p class="text-xs text-muted">
            저장하면 기록 방법이 <span class="font-medium text-body">manual</span>(관리자 대리 기록)로 남습니다.
          </p>
          <p v-if="bulkProgress" class="text-sm text-muted tabular-nums" aria-live="polite">
            처리 중 {{ bulkProgress.finished }} / {{ bulkProgress.total }}
          </p>
        </template>
        <BulkResultPanel v-else done-label="적용" :done="bulkResult.done" :failed="bulkResult.failed" />
      </div>
      <template #footer>
        <template v-if="!bulkResult">
          <AppButton variant="outline" color="neutral" size="sm" :disabled="bulkRunning" @click="bulkEditOpen = false">
            취소
          </AppButton>
          <AppButton size="sm" :loading="bulkRunning" :disabled="!bulkEditSplit.targets.length" @click="submitBulkEdit">
            {{ bulkEditSplit.targets.length }}건에 적용
          </AppButton>
        </template>
        <AppButton v-else size="sm" @click="bulkEditOpen = false">닫기</AppButton>
      </template>
    </AppModal>

    <!-- 변경 이력(QA 2026-10-14 13번) -->
    <AppModal v-model:open="historyOpen" title="출결 변경 이력" width="max-w-lg">
      <div v-if="historyTarget" class="space-y-4">
        <div class="rounded-lg border border-hairline bg-surface-soft px-4 py-3 text-sm">
          <p class="font-semibold text-ink">
            {{ historyTarget.directory?.name ?? '—' }} · {{ historyTarget.worksite?.name ?? '—' }}
          </p>
          <p class="mt-0.5 text-muted">{{ historyTarget.work_date }}</p>
        </div>
        <ul v-if="historyLines.length" class="space-y-3">
          <li v-for="(line, i) in historyLines" :key="i" class="rounded-lg border border-hairline px-4 py-3 text-sm">
            <p class="text-muted tabular-nums">{{ line.when }} · {{ line.who }}</p>
            <p class="mt-1 font-medium text-ink">{{ line.what }}</p>
            <p v-if="line.memo" class="mt-1 text-body">사유: {{ line.memo }}</p>
          </li>
        </ul>
        <p v-else class="text-sm text-muted">
          변경 이력 기능(10월 11일) 전에 수정된 기록이라 상세 내역이 없습니다.
        </p>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" @click="historyOpen = false">닫기</AppButton>
      </template>
    </AppModal>
    </template>
  </div>
</template>
