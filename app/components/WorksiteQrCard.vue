<!-- 근무지 출퇴근 QR — 화면 표시·인쇄·PNG 저장. 벽에 붙이는 인쇄물이 최종 산출물이다 -->
<script setup lang="ts">
import QRCode from 'qrcode'

const props = defineProps<{
  /** 근무지 이름. 인쇄물 제목이 된다 */
  name: string
  /** QR 에 담는 값 — dbo_worksites.qr_token */
  token: string
  /** 마지막 재발급 시각(ISO). 인쇄물에 찍어 어느 QR 인지 구분한다 */
  rotatedAt?: string | null
}>()

const svg = ref('')
const failed = ref(false)

// 오류 정정 H(30%) — 벽에 붙은 종이는 찢어지고 더러워진다. 대신 패턴이 촘촘해지므로
// 인쇄 크기를 충분히 키운다(아래 .qr-box 가 60mm).
const OPTS = { errorCorrectionLevel: 'H' as const, margin: 1 }

async function render() {
  failed.value = false
  if (!props.token) {
    svg.value = ''
    return
  }
  try {
    // SVG 로 그린다 — 인쇄할 때 확대돼도 깨지지 않는다.
    svg.value = await QRCode.toString(props.token, { ...OPTS, type: 'svg' })
  } catch {
    svg.value = ''
    failed.value = true
  }
}

watch(() => props.token, render, { immediate: true })

function fmtStamp(v?: string | null): string {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

/** PNG 저장 — 인쇄소에 맡기거나 다른 문서에 넣을 때 쓴다 */
async function downloadPng() {
  if (!props.token) return
  try {
    const url = await QRCode.toDataURL(props.token, { ...OPTS, width: 1024 })
    const a = document.createElement('a')
    a.href = url
    a.download = `QR_${props.name || '근무지'}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  } catch {
    failed.value = true
  }
}

function print() {
  window.print()
}

defineExpose({ downloadPng, print })
</script>

<template>
  <div class="qr-print-root">
    <div v-if="failed" class="text-sm text-red-600">QR 을 만들지 못했습니다.</div>

    <div v-else-if="!token" class="text-sm text-muted">발급된 토큰이 없습니다.</div>

    <!-- 이 블록만 인쇄된다 (아래 @media print) -->
    <div v-else class="qr-sheet">
      <p class="qr-title">{{ name }}</p>
      <!-- eslint-disable-next-line vue/no-v-html -- 같은 페이지에서 만든 SVG 문자열이다 -->
      <div class="qr-box" v-html="svg" />
      <p class="qr-guide">출퇴근 시 이 QR 을 찍어 주세요</p>
      <!--
        토큰 문자열은 인쇄물에 넣지 않는다. 벽에 붙는 종이에 원문이 적혀 있으면
        스캔하지 않고 값을 옮겨 적어 현장에 오지 않고도 출근을 기록할 수 있다.
      -->
      <p v-if="fmtStamp(rotatedAt)" class="qr-stamp">발급 {{ fmtStamp(rotatedAt) }}</p>
    </div>
  </div>
</template>

<style scoped>
.qr-sheet {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #fff;
  border: 1px solid var(--ui-border, #e5e7eb);
  border-radius: 12px;
}
.qr-title {
  font-size: 18px;
  font-weight: 700;
  color: #111;
  text-align: center;
}
.qr-box {
  width: 220px;
  height: 220px;
}
.qr-box :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
.qr-guide {
  font-size: 14px;
  color: #444;
}
.qr-stamp {
  font-size: 12px;
  color: #888;
}

/*
  인쇄 — 어드민 UI 를 전부 숨기고 이 카드만 A4 한 장에 크게 낸다.
  :global 로 body 아래를 숨기고 이 루트만 되살리는 방식이라, 모달 안에서
  호출해도 배경 화면이 따라 나오지 않는다.
*/
@media print {
  :global(body * ) {
    visibility: hidden;
  }
  .qr-print-root,
  .qr-print-root * {
    visibility: visible;
  }
  .qr-print-root {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .qr-sheet {
    border: none;
    gap: 10mm;
  }
  .qr-title {
    font-size: 32pt;
  }
  .qr-box {
    width: 60mm;
    height: 60mm;
  }
  .qr-guide {
    font-size: 14pt;
  }
  .qr-stamp {
    font-size: 9pt;
  }
}
</style>
