<!-- 채팅방 만들기 창 — 방 이름·참여자·AI 답변을 정해 POST /dbo-admin/rooms(QA 2026-11-02 CHAT-01). 모양은 명부 등록 창을 따른다 -->
<script setup lang="ts">
import { ref, computed, shallowRef, watch } from 'vue'
import { badMemberProblems, roomCandidates } from '~/utils/personPick'
import { ROOM_TITLE_MAX, canCreateRoom, roomCreateErrorMessage } from '~/utils/roomManage'
import type { ProfileLink } from '~/composables/useRoomPeople'
import type { DirectoryEntry } from '~/types/dbo'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [roomId: string] }>()

const api = useDboAdmin()
const { candidates } = useRoomPeople()
const toast = useToast()

const title = ref('')
const profileIds = ref<string[]>([])
const aiEnabled = ref(false)
const saving = ref(false)
const error = ref('')

/** 명부와 앱 계정. 창을 열 때마다 새로 읽는다 — 그사이 앱에 가입한 분도 고를 수 있게 */
const source = shallowRef<{ rows: DirectoryEntry[]; profiles: ProfileLink[] } | null>(null)
const loading = ref(false)
const loadError = ref('')
/** 서버가 거절한 사람(bad_member) — 그 줄 비고에 「앱 미연결」/「계약 종료」 */
const problems = ref(new Map<string, string>())
const people = computed(() =>
  source.value ? roomCandidates(source.value.rows, source.value.profiles, { problems: problems.value }) : [],
)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    source.value = await candidates()
  } catch (e) {
    loadError.value = dboErrorMessage(e, '명부를 불러오지 못했습니다.')
  } finally {
    loading.value = false
  }
}

watch(open, (v) => {
  if (!v) return
  title.value = ''
  profileIds.value = []
  aiEnabled.value = false
  error.value = ''
  problems.value = new Map()
  load()
})

const canSubmit = computed(() => canCreateRoom({ title: title.value, profileIds: profileIds.value }))

async function submit() {
  if (saving.value || !canSubmit.value) return
  saving.value = true
  error.value = ''
  try {
    const res = await api.createRoom({ title: title.value.trim(), profileIds: profileIds.value, aiEnabled: aiEnabled.value })
    toast.add({ title: `방을 만들었습니다. 참여자 ${res.members}명`, color: 'success' })
    open.value = false
    emit('created', res.roomId)
  } catch (e) {
    const found = badMemberProblems(e)
    if (found) problems.value = found
    error.value = roomCreateErrorMessage(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal v-model:open="open" title="방 만들기" width="max-w-2xl">
    <div class="space-y-4">
      <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
      <FormField label="방 이름" required :hint="`${title.trim().length}/${ROOM_TITLE_MAX}자`">
        <TextField v-model="title" :maxlength="ROOM_TITLE_MAX" placeholder="햇살요양원 1조" />
      </FormField>
      <FormField
        label="참여자"
        required
        hint="앱 계정이 있는 분만 넣을 수 있습니다. 만드는 운영관리자는 참여자로 들어가지 않습니다."
      >
        <AppSpinner v-if="loading" label="명부 불러오는 중…" />
        <div v-else-if="loadError" class="flex items-center gap-3">
          <p role="alert" class="text-sm text-red-600">{{ loadError }}</p>
          <AppButton size="sm" variant="outline" color="neutral" @click="load">다시 불러오기</AppButton>
        </div>
        <PersonPicker v-else v-model="profileIds" :people="people" show-role />
      </FormField>
      <FormField label="AI 답변" hint="켜면 시니어가 쓴 메시지에 AI 가 답합니다. 지금은 만든 뒤에 바꿀 수 없습니다.">
        <div class="flex items-center gap-2">
          <Toggle v-model="aiEnabled" aria-label="AI 답변" />
          <span class="text-sm text-body">{{ aiEnabled ? '켜기' : '끄기' }}</span>
        </div>
      </FormField>
    </div>
    <template #footer>
      <AppButton variant="outline" color="neutral" size="sm" @click="open = false">취소</AppButton>
      <AppButton size="sm" :loading="saving" :disabled="!canSubmit" @click="submit">만들기</AppButton>
    </template>
  </AppModal>
</template>
