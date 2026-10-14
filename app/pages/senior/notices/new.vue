<!-- 공지 작성 — 근무지·유형·제목·내용을 골라 발송한다(앱 API POST /dbo/notices, QA 2026-10-14 15번) -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Program, Worksite } from '~/types/dbo'
import { BODY_MAX, NOTICE_LEVELS, TITLE_MAX, type NoticeLevel } from '~/utils/noticeCompose'

const api = useDboAdmin()
const app = useDboApp()
const toast = useToast()
useAdminHeader().setHeader('공지 작성', [{ label: '공지·미열람 관리', to: '/senior/notices' }])

const worksites = ref<Worksite[]>([])
const programs = ref<Program[]>([])
const refsLoading = ref(true)
const worksiteIds = ref<string[]>([])
const level = ref<NoticeLevel>('simple')
const title = ref('')
const body = ref('')
const sending = ref(false)
const confirmOpen = ref(false)
const error = ref('')
// 화면이 열릴 때 한 번 만든다. 응답이 끊겨 다시 눌러도 서버가 같은 공지로 묶는다
const requestId = crypto.randomUUID()

const canSubmit = computed(() =>
  canSubmitNotice({ worksiteIds: worksiteIds.value, title: title.value, body: body.value }),
)
const levelLabel = computed(() => NOTICE_LEVELS.find((l) => l.value === level.value)!.label)

onMounted(async () => {
  try {
    const [ws, ps] = await Promise.all([api.listAllWorksites(), api.listPrograms()])
    worksites.value = ws.filter((w) => w.status !== 'ended')
    programs.value = ps.items
  } catch (e) {
    error.value = dboErrorMessage(e)
  } finally {
    refsLoading.value = false
  }
})

async function send() {
  if (sending.value || !canSubmit.value) return
  sending.value = true
  error.value = ''
  try {
    const res = await app.createNotice(
      buildNoticeBody({
        level: level.value,
        worksiteIds: worksiteIds.value,
        title: title.value,
        body: body.value,
        requestId,
      }),
    )
    toast.add({ title: res.duplicate ? '이미 발송된 공지입니다.' : '공지를 발송했습니다.', color: 'success' })
    await navigateTo(`/senior/notices/${res.id}`)
  } catch (e) {
    error.value = createNoticeErrorMessage(e)
    confirmOpen.value = false
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <Teleport to="#admin-topbar-actions">
      <AppButton variant="outline" color="neutral" icon="i-lucide-arrow-left" @click="navigateTo('/senior/notices')">
        목록
      </AppButton>
      <AppButton icon="i-lucide-send" :disabled="!canSubmit" @click="confirmOpen = true">발송</AppButton>
    </Teleport>

    <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>

    <AppCard padding="lg">
      <div class="space-y-5">
        <FormField label="받는 근무지" required hint="고른 근무지에 배정된 시니어에게 갑니다.">
          <AppSpinner v-if="refsLoading" label="근무지 불러오는 중…" />
          <WorksitePicker v-else v-model="worksiteIds" :worksites="worksites" :programs="programs" multiple />
        </FormField>
        <FormField label="공지 유형" required>
          <div class="flex gap-2">
            <button
              v-for="l in NOTICE_LEVELS"
              :key="l.value"
              type="button"
              class="rounded-full border px-4 py-1.5 text-sm font-medium transition-colors"
              :class="level === l.value ? 'border-brand-500 bg-brand-500 text-white' : 'border-hairline text-body hover:bg-surface-soft'"
              @click="level = l.value"
            >
              {{ l.label }}
            </button>
          </div>
        </FormField>
        <FormField label="제목" required :hint="`${title.trim().length}/${TITLE_MAX}자`">
          <TextField v-model="title" :maxlength="TITLE_MAX" />
        </FormField>
        <FormField label="내용" required :hint="`${body.trim().length}/${BODY_MAX}자`">
          <AppTextarea v-model="body" :rows="8" :maxlength="BODY_MAX" />
        </FormField>
      </div>
    </AppCard>

    <AppModal v-model:open="confirmOpen" title="이대로 보낼까요?" width="max-w-md">
      <div class="space-y-2 text-sm text-body">
        <p>근무지 {{ worksiteIds.length }}곳에 {{ levelLabel }} 공지를 보냅니다.</p>
        <p v-if="level === 'urgent'" class="font-medium text-brand-500">
          긴급 공지는 모두에게 문자도 함께 나갑니다. 나간 문자는 회수할 수 없습니다.
        </p>
        <p v-else class="text-muted">문자는 나가지 않고 앱 알림으로만 갑니다.</p>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" @click="confirmOpen = false">취소</AppButton>
        <AppButton size="sm" :loading="sending" @click="send">보내기</AppButton>
      </template>
    </AppModal>
  </div>
</template>
