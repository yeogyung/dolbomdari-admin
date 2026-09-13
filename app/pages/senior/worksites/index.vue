<!-- 근무지·수요처 관리 — 목록/등록/수정 + QR 토큰 재발급 (/dbo-admin/worksites) -->
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { Column } from '~/types/table'
import type { DirectoryEntry, LifeStatus, Program, Worksite } from '~/types/dbo'

const api = useDboAdmin()
const toast = useToast()
const { setHeader } = useAdminHeader()
setHeader('근무지·수요처')

const rows = ref<Worksite[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const q = ref('')
const sortKey = ref('name')
const loading = ref(false)

const programs = ref<Program[]>([])
const managers = ref<DirectoryEntry[]>([])

const programName = (pid: string | null) =>
  pid ? (programs.value.find((p) => p.id === pid)?.name ?? pid) : '—'
const managerName = (did: string | null) =>
  did ? (managers.value.find((m) => m.id === did)?.name ?? did) : '—'

const columns: Column[] = [
  { key: 'name', label: '근무지', sortable: true, strong: true },
  { key: 'program_id', label: '사업' },
  { key: 'address', label: '주소' },
  { key: 'manager_directory_id', label: '수요처 담당자' },
  { key: 'status', label: '상태' },
  { key: 'qr_token', label: 'QR' },
]

async function load() {
  loading.value = true
  try {
    const res = await api.listWorksites({
      page: page.value,
      size: pageSize.value,
      q: q.value,
      sort: sortKey.value,
    })
    rows.value = res.items
    total.value = res.total
  } catch (e: any) {
    toast.add({ title: '근무지 조회 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    loading.value = false
  }
}

async function loadRefs() {
  try {
    const [pg, dir] = await Promise.all([
      api.listPrograms(),
      api.listDirectory({ size: 100, status: 'active' }),
    ])
    programs.value = pg.items
    managers.value = dir.items.filter((d) => d.role === 'manager')
  } catch {
    // 사업·담당자 목록은 선택 편의용이다.
  }
}

function search() {
  page.value = 1
  load()
}

function toggleSort(key: string) {
  sortKey.value = key
  page.value = 1
  load()
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
        status: row.status,
      }
    : {
        name: '',
        programId: null,
        address: '',
        regionCode: '',
        managerDirectoryId: null,
        status: 'active',
      }
  formOpen.value = true
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
    }
    if (editing.value) {
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
      <AppButton icon="i-lucide-plus" @click="openForm()">근무지 등록</AppButton>
    </Teleport>

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
      </template>
      <template #toolbar-end>
        <span class="text-sm text-muted tabular-nums">전체 {{ total.toLocaleString() }}곳</span>
      </template>

      <template #cell-program_id="{ row }">{{ programName(row.program_id) }}</template>
      <template #cell-address="{ row }">
        <span class="text-muted">{{ row.address || '—' }}</span>
      </template>
      <template #cell-manager_directory_id="{ row }">
        {{ managerName(row.manager_directory_id) }}
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
        <FormField label="수요처 담당자" hint="명부에 등록된 담당자만 선택할 수 있습니다.">
          <SelectField
            v-model="form.managerDirectoryId"
            :options="managers.map((m) => ({ label: `${m.name} (${fmtPhone(m.phone)})`, value: m.id }))"
            placeholder="담당자 선택(선택)"
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
