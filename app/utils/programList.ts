// 사업 목록 화면의 이름 검색·상태 필터 — 사업은 전부 받으므로 화면에서 거른다(QA 2026-11-07 ADMIN-11)
import type { Program } from '../types/dbo'
import { nameIncludes } from './nameSearch'

/** 받은 순서를 그대로 두고 이름(띄어쓰기·대소문자 무시)과 상태('' 은 전체)로 거른다 */
export function filterPrograms<T extends Pick<Program, 'name' | 'status'>>(
  items: T[],
  opts: { q: string; status: string },
): T[] {
  return items.filter((p) => nameIncludes(p.name, opts.q) && (!opts.status || p.status === opts.status))
}
