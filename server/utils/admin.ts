// 어드민 서버 유틸 — service_role Supabase 클라이언트, 관리자 인증, 테이블 화이트리스트
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { H3Event } from "h3";
import { getTable, type TableDef } from "#shared/tables";

let _client: SupabaseClient | null = null;

/** RLS를 우회하는 service_role 클라이언트 (싱글턴) */

export function serviceClient(): SupabaseClient {
  if (_client) return _client;
  const config = useRuntimeConfig();
  const url = config.public.supabaseUrl;
  const key = config.supabaseServiceRoleKey;
  if (!url || !key) {
    throw createError({
      statusCode: 500,
      statusMessage:
        "Supabase URL/service_role 키가 설정되지 않았습니다 (.env 확인).",
    });
  }
  _client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _client;
}

/** 관리자 이메일 allowlist */
function adminEmails(): string[] {
  const raw = useRuntimeConfig().adminEmails || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * 요청의 Bearer 토큰을 검증하고 관리자 여부를 확인한다.
 * 통과 시 사용자 이메일 반환, 실패 시 401/403 throw.
 */
export async function requireAdmin(event: H3Event): Promise<string> {
  const auth = getRequestHeader(event, "authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: "인증 토큰이 없습니다.",
    });
  }

  const { data, error } = await serviceClient().auth.getUser(token);
  if (error || !data.user) {
    throw createError({
      statusCode: 401,
      statusMessage: "유효하지 않은 세션입니다.",
    });
  }

  const email = (data.user.email || "").toLowerCase();
  const allow = adminEmails();
  // 관리자 판별: env allowlist(부트스트랩) 또는 app_metadata.admin === true (UI로 생성한 관리자)
  const isMetaAdmin =
    (data.user.app_metadata as Record<string, unknown> | undefined)?.admin === true;
  if (isMetaAdmin || (allow.length > 0 && allow.includes(email))) {
    return email;
  }

  // 운영센터 마스터도 통과시킨다 — 두 앱이 DB 하나를 공유하므로 마스터는 양쪽을 본다.
  // 판정 기준을 dbo_profiles 로 둔 이유는 그것이 유일하게 DB 안에 있는 롤이기 때문이다
  // (구인구직 쪽 관리자 권한은 auth 메타데이터와 환경변수에만 있어 조회·감사가 안 된다).
  // dbo-admin Edge Function 과 같은 테이블을 보므로 두 문지기의 판정이 어긋나지 않는다.
  const { data: profile } = await serviceClient()
    .from("dbo_profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile?.role === "master") {
    return email || data.user.id;
  }

  throw createError({
    statusCode: 403,
    statusMessage: "관리자 권한이 없습니다.",
  });
}

/** 라우트 파라미터의 테이블명을 화이트리스트로 검증하고 정의를 반환한다. */
export function assertTable(event: H3Event): TableDef {
  const name = getRouterParam(event, "table");
  const def = getTable(name);
  if (!def) {
    throw createError({
      statusCode: 404,
      statusMessage: "알 수 없는 테이블입니다.",
    });
  }
  return def;
}

/**
 * 요청 본문을 레지스트리 필드로 화이트리스트하고 읽기전용 컬럼을 제거한다.
 * forCreate=false(수정)면 createOnly 필드도 제거한다.
 */
export function sanitizePayload(
  def: TableDef,
  body: Record<string, unknown>,
  forCreate: boolean,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of def.fields) {
    if (field.readonly) continue;
    if (!forCreate && field.createOnly) continue;
    if (!(field.name in body)) continue;
    let value = body[field.name];
    // 빈 문자열은 nullable 컬럼을 위해 null 로 정규화 (숫자/날짜/배열)
    if (value === "" && field.type !== "text" && field.type !== "textarea") {
      value = null;
    }
    out[field.name] = value;
  }
  return out;
}
