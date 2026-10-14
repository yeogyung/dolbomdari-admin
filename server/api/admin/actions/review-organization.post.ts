// 기관 가입 승인·반려 (master 전용) — 상태 변경 후 담당자에게 문자 발송. 푸시(O5)는 DB 트리거가 보낸다
import { assertWriteAllowed, requireAdmin, serviceClient } from '~~/server/utils/admin'
import { sendSms } from '~~/server/utils/sms'
import { orgReviewSmsText } from '#shared/orgApproval'

export default defineEventHandler(async (event) => {
  assertWriteAllowed(await requireAdmin(event))
  const body = (await readBody(event)) as { managerId?: string; decision?: string; reason?: string }
  const managerId = String(body.managerId || '').trim()
  const decision = body.decision
  const reason = String(body.reason || '').trim()
  if (!managerId || (decision !== 'approved' && decision !== 'rejected')) {
    throw createError({ statusCode: 400, statusMessage: 'managerId·decision(approved|rejected)이 필요합니다.' })
  }
  if (decision === 'rejected' && !reason) {
    throw createError({ statusCode: 400, statusMessage: '반려 사유를 입력해 주세요.' })
  }

  // 이미 같은 상태면 바꾸지 않는다 — 두 번 눌러도 문자가 두 번 나가지 않게
  const { data, error } = await serviceClient()
    .from('organization_manager')
    .update({
      approval_status: decision,
      reviewed_at: new Date().toISOString(),
      rejection_reason: decision === 'rejected' ? reason : null,
    })
    .eq('id', managerId)
    .neq('approval_status', decision)
    .select('phone, org_name')
    .maybeSingle()
  if (error) throw createError({ statusCode: 500, statusMessage: '상태 변경 실패: ' + error.message })
  if (!data) throw createError({ statusCode: 409, statusMessage: '이미 처리되었거나 담당자를 찾을 수 없습니다.' })

  // 상태는 이미 바뀌었다. 문자가 실패해도(예외 포함) 되돌리지 않고 화면에 알린다 —
  // 여기서 500 을 내면 어드민은 실패로 알고 다시 눌러 409 를 맞는다
  try {
    const sms = await sendSms({
      to: data.phone as string,
      text: orgReviewSmsText(data.org_name as string, decision, reason),
    })
    return sms.ok ? { ok: true, smsSent: true } : { ok: true, smsSent: false, reason: sms.reason }
  } catch (e) {
    return { ok: true, smsSent: false, reason: e instanceof Error ? e.message : String(e) }
  }
})
