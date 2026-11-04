<!-- 채팅방 참여자 명단·추가·내보내기(QA 2026-11-02 CHAT-03) — 대화 보기 머리글 아래. 고르기는 방 만들기와 같은 PersonPicker -->
<script setup lang="ts">
import { ref, computed, shallowRef, watch } from 'vue'
import type { ChatRoom, DirectoryEntry } from '~/types/dbo'
import type { ProfileLink, RoomMemberRow } from '~/composables/useRoomPeople'
import { badMemberProblems, roomCandidates } from '~/utils/personPick'
import { ROOM_MEMBERS_MAX, roomEditBlock, roomMemberErrorMessage } from '~/utils/roomManage'

const props = defineProps<{ room: ChatRoom }>()
/** 명단을 다시 읽을 때마다 지금 인원 — 방 목록·머리글의 「참여 n명」을 맞춘다 */
const emit = defineEmits<{ counted: [roomId: string, members: number] }>()

const api = useDboAdmin()
const { candidates, members: readMembers } = useRoomPeople()
const toast = useToast()

const members = ref<RoomMemberRow[]>([])
const loading = ref(false)
const loadError = ref('')
/** 방을 빠르게 바꾸면 늦게 온 앞 방의 명단을 버린다 */
let sequence = 0
/** 지금 명단이 어느 방 것인가 — 다른 방을 읽는 동안 앞 방의 명단·「내보내기」를 남기지 않는다 */
let shownRoomId: string | null = null

async function load() {
  const current = ++sequence
  const roomId = props.room.id
  if (shownRoomId !== roomId) {
    members.value = []
    shownRoomId = roomId
  }
  loading.value = true
  loadError.value = ''
  try {
    const rows = await readMembers(roomId)
    if (current !== sequence) return
    members.value = rows
    emit('counted', roomId, rows.length)
  } catch (e) {
    if (current !== sequence) return
    members.value = []
    loadError.value = dboErrorMessage(e, '참여자 명단을 불러오지 못했습니다.')
  } finally {
    if (current === sequence) loading.value = false
  }
}
watch(() => props.room.id, load, { immediate: true })

/** 종료된 방·1:1 방은 바꿀 수 없다 — 버튼을 숨기고 까닭을 적는다(서버 409 와 같은 문구) */
const block = computed(() => roomEditBlock(props.room))

const nameOf = (m: RoomMemberRow) => m.profile?.name ?? '알 수 없음'

/* 내보내기 — 확인 창(공지 발송 확인 창 모양: 제목 질문 + 본문 + 취소/실행) */
const removing = ref<RoomMemberRow | null>(null)
const removeOpen = computed({
  get: () => removing.value !== null,
  set: (v: boolean) => {
    if (!v && !removeBusy.value) removing.value = null
  },
})
const removeBusy = ref(false)
async function confirmRemove() {
  const m = removing.value
  if (!m || removeBusy.value) return
  removeBusy.value = true
  try {
    await api.removeRoomMember(props.room.id, m.profile_id)
    toast.add({ title: `${nameOf(m)} 님을 내보냈습니다.`, color: 'success' })
  } catch (e) {
    // 응답을 못 받은 경우도 있어 「못 했다」고 단정하지 않는다 — 문구가 까닭을 말한다
    toast.add({ title: roomMemberErrorMessage(e, 'remove'), color: 'error' })
  } finally {
    removeBusy.value = false
    removing.value = null
    // 성공·실패 모두 다시 읽는다 — 응답을 못 받았거나 그새 바뀐 명단을 맞춘다
    load()
  }
}

/* 참여자 추가 — 방 만들기와 같은 고르기. 이미 들어와 있는 분은 「참여 중」 회색 */
const addOpen = ref(false)
const addIds = ref<string[]>([])
const addError = ref('')
const addBusy = ref(false)
const source = shallowRef<{ rows: DirectoryEntry[]; profiles: ProfileLink[] } | null>(null)
const sourceLoading = ref(false)
const sourceError = ref('')
const problems = ref(new Map<string, string>())
const memberIds = computed(() => new Set(members.value.map((m) => m.profile_id)))
const people = computed(() =>
  source.value
    ? roomCandidates(source.value.rows, source.value.profiles, { members: memberIds.value, problems: problems.value })
    : [],
)

async function loadSource() {
  sourceLoading.value = true
  sourceError.value = ''
  try {
    source.value = await candidates()
  } catch (e) {
    sourceError.value = dboErrorMessage(e, '명부를 불러오지 못했습니다.')
  } finally {
    sourceLoading.value = false
  }
}
function openAdd() {
  addIds.value = []
  addError.value = ''
  problems.value = new Map()
  addOpen.value = true
  loadSource()
}
// 다른 방으로 옮기면 열어 둔 추가 창을 닫는다 — 앞 방에 넣지 않게
watch(
  () => props.room.id,
  () => {
    addOpen.value = false
    removing.value = null
  },
)

const canAdd = computed(() => addIds.value.length > 0 && addIds.value.length <= ROOM_MEMBERS_MAX)
async function submitAdd() {
  if (addBusy.value || !canAdd.value) return
  const roomId = props.room.id
  addBusy.value = true
  addError.value = ''
  try {
    const res = await api.addRoomMembers(roomId, addIds.value)
    toast.add({ title: `참여자 ${res.added}명을 넣었습니다.`, color: 'success' })
    addOpen.value = false
  } catch (e) {
    const message = roomMemberErrorMessage(e, 'add')
    if (addOpen.value && roomId === props.room.id) {
      const found = badMemberProblems(e)
      if (found) problems.value = found
      addError.value = message
    } else {
      toast.add({ title: message, color: 'error' })
    }
  } finally {
    addBusy.value = false
    if (roomId === props.room.id) load()
  }
}
</script>

<template>
  <section class="border-b border-hairline-soft px-8 py-4" aria-label="참여자">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-ink">
        <!-- 못 읽었으면 수를 적지 않는다 — 「0명」으로 읽히지 않게 -->
        참여자 <span class="tabular-nums text-muted">{{ loading ? '…' : loadError ? '—' : `${members.length}명` }}</span>
      </h3>
      <p v-if="block" class="text-xs text-muted">{{ block }}</p>
      <AppButton v-else size="sm" variant="outline" color="neutral" icon="i-lucide-user-plus" @click="openAdd">
        참여자 추가
      </AppButton>
    </div>
    <p v-if="loadError" role="alert" class="mt-2 text-sm text-red-600">{{ loadError }}</p>
    <p v-else-if="!loading && !members.length" class="mt-2 text-sm text-muted">참여자가 없습니다.</p>
    <!-- 명단은 길어질 수 있어 높이를 묶는다 — 대화가 아래로 밀리지 않게 -->
    <ul v-else class="mt-2 max-h-40 divide-y divide-hairline-soft overflow-y-auto">
      <li v-for="m in members" :key="m.profile_id" class="flex items-center gap-2 py-1.5 text-sm">
        <span class="truncate font-medium text-ink">{{ nameOf(m) }}</span>
        <Tag v-if="m.profile?.role">{{ ROLE_LABELS[m.profile.role] ?? m.profile.role }}</Tag>
        <span class="text-xs text-muted tabular-nums">{{ fmtStamp(m.joined_at) }} 참여</span>
        <AppButton
          v-if="!block"
          size="sm"
          variant="ghost"
          color="down"
          class="ml-auto"
          :disabled="removeBusy"
          @click="removing = m"
        >
          내보내기
        </AppButton>
      </li>
    </ul>

    <AppModal v-model:open="removeOpen" title="참여자를 내보낼까요?" width="max-w-md">
      <div v-if="removing" class="space-y-2 text-sm text-body">
        <p>{{ nameOf(removing) }} 님을 「{{ room.title }}」에서 내보냅니다.</p>
        <p class="text-muted">그분의 앱 채팅 목록에서 이 방이 사라지고 메시지를 보낼 수 없습니다. 지난 대화는 지우지 않습니다.</p>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" :disabled="removeBusy" @click="removing = null">취소</AppButton>
        <AppButton size="sm" color="down" :loading="removeBusy" @click="confirmRemove">내보내기</AppButton>
      </template>
    </AppModal>

    <!-- 넣는 중에는 닫지 않는다(방 만들기 창과 같다). 다른 방으로 옮겨 닫혔으면 실패를 알림으로 띄운다 -->
    <AppModal v-model:open="addOpen" title="참여자 추가" width="max-w-2xl" :before-close="() => !addBusy">
      <div class="space-y-4">
        <p v-if="addError" role="alert" class="text-sm text-red-600">{{ addError }}</p>
        <FormField
          :label="`「${room.title}」에 넣을 분`"
          required
          hint="앱 계정이 있는 분만 넣을 수 있습니다. 넣은 분은 지난 대화도 모두 봅니다."
        >
          <AppSpinner v-if="sourceLoading" label="명부 불러오는 중…" />
          <div v-else-if="sourceError" class="flex items-center gap-3">
            <p role="alert" class="text-sm text-red-600">{{ sourceError }}</p>
            <AppButton size="sm" variant="outline" color="neutral" @click="loadSource">다시 불러오기</AppButton>
          </div>
          <PersonPicker v-else v-model="addIds" :people="people" show-role />
        </FormField>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" :disabled="addBusy" @click="addOpen = false">취소</AppButton>
        <AppButton size="sm" :loading="addBusy" :disabled="!canAdd" @click="submitAdd">추가</AppButton>
      </template>
    </AppModal>
  </section>
</template>
