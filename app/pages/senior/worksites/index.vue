<!-- 근무지·수요처 관리 — 목록/사업 필터/등록/수정 + QR 토큰 재발급 (/dbo-admin/worksites) -->
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { Column } from '~/types/table'
import type { DirectoryEntry, LifeStatus, Program, Worksite } from '~/types/dbo'
import { downloadExcel, type ExcelColumn } from '~/utils/excel'

const api = useDboAdmin()
const toast = useToast()
const { setHeader } = useAdminHeader()
const { me } = useAdminRole()
setHeader('근무지·수요처')

const rows = ref<Worksite[]>([])
const total = ref(0)
// 검색·필터·정렬·페이지는 주소에 담는다 — 상세에서 뒤로 오면 그대로다(QA 2026-10-11)
const lq = useListQuery(
  { page: 1, size: 20, q: '', program: '', sort: 'name' },
  { committed: ['q'] },
)
const page = lq.page
const pageSize = lq.size
const q = lq.q
/** 사업 필터. 근무지가 300곳 가까이라 서버에서 거른다 */
const programFilter = lq.program
const sortKey = lq.sort
const loading = ref(false)

const programs = ref<Program[]>([])
/** 근무지 담당자 후보(role=manager, 사회복지사) */
const managers = ref<DirectoryEntry[]>([])
/** 수요처 담당자 후보(role=worksite, 수요처 계정) */
const contacts = ref<DirectoryEntry[]>([])

const programName = (pid: string | null) =>
  pid ? (programs.value.find((p) => p.id === pid)?.name ?? pid) : '—'
const personName = (list: DirectoryEntry[], did: string | null) =>
  did ? (list.find((m) => m.id === did)?.name ?? did) : '—'

const columns: Column[] = [
  { key: 'name', label: '근무지', sortable: true, strong: true },
  { key: 'program_id', label: '사업' },
  { key: 'address', label: '주소' },
  // 근무지 담당자(사회복지사, role=manager) — 이 근무지에 배정된 시니어를 앱·어드민에서 관리한다.
  { key: 'care_manager_directory_id', label: '근무지 담당자' },
  // 수요처 담당자(role=worksite) — 근무지 쪽 출석 담당. 지정·표시용이고 권한은 명부의 worksite_id 다.
  { key: 'manager_directory_id', label: '수요처 담당자' },
  // 누르면 같은 기준(활동 중 시니어·지금 유효한 배정)으로 거른 명부로 간다
  { key: 'senior_count', label: '배정 인원', align: 'right' },
  { key: 'status', label: '상태' },
  { key: 'qr_token', label: 'QR' },
]

/** 조회 순번 — 조건을 빠르게 바꾸면 늦게 온 이전 응답이 새 결과를 덮지 않게 마지막 요청만 반영한다 */
let sequence = 0
async function load() {
  const current = ++sequence
  loading.value = true
  try {
    const res = await api.listWorksites({
      page: page.value,
      size: pageSize.value,
      q: lq.committedOf('q'),
      sort: sortKey.value,
      programId: programFilter.value || undefined,
    })
    if (current !== sequence) return
    rows.value = res.items
    total.value = res.total
  } catch (e: any) {
    if (current !== sequence) return
    toast.add({ title: '근무지 조회 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    if (current === sequence) loading.value = false
  }
}

/** 사업·담당자 이름 목록이 왔는가(실패 포함). 오기 전에는 표가 이름 대신 id 를 보여 행을 미룬다 */
const refsSettled = ref(false)

async function loadRefs() {
  // 사업·명부 목록은 master 전용 API 다 — 수요처 계정은 부르면 매번 실패하니 부르지 않는다
  if (me.value?.role !== 'master') {
    refsSettled.value = true
    return
  }
  try {
    const [pg, mgr, ws] = await Promise.all([
      api.listPrograms(),
      // 역할을 서버에서 거르고 끝까지 받는다 — 100명을 넘으면 뒤쪽 담당자가 이름 대신 id 로 보인다
      fetchAllPages(
        (page, size) => api.listDirectory({ page, size, status: 'active', role: 'manager' }),
        (d) => d.id,
      ),
      fetchAllPages(
        (page, size) => api.listDirectory({ page, size, status: 'active', role: 'worksite' }),
        (d) => d.id,
      ),
    ])
    programs.value = pg.items
    managers.value = mgr
    contacts.value = ws
  } catch (e: any) {
    // 표의 사업·담당자 칸이 이름 대신 id 로 보인다 — 조용히 넘기지 않는다
    toast.add({ title: '사업·담당자 목록을 불러오지 못했습니다.', description: dboErrorMessage(e), color: 'warning' })
  } finally {
    refsSettled.value = true
  }
}

function search() {
  page.value = 1
  lq.commit()
  load()
}

watch(programFilter, search)

function toggleSort(key: string) {
  sortKey.value = key
  page.value = 1
  load()
}

/* 엑셀 — 조회 조건 전체를 받아 내보낸다. QR 은 토큰 원문 대신 발급 여부만 */
const { exporting, startExport, finishExport } = useExcelExport()
const EXCEL_COLUMNS: ExcelColumn[] = [
  { key: 'name', label: '근무지' },
  { key: 'program', label: '사업' },
  { key: 'address', label: '주소' },
  { key: 'care_manager', label: '근무지 담당자' },
  { key: 'contact', label: '수요처 담당자' },
  { key: 'status', label: '상태' },
  { key: 'qr', label: 'QR' },
]

async function exportExcel() {
  await startExport()
  try {
    const all = await fetchAllPages(
      (p, size) =>
        api.listWorksites({
          page: p,
          size,
          q: lq.committedOf('q'),
          sort: sortKey.value,
          programId: programFilter.value || undefined,
        }),
      (w) => w.id,
    )
    if (!all.length) {
      toast.add({ title: '내보낼 근무지가 없습니다.', color: 'warning' })
      return
    }
    const data = all.map((w) => ({
      name: w.name,
      // 화면용 이름 함수는 빈 값을 '—'로 낸다 — 엑셀은 다른 화면처럼 빈 칸으로 둔다
      program: w.program_id ? programName(w.program_id) : '',
      address: w.address ?? '',
      care_manager: w.care_manager_directory_id ? personName(managers.value, w.care_manager_directory_id) : '',
      contact: w.manager_directory_id ? personName(contacts.value, w.manager_directory_id) : '',
      status: lifeStatusLabel(w.status),
      qr: w.qr_token ? '발급됨' : '없음',
    }))
    downloadExcel('근무지', data, EXCEL_COLUMNS)
  } catch (e: any) {
    toast.add({ title: '엑셀 내보내기 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    finishExport()
  }
}

/* 등록·수정 모달 */
const formOpen = ref(false)
const saving = ref(false)
const editing = ref<Worksite | null>(null)
const form = ref({
  name: '',
  programId: null as string | null,
  address: '',
  regionCode: '',
  managerDirectoryId: null as string | null,
  careManagerDirectoryId: null as string | null,
  status: 'active' as LifeStatus,
})

function openForm(row?: Worksite) {
  editing.value = row ?? null
  form.value = row
    ? {
        name: row.name,
        programId: row.program_id,
        address: row.address ?? '',
        regionCode: row.region_code ?? '',
        managerDirectoryId: row.manager_directory_id,
        careManagerDirectoryId: row.care_manager_directory_id,
        status: row.status,
      }
    : {
        name: '',
        programId: null,
        address: '',
        regionCode: '',
        managerDirectoryId: null,
        careManagerDirectoryId: null,
        status: 'active',
      }
  formOpen.value = true
}

/** 이름·사업을 바꾸는데 배정이 있으면 확인 창을 띄운다. 그만두면 `false`. */
async function confirmWorksiteEdit(row: Worksite, name: string, programId: string | null) {
  const programName = (id: string | null) =>
    id ? (programs.value.find((p) => p.id === id)?.name ?? id) : null
  const before = { name: row.name, programName: programName(row.program_id) }
  const after = { name, programName: programName(programId) }
  // 바뀐 것이 없으면 배정 수를 묻지도 않는다.
  if (!worksiteEditWarning({ before, after, assignments: 1 })) return true
  let assignments: number | null = null
  try {
    assignments = (await api.listAssignments({ worksiteId: row.id, size: 1 })).total
  } catch (e) {
    console.error('[worksites] 배정 수 조회 실패', e)
  }
  const message = worksiteEditWarning({ before, after, assignments })
  return message === null || confirm(message)
}

async function submitForm() {
  if (!form.value.name.trim()) {
    toast.add({ title: '근무지 이름을 입력해 주세요.', color: 'warning' })
    return
  }
  saving.value = true
  try {
    const body = {
      name: form.value.name.trim(),
      programId: form.value.programId,
      address: form.value.address.trim() || null,
      regionCode: form.value.regionCode.trim() || null,
      managerDirectoryId: form.value.managerDirectoryId,
      careManagerDirectoryId: form.value.careManagerDirectoryId,
    }
    if (editing.value) {
      // 배정 있는 근무지의 이름·사업을 바꾸면 그 어르신들이 통째로 따라간다. 저장 전에 묻는다
      // (`utils/worksiteEditGuard.ts` — 2026-10-08 「1호점」이 「테스트」가 된 일).
      if (!(await confirmWorksiteEdit(editing.value, body.name, body.programId))) return
      await api.updateWorksite(editing.value.id, { ...body, status: form.value.status })
      toast.add({ title: '수정되었습니다.', color: 'success' })
    } else {
      const res = await api.createWorksite(body)
      toast.add({
        title: '등록되었습니다.',
        description: `QR 토큰이 함께 발급되었습니다: ${res.qrToken}`,
        color: 'success',
      })
    }
    formOpen.value = false
    load()
  } catch (e: any) {
    toast.add({
      title: editing.value ? '수정 실패' : '등록 실패',
      description: dboErrorMessage(e, '같은 사업에 같은 이름의 근무지가 있는지 확인해 주세요.'),
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}

/* QR 토큰 */
const qrOpen = ref(false)
const qrTarget = ref<Worksite | null>(null)
const rotating = ref(false)
// 인쇄·PNG 저장은 카드가 SVG/캔버스를 쥐고 있으므로 그쪽 메서드를 부른다
const qrCard = ref<{ print: () => void; downloadPng: () => Promise<void> } | null>(null)

function openQr(row: Worksite) {
  qrTarget.value = row
  qrOpen.value = true
}

const qrValue = computed(() => qrTarget.value?.qr_token ?? '')

async function rotateQr() {
  if (!qrTarget.value) return
  if (!confirm('QR을 재발급하면 기존 QR은 즉시 무효가 됩니다. 벽에 붙은 QR을 새로 인쇄해야 합니다. 계속하시겠습니까?'))
    return
  rotating.value = true
  try {
    const res = await api.rotateWorksiteQr(qrTarget.value.id)
    qrTarget.value = { ...qrTarget.value, qr_token: res.qrToken }
    toast.add({ title: 'QR이 재발급되었습니다.', description: fmtStamp(res.rotatedAt), color: 'success' })
    load()
  } catch (e: any) {
    toast.add({ title: 'QR 재발급 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    rotating.value = false
  }
}

async function copyQr() {
  if (!qrValue.value) return
  try {
    await navigator.clipboard.writeText(qrValue.value)
    toast.add({ title: 'QR 토큰을 복사했습니다.', color: 'success' })
  } catch {
    toast.add({ title: '복사에 실패했습니다. 직접 선택해 복사해 주세요.', color: 'warning' })
  }
}

watch(formOpen, (v) => {
  if (v && !programs.value.length) loadRefs()
})

onMounted(() => {
  load()
  loadRefs()
})
</script>

<template>
  <div class="flex min-h-[calc(100vh-8rem)] flex-col">
    <Teleport to="#admin-topbar-actions">
      <AppButton
        variant="outline"
        color="neutral"
        icon="i-lucide-download"
        :loading="exporting"
        :disabled="!refsSettled"
        @click="exportExcel"
      >
        엑셀 다운로드
      </AppButton>
      <AppButton icon="i-lucide-plus" @click="openForm()">근무지 등록</AppButton>
    </Teleport>

    <DataTable
      :columns="columns"
      :rows="refsSettled ? rows : []"
      :loading="loading || !refsSettled"
      :sort-key="sortKey"
      sort-dir="asc"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :page-size-options="[20, 50, 100]"
      empty-text="등록된 근무지가 없습니다."
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
        <PillSearch v-model="q" placeholder="근무지 이름 또는 전화번호" @search="search" />
        <PillSelect
          v-model="programFilter"
          :options="[{ label: '사업 전체', value: '' }, ...programs.map((p) => ({ label: p.name, value: p.id }))]"
        />
      </template>
      <template #toolbar-end>
        <span class="text-sm text-muted tabular-nums">전체 {{ total.toLocaleString() }}곳</span>
      </template>

      <template #cell-program_id="{ row }">{{ programName(row.program_id) }}</template>
      <template #cell-address="{ row }">
        <span class="text-muted">{{ row.address || '—' }}</span>
      </template>
      <template #cell-care_manager_directory_id="{ row }">
        {{ personName(managers, row.care_manager_directory_id) }}
      </template>
      <template #cell-manager_directory_id="{ row }">
        {{ personName(contacts, row.manager_directory_id) }}
      </template>
      <!-- 명부는 운영관리자 전용이라 링크도 그때만. 서버가 세다 실패하면 칸이 없어 「—」 -->
      <template #cell-senior_count="{ row }">
        <span v-if="row.senior_count == null" class="text-muted">—</span>
        <NuxtLink
          v-else-if="me?.role === 'master'"
          :to="`/senior/workers?worksite=${row.id}&role=senior&status=active`"
          class="tabular-nums text-brand-500 hover:underline"
        >
          {{ row.senior_count.toLocaleString() }}명
        </NuxtLink>
        <span v-else class="tabular-nums">{{ row.senior_count.toLocaleString() }}명</span>
      </template>
      <template #cell-status="{ row }">
        <StatusBadge :tone="lifeStatusTone(row.status)">
          {{ lifeStatusLabel(row.status) }}
        </StatusBadge>
      </template>
      <template #cell-qr_token="{ row }">
        <StatusBadge :tone="row.qr_token ? 'blue' : 'gray'">
          {{ row.qr_token ? '발급됨' : '없음' }}
        </StatusBadge>
      </template>

      <template #actions="{ row }">
        <div class="flex justify-end gap-3">
          <!-- 근무지 상세 — 근무자·근무 시각(QA 2026-10-11). 명부가 master 전용이라 master 만 -->
          <NuxtLink
            v-if="me?.role === 'master'"
            :to="`/senior/worksites/${row.id}`"
            class="text-sm font-medium text-brand-500 hover:underline"
          >
            상세
          </NuxtLink>
          <button
            type="button"
            class="text-sm font-medium text-brand-500 hover:underline"
            @click="openForm(row)"
          >
            수정
          </button>
          <button
            type="button"
            class="text-sm font-medium text-body hover:text-ink"
            @click="openQr(row)"
          >
            QR
          </button>
        </div>
      </template>
    </DataTable>

    <!-- 등록·수정 -->
    <AppModal
      v-model:open="formOpen"
      :title="editing ? '근무지 수정' : '근무지 등록'"
      width="max-w-lg"
    >
      <div class="space-y-4">
        <FormField label="근무지 이름" required hint="같은 사업 안에서는 이름이 겹칠 수 없습니다.">
          <TextField v-model="form.name" placeholder="OO경로당" />
        </FormField>
        <FormField label="사업">
          <SelectField
            v-model="form.programId"
            :options="programs.map((p) => ({ label: p.name, value: p.id }))"
            placeholder="사업 선택(선택)"
          />
        </FormField>
        <FormField label="주소">
          <TextField v-model="form.address" placeholder="서울시 ..." />
        </FormField>
        <FormField label="지역 코드" hint="날씨 조회에 사용합니다.">
          <TextField v-model="form.regionCode" placeholder="예: 1168000000" />
        </FormField>
        <FormField
          label="근무지 담당자"
          hint="이 근무지에 배정된 시니어를 관리할 담당자(사회복지사)입니다."
        >
          <SelectField
            v-model="form.careManagerDirectoryId"
            :options="managers.map((m) => ({ label: `${m.name} (${fmtPhone(m.phone)})`, value: m.id }))"
            placeholder="근무지 담당자 선택(선택)"
          />
        </FormField>
        <FormField label="수요처 담당자" hint="근무지 쪽 출석 담당자(수요처 계정)입니다.">
          <SelectField
            v-model="form.managerDirectoryId"
            :options="contacts.map((m) => ({ label: m.phone ? `${m.name} (${fmtPhone(m.phone)})` : m.name, value: m.id }))"
            placeholder="수요처 담당자 선택(선택)"
          />
        </FormField>
        <FormField v-if="editing" label="상태">
          <SelectField
            v-model="form.status"
            :options="[
              { label: '활성', value: 'active' },
              { label: '종료', value: 'ended' },
            ]"
          />
        </FormField>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" @click="formOpen = false">
          취소
        </AppButton>
        <AppButton size="sm" :loading="saving" @click="submitForm">저장</AppButton>
      </template>
    </AppModal>

    <!-- QR 토큰 -->
    <AppModal v-model:open="qrOpen" :title="`${qrTarget?.name ?? ''} QR 토큰`">
      <div class="space-y-4">
        <p class="text-sm text-body">
          시니어가 이 QR을 찍어 출퇴근합니다. 인쇄해서 근무지에 붙여 주세요.
          재발급하면 기존 QR은 즉시 무효가 되니 새로 인쇄해야 합니다.
        </p>
        <!-- 발급일은 넣지 않는다 — 목록 API 가 qr_rotated_at 을 반환하지 않는다 -->
        <WorksiteQrCard ref="qrCard" :name="qrTarget?.name ?? ''" :token="qrValue" />
      </div>
      <template #footer>
        <AppButton
          v-if="qrValue"
          variant="outline"
          color="neutral"
          size="sm"
          icon="i-lucide-printer"
          @click="qrCard?.print()"
        >
          인쇄
        </AppButton>
        <AppButton
          v-if="qrValue"
          variant="outline"
          color="neutral"
          size="sm"
          icon="i-lucide-download"
          @click="qrCard?.downloadPng()"
        >
          PNG 저장
        </AppButton>
        <AppButton
          v-if="qrValue"
          variant="outline"
          color="neutral"
          size="sm"
          icon="i-lucide-copy"
          @click="copyQr"
        >
          토큰 복사
        </AppButton>
        <AppButton
          size="sm"
          color="down"
          variant="soft"
          icon="i-lucide-refresh-cw"
          :loading="rotating"
          @click="rotateQr"
        >
          재발급
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>
