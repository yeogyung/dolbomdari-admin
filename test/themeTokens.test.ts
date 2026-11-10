// 템플릿의 색 클래스가 테마에 있는 토큰만 쓰는지 — Tailwind v4 는 모르는 클래스를 조용히 버려 빌드·타입 검사가 못 잡는다
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')

/** main.css `@theme` 의 `--color-*` 이름(brand-500·hairline·surface-soft …) */
function themeColors(): Set<string> {
  const css = readFileSync(join(ROOT, 'app/assets/css/main.css'), 'utf8')
  return new Set([...css.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1]!))
}

/** Tailwind 기본 팔레트(단계 붙음)와 특수 값, Nuxt UI 의 의미 색 유틸리티 */
const PALETTE = /^(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|[1-9]00|950)$/
const SPECIAL = new Set(['white', 'black', 'transparent', 'current', 'inherit'])
const NUXT_UI = new Set(['default', 'muted', 'elevated', 'accented', 'inverted', 'dimmed', 'toned', 'highlighted', 'primary', 'secondary', 'success', 'info', 'warning', 'error'])

/** 색이 아닌 같은 접두 유틸리티 — 글자 크기·정렬, 테두리 방향·굵기·모양, 링 굵기, 배경 크기·위치 등 */
const NOT_COLOR =
  /^(text-(xs|sm|base|lg|xl|[2-9]xl|left|right|center|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip|align)|border-([trblxyse]|[trblxyse]-0|0|2|4|8|solid|dashed|dotted|double|none|hidden|collapse|separate|spacing-0|box|radius)|ring-(0|1|2|4|8|inset|offset-\d)|outline-(none|hidden|offset-\d|0|1|2|4|8|dashed)|bg-(clip-\w+|fixed|local|scroll|cover|contain|auto|center|no-repeat|repeat|origin-\w+|none|top|bottom|left|right|linear-\w+|gradient-\w+)|divide-([xy]|solid|dashed))$/

function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? vueFiles(p) : p.endsWith('.vue') ? [p] : []
  })
}

describe('테마 색 토큰', () => {
  it('템플릿의 bg·text·border·ring·divide·outline 색은 main.css @theme·Tailwind 기본 팔레트·Nuxt UI 색만 쓴다', () => {
    const theme = themeColors()
    const unknown: string[] = []
    for (const file of vueFiles(join(ROOT, 'app'))) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/(?<![\w-])(?:[a-z-]+:)*((bg|text|border(?:-[trblxyse])?|ring|divide|outline)-([a-z][a-z0-9-]*))(?:\/\d+)?(?![\w-])/g)) {
        const [, cls, , name] = m as unknown as [string, string, string, string]
        if (NOT_COLOR.test(cls)) continue
        if (theme.has(name) || PALETTE.test(name) || SPECIAL.has(name) || NUXT_UI.has(name)) continue
        unknown.push(`${relative(ROOT, file).replace(/\\/g, '/')}: ${cls}`)
      }
    }
    expect([...new Set(unknown)]).toEqual([])
  })
})
