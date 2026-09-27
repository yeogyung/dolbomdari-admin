<!-- FAQ 상세 — 질문·답변·적용 범위 열람 + 승인·반려 (조회 supabase 직접, 쓰기 PATCH /dbo-admin/faqs/{id}) -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Faq, FaqStatus } from '~/types/dbo'

const route = useRoute()
const faqs = useFaqs()
const api = useDboAdmin()
const toast = useToast()
const { setHeader } = useAdminHeader()
setHeader('FAQ 상세', [{ label: 'FAQ 관리', to: '/senior/faqs' }])

const id = computed(() => String(route.params.id))

const faq = ref<Faq | null>(null)
const loading = ref(true)
const loadError = ref('')
const deciding = ref<FaqStatus | null>(null)

const scopeNames = computed(() => (faq.value ? faqScopeNames(faq.value) : []))

async function loadFaq() {
  loading.value = true
  loadError.value = ''
  try {
    faq.value = await faqs.getFaq(id.value)
  } catch (e: any) {
    // 승인 후 다시 불러오다 실패하면 이전 상태의 카드가 남아 결정 전 버튼을 보여 준다 — 비운다
    faq.value = null
    loadError.value = faqReadErrorMessage(e)
    toast.add({ title: 'FAQ 조회 실패', description: loadError.value, color: 'error' })
  } finally {
    loading.value = false
  }
}

// 승인하면 서버가 enabled 를 켜고, 반려하면 끈다 — 여기서는 status 만 보낸다
const CONFIRM: Record<'approved' | 'rejected', string> = {
  approved: '이 FAQ를 승인하시겠습니까? 승인하면 바로 AI 답변에 쓰입니다.',
  rejected: '이 FAQ를 반려하시겠습니까? 반려하면 AI 답변에 쓰이지 않습니다.',
}

async function decide(status: 'approved' | 'rejected') {
  if (!faq.value || !confirm(CONFIRM[status])) return
  deciding.value = status
  try {
    await api.updateFaqStatus(faq.value.id, status)
    toast.add({ title: status === 'approved' ? '승인되었습니다.' : '반려되었습니다.', color: 'success' })
    await loadFaq()
  } catch (e: any) {
    toast.add({ title: '처리 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    deciding.value = null
  }
}

onMounted(loadFaq)
</script>

<template>
  <div class="space-y-6">
    <Teleport to="#admin-topbar-actions">
      <AppButton variant="outline" color="neutral" icon="i-lucide-arrow-left" @click="navigateTo('/senior/faqs')">
        목록
      </AppButton>
      <template v-if="faq">
        <!-- 결정은 번복할 수 있다: 대기는 둘 다, 승인은 반려만, 반려는 승인만 -->
        <AppButton
          v-if="faq.status !== 'rejected'"
          variant="soft"
          color="down"
          icon="i-lucide-x"
          :loading="deciding === 'rejected'"
          :disabled="!!deciding"
          @click="decide('rejected')"
        >
          반려
        </AppButton>
        <AppButton
          v-if="faq.status !== 'approved'"
          icon="i-lucide-check"
          :loading="deciding === 'approved'"
          :disabled="!!deciding"
          @click="decide('approved')"
        >
          승인
        </AppButton>
      </template>
    </Teleport>

    <AppSpinner v-if="loading" label="불러오는 중…" />

    <AppCard v-else-if="faq" padding="lg">
      <template #header>
        <div class="flex items-center gap-3">
          <h2 class="text-[18px] font-semibold text-ink">FAQ</h2>
          <Tag v-if="faq.category">{{ faq.category }}</Tag>
          <StatusBadge :tone="faqStatusTone(faq.status)">{{ faqStatusLabel(faq.status) }}</StatusBadge>
        </div>
        <span class="text-sm text-muted">등록 {{ fmtStamp(faq.created_at) }}</span>
      </template>

      <div class="space-y-6">
        <section>
          <h3 class="mb-2 text-[13px] font-semibold text-muted">질문</h3>
          <p class="text-[15px] font-semibold whitespace-pre-line text-ink">{{ faq.question }}</p>
        </section>
        <section>
          <h3 class="mb-2 text-[13px] font-semibold text-muted">답변</h3>
          <p class="text-[15px] leading-relaxed whitespace-pre-line text-body">{{ faq.answer }}</p>
        </section>

        <div class="grid gap-5 border-t border-hairline pt-6 md:grid-cols-3">
          <section>
            <h3 class="mb-2 text-[13px] font-semibold text-muted">적용 범위</h3>
            <div class="flex flex-wrap gap-1.5">
              <Tag v-if="!scopeNames.length">기관 전체</Tag>
              <Tag v-for="(name, i) in scopeNames" :key="i">{{ name }}</Tag>
            </div>
          </section>
          <section>
            <h3 class="mb-2 text-[13px] font-semibold text-muted">AI 사용</h3>
            <p class="text-[15px]" :class="faq.enabled ? 'text-up' : 'text-muted'">
              {{ faq.enabled ? '사용 중' : '사용 안 함' }}
            </p>
          </section>
          <section>
            <h3 class="mb-2 text-[13px] font-semibold text-muted">순서</h3>
            <p class="text-[15px] text-body tabular-nums">{{ faq.sort }}</p>
          </section>
        </div>
      </div>
    </AppCard>

    <!-- 조회 실패와 「없음」을 구분한다 — 네트워크 오류를 삭제된 FAQ로 안내하지 않는다 -->
    <EmptyState
      v-else-if="loadError"
      icon="i-lucide-triangle-alert"
      title="FAQ를 불러오지 못했습니다."
      :description="loadError"
    />
    <EmptyState v-else title="FAQ를 찾을 수 없습니다." description="삭제되었거나 볼 권한이 없는 FAQ입니다." />
  </div>
</template>
