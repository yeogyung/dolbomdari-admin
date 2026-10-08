// 배정 있는 근무지의 이름·사업을 바꿀 때 저장 전에 묻는 확인 문구
//
// 2026-10-08, 「행복한밥상 › 1호점」 행의 「수정」으로 이름을 「테스트」, 사업을 「시니어카페」로 바꿔
// 그 근무지에 배정된 어르신 16명이 통째로 「시니어카페 › 테스트」 소속이 됐다. 수정은 근무지 행만
// 고치고 배정은 그대로 따라가는데, 화면이 그 사실을 말하지 않았다.
//
// **이름이나 사업이 바뀔 때만 묻는다.** 주소·담당자만 고치는 일은 잦고 소속을 바꾸지 않는다.

type Snapshot = { name: string; programName: string | null }

const quote = (v: string | null) => `「${v ?? '사업 없음'}」`

/**
 * 확인 창에 띄울 글. 물을 필요가 없으면 `null`.
 *
 * `assignments` 가 `null` 이면 배정 수를 못 받은 것이다 — 그냥 저장하면 이 확인 창을 둔 의미가
 * 없으므로 모른다고 말하고 묻는다.
 */
export function worksiteEditWarning(args: {
  before: Snapshot
  after: Snapshot
  assignments: number | null
}): string | null {
  const { before, after, assignments } = args
  const name = after.name.trim()
  const changes: string[] = []
  if (name !== before.name) changes.push(`이름: ${quote(before.name)} → ${quote(name)}`)
  if (after.programName !== before.programName) {
    changes.push(`사업: ${quote(before.programName)} → ${quote(after.programName)}`)
  }
  if (changes.length === 0 || assignments === 0) return null

  const head = assignments === null
    ? '배정된 어르신 수를 확인하지 못했어요. 배정이 있다면 함께 바뀌어요.'
    : `${quote(before.name)}에 배정된 어르신이 ${assignments}명 있어요.`
  const tail = assignments === null
    ? '계속할까요?'
    : `저장하면 이 ${assignments}명은 바뀐 근무지에 그대로 배정돼 있어요. 계속할까요?`
  return [head, '', ...changes, '', tail].join('\n')
}
