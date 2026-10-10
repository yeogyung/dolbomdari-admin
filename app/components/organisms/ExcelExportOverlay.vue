<!-- 유기체: 엑셀 내보내기 중 화면 전체를 덮는 스피너 오버레이 (useExcelExport 상태) -->
<script setup lang="ts">
const { exporting } = useExcelExport()
</script>

<template>
  <Transition name="fade">
    <div
      v-if="exporting"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40"
      role="status"
      aria-live="polite"
    >
      <div class="flex flex-col items-center gap-3 rounded-[24px] bg-white px-10 py-8 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-brand-500" />
        <span class="text-[15px] font-medium text-body">엑셀 파일을 만드는 중…</span>
      </div>
    </div>
  </Transition>
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
