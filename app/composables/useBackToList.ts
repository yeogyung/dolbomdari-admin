// 상세 화면의 「목록」 — 목록에서 들어왔으면 뒤로 가서 그 목록의 필터를 지킨다(QA 2026-10-11)
import { cameFromList } from '~/utils/listQuery'

export function useBackToList(listPath: string) {
  const router = useRouter()
  return () => {
    const back = import.meta.client ? window.history.state?.back : null
    if (cameFromList(back, listPath)) router.back()
    else void navigateTo(listPath)
  }
}
