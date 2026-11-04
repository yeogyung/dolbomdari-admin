<!-- 템플릿: 어드민 셸 — 사이드바(데스크톱 고정 / 모바일 드로어) + 상단바 + 본문 -->
<script setup lang="ts">
import { phoneAllows, phoneHome } from '#shared/nav'

const sidebarOpen = ref(false)
const route = useRoute()

// 라우트 이동 시 모바일 드로어 자동 닫기
watch(() => route.fullPath, () => (sidebarOpen.value = false))

/*
 * 휴대폰 폭에서 출퇴근 기록 밖의 화면은 그리지 않고 「PC에서 이용해 주세요」를 보인다(QA 2026-11-02 MOBILE-02, 결정 F7).
 * 메뉴에서 막아도 주소로는 들어온다. 화면을 아예 만들지 않으니 그 화면의 조회·상단바 버튼도 없다.
 * 롤 규칙은 라우트 가드가 먼저 본다 — 여기는 폭만 더 본다.
 */
const phone = usePhoneWidth()
const { me } = useAdminRole()
const { setHeader } = useAdminHeader()
const pcOnly = computed(() => phone.value && !phoneAllows(route.path))
const phoneTarget = computed(() => (me.value ? phoneHome(me.value.role) : null))
// 화면이 그려지지 않아 제목을 정할 곳이 없다 — 앞 화면 제목이 남지 않게 셸이 정한다
watch(pcOnly, (v) => v && setHeader('PC에서 이용해 주세요'), { immediate: true })
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-white">
    <!-- 데스크톱 사이드바 -->
    <div class="hidden lg:block">
      <AppSidebar />
    </div>

    <!-- 모바일 드로어 -->
    <Transition name="fade">
      <div v-if="sidebarOpen" class="fixed inset-0 z-40 lg:hidden">
        <div class="absolute inset-0 bg-slate-900/40" @click="sidebarOpen = false" />
        <div class="absolute inset-y-0 left-0">
          <AppSidebar />
        </div>
      </div>
    </Transition>

    <!-- 본문 -->
    <div class="flex min-w-0 flex-1 flex-col">
      <AppTopbar @toggle-sidebar="sidebarOpen = true" />
      <main class="flex-1 overflow-y-auto bg-surface-soft p-4 lg:p-8">
        <!-- 안내 모양은 다른 화면의 빈 상태(AppCard + EmptyState)를 따른다 -->
        <AppCard v-if="pcOnly">
          <EmptyState
            icon="i-lucide-monitor"
            title="PC에서 이용해 주세요."
            description="휴대폰에서는 출퇴근 기록만 볼 수 있습니다."
          >
            <template v-if="phoneTarget" #action>
              <AppButton size="sm" @click="navigateTo(phoneTarget)">출퇴근 기록으로</AppButton>
            </template>
          </EmptyState>
        </AppCard>
        <slot v-else />
      </main>
    </div>

    <ExcelExportOverlay />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
