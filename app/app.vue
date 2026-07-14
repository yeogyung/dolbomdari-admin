<!-- 앱 루트 — Nuxt UI 오버레이/토스트 컨텍스트(UApp)로 페이지를 감싼다 -->
<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
