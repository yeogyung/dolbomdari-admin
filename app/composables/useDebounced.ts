// 입력이 멈춘 뒤에만 값을 넘기는 디바운스 ref — 검색칸이 글자마다 목록을 다시 그리지 않게 한다
import { onScopeDispose, ref, watch, type Ref } from 'vue'

/**
 * `source` 가 `delay` ms 동안 바뀌지 않으면 그 값을 넘긴다.
 * **비우는 것은 바로 넘긴다** — 검색어를 지웠는데 목록이 잠깐 남아 보이면 어색하다.
 */
export function useDebounced<T>(source: Ref<T>, delay = 250): Ref<T> {
  const out = ref(source.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(source, (v) => {
    clearTimeout(timer)
    if (v === '' || v === null || v === undefined) {
      out.value = v
      return
    }
    timer = setTimeout(() => {
      out.value = v
    }, delay)
  })
  onScopeDispose(() => clearTimeout(timer))
  return out
}
