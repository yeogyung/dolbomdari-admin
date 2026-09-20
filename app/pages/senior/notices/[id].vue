<script setup lang="ts">
import type { NoticeDetail, NoticeRecipient } from '~/types/dbo'
import type { Column } from '~/types/table'
import { deliveryLabel, noticeReadLabel } from '~/utils/notices'

const api = useDboAdmin()
const route = useRoute()
useAdminHeader().setHeader('공지 수신자·미열람 관리')
const notice = ref<NoticeDetail | null>(null)
const rows = ref<NoticeRecipient[]>([])
const channel = ref('all')
const read = ref('all')
const page = ref(1)
const total = ref(0)
const q = ref('')
const loading = ref(false)
const error = ref('')
let sequence = 0
const columns: Column[] = [
  { key: 'name', label: '참여자', strong: true },
  { key: 'phone', label: '연락처' },
  { key: 'sms_status', label: '문자' },
  { key: 'push_status', label: '푸시' },
  { key: 'read_at', label: '열람 상태' },
]
async function load() {
  const current = ++sequence
  loading.value = true
  error.value = ''
  rows.value = []
  notice.value = null
  try {
    const id = String(route.params.id)
    const [detail, recipients] = await Promise.all([
      api.getNotice(id),
      api.listNoticeRecipients(id, { channel: channel.value, read: read.value, page: page.value, size: 20, q: q.value }),
    ])
    if (current !== sequence) return
    notice.value = detail
    rows.value = recipients.items
    total.value = recipients.total
  } catch (e) {
    if (current === sequence) { error.value = dboErrorMessage(e); total.value = 0 }
  } finally {
    if (current === sequence) loading.value = false
  }
}
function search() { if (page.value !== 1) page.value = 1; else load() }
watch([channel, read, () => route.params.id], search)
watch(page, load)
onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <NuxtLink to="/senior/notices" class="text-sm text-brand-500 hover:underline">공지 목록으로</NuxtLink>
    <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
    <Card v-if="notice" class="space-y-3 p-6">
      <p class="text-sm text-muted">{{ notice.kind === 'urgent' ? '긴급 공지' : '일반 공지' }}</p>
      <h1 class="text-xl font-semibold">{{ notice.title }}</h1>
      <p class="whitespace-pre-wrap break-words text-body">{{ notice.body }}</p>
      <p v-if="notice.trackedRecipients === 0" class="text-sm text-amber-700">저장된 수신자별 발송 이력이 없습니다 기존 공지의 발송 채널은 확인할 수 없습니다</p>
      <p v-if="notice.metadata.delivery?.status === 'pending' || notice.metadata.delivery?.historyFailed" class="text-sm text-amber-700">일부 발송 이력이 처리 중이거나 저장되지 않았습니다 아래 목록이 전체 발송 결과와 다를 수 있습니다</p>
    </Card>
    <p class="text-sm text-muted">문자와 푸시는 발송 접수된 참여자를 표시합니다 둘 다 발송한 경우 양쪽 필터에 포함됩니다</p>
    <p class="text-sm text-muted">문자 발송은 열람 확인이 아닙니다 앱 미가입자는 미열람 대상에서 제외됩니다 실패와 결과 미확정 내역은 전체에서 확인할 수 있습니다</p>
    <DataTable :columns="columns" :rows="rows" row-key="directory_id" :loading="loading" :total="total"
      :page="page" :page-size="20" :page-size-options="[20]" empty-text="조건에 맞는 수신자가 없습니다" @update:page="page = $event">
      <template #toolbar>
        <label class="flex items-center gap-2 text-sm">발송 채널
          <SelectField v-model="channel" :options="[{ label: '전체', value: 'all' }, { label: '문자', value: 'sms' }, { label: '푸시', value: 'push' }]" />
        </label>
        <label class="flex items-center gap-2 text-sm">열람 여부
          <SelectField v-model="read" :options="[{ label: '전체', value: 'all' }, { label: '미열람', value: 'unread' }, { label: '열람 완료', value: 'read' }]" />
        </label>
        <form class="flex gap-2" @submit.prevent="search">
          <TextField v-model="q" placeholder="이름 또는 전화번호" aria-label="참여자 검색" />
          <AppButton type="submit" variant="outline">검색</AppButton>
        </form>
        <AppButton variant="outline" @click="load">새로고침</AppButton>
      </template>
      <template #cell-sms_status="{ row }">{{ deliveryLabel(row.sms_status) }}</template>
      <template #cell-push_status="{ row }">{{ deliveryLabel(row.push_status) }}</template>
      <template #cell-read_at="{ row }">
        {{ noticeReadLabel(row as NoticeRecipient) }}
        <span v-if="row.read_at" class="block text-xs text-muted">{{ fmtStamp(row.read_at) }}</span>
      </template>
    </DataTable>
  </div>
</template>
