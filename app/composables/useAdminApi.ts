// 자체 어드민 서버 API 래퍼 — 현재 세션 토큰을 Authorization 헤더에 실어 호출
import { ORG_DOCUMENT_MAX_BYTES, orgDocumentExt } from '#shared/orgDocument'

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

  /** 대시보드 KPI 집계 */
  async function statsSummary(): Promise<Record<string, number>> {
    return await $fetch('/api/admin/stats/summary', { headers: await authHeader() })
  }

  /** 커스텀 운영 액션 (server/api/admin/actions/*) */
  async function action(path: string, body: Record<string, any>): Promise<any> {
    return await $fetch(`/api/admin/actions/${path}`, {
      method: 'POST',
      headers: await authHeader(),
      body,
    })
  }

  /** 기관 가입 서류 임시 열람 URL (없으면 null) */
  async function orgDocumentUrl(managerId: string): Promise<string | null> {
    const res = await $fetch<{ url: string | null }>(
      `/api/admin/org-documents/${encodeURIComponent(managerId)}`,
      { headers: await authHeader() },
    )
    return res.url
  }

  /**
   * 관리자가 사업자등록증을 대신 올린다 — 주소 발급 → 브라우저가 Storage 로 바로 업로드 → 담당자에 연결.
   * 파일이 어드민 서버를 거치지 않아 서버 요청 크기 제한에 걸리지 않는다
   */
  async function uploadOrgDocument(managerId: string, file: File): Promise<void> {
    if (!orgDocumentExt(file.type)) throw new Error('서류는 JPG·PNG·WEBP 이미지로 올려 주세요.')
    if (file.size > ORG_DOCUMENT_MAX_BYTES) throw new Error('서류 파일은 10MB 이하만 올릴 수 있습니다.')
    const base = `/api/admin/org-documents/${encodeURIComponent(managerId)}`
    const { path, token } = await $fetch<{ path: string; token: string }>(`${base}/upload-url`, {
      method: 'POST',
      headers: await authHeader(),
      body: { contentType: file.type },
    })
    const { error } = await supabase.storage
      .from('org-documents')
      .uploadToSignedUrl(path, token, file, { contentType: file.type })
    if (error) throw new Error('서류를 올리지 못했습니다: ' + error.message)
    await $fetch(`${base}/attach`, { method: 'POST', headers: await authHeader(), body: { path } })
  }

  return {
    list,
    get,
    create,
    update,
    remove,
    statsSummary,
    action,
    orgDocumentUrl,
    uploadOrgDocument,
  }
}
