// 목록 화면의 검색·필터·정렬·페이지를 주소에 담는 상태 — 상세에서 뒤로 오면 그대로 복원된다(QA 2026-10-11)
import { ref, watch, type Ref } from 'vue'
import { readListQuery, toListQuery, withCommitted, type ListQueryDefaults } from '~/utils/listQuery'

/**
 * 값마다 `ref` 를 하나씩 돌려준다. 처음 값은 지금 주소에서 읽고, 바뀌면 `router.replace` 로
 * 주소를 고친다 — `push` 가 아니라서 필터를 바꿀 때마다 뒤로가기 기록이 쌓이지 않는다.
 *
 * 화면의 `onMounted(load)` 는 그대로 둔다. 그 시점에 이 ref 들은 이미 복원된 값이다.
 * 기존 `watch(filter, search)` 도 그대로 돈다 — 처음 값에는 반응하지 않는다.
 *
 * `committed` 에 넣은 칸(검색어)은 입력할 때가 아니라 **`commit()` 을 부를 때** 주소에 실린다.
 * 화면의 `search()` 가 부른다.
 */
export function useListQuery<T extends ListQueryDefaults>(
  defaults: T,
  options: { committed?: (keyof T)[] } = {},
): { [K in keyof T]: Ref<T[K]> } & { commit: () => void; committedOf: <K extends keyof T>(key: K) => T[K] } {
  const route = useRoute()
  const router = useRouter()
  const initial = readListQuery(route.query as Record<string, unknown>, defaults)
  const refs = {} as { [K in keyof T]: Ref<T[K]> }
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    refs[key] = ref(initial[key]) as Ref<T[typeof key]>
  }
  const keys = options.committed ?? []
  const committed: Partial<T> = {}
  for (const key of keys) committed[key] = initial[key]

  const write = () => {
    const values = {} as T
    for (const key of Object.keys(refs) as (keyof T)[]) values[key] = refs[key].value
    void router.replace({ query: toListQuery(withCommitted(values, committed), defaults) })
  }
  // 정해지는 칸은 지켜보지 않는다 — 입력할 때마다 주소가 바뀌지 않게.
  watch(
    (Object.keys(refs) as (keyof T)[]).filter((k) => !keys.includes(k)).map((k) => refs[k]),
    write,
  )
  const commit = () => {
    for (const key of keys) committed[key] = refs[key].value
    write()
  }
  /**
   * 정해진 값 — 조회는 이걸로 해야 주소와 화면이 같은 조건을 가리킨다. 입력칸에 치다 만 글자로
   * 페이지·정렬을 바꿔 조회하면, 주소엔 앞 검색어가 남아 상세에 다녀온 뒤 다른 목록이 나온다.
   */
  const committedOf = <K extends keyof T>(key: K): T[K] =>
    (keys.includes(key) ? committed[key] : refs[key].value) as T[K]
  return Object.assign(refs, { commit, committedOf })
}
