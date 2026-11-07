<!-- 채팅방 열람 — 방 목록 + 대화 읽기 + 활성/종료 전환 (/dbo-admin/rooms) -->
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { ChatMessage, ChatRoom } from '~/types/dbo'
import type { RoomStats } from '~/composables/useRoomStats'
import { ROOM_AI_OPTIONS, ROOM_KIND_OPTIONS, ROOM_STATUS_OPTIONS, roomFilterQuery } from '~/utils/roomFilters'

const api = useDboAdmin()
const route = useRoute()
const { statsFor } = useRoomStats()
const { room: readRoom } = useRoomPeople()
const toast = useToast()
/** 방을 여는 중에는 다른 방을 열지 않는다 — 늦게 온 응답이 다른 방 메시지를 덮지 않게 */
const openGuard = createClickGuard()
const { setHeader } = useAdminHeader()
setHeader('채팅방')

const rooms = ref<ChatRoom[]>([])
const total = ref(0)
// 검색어·필터·페이지는 주소에 담는다 — 다른 화면에 다녀와도 그대로다. 검색어는 「검색」 때 싣는다
const lq = useListQuery({ page: 1, q: '', status: '', kind: '', ai: '' }, { committed: ['q'] })
const page = lq.page
const pageSize = 20
const q = lq.q
/** 상태·종류·AI 사용 필터(QA 2026-11-07 ADMIN-01). 서버가 걸러 쪽·개수가 맞는다 */
const statusFilter = lq.status
const kindFilter = lq.kind
const aiFilter = lq.ai
const filtering = computed(() => !!(lq.committedOf('q') || statusFilter.value || kindFilter.value || aiFilter.value))
const loadingRooms = ref(false)

/** 방별 참여 인원·마지막 메시지 시각(QA 2026-11-02 CHAT-02). 못 읽으면 비어 있고 그 칸만 안 보인다 */
const stats = ref(new Map<string, RoomStats>())

const selected = ref<ChatRoom | null>(null)
const messages = ref<ChatMessage[]>([])
const loadingMessages = ref(false)
const updating = ref(false)
/** 대화를 받은 시각 — 첨부 서명 주소(1시간)가 만료됐는지 본다(QA 2026-11-02 CHAT-04) */
const messagesAt = ref<number | null>(null)
/** 브라우저가 못 읽은 사진(만료 등)의 첨부 id. 대화를 다시 받으면 비운다 */
const brokenAttachments = ref(new Set<string>())
/** 같은 방의 대화를 다시 받는 중(새로고침) — 보던 대화는 그대로 둔다 */
const reloading = ref(false)

const lastPage = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

/** 조회 순번 — 조건을 빠르게 바꾸면 늦게 온 이전 응답이 새 결과를 덮지 않게 마지막 요청만 반영한다 */
let sequence = 0
async function loadRooms() {
  const current = ++sequence
  loadingRooms.value = true
  try {
    const res = await api.listRooms({
      page: page.value,
      size: pageSize,
      q: lq.committedOf('q'),
      ...roomFilterQuery({ status: statusFilter.value, kind: kindFilter.value, ai: aiFilter.value }),
    })
    if (current !== sequence) return
    rooms.value = res.items
    total.value = res.total
    if (!selected.value && res.items.length) openRoom(res.items[0]!)
    // 덧붙이는 정보다. 실패해도 목록은 그대로 두고 알린다 — 조용히 비우면 「인원 0」처럼 읽힌다
    stats.value = new Map()
    statsFor(res.items)
      .then((m) => {
        if (current === sequence) stats.value = m
      })
      .catch((e: any) => {
        if (current !== sequence) return
        toast.add({ title: '참여 인원·최근 메시지를 불러오지 못했습니다.', description: dboErrorMessage(e), color: 'warning' })
      })
  } catch (e: any) {
    if (current !== sequence) return
    toast.add({ title: '채팅방 조회 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    if (current === sequence) loadingRooms.value = false
  }
}

/**
 * 방을 열어 대화를 받는다. `keep` 은 같은 방을 다시 받을 때다(첨부 주소 만료·새로고침) — 보던 대화를 비우지 않고
 * 받은 뒤에 바꿔 끼운다. 비우면 스크롤이 맨 위로 튀고, 다시 받기가 실패하면 보던 대화가 사라진다
 */
async function openRoom(room: ChatRoom, keep = false) {
  selected.value = room
  if (keep) {
    reloading.value = true
  } else {
    loadingMessages.value = true
    messages.value = []
    messagesAt.value = null
    brokenAttachments.value = new Set()
  }
  try {
    const res = await api.listRoomMessages(room.id)
    // 다른 방을 그새 눌렀으면 이 응답은 버린다 — 앞 방의 대화가 뒤 방 제목 아래 보이지 않게
    if (selected.value?.id !== room.id) return
    messages.value = res.items
    messagesAt.value = Date.now()
    brokenAttachments.value = new Set()
  } catch (e: any) {
    if (selected.value?.id !== room.id) return
    toast.add({ title: '대화 조회 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    if (keep) reloading.value = false
    else if (selected.value?.id === room.id) loadingMessages.value = false
  }
}

async function toggleStatus() {
  if (!selected.value) return
  const next = selected.value.status === 'active' ? 'closed' : 'active'
  if (
    next === 'closed' &&
    !confirm('이 채팅방을 종료하시겠습니까? 앱에서 새 메시지를 보낼 수 없게 됩니다.')
  )
    return
  updating.value = true
  try {
    await api.updateRoom(selected.value.id, { status: next })
    selected.value = { ...selected.value, status: next }
    const idx = rooms.value.findIndex((r) => r.id === selected.value!.id)
    if (idx >= 0) rooms.value[idx] = { ...rooms.value[idx]!, status: next }
    toast.add({ title: next === 'active' ? '방을 다시 열었습니다.' : '방을 종료했습니다.', color: 'success' })
  } catch (e: any) {
    toast.add({ title: '상태 변경 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    updating.value = false
  }
}

function search() {
  page.value = 1
  lq.commit()
  loadRooms()
}

watch([statusFilter, kindFilter, aiFilter], search)

// 조회 Promise 를 돌려준다 — 이전·다음 버튼(AppButton)이 끝날 때까지 다시 눌리지 않게
function goPage(p: number) {
  if (p < 1 || p > lastPage.value) return
  page.value = p
  return loadRooms()
}

const senderName = (m: ChatMessage) =>
  (m.sender_name as string) || (m.sender_type === 'ai' ? 'AI 도움말' : '알 수 없음')
const isAi = (m: ChatMessage) => m.sender_type === 'ai'

/** 대화를 다시 받는다 — 첨부 주소가 1시간 뒤 만료되고, 그새 온 메시지도 보인다 */
const reloadMessages = () => (selected.value ? openGuard.run(() => openRoom(selected.value!, true)) : undefined)

/** 만료된 주소를 열면 오류 쪽이 뜬다. 그 전에 막고 대화를 다시 받는다 — 다시 누르면 새 주소로 열린다 */
function openAttachment(e: MouseEvent) {
  if (!attachmentUrlsExpired(messagesAt.value, Date.now())) return
  e.preventDefault()
  toast.add({ title: '사진·파일 주소가 만료되어 대화를 다시 불러옵니다.', description: '다시 눌러 주세요.', color: 'warning' })
  reloadMessages()
}

/** 참여자 명단을 다시 읽을 때마다 목록·머리글의 「참여 n명」을 맞춘다(QA 2026-11-02 CHAT-03 — 넣고 뺀 뒤) */
function onMembersCounted(roomId: string, members: number) {
  const s = stats.value.get(roomId)
  if (s && s.members !== members) stats.value.set(roomId, { ...s, members })
}

/** 방 만들기 창(QA 2026-11-02 CHAT-01) */
const createOpen = ref(false)
/** 만들면 목록을 첫 쪽부터 다시 읽고, 새 방이 보이면 연다 */
async function onRoomCreated(roomId: string) {
  page.value = 1
  await loadRooms()
  const room = rooms.value.find((r) => r.id === roomId)
  if (room) openGuard.run(() => openRoom(room))
}

/**
 * 방 하나를 id 로 연다 — 지금 목록 쪽에 없어도 연다(명부 상세의 「참여 중인 채팅방」, QA 2026-11-07 ADMIN-03).
 * 목록에 있으면 그 줄을 쓰고, 없으면 방을 직접 읽는다
 */
async function openRoomById(roomId: string) {
  const inList = rooms.value.find((r) => r.id === roomId)
  if (inList) return openRoom(inList)
  try {
    const room = await readRoom(roomId)
    if (room) return openRoom(room)
    toast.add({ title: '채팅방을 찾을 수 없습니다.', color: 'warning' })
  } catch (e: any) {
    toast.add({ title: '채팅방 조회 실패', description: dboErrorMessage(e), color: 'error' })
  }
}

// `?room=<id>` 로 왔으면 그 방을 먼저 연다. 목록은 그다음에 읽는다 — 먼저 읽으면 첫 방이 잠깐 열렸다 바뀐다
onMounted(async () => {
  const roomId = typeof route.query.room === 'string' ? route.query.room : ''
  if (roomId) await openRoomById(roomId)
  loadRooms()
})
</script>

<template>
  <!-- items-start: 두 카드가 서로의 높이를 따라 늘어나지 않게 한다 — 긴 대화가 방 목록 카드까지 키우던 문제 -->
  <div class="grid items-start gap-6 lg:grid-cols-[340px_1fr]">
    <!-- 방 만들기 — 공지 목록의 「공지 작성」처럼 머리글 오른쪽 버튼 -->
    <Teleport to="#admin-topbar-actions">
      <AppButton icon="i-lucide-message-square-plus" @click="createOpen = true">방 만들기</AppButton>
    </Teleport>
    <RoomCreateModal v-model:open="createOpen" @created="onRoomCreated" />

    <!-- 방 목록 -->
    <AppCard padding="none">
      <template #header>
        <h2 class="text-[18px] font-semibold text-ink">채팅방</h2>
        <span class="text-sm text-muted tabular-nums">{{ loadingRooms ? '…' : total.toLocaleString() }}개</span>
      </template>

      <div class="space-y-2 p-4">
        <PillSearch v-model="q" placeholder="방 이름 검색" width="w-full" @search="search" />
        <div class="flex flex-wrap gap-2">
          <PillSelect v-model="statusFilter" :options="ROOM_STATUS_OPTIONS" />
          <PillSelect v-model="kindFilter" :options="ROOM_KIND_OPTIONS" />
          <PillSelect v-model="aiFilter" :options="ROOM_AI_OPTIONS" />
        </div>
      </div>

      <AppSpinner v-if="loadingRooms" label="불러오는 중…" />
      <EmptyState v-else-if="!rooms.length" :description="filtering ? '조건에 맞는 채팅방이 없습니다.' : '채팅방이 없습니다.'" />
      <ul v-else class="max-h-[60vh] overflow-y-auto">
        <li v-for="room in rooms" :key="room.id">
          <button
            type="button"
            class="flex w-full flex-col gap-1.5 border-t border-hairline-soft px-6 py-4 text-left transition-colors"
            :class="selected?.id === room.id ? 'bg-brand-soft' : 'hover:bg-surface-soft'"
            :disabled="openGuard.pending.value"
            @click="openGuard.run(() => openRoom(room))"
          >
            <span class="flex items-center gap-2">
              <span class="truncate text-[15px] font-semibold text-ink">{{ room.title }}</span>
              <StatusBadge :tone="room.status === 'active' ? 'green' : 'gray'">
                {{ room.status === 'active' ? '활성' : '종료' }}
              </StatusBadge>
            </span>
            <span class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
              <span>{{ room.kind === 'direct' ? '1:1' : '단체' }}</span>
              <span v-if="stats.has(room.id)" class="tabular-nums">참여 {{ stats.get(room.id)!.members }}명</span>
              <span v-if="room.ai_enabled" class="text-brand-500">AI 사용</span>
              <!-- 날짜는 마지막 메시지 시각이다. 예전에는 개설 시각이라 대화가 오간 방도 오래된 방처럼 보였다 -->
              <span v-if="stats.has(room.id)" class="tabular-nums">
                {{ stats.get(room.id)!.lastMessageAt ? `최근 ${fmtStamp(stats.get(room.id)!.lastMessageAt!)}` : '메시지 없음' }}
              </span>
            </span>
          </button>
        </li>
      </ul>

      <div v-if="total > pageSize" class="flex items-center justify-between border-t border-hairline-soft px-6 py-4">
        <AppButton
          variant="outline"
          color="neutral"
          size="sm"
          :disabled="page <= 1"
          @click="goPage(page - 1)"
        >
          이전
        </AppButton>
        <span class="text-sm text-muted tabular-nums">{{ page }} / {{ lastPage }}</span>
        <AppButton
          variant="outline"
          color="neutral"
          size="sm"
          :disabled="page >= lastPage"
          @click="goPage(page + 1)"
        >
          다음
        </AppButton>
      </div>
    </AppCard>

    <!-- 대화 -->
    <AppCard padding="none">
      <template #header>
        <div v-if="selected">
          <h2 class="text-[18px] font-semibold text-ink">{{ selected.title }}</h2>
          <p class="mt-0.5 text-sm text-muted">
            {{ selected.kind === 'direct' ? '1:1 대화' : '단체방' }} ·
            <template v-if="stats.has(selected.id)">참여 {{ stats.get(selected.id)!.members }}명 · </template>
            {{ selected.ai_enabled ? 'AI 답변 사용' : 'AI 답변 없음' }} ·
            개설 {{ fmtStamp(selected.created_at) }}
          </p>
        </div>
        <h2 v-else class="text-[18px] font-semibold text-ink">대화</h2>
        <div v-if="selected" class="flex items-center gap-2">
          <!-- 새로고침은 리포트 화면의 버튼 모양을 따른다 -->
          <AppButton
            size="sm"
            variant="outline"
            color="neutral"
            icon="i-lucide-refresh-cw"
            :loading="reloading"
            :disabled="loadingMessages || openGuard.pending.value"
            @click="reloadMessages"
          >
            새로고침
          </AppButton>
          <AppButton
            size="sm"
            :variant="selected.status === 'active' ? 'soft' : 'solid'"
            :color="selected.status === 'active' ? 'down' : 'primary'"
            :loading="updating"
            @click="toggleStatus"
          >
            {{ selected.status === 'active' ? '방 종료' : '방 다시 열기' }}
          </AppButton>
        </div>
      </template>

      <!-- 참여자 명단·추가·내보내기(QA CHAT-03) -->
      <RoomMembersPanel v-if="selected" :room="selected" @counted="onMembersCounted" />

      <!-- 대화는 길어질 수 있어 높이를 묶고 안에서 스크롤한다 -->
      <div class="max-h-[65vh] min-h-[420px] overflow-y-auto px-8 py-6">
        <!-- 방 목록을 받는 중이면 곧 첫 방이 열린다 — 「방을 선택해 주세요」를 먼저 띄우지 않는다 -->
        <AppSpinner v-if="loadingMessages || (!selected && loadingRooms)" label="대화를 불러오는 중…" />
        <EmptyState
          v-else-if="!selected"
          icon="i-lucide-message-square"
          description="왼쪽에서 채팅방을 선택해 주세요."
        />
        <EmptyState v-else-if="!messages.length" description="아직 주고받은 메시지가 없습니다." />
        <ul v-else class="space-y-4">
          <li v-for="m in messages" :key="m.id" class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold" :class="isAi(m) ? 'text-brand-500' : 'text-ink'">
                {{ senderName(m) }}
              </span>
              <Tag v-if="m.sender_role">{{ ROLE_LABELS[String(m.sender_role)] ?? m.sender_role }}</Tag>
              <span class="text-xs text-muted">{{ fmtStamp(m.created_at) }}</span>
            </div>
            <p
              class="max-w-[70ch] rounded-2xl px-4 py-3 text-[15px] whitespace-pre-wrap"
              :class="isAi(m) ? 'bg-brand-soft text-ink' : 'bg-surface-soft text-body'"
            >
              {{ m.body }}
            </p>
            <!-- 첨부(QA CHAT-04). 사진은 썸네일, 누르면 새 탭에 원본 — 수요처 가입 서류(OrgReviewPanel)와 같은 모양 -->
            <div v-if="messageAttachments(m).length" class="flex max-w-[70ch] flex-wrap items-start gap-2">
              <template v-for="a in messageAttachments(m)" :key="a.id">
                <a
                  v-if="attachmentView(a, brokenAttachments.has(a.id)) === 'image'"
                  :href="a.url!"
                  target="_blank"
                  rel="noopener"
                  @click="openAttachment"
                >
                  <img
                    :src="a.url!"
                    :alt="a.filename"
                    class="max-h-48 max-w-full rounded-lg border border-hairline object-contain"
                    @error="brokenAttachments.add(a.id)"
                  />
                </a>
                <a
                  v-else-if="attachmentView(a, brokenAttachments.has(a.id)) === 'file'"
                  :href="a.url!"
                  target="_blank"
                  rel="noopener"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-sm text-brand-500 hover:underline"
                  @click="openAttachment"
                >
                  <UIcon name="i-lucide-file-down" class="size-4 shrink-0" />
                  <span class="truncate">{{ a.filename }}</span>
                  <span class="shrink-0 text-xs text-muted tabular-nums">{{ fmtBytes(a.byte_size) }}</span>
                </a>
                <span
                  v-else
                  class="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-sm text-muted"
                >
                  <UIcon name="i-lucide-triangle-alert" class="size-4 shrink-0" />
                  {{ attachmentUnavailableText(a) }}
                </span>
              </template>
            </div>
          </li>
        </ul>
      </div>
    </AppCard>
  </div>
</template>
