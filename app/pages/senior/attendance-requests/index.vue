<!-- 출결 조정 요청 — 담당자·master 가 수요처의 요청을 확인해 확정·반려 (QA PARTNER-02, /dbo-admin/attendance-requests) -->
<script setup lang="ts">
useAdminHeader().setHeader('조정 요청')
</script>

<template>
  <div class="flex min-h-[calc(100vh-8rem)] flex-col">
    <AttendanceRequestsPanel decide />
  </div>
</template>
