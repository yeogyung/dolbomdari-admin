// 공유 링크(/l/job/:id) 응답 HTML에 OG/트위터 메타 태그를 서버에서 주입 — 카카오톡 등 스크래퍼용(SPA라 클라이언트 메타는 못 읽음)
import { serviceClient } from '../utils/admin'

const SITE_NAME = '돌봄다리'
const BASE_URL = 'https://admin.carebridges.kr'
// 카드 썸네일 — public/og-default.png (권장 1200x630) 배포 필요. 없으면 이미지 없는 카드로 표시됨.
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-default.png`

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', async (html, { event }) => {
    const path = event.path || ''
    const matched = /^\/l\/job\/([^/?#]+)/.exec(path)
    if (!matched) return

    const id = decodeURIComponent(matched[1])

    let title = '돌봄다리 공고'
    let description = '돌봄다리에서 공고를 확인해보세요.'

    try {
      const { data } = await serviceClient()
        .from('jobs')
        .select('title, company, org_name, salary, location, description')
        .eq('id', id)
        .maybeSingle()
      if (data) {
        title = `[돌봄다리] ${data.title ?? '공고'}`
        const org = data.org_name || data.company || ''
        const parts = [org, data.salary, data.location].filter(Boolean)
        description = parts.length ? parts.join(' · ') : data.description || description
      }
    } catch {
      // 조회 실패 시 기본 메타로 폴백
    }

    const url = `${BASE_URL}${path}`
    html.head.push(
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
      `<meta property="og:title" content="${esc(title)}" />`,
      `<meta property="og:description" content="${esc(description)}" />`,
      `<meta property="og:image" content="${esc(DEFAULT_OG_IMAGE)}" />`,
      `<meta property="og:url" content="${esc(url)}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${esc(title)}" />`,
      `<meta name="twitter:description" content="${esc(description)}" />`,
      `<meta name="twitter:image" content="${esc(DEFAULT_OG_IMAGE)}" />`,
    )
  })
})
