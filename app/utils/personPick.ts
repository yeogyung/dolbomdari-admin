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
  /** 비고를 빨갛게 — 서버가 거절한 까닭(채팅방 bad_member) */
  alert?: boolean
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

/**
 * 채팅방 참여자 후보(QA 2026-11-02 CHAT-01 · CHAT-03, 서버 2026-11-04 계약 3a묶음 4·5번). 방 멤버는 로그인한 계정에만
 * 붙으므로 값은 **프로필 id** 다 — 어드민 명부에는 프로필 id 가 없어 `dbo_profiles.directory_id` 로 명부 행과 잇는다.
 *
 * - 앱 계정이 없는 분 — 「앱 미연결」 회색(고를 수 없다. 넣으면 서버가 `missing` 으로 거절한다). 값 자리는 명부 id 다
 * - `members`(이미 방에 있는 프로필 id) — 「참여 중」 회색
 * - `problems`(서버 `bad_member` 의 까닭, 프로필 id → 문구) — 비고에 빨갛게. 고른 채로 둬 무엇이 걸렸는지 보이게 한다
 */
export function roomCandidates(
  rows: { id: string; name: string; phone: string | null; role: string }[],
  profiles: { id: string; directory_id: string }[],
  opts: { members?: Set<string>; problems?: Map<string, string> } = {},
): PickPerson[] {
  const profileOf = new Map<string, string>()
  // 한 명부에 계정이 둘이면 먼저 온 것 하나만 잇는다(지금 운영에는 없다)
  for (const p of profiles) if (!profileOf.has(p.directory_id)) profileOf.set(p.directory_id, p.id)
  return rows.map((r) => {
    const base = { name: r.name, phone: r.phone, role: r.role }
    const profileId = profileOf.get(r.id)
    if (!profileId) return { ...base, id: r.id, note: '앱 미연결', disabled: true }
    if (opts.members?.has(profileId)) return { ...base, id: profileId, note: '참여 중', disabled: true }
    const problem = opts.problems?.get(profileId)
    return problem ? { ...base, id: profileId, note: problem, alert: true } : { ...base, id: profileId, note: null }
  })
}

/** 서버 `bad_member` 의 까닭 — missing 앱 계정 없음 · inactive 명부 상태가 active 아님(계약 종료) */
export function memberProblemLabel(reason: string): string {
  if (reason === 'missing') return '앱 미연결'
  if (reason === 'inactive') return '계약 종료'
  return reason
}

/**
 * 방 개설·참여자 추가의 400 `bad_member` 에서 걸린 사람(프로필 id → 문구). 다른 오류면 null.
 * 서버가 id 를 소문자로 맞춰 돌려주므로 여기서도 소문자로 둔다(DB 가 주는 프로필 id 도 소문자다).
 */
export function badMemberProblems(e: any): Map<string, string> | null {
  if (e?.data?.error !== 'bad_member' || !Array.isArray(e.data.invalid)) return null
  const out = new Map<string, string>()
  for (const it of e.data.invalid as { profileId?: unknown; reason?: unknown }[]) {
    if (typeof it?.profileId === 'string') out.set(it.profileId.toLowerCase(), memberProblemLabel(String(it.reason ?? '')))
  }
  return out
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
