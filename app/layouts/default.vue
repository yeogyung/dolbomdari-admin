<!-- 기본 레이아웃 — 통합 어드민 셸(AdminShell) 사용 -->
<script setup lang="ts">
// 탭 제목은 상단바 제목(각 페이지의 setHeader)을 따라간다 — 페이지마다 useHead 를 따로 두지 않는다
const { header } = useAdminHeader()
useHead({
  title: () => header.value.title,
  titleTemplate: (t) => (t ? `${t} · 돌봄다리 어드민` : '돌봄다리 어드민'),
})
</script>

<template>
  <AdminShell>
    <slot />
  </AdminShell>
</template>
