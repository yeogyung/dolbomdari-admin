// 휴대폰 폭(Tailwind md 아래)인지 — 첫 그림부터 맞게 바로 읽고, 폭이 바뀌면 따라간다(QA 2026-11-02 MOBILE-02)
import { ref, type Ref } from 'vue'
import { PC_MEDIA } from '#shared/nav'

/** 화면 전체가 같은 값을 본다 — 메뉴와 안내 화면이 어긋나지 않게 하나만 둔다 */
let phone: Ref<boolean> | null = null

export function usePhoneWidth(): Readonly<Ref<boolean>> {
  if (!import.meta.client) return ref(false)
  if (!phone) {
    const pc = window.matchMedia(PC_MEDIA)
    const state = ref(!pc.matches)
    pc.addEventListener('change', (e) => {
      state.value = !e.matches
    })
    phone = state
  }
  return phone
}
