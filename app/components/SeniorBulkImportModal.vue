<!-- 참여자 일괄 등록 — 파일(xlsx·csv)이나 붙여넣은 목록으로 시니어를 한 명씩 차례로 등록한다(QA 2026-10-14 10번) -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { downloadExcel, readSheetRows } from '~/utils/excel'
import { parseImportRows, runImport, splitPasted, type ImportRow, type ImportStatus } from '~/utils/seniorBulkImport'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ done: [] }>()

const api = useDboAdmin()
const toast = useToast()
const fileInput = ref<HTMLInputElement | null>(null)
const pasted = ref('')
const rows = ref<ImportRow[]>([])
const running = ref(false)
const finished = ref(false)
const stopRequested = ref(false)
const progress = ref(0)

const count = (s: ImportStatus) => rows.value.filter((r) => r.status === s).length
const readyCount = computed(() => count('ok'))
const STATUS: Record<ImportStatus, { label: string; tone: 'green' | 'red' | 'amber' | 'blue' | 'gray' }> = {
  ok: { label: '등록 가능', tone: 'blue' },
  invalid: { label: '오류', tone: 'red' },
  duplicate: { label: '파일 안 중복', tone: 'amber' },
  done: { label: '등록됨', tone: 'green' },
  taken: { label: '이미 등록됨', tone: 'gray' },
  failed: { label: '실패', tone: 'red' },
  skipped: { label: '건너뜀', tone: 'gray' },
}

function reset() {
  rows.value = []
  pasted.value = ''
  finished.value = false
  progress.value = 0
}

// 보내는 중에는 닫지 않는다. 닫으면 어디까지 등록됐는지 알 수 없게 된다
function setOpen(v: boolean) {
  if (running.value) return
  open.value = v
  if (!v) {
    if (finished.value) emit('done')
    reset()
  }
}

async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    rows.value = parseImportRows(await readSheetRows(file))
  } catch {
    toast.add({ title: '파일을 읽지 못했습니다.', description: 'xlsx 또는 csv 파일인지 확인해 주세요.', color: 'warning' })
  }
}

function readPasted() {
  rows.value = parseImportRows(splitPasted(pasted.value))
}

function downloadTemplate() {
  downloadExcel('참여자_등록_양식', [], [
    { key: 'name', label: '이름' },
    { key: 'phone', label: '전화번호' },
    { key: 'memo', label: '메모' },
  ])
}

async function start() {
  running.value = true
  stopRequested.value = false
  progress.value = 0
  try {
    await runImport(
      rows.value,
      (r) => api.createDirectory({ name: r.name, phone: r.phone, role: 'senior', memo: r.memo || null }),
      () => stopRequested.value,
      () => {
        progress.value++
        rows.value = [...rows.value]
      },
    )
  } finally {
    rows.value = [...rows.value]
    running.value = false
    finished.value = true
  }
}

function downloadFailures() {
  const bad = rows.value.filter((r) => ['invalid', 'duplicate', 'failed', 'skipped'].includes(r.status))
  downloadExcel(
    '참여자_등록_실패',
    bad.map((r) => ({ line: r.line, name: r.name, phone: r.phone, memo: r.memo, reason: r.reason ?? STATUS[r.status].label })),
    [
      { key: 'line', label: '행' },
      { key: 'name', label: '이름' },
      { key: 'phone', label: '전화번호' },
      { key: 'memo', label: '메모' },
      { key: 'reason', label: '사유' },
    ],
  )
}
</script>

<template>
  <AppModal :open="open" title="참여자 일괄 등록" width="max-w-3xl" @update:open="setOpen">
    <div class="space-y-4">
      <template v-if="!rows.length">
        <p class="text-sm text-muted">
          이름·전화번호(·메모) 칸이 있는 엑셀이나 csv 파일을 올리거나, 한 줄에 한 명씩 붙여 넣어 주세요. 시니어로
          등록되며 근무지 배정은 등록 뒤 상세 화면에서 합니다.
        </p>
        <div class="flex gap-2">
          <AppButton icon="i-lucide-file-up" @click="fileInput?.click()">파일 선택</AppButton>
          <AppButton variant="outline" color="neutral" icon="i-lucide-download" @click="downloadTemplate">
            양식 다운로드
          </AppButton>
        </div>
        <input ref="fileInput" type="file" class="hidden" accept=".xlsx,.xls,.csv" @change="onPick" />
        <FormField label="또는 목록 붙여넣기" hint="예) 홍길동, 010-1234-5678 — 엑셀에서 복사해 붙여 넣어도 됩니다">
          <AppTextarea v-model="pasted" :rows="6" />
        </FormField>
        <AppButton variant="outline" :disabled="!pasted.trim()" @click="readPasted">목록 읽기</AppButton>
      </template>

      <template v-else>
        <p class="text-sm text-body">
          <template v-if="!finished && !running">
            등록 가능 {{ readyCount }}명 · 오류 {{ count('invalid') }} · 파일 안 중복 {{ count('duplicate') }}
          </template>
          <template v-else-if="running">등록 중 {{ progress }} / {{ readyCount + progress }}</template>
          <template v-else>
            등록됨 {{ count('done') }} · 이미 등록됨 {{ count('taken') }} · 실패 {{ count('failed') }} · 건너뜀
            {{ count('skipped') }}. 중간에 멈춰도 앞서 등록된 사람은 그대로 남습니다.
          </template>
        </p>
        <div class="max-h-[50vh] overflow-y-auto rounded-lg border border-hairline">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-surface-soft text-left text-muted">
              <tr>
                <th class="px-3 py-2">행</th>
                <th class="px-3 py-2">이름</th>
                <th class="px-3 py-2">전화번호</th>
                <th class="px-3 py-2">상태</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r.line" class="border-t border-hairline">
                <td class="px-3 py-2 tabular-nums text-muted">{{ r.line }}</td>
                <td class="px-3 py-2">{{ r.name || '—' }}</td>
                <td class="px-3 py-2 tabular-nums">{{ r.phone ? fmtPhone(r.phone) : '—' }}</td>
                <td class="px-3 py-2">
                  <StatusBadge :tone="STATUS[r.status].tone">{{ STATUS[r.status].label }}</StatusBadge>
                  <span v-if="r.reason" class="ml-2 text-xs text-muted">{{ r.reason }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <template #footer>
      <template v-if="running">
        <AppButton variant="outline" color="neutral" size="sm" :disabled="stopRequested" @click="stopRequested = true">
          중단
        </AppButton>
      </template>
      <template v-else-if="finished">
        <AppButton variant="outline" color="neutral" size="sm" icon="i-lucide-download" @click="downloadFailures">
          실패 목록 내려받기
        </AppButton>
        <AppButton size="sm" @click="setOpen(false)">닫기</AppButton>
      </template>
      <template v-else>
        <AppButton v-if="rows.length" variant="outline" color="neutral" size="sm" @click="reset">다시 고르기</AppButton>
        <AppButton size="sm" :disabled="readyCount === 0" @click="start">{{ readyCount }}명 등록</AppButton>
      </template>
    </template>
  </AppModal>
</template>
