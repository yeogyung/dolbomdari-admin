// FAQ 조회 — 브라우저 supabase-js 로 dbo_faqs 를 직접 읽는다(RLS: master·manager). 쓰기는 useDboAdmin
import type { Faq } from '~/types/dbo'

// dbo_worksites 는 qr_token 때문에 컬럼 단위 grant 라 `*` 로 읽으면 42501 이다 — 컬럼을 적는다
const FAQ_SELECT =
  'id, question, answer, enabled, sort, status, category, created_by, created_at, dbo_faq_worksites(worksite_id, dbo_worksites(id, name))'

export function useFaqs() {
  const supabase = useSupabase()

  return {
    async listFaqs(): Promise<Faq[]> {
      const { data, error } = await supabase
        .from('dbo_faqs')
        .select(FAQ_SELECT)
        .order('sort', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as Faq[]
    },
    /** 없거나 RLS 로 가려지면 null */
    async getFaq(id: string): Promise<Faq | null> {
      const { data, error } = await supabase.from('dbo_faqs').select(FAQ_SELECT).eq('id', id).maybeSingle()
      if (error) throw error
      return data as unknown as Faq | null
    },
  }
}
