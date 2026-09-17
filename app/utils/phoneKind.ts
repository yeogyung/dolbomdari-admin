export type PhoneKind = 'unknown' | 'smartphone' | 'feature'

const phoneKindLine = /^휴대폰 종류: (스마트폰|일반폰)$/

export function phoneKindFromMemo(memo: string): PhoneKind {
  const line = memo.split(/\r?\n/).reverse().find((value) => phoneKindLine.test(value))
  if (!line) return 'unknown'
  return line.endsWith('스마트폰') ? 'smartphone' : 'feature'
}

/** 정해진 휴대폰 종류 줄만 바꾸고 담당자가 작성한 다른 메모는 그대로 보존한다. */
export function withPhoneKind(memo: string, kind: unknown): string {
  if (kind !== 'unknown' && kind !== 'smartphone' && kind !== 'feature') return memo
  const lines = memo.split(/\r?\n/)
  const existing = lines.findIndex((line) => phoneKindLine.test(line))
  const remaining = lines.filter((line) => !phoneKindLine.test(line))
  if (kind === 'unknown') return remaining.join('\n')
  const label = `휴대폰 종류: ${kind === 'smartphone' ? '스마트폰' : '일반폰'}`
  if (existing >= 0) {
    remaining.splice(existing, 0, label)
    return remaining.join('\n')
  }
  if (!memo) return label
  return memo + (memo.endsWith('\n') ? '' : '\n') + label
}
