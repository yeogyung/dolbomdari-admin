// 버튼 중복 클릭 방지 — 클릭 처리가 Promise 를 돌려주면 끝날 때까지 다시 부르지 않는다
import { ref, type Ref } from 'vue'

export interface ClickGuard {
  /** 처리 중인가. 버튼은 이 값으로 비활성·스피너를 건다 */
  pending: Ref<boolean>
  /** 처리 중이면 무시한다. 결과가 Promise 면 끝날 때까지(실패해도) 잠근다 */
  run: (handler: () => unknown) => Promise<void> | void
}

/**
 * 저장 버튼을 두 번 누르면 같은 행이 두 번 생기거나 같은 요청이 겹친다. 화면마다
 * saving 플래그를 두면 빠뜨리는 곳이 생겨 공용 버튼이 한 번에 막는다.
 *
 * Promise 를 돌려주지 않는 처리(모달 닫기 같은 동기 처리)는 잠그지 않는다.
 * 처리가 confirm() 으로 시작하면 그 대기도 잠금 안에 들어가지 않는다 — confirm 은 동기다.
 */
export function createClickGuard(): ClickGuard {
  const pending = ref(false)

  function run(handler: () => unknown) {
    if (pending.value) return
    const result = handler()
    if (!(result instanceof Promise)) return
    pending.value = true
    return result.then(
      () => {
        pending.value = false
      },
      (e: unknown) => {
        pending.value = false
        throw e
      },
    )
  }

  return { pending, run }
}
