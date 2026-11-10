<!-- 참여자 정보·메모 창(QA 2026-11-07 MGR-05) — 근무표에서 이름을 누르면 연다. 읽기는 RLS(담당자는 맡은 근무지에 배정된 분), 쓰기는 앱 메모 API. Figma 없음 -->
<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ directoryId: string | null; name: string }>()
const open = defineModel<boolean>('open', { default: false })
const supabase = useSupabase()
const app = useDboApp()
const toast = useToast()

type Note = { id: string; body: string; author_name: string | null; author_role: string | null; created_at: string }
const phone = ref<string | null>(null)
const notes = ref<Note[]>([])
const loading = ref(false)
const error = ref('')
const draft = ref('')
const saving = ref(false)

async function load() {
  const id = props.directoryId
  if (!id) return
  loading.value = true
  error.value = ''
  try {
    const [person, list] = await Promise.all([
      supabase.from('dbo_directory').select('phone').eq('id', id).maybeSingle(),
      supabase
        .from('dbo_member_notes')
        .select('id, body, author_name, author_role, created_at')
        .eq('directory_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
    ])
    if (person.error) throw person.error
    if (list.error) throw list.error
    phone.value = (person.data as { phone: string | null } | null)?.phone ?? null
    notes.value = (list.data ?? []) as Note[]
  } catch (e) {
    error.value = dboErrorMessage(e, '참여자 정보를 불러오지 못했습니다.')
  } finally {
    loading.value = false
  }
}
watch(open, (v) => {
  if (!v) return
  draft.value = ''
  notes.value = []
  phone.value = null
  load()
})

async function add() {
  const body = draft.value.trim()
  if (!props.directoryId || !body || saving.value) return
  saving.value = true
  try {
    await app.addMemberNote(props.directoryId, body)
    draft.value = ''
    await load()
  } catch (e) {
    toast.add({ title: '메모를 남기지 못했습니다.', description: dboErrorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal v-model:open="open" :title="`${name} 정보·메모`" width="max-w-lg">
    <div class="space-y-4">
      <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
      <p class="text-sm">연락처 <span class="font-semibold tabular-nums">{{ phone ? fmtPhone(phone) : '—' }}</span></p>
      <FormField label="새 메모" hint="담당자·운영관리자만 봅니다">
        <AppTextarea v-model="draft" :rows="3" placeholder="예: 무릎이 불편해 계단 작업은 빼 주세요" />
      </FormField>
      <div class="flex justify-end">
        <AppButton size="sm" :loading="saving" :disabled="!draft.trim() || draft.length > 2000" @click="add">메모 남기기</AppButton>
      </div>
      <p v-if="loading && !notes.length" class="text-sm text-muted">불러오는 중…</p>
      <p v-else-if="!notes.length" class="text-sm text-muted">남긴 메모가 없습니다.</p>
      <ul v-else class="max-h-72 space-y-2 overflow-y-auto">
        <li v-for="n in notes" :key="n.id" class="rounded-lg border border-hairline px-3 py-2">
          <p class="whitespace-pre-wrap text-sm">{{ n.body }}</p>
          <p class="mt-1 text-xs text-muted">{{ n.author_name ?? '—' }} · {{ fmtStamp(n.created_at) }}</p>
        </li>
      </ul>
    </div>
    <template #footer>
      <AppButton variant="outline" color="neutral" size="sm" @click="open = false">닫기</AppButton>
    </template>
  </AppModal>
</template>
