// 배정 있는 근무지의 이름·사업을 바꿀 때 묻는 확인 문구 — 「1호점」이 수정 한 번에 「테스트」가 된 일(2026-10-08)
import { describe, expect, it } from 'vitest'
import { worksiteEditWarning } from '../app/utils/worksiteEditGuard'

const before = { name: '1호점', programName: '행복한밥상' }

describe('worksiteEditWarning', () => {
  it('이름과 사업이 그대로면 묻지 않는다 — 주소·담당자만 고치는 일은 잦다', () => {
    expect(worksiteEditWarning({ before, after: before, assignments: 16 })).toBeNull()
  })

  it('배정이 없으면 묻지 않는다', () => {
    expect(
      worksiteEditWarning({ before, after: { ...before, name: '테스트' }, assignments: 0 }),
    ).toBeNull()
  })

  it('배정이 있는데 이름·사업을 바꾸면 몇 명인지와 무엇이 바뀌는지 말한다', () => {
    const msg = worksiteEditWarning({
      before,
      after: { name: '테스트', programName: '시니어카페' },
      assignments: 16,
    })!
    expect(msg).toContain('「1호점」에 배정된 어르신이 16명 있어요.')
    expect(msg).toContain('이름: 「1호점」 → 「테스트」')
    expect(msg).toContain('사업: 「행복한밥상」 → 「시니어카페」')
    expect(msg).toContain('16명은 바뀐 근무지에 그대로 배정돼 있어요')
    expect(msg.endsWith('계속할까요?')).toBe(true)
  })

  it('바뀐 칸만 적는다', () => {
    const msg = worksiteEditWarning({
      before,
      after: { ...before, programName: '시니어카페' },
      assignments: 3,
    })!
    expect(msg).not.toContain('이름:')
    expect(msg).toContain('사업: 「행복한밥상」 → 「시니어카페」')
  })

  it('앞뒤 공백만 다른 이름은 바뀐 것이 아니다 — 저장할 때 다듬는다', () => {
    expect(
      worksiteEditWarning({ before, after: { ...before, name: ' 1호점 ' }, assignments: 16 }),
    ).toBeNull()
  })

  it('사업이 없으면 「사업 없음」으로 적는다', () => {
    const msg = worksiteEditWarning({
      before,
      after: { ...before, programName: null },
      assignments: 1,
    })!
    expect(msg).toContain('사업: 「행복한밥상」 → 「사업 없음」')
  })

  // 수를 못 받았다고 그냥 저장하면 확인 창을 둔 의미가 없다. 모른다고 말하고 묻는다.
  it('배정 수를 못 받았으면 모른다고 말하고 묻는다', () => {
    const msg = worksiteEditWarning({
      before,
      after: { ...before, name: '테스트' },
      assignments: null,
    })!
    expect(msg).toContain('배정된 어르신 수를 확인하지 못했어요')
    expect(msg.endsWith('계속할까요?')).toBe(true)
  })
})
