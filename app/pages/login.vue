<!-- 로그인 페이지 — Supabase 이메일/비밀번호 인증 -->
<script setup lang="ts">
definePageMeta({ layout: false })

const supabase = useSupabase()
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function login() {
  errorMsg.value = ''
  loading.value = true
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })
    if (error) {
      errorMsg.value = '로그인에 실패했습니다. 이메일/비밀번호를 확인해 주세요.'
      return
    }
    await navigateTo('/')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-lg font-bold">돌봄다리 어드민</h1>
      </template>

      <form class="space-y-4" @submit.prevent="login">
        <UFormField label="이메일" name="email">
          <UInput v-model="email" type="email" autocomplete="username" class="w-full" />
        </UFormField>
        <UFormField label="비밀번호" name="password">
          <UInput v-model="password" type="password" autocomplete="current-password" class="w-full" />
        </UFormField>
        <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>
        <UButton type="submit" block :loading="loading" color="primary">로그인</UButton>
      </form>
    </UCard>
  </div>
</template>
