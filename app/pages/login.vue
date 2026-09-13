<!-- 로그인 페이지 — 앱을 고르고 전화번호 OTP 로 인증한다 -->
<script setup lang="ts">
definePageMeta({ layout: false })

const supabase = useSupabase()
const config = useRuntimeConfig()

/*
 * 두 앱은 전화번호 정규화 규칙도 계정 도메인도 다르다.
 *   시니어    01012345678      → @dbo.dolbomdari.app      (dbo-public)
 *   구인구직  +821012345678    → @internal.dolbomdari.app (send-otp/verify-otp)
 * 하나의 입력창으로 자동 판별하려 들면 오류 없이 다른 계정을 찾는다(AGENTS §3.5).
 * 그래서 입구에서 고르게 하고 두 경로를 코드에서도 갈라 둔다.
 */
type AppKey = 'senior' | 'jobs'
const appKey = ref<AppKey>('senior')
const APPS: { key: AppKey; label: string }[] = [
  { key: 'senior', label: '시니어 출퇴근' },
  { key: 'jobs', label: '구인구직' },
]

const fnBase = `${config.public.supabaseUrl}/functions/v1`
const anonHeaders = { apikey: config.public.supabaseAnonKey }

type Step = 'phone' | 'code'
const step = ref<Step>('phone')

const phone = ref('')
const code = ref('')
const loading = ref(false)
const errorMsg = ref('')
const noticeMsg = ref('')

/** 숫자만 남긴 국내 표기 — 시니어는 이 형태를 그대로 쓴다 */
const digits = computed(() => phone.value.replace(/[^0-9]/g, '').slice(0, 11))
/** 구인구직은 E.164 를 요구한다 */
const e164 = computed(() => `+82${digits.value.replace(/^0/, '')}`)
const phoneValid = computed(() => /^01[0-9]{8,9}$/.test(digits.value))

function switchApp(k: AppKey) {
  if (appKey.value === k) return
  appKey.value = k
  step.value = 'phone'
  code.value = ''
  errorMsg.value = ''
  noticeMsg.value = ''
}

async function requestOtp() {
  errorMsg.value = ''
  noticeMsg.value = ''
  loading.value = true
  try {
    if (appKey.value === 'senior') {
      const res = await $fetch<{ registered?: boolean; error?: string; retryAfterSec?: number }>(
        `${fnBase}/dbo-public/auth/otp`,
        { method: 'POST', headers: anonHeaders, body: { phone: digits.value } },
      )
      if (res.registered === false) {
        errorMsg.value = '등록되지 않은 번호입니다. 관리자에게 문의해 주세요.'
        return
      }
      if (res.error === 'too_soon') {
        errorMsg.value = `잠시 후 다시 시도해 주세요. (${res.retryAfterSec ?? 30}초)`
        return
      }
      if (res.error) {
        errorMsg.value = '인증번호를 보내지 못했습니다.'
        return
      }
    } else {
      const res = await $fetch<{ success?: boolean; error?: string }>(`${fnBase}/send-otp`, {
        method: 'POST',
        headers: anonHeaders,
        body: { phone: e164.value },
      })
      if (!res.success) {
        errorMsg.value = res.error || '인증번호를 보내지 못했습니다.'
        return
      }
    }

    step.value = 'code'
    noticeMsg.value = '인증번호를 문자로 보냈습니다.'
  } catch (e: any) {
    errorMsg.value = e?.data?.error || '인증번호를 보내지 못했습니다.'
  } finally {
    loading.value = false
  }
}

async function verifyOtp() {
  errorMsg.value = ''
  loading.value = true
  try {
    let tokenHash = ''

    if (appKey.value === 'senior') {
      const res = await $fetch<{
        tokenHash?: string
        registered?: boolean
        error?: string
        remaining?: number
      }>(`${fnBase}/dbo-public/auth/verify`, {
        method: 'POST',
        headers: anonHeaders,
        body: { phone: digits.value, code: code.value },
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
      if (!res.tokenHash) {
        errorMsg.value = '인증에 실패했습니다.'
        return
      }
      tokenHash = res.tokenHash
    } else {
      const res = await $fetch<{ token_hash?: string; error?: string }>(`${fnBase}/verify-otp`, {
        method: 'POST',
        headers: anonHeaders,
        body: { phone: e164.value, code: code.value, mode: 'login' },
      })
      if (!res.token_hash) {
        errorMsg.value = res.error || '인증에 실패했습니다.'
        return
      }
      tokenHash = res.token_hash
    }

    // 전화번호 프로바이더를 켜지 않고 이메일 프로바이더로 세션을 만든다 — type 은 'email'
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
    if (error) {
      errorMsg.value = '세션을 만들지 못했습니다. 다시 시도해 주세요.'
      return
    }

    // 어드민 자격 확인과 첫 화면 결정은 전역 미들웨어(auth.global.ts)가 한다.
    // 자격이 없으면 거기서 세션을 지우고 다시 로그인 화면으로 돌려보낸다.
    await navigateTo('/')
  } catch (e: any) {
    errorMsg.value = e?.data?.error || '인증에 실패했습니다.'
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

      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-2">
          <UButton
            v-for="a in APPS"
            :key="a.key"
            block
            size="sm"
            :color="appKey === a.key ? 'primary' : 'neutral'"
            :variant="appKey === a.key ? 'solid' : 'outline'"
            :disabled="loading"
            @click="switchApp(a.key)"
          >
            {{ a.label }}
          </UButton>
        </div>

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
          <UButton type="submit" block color="primary" :loading="loading" :disabled="!phoneValid">
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
          <UButton type="submit" block color="primary" :loading="loading" :disabled="code.length !== 6">
            로그인
          </UButton>
          <UButton block variant="ghost" color="neutral" :disabled="loading" @click="backToPhone">
            번호 다시 입력
          </UButton>
        </form>
      </div>
    </UCard>
  </div>
</template>
