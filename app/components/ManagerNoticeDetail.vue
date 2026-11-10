<!-- 담당자의 공지 열람 현황(QA 2026-11-07 MGR-01) — 본문(RLS) + 앱 API 의 열람 집계·미열람자·읽은 분·다시 알리기. Figma 없음 -->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { noticeTypeLabel } from '~/utils/notices'
import {
  type NoticeReader,
  type NoticeReadStats,
  type NoticeUnreadPerson,
  canResend,
  channelLabel,
  readSummary,
  resendSummary,
} from '~/utils/managerNotices'

const props = defineProps<{ id: string }>()
const supabase = useSupabase()
const app = useDboApp()
const toast = useToast()

type Notice = { id: string; title: string; body: string | null; kind: 'normal' | 'urgent'; is_special: boolean; published_at: string | null }
const notice = ref<Notice | null>(null)
const stats = ref<NoticeReadStats | null>(null)
const unread = ref<NoticeUnreadPerson[]>([])
const readers = ref<NoticeReader[]>([])
const tab = ref<'unread' | 'read'>('unread')
const loading = ref(false)
const error = ref('')
const picked = ref(new Set<string>())
const resending = ref(false)
let sequence = 0

async function load() {
  const current = ++sequence
  loading.value = true
  error.value = ''
  try {
    const [{ data, error: e }, u, r] = await Promise.all([
      supabase.from('dbo_notices').select('id, title, body, kind, is_special, published_at').eq('id', props.id).maybeSingle(),
      app.noticeUnread(props.id),
      app.noticeReaders(props.id),
    ])
    if (e) throw e
    if (current !== sequence) return
    if (!data) throw Object.assign(new Error('not_found'), { status: 404 })
    notice.value = data as Notice
    stats.value = u.stats
    unread.value = u.people
    readers.value = r.people
    picked.value = new Set([...picked.value].filter((id) => u.people.some((p) => p.directoryId === id && canResend(p))))
  } catch (e) {
    if (current !== sequence) return
    error.value = (e as any)?.status === 403
      ? '이 공지의 열람 현황을 볼 권한이 없습니다. 내가 보냈거나 맡은 근무지의 공지만 볼 수 있습니다.'
      : dboErrorMessage(e, '공지를 불러오지 못했습니다.')
  } finally {
    if (current === sequence) loading.value = false
  }
}
watch(() => props.id, () => {
  notice.value = null
  picked.value = new Set()
  load()
})
onMounted(load)

const resendable = computed(() => unread.value.filter((p) => canResend(p)))
const allPicked = computed(() => resendable.value.length > 0 && resendable.value.every((p) => picked.value.has(p.directoryId)))
function togglePick(id: string) {
  const next = new Set(picked.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  picked.value = next
}
function toggleAll() {
  picked.value = allPicked.value ? new Set() : new Set(resendable.value.map((p) => p.directoryId))
}

async function resend() {
  const ids = [...picked.value]
  if (!ids.length) return
  if (!window.confirm(`${ids.length}명에게 다시 알릴까요? 앱 알림, 앱이 없는 분은 문자로 갑니다.`)) return
  resending.value = true
  try {
    const r = await app.resendNotice(props.id, ids)
    toast.add({ title: resendSummary(r), color: r.notSent || r.sms.failed || r.push.failed ? 'warning' : 'success' })
    picked.value = new Set()
    await load()
  } catch (e) {
    toast.add({ title: '다시 알리지 못했습니다.', description: dboErrorMessage(e), color: 'error' })
  } finally {
    resending.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
    <AppCard v-if="notice" class="space-y-2 p-5">
      <div class="flex items-center gap-2">
        <Tag>{{ noticeTypeLabel(notice) }}</Tag>
        <h2 class="text-lg font-bold">{{ notice.title }}</h2>
      </div>
      <p class="text-xs text-muted">{{ notice.published_at ? fmtStamp(notice.published_at) : '미발행' }}</p>
      <p class="whitespace-pre-wrap text-sm">{{ notice.body }}</p>
      <p class="pt-2 text-sm font-semibold">{{ readSummary(stats) }}</p>
    </AppCard>

    <div v-if="notice" class="space-y-3">
      <div class="flex items-center gap-2">
        <PillSelect v-model="tab" :options="[{ label: `안 읽은 분 ${unread.length}`, value: 'unread' }, { label: `읽은 분 ${readers.length}`, value: 'read' }]" />
        <AppButton variant="outline" size="sm" :loading="loading" @click="load">새로고침</AppButton>
        <AppButton v-if="tab === 'unread'" class="ml-auto" size="sm" icon="i-lucide-bell-ring" :loading="resending" :disabled="!picked.size" @click="resend">
          고른 {{ picked.size }}명 다시 알리기
        </AppButton>
      </div>

      <div v-if="tab === 'unread'" class="overflow-hidden rounded-lg border border-line bg-surface">
        <div class="flex items-center gap-3 border-b border-line px-4 py-2 text-xs font-semibold text-muted">
          <Checkbox :model-value="allPicked" :disabled="!resendable.length" aria-label="다시 알릴 수 있는 분 모두 고르기" @update:model-value="toggleAll" />
          <span class="flex-1">참여자</span><span class="w-36">받는 방법</span><span class="w-40">다시 알림</span>
        </div>
        <p v-if="!unread.length" class="px-4 py-6 text-center text-sm text-muted">모두 읽었습니다.</p>
        <div v-for="p in unread" :key="p.directoryId" class="flex items-center gap-3 border-b border-line px-4 py-2 text-sm last:border-b-0">
          <Checkbox :model-value="picked.has(p.directoryId)" :disabled="!canResend(p)" :aria-label="`${p.name} 고르기`" @update:model-value="togglePick(p.directoryId)" />
          <span class="flex-1">{{ p.name }} <span class="text-xs text-muted">{{ p.phone ? fmtPhone(p.phone) : '' }}</span></span>
          <span class="w-36 text-xs">{{ channelLabel(p.channel) }}</span>
          <span class="w-40 text-xs text-muted">
            {{ p.cooldownUntil && !canResend(p) ? `${fmtClock(p.cooldownUntil)} 뒤 가능` : p.lastResentAt ? `${fmtStamp(p.lastResentAt)} 보냄` : '—' }}
          </span>
        </div>
      </div>

      <div v-else class="overflow-hidden rounded-lg border border-line bg-surface">
        <p v-if="!readers.length" class="px-4 py-6 text-center text-sm text-muted">아직 읽은 분이 없습니다.</p>
        <div v-for="p in readers" :key="p.directoryId" class="flex items-center gap-3 border-b border-line px-4 py-2 text-sm last:border-b-0">
          <span class="flex-1">{{ p.name }}</span>
          <span class="text-xs text-muted">{{ p.method === 'confirm' ? '확인 누름' : '열어 봄' }} · {{ p.readAt ? fmtStamp(p.readAt) : '시각 없음' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
