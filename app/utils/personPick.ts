// 사람 고르기 표의 행과 찾기 규칙 — 공지 개인 받는 사람(QA ANOTICE-03)·채팅방 참여자(CHAT-01·03)가 같이 쓴다

export type PickPerson = {
  /** 고르면 담기는 값 — 공지는 명부 id, 채팅방은 프로필 id */
  id: string
  name: string
  phone: string | null
  /** 명부 역할(senior·manager·worksite). 여러 역할이 섞인 명단에서만 보인다 */
  role?: string
  /** 비고 칸 — 「앱 미연결」 같은 안내 */
  note?: string | null
  /** 고를 수 없다 — 회색으로 두고 눌러도 담기지 않는다 */
  disabled?: boolean
}

/**
 * 공지 「개인」 받는 사람 후보 — 명부 행 그대로, 값은 명부 id(서버 `directoryIds`). **앱 계정이 없는 분도 고를 수
 * 있다**(긴급은 문자로 가고 발송 기록이 남는다 — 서버 계약 3a묶음 3번). 앱 미연결은 비고에 적기만 한다.
 */
export function noticePeople(
  rows: { id: string; name: string; phone: string | null; app_connected?: boolean | null }[],
): PickPerson[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    note: r.app_connected === false ? '앱 미연결' : null,
  }))
}

/** 비교용으로 띄어쓰기를 빼고 소문자로 바꾼다 */
const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()

/**
 * 이름이나 연락처로 좁힌다. 이름은 띄어쓰기·대소문자를 무시하고, 숫자가 들어 있으면 연락처 숫자에서도 찾는다
 * (같은 이름이 흔해 끝 네 자리로 가린다). 빈 검색어면 그대로 돌려준다.
 */
export function filterPeople<T extends Pick<PickPerson, 'name' | 'phone'>>(people: T[], term: string): T[] {
  const word = norm(term)
  if (!word) return people
  const digits = word.replace(/\D/g, '')
  return people.filter(
    (p) => norm(p.name).includes(word) || (!!digits && (p.phone ?? '').replace(/\D/g, '').includes(digits)),
  )
}
