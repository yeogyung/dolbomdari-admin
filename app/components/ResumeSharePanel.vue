<!-- 이력서 공유 패널 — PDF 다운로드, 공개 링크 발급/폐기, 문자 발송 -->
<script setup lang="ts">
const props = defineProps<{ resumeId: string; userId: string }>()

const supabase = useSupabase()
const toast = useToast()
const config = useRuntimeConfig()

interface ShareLink {
  token: string
  password: string
  expires_at: string
  revoked_at: string | null
  locked_at: string | null
  view_count: number
  last_viewed_at: string | null
  created_at: string
}

const links = ref<ShareLink[]>([])
const loading = ref(true)
const issuing = ref(false)
const revealed = ref<Record<string, boolean>>({})
const smsTarget = ref<Record<string, string>>({})
const sending = ref<Record<string, boolean>>({})

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('세션이 없습니다. 다시 로그인해 주세요.')
  return { Authorization: `Bearer ${session.access_token}` }
}

function linkUrl(token: string) {
  return `${config.public.linkBaseUrl}/r/${token}`
}

function fmt(v: string | null) {
  return v ? v.replace('T', ' ').slice(0, 16) : '—'
}

function statusOf(l: ShareLink) {
  if (l.revoked_at) return { text: '폐기됨', color: 'neutral' as const }
  if (l.locked_at) return { text: '잠김', color: 'error' as const }
  if (new Date(l.expires_at) < new Date()) return { text: '만료됨', color: 'warning' as const }
  return { text: '사용 가능', color: 'success' as const }
}

async function load() {
  loading.value = true
  try {
    const res = await $fetch<{ rows: ShareLink[] }>('/api/admin/resume-links', {
      headers: await authHeader(),
      query: { userId: props.userId },
    })
    links.value = res.rows
  } catch (e: any) {
    toast.add({ title: '링크 조회 실패', description: e?.data?.statusMessage || e.message, color: 'error' })
  } finally {
    loading.value = false
  }
}

async function issue() {
  issuing.value = true
  try {
    await $fetch('/api/admin/resume-links', {
      method: 'POST',
      headers: await authHeader(),
      body: { userId: props.userId },
    })
    toast.add({ title: '링크를 발급했습니다.', color: 'success' })
    await load()
  } catch (e: any) {
    toast.add({ title: '발급 실패', description: e?.data?.statusMessage || e.message, color: 'error' })
  } finally {
    issuing.value = false
  }
}

async function revoke(token: string) {
  if (!confirm('이 링크를 폐기하시겠습니까? 받은 사람은 더 이상 열 수 없습니다.')) return
  try {
    await $fetch(`/api/admin/resume-links/${token}`, {
      method: 'DELETE',
      headers: await authHeader(),
    })
    toast.add({ title: '폐기했습니다.', color: 'success' })
    await load()
  } catch (e: any) {
    toast.add({ title: '폐기 실패', description: e?.data?.statusMessage || e.message, color: 'error' })
  }
}

async function copyLink(l: ShareLink) {
  await navigator.clipboard.writeText(`${linkUrl(l.token)}\n비밀번호 ${l.password}`)
  toast.add({ title: '주소와 비밀번호를 복사했습니다.', color: 'success' })
}

async function downloadPdf() {
  try {
    const res = await $fetch<Blob>(`/api/admin/resume-pdf/${props.resumeId}`, {
      headers: await authHeader(),
      responseType: 'blob',
    })
    const url = URL.createObjectURL(res)
    const a = document.createElement('a')
    a.href = url
    a.download = '이력서.pdf'
    a.click()
    URL.revokeObjectURL(url)
  } catch (e: any) {
    toast.add({ title: '다운로드 실패', description: e?.data?.statusMessage || e.message, color: 'error' })
  }
}

onMounted(load)
defineExpose({ load })
</script>

<template>
  <UCard class="mt-4">
    <template #header>
      <div class="flex items-center justify-between">
        <span class="font-semibold">이력서 공유</span>
        <div class="flex gap-2">
          <UButton size="xs" variant="soft" @click="downloadPdf">PDF 다운로드</UButton>
          <UButton size="xs" color="primary" :loading="issuing" @click="issue">
            공개 링크 발급
          </UButton>
        </div>
      </div>
    </template>

    <Spinner v-if="loading" label="불러오는 중…" />
    <p v-else-if="!links.length" class="py-4 text-center text-sm text-gray-400">
      발급한 링크가 없습니다.
    </p>

    <div v-else class="space-y-3">
      <div v-for="l in links" :key="l.token" class="rounded border border-gray-200 p-3 text-sm">
        <div class="mb-2 flex items-center gap-2">
          <UBadge :color="statusOf(l).color" variant="subtle" size="xs">
            {{ statusOf(l).text }}
          </UBadge>
          <span class="text-gray-500">
            만료 {{ fmt(l.expires_at) }} · 열람 {{ l.view_count }}회
          </span>
          <span v-if="l.last_viewed_at" class="text-gray-400">
            (마지막 {{ fmt(l.last_viewed_at) }})
          </span>
        </div>

        <div class="mb-2 break-all font-mono text-xs text-gray-700">{{ linkUrl(l.token) }}</div>

        <div class="mb-2 flex items-center gap-2">
          <span class="text-gray-500">비밀번호</span>
          <span class="font-mono">{{ revealed[l.token] ? l.password : '••••••' }}</span>
          <UButton
            size="xs"
            variant="ghost"
            @click="revealed[l.token] = !revealed[l.token]"
          >
            {{ revealed[l.token] ? '숨기기' : '보기' }}
          </UButton>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <UButton size="xs" variant="soft" @click="copyLink(l)">복사</UButton>
          <UButton
            v-if="!l.revoked_at"
            size="xs"
            color="error"
            variant="soft"
            @click="revoke(l.token)"
          >
            폐기
          </UButton>
        </div>
      </div>
    </div>
  </UCard>
</template>
