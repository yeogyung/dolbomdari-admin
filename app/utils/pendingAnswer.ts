// 한 번에 하나만 묻는 확인 — 묻는 사이 또 물으면 같은 답을 기다린다(저장하지 않고 닫기 확인, QA 2026-11-02 ADM-01)

/**
 * 창을 닫으려다(X·바깥·Esc) 묻는 중에 메뉴 이동(뒤로 가기)이 또 물을 수 있다. 확인 창은 하나이므로
 * 두 쪽 모두 같은 답을 받아야 한다 — 하나만 답을 받으면 다른 쪽은 영영 기다린다.
 */
export function createPendingAnswer() {
  let pending: { promise: Promise<boolean>; resolve: (ok: boolean) => void } | null = null
  return {
    /** 묻는 중이면 그 답을, 아니면 새로 묻고 답을 기다린다 */
    ask(): Promise<boolean> {
      if (!pending) {
        let resolve!: (ok: boolean) => void
        const promise = new Promise<boolean>((r) => {
          resolve = r
        })
        pending = { promise, resolve }
      }
      return pending.promise
    },
    /** 기다리던 쪽 모두에게 답한다. 묻는 중이 아니면 아무 일도 없다 */
    answer(ok: boolean) {
      const current = pending
      pending = null
      current?.resolve(ok)
    },
  }
}
