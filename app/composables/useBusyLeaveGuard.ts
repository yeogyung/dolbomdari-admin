// 일괄 처리 중 화면 떠나기 막기 — 메뉴 이동·뒤로가기는 멈추고 알리며, 새로고침·탭 닫기는 브라우저가 묻게 한다
import { onBeforeUnmount, onMounted, type Ref } from 'vue'

/**
 * 여러 건을 차례로 처리하는 동안(`busy`) 화면을 떠나면 처리는 뒤에서 이어지는데 결과 창이 사라지고, 새로고침하면 중간에 끊겨
 * 어디까지 됐는지 알 수 없다(리뷰 반영). 처리 창의 닫기 막기(`before-close`)와 짝이다
 */
export function useBusyLeaveGuard(busy: Ref<boolean>) {
  const toast = useToast()
  onBeforeRouteLeave(() => {
    if (!busy.value) return true
    toast.add({ title: '처리하는 중입니다. 끝난 뒤 이동해 주세요.', color: 'warning' })
    return false
  })
  const onUnload = (e: BeforeUnloadEvent) => {
    if (!busy.value) return
    e.preventDefault()
    // 옛 브라우저는 returnValue 가 있어야 묻는다
    e.returnValue = ''
  }
  onMounted(() => window.addEventListener('beforeunload', onUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', onUnload))
}
