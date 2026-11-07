<!-- 일괄 처리 결과 — 된 수·실패 수와 실패 명단(누구 · 왜). 출결 일괄 수정·선택 삭제·여러 명 배정이 같이 쓴다 -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 된 것을 부르는 말 — 「적용」·「삭제」·「배정」 */
    doneLabel: string
    done: number
    failed: { name: string; reason: string }[]
    /** 세는 단위 — 기록은 건, 사람은 명 */
    unit?: string
  }>(),
  { unit: '건' },
)
</script>

<template>
  <div class="space-y-3 text-sm">
    <p class="font-semibold text-ink tabular-nums">
      {{ doneLabel }} {{ done }}{{ unit }} · 실패 {{ failed.length }}{{ unit }}
    </p>
    <!-- 모양은 출결 삭제 창의 경고 상자를 따른다 -->
    <div v-if="failed.length" class="rounded-lg border border-down bg-down-soft px-4 py-3 text-down" role="alert">
      <p class="font-semibold">아래 {{ failed.length }}{{ unit }}은 처리하지 못했습니다. 된 것은 그대로 둡니다.</p>
      <ul class="mt-1.5 max-h-60 list-disc space-y-0.5 overflow-y-auto pl-5">
        <li v-for="(f, i) in failed" :key="i">{{ f.name }} — {{ f.reason }}</li>
      </ul>
    </div>
    <slot />
  </div>
</template>
