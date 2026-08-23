<!-- 템플릿: 어드민 셸 — 사이드바(데스크톱 고정 / 모바일 드로어) + 상단바 + 본문 -->
<script setup lang="ts">
const sidebarOpen = ref(false)
const route = useRoute()

// 라우트 이동 시 모바일 드로어 자동 닫기
watch(() => route.fullPath, () => (sidebarOpen.value = false))
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
        <div class="mx-auto max-w-[1200px]">
          <slot />
        </div>
      </main>
    </div>
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
