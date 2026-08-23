// 상단바에 표시할 페이지 제목/브레드크럼 상태 — 각 페이지가 설정, AppTopbar가 렌더
export interface Crumb {
  label: string
  to?: string
}

export function useAdminHeader() {
  const state = useState<{ title: string; crumbs: Crumb[] }>('admin-header', () => ({
    title: '',
    crumbs: [],
  }))

  function setHeader(title: string, crumbs: Crumb[] = []) {
    state.value = { title, crumbs }
  }

  return { header: state, setHeader }
}
