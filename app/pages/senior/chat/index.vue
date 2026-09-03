<!-- 채팅방 열람 — 방 목록 + 대화 읽기 + 활성/종료 전환 (/dbo-admin/rooms) -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { ChatMessage, ChatRoom } from '~/types/dbo'

const api = useDboAdmin()
const toast = useToast()
const { setHeader } = useAdminHeader()
setHeader('채팅방')

const rooms = ref<ChatRoom[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const q = ref('')
const loadingRooms = ref(false)

const selected = ref<ChatRoom | null>(null)
const messages = ref<ChatMessage[]>([])
const loadingMessages = ref(false)
const updating = ref(false)

const lastPage = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

async function loadRooms() {
  loadingRooms.value = true
  try {
    const res = await api.listRooms({ page: page.value, size: pageSize, q: q.value })
    rooms.value = res.items
    total.value = res.total
    if (!selected.value && res.items.length) openRoom(res.items[0]!)
  } catch (e: any) {
    toast.add({ title: '채팅방 조회 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    loadingRooms.value = false
  }
}

async function openRoom(room: ChatRoom) {
  selected.value = room
  loadingMessages.value = true
  messages.value = []
  try {
    const res = await api.listRoomMessages(room.id)
    messages.value = res.items
  } catch (e: any) {
    toast.add({ title: '대화 조회 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    loadingMessages.value = false
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
  loadRooms()
}

function goPage(p: number) {
  if (p < 1 || p > lastPage.value) return
  page.value = p
  loadRooms()
}

const senderName = (m: ChatMessage) =>
  (m.sender_name as string) || (m.sender_type === 'ai' ? 'AI 도움말' : '알 수 없음')
const isAi = (m: ChatMessage) => m.sender_type === 'ai'

onMounted(loadRooms)
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[340px_1fr]">
    <!-- 방 목록 -->
    <AppCard padding="none">
      <template #header>
        <h2 class="text-[18px] font-semibold text-ink">채팅방</h2>
        <span class="text-sm text-muted tabular-nums">{{ total.toLocaleString() }}개</span>
      </template>

      <div class="p-4">
        <PillSearch v-model="q" placeholder="방 이름 검색" width="w-full" @search="search" />
      </div>

      <AppSpinner v-if="loadingRooms" label="불러오는 중…" />
      <EmptyState v-else-if="!rooms.length" description="채팅방이 없습니다." />
      <ul v-else class="max-h-[60vh] overflow-y-auto">
        <li v-for="room in rooms" :key="room.id">
          <button
            type="button"
            class="flex w-full flex-col gap-1.5 border-t border-hairline-soft px-6 py-4 text-left transition-colors"
            :class="selected?.id === room.id ? 'bg-brand-soft' : 'hover:bg-surface-soft'"
            @click="openRoom(room)"
          >
            <span class="flex items-center gap-2">
              <span class="truncate text-[15px] font-semibold text-ink">{{ room.title }}</span>
              <StatusBadge :tone="room.status === 'active' ? 'green' : 'gray'">
                {{ room.status === 'active' ? '활성' : '종료' }}
              </StatusBadge>
            </span>
            <span class="flex items-center gap-2 text-xs text-muted">
              <span>{{ room.kind === 'direct' ? '1:1' : '단체' }}</span>
              <span v-if="room.ai_enabled" class="text-brand-500">AI 사용</span>
              <span>{{ fmtStamp(room.created_at) }}</span>
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
            {{ selected.ai_enabled ? 'AI 답변 사용' : 'AI 답변 없음' }} ·
            개설 {{ fmtStamp(selected.created_at) }}
          </p>
        </div>
        <h2 v-else class="text-[18px] font-semibold text-ink">대화</h2>
        <AppButton
          v-if="selected"
          size="sm"
          :variant="selected.status === 'active' ? 'soft' : 'solid'"
          :color="selected.status === 'active' ? 'down' : 'primary'"
          :loading="updating"
          @click="toggleStatus"
        >
          {{ selected.status === 'active' ? '방 종료' : '방 다시 열기' }}
        </AppButton>
      </template>

      <div class="min-h-[420px] px-8 py-6">
        <AppSpinner v-if="loadingMessages" label="대화를 불러오는 중…" />
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
          </li>
        </ul>
      </div>
    </AppCard>
  </div>
</template>
