<!-- 문자 실패 모아 보기 — 보낸 날로 접수 실패·수신 실패 문자를 모아 본다 (QA ANOTICE-05, GET /dbo-admin/sms/messages?result=failed) -->
<script setup lang="ts">
import type { NoticeSms } from '~/types/dbo'
import type { Column } from '~/types/table'

const api = useDboAdmin()
const toast = useToast()
useAdminHeader().setHeader('문자 실패 모아 보기', [{ label: '공지·미열람 관리', to: '/senior/notices' }])

// 기간·페이지는 주소에 담는다 — 공지 상세에 다녀와도 그대로다(리포트에서 그달로 열기도 한다). 기간은 「조회」를 눌러야 정해진다
const lq = useListQuery({ page: 1, from: daysAgoSeoul(29), to: todaySeoul() }, { committed: ['from', 'to'] })
const page = lq.page
const from = lq.from
const to = lq.to
const rows = ref<NoticeSms[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
/** 옛 서버(경로 없음) — 표 대신 안내한다 */
const unsupported = ref(false)

const columns: Column[] = [
  { key: 'created_at', label: '보낸 시각', strong: true },
  { key: 'notice', label: '공지 제목' },
  { key: 'name', label: '이름' },
  { key: 'phone', label: '번호' },
  { key: 'sms_result', label: '결과' },
  { key: 'sms_reason', label: '사유' },
]

/** 조회 순번 — 늦게 온 이전 응답이 새 결과를 덮지 않게 마지막 요청만 반영한다 */
let sequence = 0
async function load() {
  const current = ++sequence
  loading.value = true
  error.value = ''
  try {
    const res = await api.listSmsMessages({
      result: 'failed',
      from: lq.committedOf('from') || undefined,
      to: lq.committedOf('to') || undefined,
      page: page.value,
      size: 20,
    })
    if (current !== sequence) return
    rows.value = res.items
    total.value = res.total
    unsupported.value = false
  } catch (e) {
    if (current !== sequence) return
    rows.value = []
    total.value = 0
    unsupported.value = smsListUnsupported(e)
    if (!unsupported.value) error.value = dboErrorMessage(e, '문자 결과를 불러오지 못했습니다.')
  } finally {
    if (current === sequence) loading.value = false
  }
}

function search() {
  const bad = smsListRangeError(from.value, to.value)
  if (bad) {
    toast.add({ title: bad, color: 'warning' })
    return
  }
  lq.commit()
  if (page.value !== 1) page.value = 1
  else load()
}
watch(page, load)
onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <NuxtLink to="/senior/notices" class="text-sm text-brand-500 hover:underline">공지 목록으로</NuxtLink>

    <EmptyState v-if="unsupported" icon="i-lucide-info" :title="SMS_LIST_UNSUPPORTED" />

    <template v-else>
      <!-- 조회 조건 — 모양은 출퇴근 기록·삭제 기록의 기간 카드를 따른다 -->
      <AppCard>
        <div class="flex flex-wrap items-end gap-4">
          <FormField label="보낸 날 시작">
            <DateField v-model="from" />
          </FormField>
          <FormField label="보낸 날 종료">
            <DateField v-model="to" />
          </FormField>
          <AppButton size="sm" icon="i-lucide-search" @click="search">조회</AppButton>
        </div>
        <p class="mt-3 text-xs text-muted">
          긴급 공지 문자 가운데 문자 업체가 받지 않았거나(보내지 못함) 휴대폰에 닿지 못한(수신 실패) 문자입니다. 다시 알림 문자도
          들어 있습니다. 결과는 보낸 뒤 30분 안에 채워집니다.
        </p>
      </AppCard>

      <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>

      <DataTable
        :columns="columns"
        :rows="rows"
        :loading="loading"
        :total="total"
        :page="page"
        :page-size="20"
        :page-size-options="[20]"
        empty-text="이 기간에 실패한 문자가 없습니다."
        @update:page="page = $event"
      >
        <template #toolbar-end>
          <span class="text-sm text-muted tabular-nums">전체 {{ total.toLocaleString() }}건</span>
          <AppButton variant="outline" @click="load">새로고침</AppButton>
        </template>
        <template #cell-created_at="{ row }">{{ fmtStamp(row.created_at) }}</template>
        <template #cell-notice="{ row }">
          <NuxtLink :to="`/senior/notices/${row.notice_id}`" class="text-brand-500 hover:underline">
            {{ row.notice?.title ?? '—' }}
          </NuxtLink>
          <Tag v-if="row.source === 'resend'" class="ml-1.5">다시 알림</Tag>
        </template>
        <template #cell-name="{ row }">{{ row.senior?.name ?? '—' }}</template>
        <!-- 번호는 명부·출퇴근 기록처럼 가리지 않고 하이픈만 넣는다(fmtPhone) -->
        <template #cell-phone="{ row }"><span class="tabular-nums">{{ fmtPhone(row.senior?.phone) }}</span></template>
        <template #cell-sms_result="{ row }">
          <span class="text-down">{{ smsResultLabel(row.sms_result, null) }}</span>
        </template>
        <template #cell-sms_reason="{ row }">{{ row.sms_reason ?? '—' }}</template>
      </DataTable>
    </template>
  </div>
</template>
