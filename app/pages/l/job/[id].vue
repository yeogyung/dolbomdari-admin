<!-- 공유 링크 랜딩 — 앱 딥링크를 시도하고 미설치 시 플랫폼 스토어로 이동하는 공개 페이지 -->
<script setup lang="ts">
// 관리자 레이아웃(헤더/사이드바) 없이 단독 랜딩으로 렌더
definePageMeta({ layout: false })

const route = useRoute()
const id = computed(() => String(route.params.id ?? ''))
const deepLink = computed(() => `dolbomdari://job/${id.value}`)

const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=kr.carebridges.www.app'
// iOS App Store URL — 스토어 등록 후 채워넣기. 비어 있으면 iOS는 안내만 표시하고 자동 이동을 생략.
const APP_STORE_URL_IOS = ''

type Platform = 'ios' | 'android' | 'other'
const platform = ref<Platform>('other')
// iOS인데 App Store URL이 아직 없어 스토어로 보낼 수 없는 상태
const iosUnavailable = ref(false)

function detectPlatform(): Platform {
  const ua = navigator.userAgent || ''
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'other'
}

// 플랫폼별 스토어 URL. iOS는 URL이 없으면 null (android/기타는 Play스토어)
function storeUrl(p: Platform): string | null {
  if (p === 'ios') return APP_STORE_URL_IOS || null
  return PLAY_STORE_URL
}

function openApp() {
  window.location.href = deepLink.value
}

function goStore() {
  const url = storeUrl(platform.value)
  if (url) window.location.href = url
}

let fallbackTimer: ReturnType<typeof setTimeout> | null = null

function cancelFallback() {
  if (fallbackTimer) {
    clearTimeout(fallbackTimer)
    fallbackTimer = null
  }
}

// 앱으로 전환되면 페이지가 숨겨짐 → 스토어 자동 이동 취소
function onVisibilityChange() {
  if (document.hidden) cancelFallback()
}

onMounted(() => {
  platform.value = detectPlatform()

  // 앱 열기 시도 (설치돼 있으면 앱으로 전환됨)
  openApp()

  const target = storeUrl(platform.value)
  if (!target) {
    // iOS인데 스토어 URL 미정 → 자동 이동 없이 안내만 노출
    iosUnavailable.value = true
    return
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', cancelFallback)
  window.addEventListener('blur', cancelFallback)

  // 일정 시간 뒤에도 페이지가 살아있으면(미설치) 스토어로 이동
  fallbackTimer = setTimeout(() => {
    window.location.replace(target)
  }, 1500)
})

onBeforeUnmount(() => {
  cancelFallback()
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('pagehide', cancelFallback)
  window.removeEventListener('blur', cancelFallback)
})
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-[#F5F6F8] px-6">
    <div
      class="w-full max-w-sm bg-white rounded-3xl shadow-sm px-6 py-10 flex flex-col items-center text-center"
    >
      <div
        class="w-16 h-16 rounded-2xl bg-brand-500 flex items-center justify-center mb-5"
      >
        <span class="text-white text-xl font-bold">돌봄</span>
      </div>

      <h1 class="text-xl font-bold text-[#1a1a1f] mb-2">돌봄다리</h1>
      <p class="text-sm text-[#5f5e69] mb-8 leading-6">
        공고를 앱에서 확인해보세요.<br />
        앱이 설치돼 있으면 자동으로 열립니다.
      </p>

      <UButton
        block
        size="lg"
        color="primary"
        class="mb-3 justify-center"
        @click="openApp"
      >
        앱으로 열기
      </UButton>

      <UButton
        v-if="!iosUnavailable"
        block
        size="lg"
        variant="soft"
        color="neutral"
        class="justify-center"
        @click="goStore"
      >
        앱 설치하기
      </UButton>
      <p v-else class="text-xs text-[#9CA3AF] mt-1">
        iOS 앱은 준비 중입니다. 안드로이드에서 이용해주세요.
      </p>
    </div>
  </div>
</template>
