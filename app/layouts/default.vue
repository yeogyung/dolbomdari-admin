<!-- 기본 레이아웃 — 좌측 테이블 네비게이션 + 상단 헤더(로그인 이메일/로그아웃) -->
<script setup lang="ts">
import { TABLE_LIST } from '#shared/tables'

const supabase = useSupabase()
const route = useRoute()

const crudTables = TABLE_LIST.filter((t) => t.mode === 'crud' && !t.hideInNav)
const logTables = TABLE_LIST.filter((t) => t.mode === 'log' && !t.hideInNav)

const email = ref('')
onMounted(async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  email.value = user?.email || ''
})

async function logout() {
  await supabase.auth.signOut()
  await navigateTo('/login')
}

function isActive(name: string) {
  return route.path === `/${name}`
}
</script>

<template>
  <div class="flex min-h-screen bg-gray-50">
    <!-- 사이드바 -->
    <aside class="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
      <NuxtLink to="/" class="block px-5 py-4 text-lg font-bold text-gray-900">
        돌봄다리 어드민
      </NuxtLink>

      <nav class="flex-1 overflow-y-auto px-3 pb-4">
        <p class="px-2 pb-1 pt-3 text-xs font-semibold uppercase text-gray-400">데이터 관리</p>
        <NuxtLink
          v-for="t in crudTables"
          :key="t.name"
          :to="`/${t.name}`"
          class="block rounded-md px-3 py-2 text-sm"
          :class="isActive(t.name) ? 'bg-primary-50 font-medium text-primary-700' : 'text-gray-700 hover:bg-gray-100'"
        >
          {{ t.label }}
        </NuxtLink>

        <p class="px-2 pb-1 pt-4 text-xs font-semibold uppercase text-gray-400">로그</p>
        <NuxtLink
          v-for="t in logTables"
          :key="t.name"
          :to="`/${t.name}`"
          class="block rounded-md px-3 py-2 text-sm"
          :class="isActive(t.name) ? 'bg-primary-50 font-medium text-primary-700' : 'text-gray-700 hover:bg-gray-100'"
        >
          {{ t.label }}
        </NuxtLink>
      </nav>
    </aside>

    <!-- 본문 -->
    <div class="flex min-w-0 flex-1 flex-col">
      <header class="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div class="text-sm text-gray-500">{{ email }}</div>
        <UButton size="sm" variant="ghost" color="neutral" @click="logout">로그아웃</UButton>
      </header>
      <main class="flex-1 overflow-x-auto p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
