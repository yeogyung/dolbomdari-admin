// 행 생성 — crud 모드 + canCreate 테이블만 허용
import { randomUUID } from 'node:crypto'
import { requireAdmin, assertTable, serviceClient, sanitizePayload } from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const def = assertTable(event)

  if (def.mode !== 'crud' || !def.canCreate) {
    throw createError({ statusCode: 405, statusMessage: '이 테이블은 생성할 수 없습니다.' })
  }

  const body = (await readBody(event)) as Record<string, unknown>
  const payload = sanitizePayload(def, body, true)

  // jobs.id 는 text PK(기본값 없음) → 미입력 시 UUID 자동 생성
  if (def.name === 'jobs' && !payload.id) {
    payload.id = randomUUID()
  }

  const { data, error } = await serviceClient()
    .from(def.name)
    .insert(payload)
    .select()
    .single()

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message })
  }
  return data
})
