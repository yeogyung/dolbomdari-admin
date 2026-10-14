<!-- 기관 담당자 상세 — 가입 검토 상태·반려 사유·제출 서류와 승인/반려 처리(master 전용) -->
<script setup lang="ts">
import { orgApprovalLabel, orgApprovalTone } from '#shared/orgApproval'

const props = defineProps<{ managerId: string; record: Record<string, any> }>()
const emit = defineEmits<{ changed: [] }>()

const api = useAdminApi()
const toast = useToast()
const { me } = useAdminRole()
const isMaster = computed(() => me.value?.role === 'master')

const status = computed(() => String(props.record.approval_status ?? ''))
const docUrl = ref<string | null>(null)
const docLoading = ref(true)
const deciding = ref<'approved' | 'rejected' | null>(null)
const rejectOpen = ref(false)
const reason = ref('')

async function loadDocument() {
  docLoading.value = true
  try {
    docUrl.value = await api.orgDocumentUrl(props.managerId)
  } catch (e: any) {
    toast.add({ title: '서류 조회 실패', description: e?.data?.statusMessage || e.message, color: 'error' })
  } finally {
    docLoading.value = false
  }
}

async function decide(decision: 'approved' | 'rejected') {
  if (decision === 'approved' && !confirm('이 기관을 승인하시겠습니까? 승인하면 바로 기관 기능을 쓸 수 있고, 담당자에게 문자와 알림이 갑니다.')) return
  deciding.value = decision
  try {
    const res = await api.action('review-organization', {
      managerId: props.managerId,
      decision,
      reason: decision === 'rejected' ? reason.value.trim() : undefined,
    })
    toast.add({ title: decision === 'approved' ? '승인되었습니다.' : '반려되었습니다.', color: 'success' })
    if (!res.smsSent) {
      toast.add({ title: '문자 발송 실패', description: res.reason, color: 'error' })
    }
    rejectOpen.value = false
    reason.value = ''
    emit('changed')
  } catch (e: any) {
    toast.add({ title: '처리 실패', description: e?.data?.statusMessage || e.message, color: 'error' })
  } finally {
    deciding.value = null
  }
}

// 롤은 비동기로 들어온다 — master 로 확인된 뒤에만 서류를 부른다(서버도 master 만 허용)
watch(isMaster, (v) => { if (v) loadDocument() }, { immediate: true })
</script>

<template>
  <AppCard padding="lg">
    <template #header>
      <div class="flex items-center gap-3">
        <h2 class="text-[18px] font-semibold text-ink">가입 검토</h2>
        <StatusBadge :tone="orgApprovalTone(status)">{{ orgApprovalLabel(status) }}</StatusBadge>
      </div>
      <!-- 결정은 번복할 수 있다: 대기는 둘 다, 승인은 반려만, 반려는 승인만 -->
      <div v-if="isMaster" class="flex gap-2">
        <AppButton
          v-if="status !== 'rejected'"
          variant="soft"
          color="down"
          icon="i-lucide-x"
          :disabled="!!deciding"
          @click="rejectOpen = true"
        >
          반려
        </AppButton>
        <AppButton
          v-if="status !== 'approved'"
          icon="i-lucide-check"
          :loading="deciding === 'approved'"
          :disabled="!!deciding"
          @click="decide('approved')"
        >
          승인
        </AppButton>
      </div>
    </template>

    <div class="space-y-6">
      <section class="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
        <span class="text-muted">검토 시각</span>
        <span class="text-ink">{{ fmtDateTime(record.reviewed_at) }}</span>
        <template v-if="status === 'rejected'">
          <span class="text-muted">반려 사유</span>
          <span class="whitespace-pre-line text-ink">{{ record.rejection_reason || '—' }}</span>
        </template>
      </section>

      <section v-if="isMaster">
        <h3 class="mb-2 text-[13px] font-semibold text-muted">제출 서류</h3>
        <AppSpinner v-if="docLoading" label="서류 불러오는 중…" />
        <a v-else-if="docUrl" :href="docUrl" target="_blank" rel="noopener">
          <img :src="docUrl" alt="사업자등록증 또는 고유번호증" class="max-h-[480px] rounded-lg border border-hairline" />
        </a>
        <p v-else class="text-sm text-muted">제출된 서류가 없습니다.</p>
      </section>
    </div>
  </AppCard>

  <AppModal v-model:open="rejectOpen" title="가입 반려">
    <div class="space-y-2">
      <p class="text-sm text-body">반려 사유는 담당자에게 문자로 가고, 앱 내정보에도 그대로 보입니다.</p>
      <AppTextarea v-model="reason" placeholder="예) 사업자등록증 사진이 흐려 확인할 수 없습니다." :rows="4" />
    </div>
    <template #footer>
      <AppButton variant="outline" color="neutral" @click="rejectOpen = false">취소</AppButton>
      <AppButton
        color="down"
        :loading="deciding === 'rejected'"
        :disabled="!reason.trim() || !!deciding"
        @click="decide('rejected')"
      >
        반려하기
      </AppButton>
    </template>
  </AppModal>
</template>
