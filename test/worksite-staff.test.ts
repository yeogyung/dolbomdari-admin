// 근무지 목록 담당자 이름 테스트 — 서버가 싣는 이름을 먼저, 없으면 명부에서(QA 2026-11-02 PARTNER-05)
import { describe, expect, it } from 'vitest'
import { worksiteStaffName } from '../app/utils/dbo'

const ID = 'd5997010-0000-4000-8000-000000000001'

describe('worksiteStaffName', () => {
  // 수요처 계정 — 명부를 못 받아 목록이 비어도 서버가 실은 이름이 보인다
  it('서버가 실은 이름을 먼저 쓴다', () => {
    expect(worksiteStaffName({ name: '김미영' }, [], ID)).toBe('김미영')
    expect(worksiteStaffName({ name: '김미영' }, [{ id: ID, name: '다른 이름' }], ID)).toBe('김미영')
  })

  // 옛 서버거나 서버가 이름을 못 읽어 칸이 빠졌다 — 예전처럼 명부에서 찾는다
  it('칸이 없으면 명부에서 찾고, 없으면 id 다', () => {
    expect(worksiteStaffName(undefined, [{ id: ID, name: '김미영' }], ID)).toBe('김미영')
    expect(worksiteStaffName(undefined, [], ID)).toBe(ID)
  })

  it('이름이 비어 오면 명부로 넘어간다', () => {
    expect(worksiteStaffName({ name: null }, [{ id: ID, name: '김미영' }], ID)).toBe('김미영')
  })

  it('지정 전이면 —', () => {
    expect(worksiteStaffName(null, [], null)).toBe('—')
    expect(worksiteStaffName(undefined, [], null)).toBe('—')
  })
})
