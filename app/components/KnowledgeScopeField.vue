<!-- 담당자 FAQ·AI 문서의 적용 범위 칸 — 앱과 같이 「기관 전체」 또는 맡은 근무지 하나. 근무지를 읽는 동안은 저장을 막고, 못 읽으면 기관 전체로 올라간다고 알린다. Figma 없음 -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Worksite } from '~/types/dbo'

/** 고른 근무지 id. '' 이면 기관 전체(서버에 빈 배열) */
const scope = defineModel<string>({ default: '' })
/**
 * 저장해도 되는가. 읽는 동안 저장하면 범위를 한 번도 못 보고 가장 넓은 기관 전체로 올라간다(앱과 같은 판단).
 * 못 읽었을 때는 막지 않는다 — 그렇게 된다고 말하고 다시 시도를 준다
 */
const ready = defineModel<boolean>('ready', { default: false })
/** 근무지를 못 읽어 기관 전체로만 올릴 수 있다 — 바로 쓰이는 문서 화면은 저장 전에 한 번 더 묻는다 */
const failed = defineModel<boolean>('failed', { default: false })
const api = useDboAdmin()
const sites = ref<Worksite[]>([])
const reason = ref('')

async function load() {
  ready.value = false
  failed.value = false
  reason.value = ''
  try {
    // 서버가 맡은 근무지로 좁힌다. 끝난 근무지는 고르지 않는다
    sites.value = (await api.listAllWorksites()).filter((w) => w.status !== 'ended')
    if (scope.value && !sites.value.some((w) => w.id === scope.value)) scope.value = ''
  } catch (e) {
    console.error('[KnowledgeScopeField] 근무지 조회 실패', e)
    sites.value = []
    scope.value = ''
    reason.value = dboErrorMessage(e)
    failed.value = true
  } finally {
    ready.value = true
  }
}
onMounted(load)
</script>

<template>
  <FormField label="적용 범위" hint="기관 전체는 모든 근무지 시니어의 질문에 쓰입니다.">
    <p v-if="!ready" class="text-sm text-muted">근무지를 불러오는 중…</p>
    <p v-else-if="failed" role="alert" class="text-sm text-red-600">
      근무지를 불러오지 못했습니다({{ reason }}). 지금 저장하면 기관 전체로 올라갑니다.
      <button type="button" class="ml-1 font-medium text-brand-500 hover:underline" @click="load">다시 시도</button>
    </p>
    <p v-else-if="!sites.length" class="text-sm text-muted">맡은 근무지가 없어 기관 전체로 올라갑니다.</p>
    <SelectField
      v-else
      v-model="scope"
      :options="[{ label: '기관 전체', value: '' }, ...sites.map((w) => ({ label: `${w.name}만`, value: w.id }))]"
    />
  </FormField>
</template>
