// 자체 어드민 서버 API 래퍼 — 현재 세션 토큰을 Authorization 헤더에 실어 호출
export interface ListResult<T = Record<string, any>> {
  rows: T[]
  total: number
}

export function useAdminApi() {
  const supabase = useSupabase()

  async function authHeader(): Promise<Record<string, string>> {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) throw new Error('세션이 없습니다. 다시 로그인해 주세요.')
    return { Authorization: `Bearer ${session.access_token}` }
  }

  async function list(
    table: string,
    params: {
      page?: number
      pageSize?: number
      q?: string
      all?: boolean
      sort?: string
      dir?: 'asc' | 'desc'
      f?: string
      op?: 'eq' | 'neq'
      v?: string
    } = {},
  ): Promise<ListResult> {
    return await $fetch(`/api/admin/${table}`, {
      headers: await authHeader(),
      query: {
        page: params.page,
        pageSize: params.pageSize,
        q: params.q || undefined,
        all: params.all ? 'true' : undefined,
        sort: params.sort || undefined,
        dir: params.dir || undefined,
        f: params.f || undefined,
        op: params.op || undefined,
        v: params.v || undefined,
      },
    })
  }

  async function get(table: string, id: string): Promise<Record<string, any>> {
    return await $fetch(`/api/admin/${table}/${encodeURIComponent(id)}`, {
      headers: await authHeader(),
    })
  }

  async function create(table: string, body: Record<string, any>): Promise<Record<string, any>> {
    return await $fetch(`/api/admin/${table}`, {
      method: 'POST',
      headers: await authHeader(),
      body,
    })
  }

  async function update(
    table: string,
    id: string,
    body: Record<string, any>,
  ): Promise<Record<string, any>> {
    return await $fetch(`/api/admin/${table}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: await authHeader(),
      body,
    })
  }

  async function remove(table: string, key: Record<string, string>): Promise<void> {
    await $fetch(`/api/admin/${table}`, {
      method: 'DELETE',
      headers: await authHeader(),
      query: key,
    })
  }

  return { list, get, create, update, remove }
}
