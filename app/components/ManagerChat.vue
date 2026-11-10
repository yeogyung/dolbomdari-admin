<!-- 담당자의 채팅(QA 2026-11-07 MGR-02 · ACCT-03, 결정 D35) — 본인이 든 방만 보고 답장한다. 조회는 supabase 직접(RLS 멤버), 보내기는 앱 API. Figma 없음 -->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { managerRoomTitle, messagePreview, type ManagerRoom, type ManagerMessage } from '~/utils/managerChat'

const supabase = useSupabase()
const app = useDboApp()
const toast = useToast()
const route = useRoute()

const meId = ref<string | null>(null)
const rooms = ref<ManagerRoom[]>([])
const loadingRooms = ref(false)
const roomsError = ref('')
const selectedId = ref<string | null>(null)
const selected = computed(() => rooms.value.find((r) => r.id === selectedId.value) ?? null)
const messages = ref<ManagerMessage[]>([])
const loadingMessages = ref(false)
const draft = ref('')
const sending = ref(false)
const scroller = ref<HTMLElement | null>(null)
let channel: RealtimeChannel | null = null
let roomSequence = 0
let messageSequence = 0

async function loadRooms() {
  const current = ++roomSequence
  loadingRooms.value = true
  roomsError.value = ''
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('세션이 없습니다. 다시 로그인해 주세요.')
    meId.value = session.user.id
    const { data: roomRows, error: e1 } = await supabase
      .from('dbo_rooms')
      .select('id, title, kind, status')
      .is('deleted_at', null)
    if (e1) throw e1
    const ids = (roomRows ?? []).map((r: { id: string }) => r.id)
    if (!ids.length) {
      if (current === roomSequence) rooms.value = []
      return
    }
    const [members, unread, last] = await Promise.all([
      supabase.from('dbo_room_members').select('room_id, profile_id, profile:dbo_profiles(name)').in('room_id', ids),
      supabase.rpc('dbo_unread_counts'),
      supabase
        .from('dbo_messages')
        .select('room_id, body, sender_type, created_at')
        .in('room_id', ids)
        .order('created_at', { ascending: false })
        .limit(500),
    ])
    for (const r of [members, unread, last]) if (r.error) throw r.error
    if (current !== roomSequence) return
    const unreadBy = new Map(((unread.data ?? []) as { room_id: string; unread: number }[]).map((u) => [u.room_id, Number(u.unread) || 0]))
    const lastBy = new Map<string, { body: string | null; sender_type: string; created_at: string }>()
    for (const m of (last.data ?? []) as { room_id: string; body: string | null; sender_type: string; created_at: string }[]) {
      if (!lastBy.has(m.room_id)) lastBy.set(m.room_id, m)
    }
    const membersBy = new Map<string, { profileId: string; name: string }[]>()
    for (const m of (members.data ?? []) as unknown as { room_id: string; profile_id: string; profile: { name: string | null } | null }[]) {
      const list = membersBy.get(m.room_id) ?? []
      list.push({ profileId: m.profile_id, name: m.profile?.name ?? '' })
      membersBy.set(m.room_id, list)
    }
    rooms.value = (roomRows ?? [])
      .map((r: { id: string; title: string | null; kind: string; status: string }) => ({
        id: r.id,
        title: r.title,
        kind: r.kind,
        status: r.status,
        members: membersBy.get(r.id) ?? [],
        unread: unreadBy.get(r.id) ?? 0,
        lastAt: lastBy.get(r.id)?.created_at ?? null,
        lastPreview: lastBy.has(r.id) ? messagePreview(lastBy.get(r.id)!) : '',
      }))
      .sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))
  } catch (e) {
    if (current === roomSequence) roomsError.value = dboErrorMessage(e, '채팅방을 불러오지 못했습니다.')
  } finally {
    if (current === roomSequence) loadingRooms.value = false
  }
}

async function loadMessages() {
  const id = selectedId.value
  if (!id) return
  const current = ++messageSequence
  loadingMessages.value = true
  try {
    const { data, error: e } = await supabase
      .from('dbo_messages')
      .select('id, sender_type, sender_id, body, created_at, sender:dbo_profiles(name, role), attachments:dbo_attachments(id, kind, filename)')
      .eq('room_id', id)
      .order('created_at', { ascending: false })
      .limit(200)
    if (e) throw e
    if (current !== messageSequence) return
    messages.value = ((data ?? []) as unknown as ManagerMessage[]).reverse()
    await nextTick()
    scroller.value?.scrollTo({ top: scroller.value.scrollHeight })
    markRead(id)
  } catch (e) {
    if (current === messageSequence) toast.add({ title: '대화를 불러오지 못했습니다.', description: dboErrorMessage(e), color: 'error' })
  } finally {
    if (current === messageSequence) loadingMessages.value = false
  }
}

/** 읽음 — 내 멤버 행의 last_read_at 만 고칠 수 있다(열 권한). 실패해도 화면은 그대로 */
async function markRead(roomId: string) {
  if (!meId.value) return
  const { error: e } = await supabase
    .from('dbo_room_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('room_id', roomId)
    .eq('profile_id', meId.value)
  if (e) return
  const room = rooms.value.find((r) => r.id === roomId)
  if (room) room.unread = 0
}

function subscribe(roomId: string) {
  if (channel) supabase.removeChannel(channel)
  channel = supabase
    .channel(`admin-room:${roomId}:${Date.now()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dbo_messages', filter: `room_id=eq.${roomId}` }, () => {
      loadMessages()
    })
    .subscribe()
}

function open(id: string) {
  if (selectedId.value === id) return
  selectedId.value = id
  messages.value = []
  draft.value = ''
}
watch(selectedId, (id) => {
  if (!id) return
  loadMessages()
  subscribe(id)
})

async function send() {
  const room = selected.value
  const body = draft.value.trim()
  if (!room || !body || sending.value) return
  sending.value = true
  try {
    await app.sendMessage(room.id, body)
    draft.value = ''
    await loadMessages()
    loadRooms()
  } catch (e: any) {
    const code = e?.data?.error
    toast.add({
      title: code === 'room_closed' ? '종료된 방이라 보낼 수 없습니다.' : '보내지 못했습니다.',
      description: code === 'room_closed' ? undefined : dboErrorMessage(e),
      color: 'error',
    })
  } finally {
    sending.value = false
  }
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    send()
  }
}

onMounted(async () => {
  await loadRooms()
  const fromQuery = typeof route.query.room === 'string' ? route.query.room : ''
  if (fromQuery && rooms.value.some((r) => r.id === fromQuery)) open(fromQuery)
})
onBeforeUnmount(() => {
  if (channel) supabase.removeChannel(channel)
})
</script>

<template>
  <div class="grid items-start gap-6 lg:grid-cols-[340px_1fr]">
    <AppCard class="overflow-hidden">
      <div class="flex items-center justify-between border-b border-line px-4 py-3">
        <p class="text-sm font-semibold">내가 든 채팅방 {{ rooms.length }}</p>
        <AppButton variant="outline" size="sm" :loading="loadingRooms" @click="loadRooms">새로고침</AppButton>
      </div>
      <p v-if="roomsError" role="alert" class="px-4 py-3 text-sm text-red-600">{{ roomsError }}</p>
      <p v-else-if="!loadingRooms && !rooms.length" class="px-4 py-8 text-center text-sm text-muted">든 채팅방이 없습니다.</p>
      <button
        v-for="r in rooms"
        :key="r.id"
        type="button"
        class="flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-surface-muted"
        :class="r.id === selectedId ? 'bg-brand-50' : ''"
        @click="open(r.id)"
      >
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold">
            {{ managerRoomTitle(r, meId) }}
            <span v-if="r.status === 'closed'" class="text-xs font-normal text-muted">(종료)</span>
          </p>
          <p class="truncate text-xs text-muted">{{ r.lastPreview || '아직 대화가 없습니다' }}</p>
        </div>
        <span v-if="r.unread" class="rounded-full bg-brand-500 px-2 py-0.5 text-xs font-bold text-white">{{ r.unread }}</span>
      </button>
    </AppCard>

    <AppCard class="flex min-h-[480px] flex-col overflow-hidden">
      <template v-if="selected">
        <div class="border-b border-line px-4 py-3">
          <p class="text-sm font-semibold">{{ managerRoomTitle(selected, meId) }}</p>
          <p class="text-xs text-muted">{{ selected.members.map((m) => m.name).filter(Boolean).join(', ') }}</p>
        </div>
        <div ref="scroller" class="max-h-[60vh] flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <p v-if="loadingMessages && !messages.length" class="text-center text-sm text-muted">불러오는 중…</p>
          <div v-for="m in messages" :key="m.id" class="flex" :class="m.sender_id === meId ? 'justify-end' : 'justify-start'">
            <div class="max-w-[75%]">
              <p v-if="m.sender_id !== meId" class="mb-0.5 text-xs text-muted">
                {{ m.sender_type === 'ai' ? 'AI 도우미' : m.sender_type === 'system' ? '안내' : (m.sender?.name ?? '') }}
              </p>
              <div
                class="whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm"
                :class="m.sender_id === meId ? 'bg-brand-500 text-white' : 'bg-surface-muted'"
              >
                {{ m.body }}
                <p v-for="a in m.attachments ?? []" :key="a.id" class="text-xs opacity-80">[{{ a.kind === 'image' ? '사진' : '파일' }}{{ a.filename ? ` ${a.filename}` : '' }} — 앱에서 볼 수 있습니다]</p>
              </div>
              <p class="mt-0.5 text-[11px] text-muted" :class="m.sender_id === meId ? 'text-right' : ''">{{ fmtStamp(m.created_at) }}</p>
            </div>
          </div>
        </div>
        <div class="flex items-end gap-2 border-t border-line px-4 py-3">
          <AppTextarea
            v-model="draft"
            class="flex-1"
            :rows="2"
            :disabled="selected.status === 'closed'"
            :placeholder="selected.status === 'closed' ? '종료된 방입니다' : '답장을 입력하세요 (Enter 보내기, Shift+Enter 줄바꿈)'"
            @keydown="onKey"
          />
          <AppButton :loading="sending" :disabled="!draft.trim() || selected.status === 'closed'" @click="send">보내기</AppButton>
        </div>
      </template>
      <p v-else class="m-auto text-sm text-muted">왼쪽에서 채팅방을 고르세요.</p>
    </AppCard>
  </div>
</template>
