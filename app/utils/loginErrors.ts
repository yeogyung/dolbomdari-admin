// 로그인 인증번호 요청·확인이 던진 오류의 화면 문구 — 서버 오류 코드를 쉬운 말로 바꾼다

/** 서버 코드 → 문구. 여기 없는 코드는 예전처럼 코드를 그대로 보인다 */
const LOGIN_ERRORS: Record<string, string> = {
  // 명부 상태가 active 가 아니다(종료된 사람) — 인증번호 요청·확인 모두 403(서버 2026-11-07, QA ACCT-02)
  inactive: '이용이 끝난 계정입니다. 담당자에게 문의해 주세요.',
}

/** 인증번호 요청·확인 실패 문구. 아는 코드는 문구로, 모르는 코드는 그대로, 코드가 없으면 `fallback` */
export function loginErrorMessage(e: any, fallback: string): string {
  const code: unknown = e?.data?.error
  if (typeof code === 'string' && code) return LOGIN_ERRORS[code] ?? code
  return fallback
}
