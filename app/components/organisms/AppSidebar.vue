<!-- 유기체: 좌측 사이드바 — 앱 스위처 + 앱별 네비게이션 (디자인 시안 기준) -->
<script setup lang="ts">
import { getApps, appKeyForPath } from '#shared/nav'

const route = useRoute()
const supabase = useSupabase()
const { me, clear } = useAdminRole()

// 롤을 받기 전에는 메뉴를 그리지 않는다 — 잠깐이라도 권한 밖 메뉴를 보여 주면
// 눌렀을 때 404 를 받고 고장난 것처럼 보인다.
const apps = computed(() => (me.value ? getApps(me.value.role) : []))
const activeKey = computed(() => appKeyForPath(route.path))
const activeApp = computed(
  () => apps.value.find((a) => a.key === activeKey.value) ?? apps.value[0] ?? null,
)

const ROLE_LABEL: Record<string, string> = {
  master: '운영관리자',
  worksite: '수요처 담당자',
  org: '기관 관리자',
}
const roleLabel = computed(() => ROLE_LABEL[me.value?.role ?? ''] ?? '관리자')

const email = ref('')
onMounted(async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  email.value = user?.email ?? ''
})

async function logout() {
  clear()
  await supabase.auth.signOut()
  await navigateTo('/login')
}

function isActive(to: string): boolean {
  if (to === '/' || to === '/senior') return route.path === to
  return route.path === to || route.path.startsWith(to + '/')
}
</script>

<template>
  <aside class="flex h-full w-[232px] shrink-0 flex-col border-r border-hairline bg-white px-3 py-5">
    <!-- 브랜드 -->
    <div class="flex items-center gap-2 px-2">
      <span class="flex size-[26px] items-center justify-center rounded-lg bg-brand-500 text-xs font-bold text-white">돌</span>
      <span class="text-[17px] font-semibold tracking-tight text-ink">돌봄다리 어드민</span>
    </div>

    <!-- 앱 스위처 — 앱이 하나뿐인 롤에게는 고를 것이 없으므로 숨긴다 -->
    <div v-if="apps.length > 1" class="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-surface-soft p-1">
      <NuxtLink
        v-for="a in apps"
        :key="a.key"
        :to="a.home"
        class="flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors"
        :class="activeKey === a.key ? 'bg-white text-brand-500 shadow-sm' : 'text-muted hover:text-body'"
      >
        <UIcon :name="a.icon" class="size-4" />
        {{ a.label }}
      </NuxtLink>
    </div>

    <!-- 네비게이션 -->
    <nav class="mt-5 flex-1 space-y-5 overflow-y-auto">
      <div v-for="(section, si) in activeApp?.sections ?? []" :key="si">
        <p v-if="section.label" class="mb-1.5 px-3 text-[11px] font-semibold tracking-wide text-muted-soft uppercase">
          {{ section.label }}
        </p>
        <ul class="space-y-0.5">
          <li v-for="item in section.items" :key="item.to">
            <NuxtLink
              :to="item.to"
              class="flex items-center gap-2.5 rounded-lg px-3 py-[11px] text-[15px] transition-colors"
              :class="
                isActive(item.to)
                  ? 'bg-brand-soft font-semibold text-brand-500'
                  : 'font-medium text-body hover:bg-surface-soft'
              "
            >
              <UIcon
                :name="item.icon"
                class="size-[18px] shrink-0"
                :class="isActive(item.to) ? 'text-brand-500' : 'text-body'"
              />
              <span class="truncate">{{ item.label }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </nav>

    <!-- 계정 (하단) -->
    <div class="mt-2 flex items-center gap-2.5 border-t border-hairline px-2 pt-3">
      <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-strong text-xs font-semibold text-muted">
        {{ (email[0] || '관').toUpperCase() }}
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-ink">{{ email || '관리자' }}</p>
        <p class="text-xs text-muted">{{ roleLabel }}</p>
      </div>
      <button
        type="button"
        class="inline-flex size-7 items-center justify-center rounded-lg text-muted hover:bg-surface-soft"
        aria-label="로그아웃"
        title="로그아웃"
        @click="logout"
      >
        <UIcon name="i-lucide-log-out" class="size-4" />
      </button>
    </div>
  </aside>
</template>
