<!-- 로그인 페이지 — 전화번호 OTP 인증 (운영센터 dbo-public 의 로그인 경로를 그대로 쓴다) -->
<script setup lang="ts">
definePageMeta({ layout: false })

const supabase = useSupabase()
const config = useRuntimeConfig()

// dbo-public 은 verify_jwt=false 라 로그인 전에 호출된다.
// ⚠ 일자리찾기의 send-otp/verify-otp 를 쓰면 안 된다 — 그쪽은 번호를 E.164(+8210…)로
//   정규화하고 @internal.dolbomdari.app 을 쓴다. 도메인이 달라 조용히 다른 계정을 찾는다.
const base = `${config.public.supabaseUrl}/functions/v1/dbo-public`

type Step = 'phone' | 'code'
const step = ref<Step>('phone')

const phone = ref('')
const code = ref('')
const loading = ref(false)
const errorMsg = ref('')
const noticeMsg = ref('')

/** 서버(normalizePhone)와 같은 규칙 — 숫자만 남기고 11자리로 자른다 */
const normalized = computed(() => phone.value.replace(/[^0-9]/g, '').slice(0, 11))
const phoneValid = computed(() => /^01[0-9]{8,9}$/.test(normalized.value))

async function requestOtp() {
  errorMsg.value = ''
  noticeMsg.value = ''
  loading.value = true
  try {
    const res = await $fetch<{
      registered?: boolean
      error?: string
      retryAfterSec?: number
    }>(`${base}/auth/otp`, {
      method: 'POST',
      headers: { apikey: config.public.supabaseAnonKey },
      body: { phone: normalized.value },
    })

    // 명부에 없는 번호는 계정도 OTP 도 만들지 않는다 — 문자 자체가 나가지 않는다
    if (res.registered === false) {
      errorMsg.value = '등록되지 않은 번호입니다. 관리자에게 문의해 주세요.'
      return
    }
    if (res.error === 'too_soon') {
      errorMsg.value = `잠시 후 다시 시도해 주세요. (${res.retryAfterSec ?? 30}초)`
      return
    }
    if (res.error === 'send_failed') {
      errorMsg.value = '문자 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.'
      return
    }
    if (res.error) {
      errorMsg.value = '인증번호를 보내지 못했습니다.'
      return
    }

    step.value = 'code'
    noticeMsg.value = '인증번호를 문자로 보냈습니다.'
  } catch {
    errorMsg.value = '인증번호를 보내지 못했습니다.'
  } finally {
    loading.value = false
  }
}

async function verifyOtp() {
  errorMsg.value = ''
  loading.value = true
  try {
    const res = await $fetch<{
      tokenHash?: string
      registered?: boolean
      error?: string
      remaining?: number
    }>(`${base}/auth/verify`, {
      method: 'POST',
      headers: { apikey: config.public.supabaseAnonKey },
      body: { phone: normalized.value, code: code.value },
    })

    if (res.error === 'mismatch') {
      errorMsg.value = `인증번호가 다릅니다. (남은 횟수 ${res.remaining ?? 0})`
      return
    }
    if (res.error === 'expired' || res.error === 'too_many_attempts') {
      errorMsg.value = '인증번호가 만료되었습니다. 다시 요청해 주세요.'
      step.value = 'phone'
      code.value = ''
      return
    }
    if (res.registered === false) {
      errorMsg.value = '등록되지 않은 번호입니다.'
      step.value = 'phone'
      return
    }
    if (!res.tokenHash) {
      errorMsg.value = '인증에 실패했습니다.'
      return
    }

    // magiclink 의 hashed_token 을 세션으로 교환한다. 전화번호 프로바이더를 켜지
    // 않고 이메일 프로바이더를 쓰므로 type 은 'email' 이다.
    const { error } = await supabase.auth.verifyOtp({
      token_hash: res.tokenHash,
      type: 'email',
    })
    if (error) {
      errorMsg.value = '세션을 만들지 못했습니다. 다시 시도해 주세요.'
      return
    }

    await navigateTo('/')
  } catch {
    errorMsg.value = '인증에 실패했습니다.'
  } finally {
    loading.value = false
  }
}

function backToPhone() {
  step.value = 'phone'
  code.value = ''
  errorMsg.value = ''
  noticeMsg.value = ''
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-lg font-bold">돌봄다리 어드민</h1>
      </template>

      <form v-if="step === 'phone'" class="space-y-4" @submit.prevent="requestOtp">
        <UFormField label="전화번호" name="phone">
          <UInput
            v-model="phone"
            type="tel"
            inputmode="numeric"
            autocomplete="tel"
            placeholder="010-0000-0000"
            class="w-full"
          />
        </UFormField>
        <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>
        <UButton
          type="submit"
          block
          color="primary"
          :loading="loading"
          :disabled="!phoneValid"
        >
          인증번호 받기
        </UButton>
      </form>

      <form v-else class="space-y-4" @submit.prevent="verifyOtp">
        <UFormField label="인증번호" name="code">
          <UInput
            v-model="code"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            placeholder="6자리"
            class="w-full"
          />
        </UFormField>
        <p v-if="noticeMsg" class="text-sm text-gray-500">{{ noticeMsg }}</p>
        <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>
        <UButton
          type="submit"
          block
          color="primary"
          :loading="loading"
          :disabled="code.length !== 6"
        >
          로그인
        </UButton>
        <UButton block variant="ghost" color="neutral" :disabled="loading" @click="backToPhone">
          번호 다시 입력
        </UButton>
      </form>
    </UCard>
  </div>
</template>
