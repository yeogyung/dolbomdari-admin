<!-- 기관 상세 「기관 정보」의 사업자등록증 행 — 등록 여부만 보이고 (보기)로 새 창에서 연다. 관리자가 대신 등록·교체(master 전용) -->
<script setup lang="ts">
import { ORG_DOCUMENT_ACCEPT } from '#shared/orgDocument'

const props = defineProps<{ managers: Record<string, any>[] }>()

const api = useAdminApi()
const toast = useToast()
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const viewing = ref(false)
/** 이 화면에서 방금 올린 담당자 — 목록을 다시 부르지 않고 표시만 바꾼다 */
const uploadedId = ref<string | null>(null)

// 서류는 담당자마다 따로 있다. 기관의 서류는 승인된 담당자 것을 먼저, 없으면 최근 수정순(목록 정렬) 첫 담당자 것으로 본다
const pick = (list: Record<string, any>[]) => list.find((m) => m.approval_status === 'approved') ?? list[0]
const ownerId = computed<string | null>(
  () => uploadedId.value ?? pick(props.managers.filter((m) => m.document_path))?.id ?? null,
)
// 새로 올리면 서류 주인 것을 바꾸고(교체), 서류가 없으면 같은 규칙으로 고른 담당자에게 붙인다
const targetId = computed<string | null>(() => ownerId.value ?? pick(props.managers)?.id ?? null)

async function view() {
  if (!ownerId.value) return
  // 주소를 받은 뒤에 열면 팝업 차단에 걸린다 — 누른 순간 빈 창부터 연다
  const win = window.open('', '_blank')
  if (!win) {
    toast.add({ title: '새 창이 차단되었습니다.', description: '브라우저에서 팝업을 허용해 주세요.', color: 'warning' })
    return
  }
  win.opener = null
  viewing.value = true
  try {
    const url = await api.orgDocumentUrl(ownerId.value)
    if (!url) throw new Error('서류를 찾을 수 없습니다.')
    win.location.href = url
  } catch (e: any) {
    win.close()
    toast.add({ title: '서류 열기 실패', description: e?.data?.statusMessage || e.message, color: 'error' })
  } finally {
    viewing.value = false
  }
}

async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  const id = targetId.value
  if (!file || !id) return
  // 교체 확인은 파일을 고른 뒤에 묻는다 — 먼저 물으면 확인창에 머문 사이 클릭 허용 시간이 지나 선택창이 안 뜰 수 있다
  if (ownerId.value && !confirm('등록된 사업자등록증을 새 파일로 바꾸시겠습니까?')) return
  uploading.value = true
  try {
    await api.uploadOrgDocument(id, file)
    uploadedId.value = id
    toast.add({ title: '사업자등록증을 등록했습니다.', color: 'success' })
  } catch (e: any) {
    toast.add({ title: '등록 실패', description: e?.data?.statusMessage || e.message, color: 'error' })
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="grid grid-cols-[8rem_1fr] gap-4 border-b border-hairline-soft py-3.5 text-sm">
    <dt class="font-medium text-muted">사업자 등록증</dt>
    <dd class="flex min-w-0 flex-wrap items-center gap-2 text-body">
      <template v-if="ownerId">
        등록 됨
        <button
          type="button"
          class="font-medium text-brand-500 hover:underline disabled:opacity-50"
          :disabled="viewing"
          @click="view"
        >
          (보기)
        </button>
      </template>
      <span v-else class="text-muted">미등록</span>
      <AppButton
        size="sm"
        variant="outline"
        color="neutral"
        :icon="ownerId ? 'i-lucide-refresh-cw' : 'i-lucide-upload'"
        :loading="uploading"
        @click="fileInput?.click()"
      >
        {{ ownerId ? '교체' : '등록' }}
      </AppButton>
      <input ref="fileInput" type="file" class="hidden" :accept="ORG_DOCUMENT_ACCEPT" @change="onPick" />
    </dd>
  </div>
</template>
