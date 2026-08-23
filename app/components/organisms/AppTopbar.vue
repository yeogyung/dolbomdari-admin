<!-- 유기체: 상단 바 — 페이지 제목/브레드크럼(좌) + 액션 텔레포트 타깃(우) + 모바일 햄버거 -->
<script setup lang="ts">
const emit = defineEmits<{ toggleSidebar: [] }>()
const { header } = useAdminHeader()
</script>

<template>
  <header class="flex h-16 shrink-0 items-center justify-between border-b border-hairline bg-white px-4 lg:px-8">
    <div class="flex min-w-0 items-center gap-2">
      <button
        type="button"
        class="-ml-1 inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-soft lg:hidden"
        aria-label="메뉴 열기"
        @click="emit('toggleSidebar')"
      >
        <UIcon name="i-lucide-menu" class="size-5" />
      </button>

      <!-- 브레드크럼 or 제목 -->
      <nav v-if="header.crumbs.length" class="flex items-center gap-2 text-[15px] text-muted">
        <template v-for="(c, i) in header.crumbs" :key="i">
          <NuxtLink v-if="c.to" :to="c.to" class="hover:text-body">{{ c.label }}</NuxtLink>
          <span v-else>{{ c.label }}</span>
          <UIcon v-if="i < header.crumbs.length - 1" name="i-lucide-chevron-right" class="size-3.5" />
        </template>
        <UIcon name="i-lucide-chevron-right" class="size-3.5" />
        <span class="truncate font-semibold text-ink">{{ header.title }}</span>
      </nav>
      <span v-else class="truncate text-[18px] font-semibold tracking-tight text-ink">{{ header.title }}</span>
    </div>

    <!-- 페이지 액션 텔레포트 타깃 -->
    <div id="admin-topbar-actions" class="flex items-center gap-2.5" />
  </header>
</template>
