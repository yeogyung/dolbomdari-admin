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

/*
 * 이메일 allowlist(NUXT_ADMIN_EMAILS)는 제거했다.
 *
 * DB 밖(환경변수)에 있는 권한이라 누가 관리자인지 조회도 감사도 되지 않았고,
 * 무엇보다 두 문지기의 판정을 어긋나게 했다 — 어드민 Nitro 는 allowlist 로
 * master 를 통과시키는데 dbo-admin 은 그 목록을 모른다. 그래서 사이드바에는
 * 시니어 메뉴가 보이는데 열면 403 이 나는 상태가 생겼다.
 *
 * 이제 권한은 dbo_profiles(운영센터)와 organization_manager(구인구직) 두 테이블,
 * 즉 DB 안에서만 결정된다.
 */

/**
 * 어드민 롤 — 권한 경계의 **단일 지점**이다.
 *
 * 라우트마다 롤을 다시 판정하면 스무 곳 중 한 곳만 빠뜨려도 그곳이 조용히
 * 열린다. 모든 라우트가 requireAdmin 을 거치게 하고 여기서만 판정한다.
 */
export type AdminRole = "master" | "worksite" | "org";

export interface AdminActor {
  userId: string;
  email: string;
  /** 화면에 보이는 이름. 명부(dbo_directory)나 기관 담당자명이 정본이다 */
  name: string;
  role: AdminRole;
  /** role='org' 일 때 소속 기관. 그 외에는 null */
  organizationId: string | null;
  /** role='worksite' 일 때 담당 근무지. master 는 null 이어도 된다 */
  worksiteId: string | null;
}

/**
 * 요청의 Bearer 토큰을 검증하고 어드민 자격을 판정한다.
 * 통과 시 actor 반환, 실패 시 401/403 throw.
 */
export async function requireAdmin(event: H3Event): Promise<AdminActor> {
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

  const userId = data.user.id;
  const email = (data.user.email || "").toLowerCase();
  const db = serviceClient();

  // ── 1) 부트스트랩 관리자 — app_metadata.admin
  //    이것도 DB 밖 권한이라 새로 늘리지 않는다. 기존 계정 하나를 위해 남겨 둔 것이다.
  const isMetaAdmin =
    (data.user.app_metadata as Record<string, unknown> | undefined)?.admin === true;
  if (isMetaAdmin) {
    // 이 경로에는 이름이 없다 — DB 밖 권한이라 프로필이 붙어 있지 않다
    return {
      userId,
      email,
      name: email.split("@")[0] || "관리자",
      role: "master",
      organizationId: null,
      worksiteId: null,
    };
  }

  // ── 2) 운영센터 롤 — dbo_profiles 가 정본이다.
  //    dbo-admin Edge Function 과 같은 테이블을 보므로 두 문지기의 판정이 어긋나지 않는다.
  const { data: profile } = await db
    .from("dbo_profiles")
    .select("role, directory_id, name")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.role === "master") {
    return {
      userId,
      email,
      name: (profile.name as string) || "운영관리자",
      role: "master",
      organizationId: null,
      worksiteId: null,
    };
  }

  if (profile?.role === "worksite") {
    // 담당 근무지는 명부에 있다. 없으면 **던진다** — 전체로 떨어뜨리면 수요처 계정이
    // 명부를 통째로 보게 된다. 조용히 넓어지는 실패는 만들지 않는다.
    const { data: dir } = await db
      .from("dbo_directory")
      .select("worksite_id, status")
      .eq("id", profile.directory_id)
      .maybeSingle();
    if (!dir || dir.status !== "active" || !dir.worksite_id) {
      throw createError({
        statusCode: 403,
        statusMessage: "담당 근무지가 지정되지 않았습니다.",
      });
    }
    return {
      userId,
      email,
      name: (profile.name as string) || "수요처 담당자",
      role: "worksite",
      organizationId: null,
      worksiteId: dir.worksite_id as string,
    };
  }

  // ── 3) 구인구직 기관 관리자
  //    ⚠ 구인구직 OTP(mode:'login')는 종사자도 세션을 준다. 그래서 여기서
  //    organization_manager 존재를 반드시 확인해야 한다 — 빠뜨리면 종사자 누구나
  //    어드민에 들어온다. 시니어 경로에는 이 문제가 없다(명부에 없으면 문자도 안 나간다).
  const { data: orgManager } = await db
    .from("organization_manager")
    .select("organization_id, manager_name")
    .eq("id", userId)
    .maybeSingle();

  if (orgManager) {
    return {
      userId,
      email,
      name: (orgManager.manager_name as string) || "기관 관리자",
      role: "org",
      organizationId: (orgManager.organization_id as string | null) ?? null,
      worksiteId: null,
    };
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

/**
 * 롤이 접근할 수 있는 구인구직 테이블.
 *
 * **기본은 거부다.** 목록에 없는 테이블은 막힌다 — 새 테이블을 레지스트리에
 * 추가해도 자동으로 열리지 않는다. 반대로 짜면(막을 것만 나열) 추가할 때마다
 * 빠뜨리고, 빠뜨린 쪽이 열린 상태가 된다.
 */
const ROLE_TABLES: Record<AdminRole, readonly string[] | "all"> = {
  master: "all",
  // 기관 관리자는 종사자와 기관만 본다. 기관은 본인 것만(assertTableAccess 아래의 스코프).
  org: ["users", "organization"],
  // 수요처 담당자는 구인구직 쪽을 보지 않는다 — 시니어 전용 롤이다.
  worksite: [],
};

/** 이 롤이 그 테이블을 볼 수 있는가. 볼 수 없으면 404 로 막는다. */
export function assertTableAccess(actor: AdminActor, table: string): void {
  const allowed = ROLE_TABLES[actor.role];
  if (allowed === "all") return;
  if (allowed.includes(table)) return;
  // 403 이 아니라 404 다 — 403 은 "그 테이블이 존재한다"를 알려 준다.
  throw createError({ statusCode: 404, statusMessage: "알 수 없는 테이블입니다." });
}

/**
 * 목록/단건 조회에 롤 스코프를 건다.
 *
 * 기관 관리자는 `organization` 에서 **자기 기관 한 행만** 본다. `users`(종사자)는
 * 제한하지 않는다 — 앱의 `users_select_for_org_managers` 정책이 이미 기관 담당자에게
 * 종사자 전체 조회를 열어 두고 있어 그쪽과 기준을 맞춘다.
 */
// deno-lint-ignore no-explicit-any
export function applyRoleScope<T extends { eq: (c: string, v: any) => T }>(
  query: T,
  actor: AdminActor,
  table: string,
): T {
  if (actor.role === "org" && table === "organization") {
    // 소속 기관이 없는 담당자는 아무 기관도 못 본다. 전체로 떨어뜨리지 않는다.
    return query.eq("id", actor.organizationId ?? "00000000-0000-0000-0000-000000000000");
  }
  return query;
}

/**
 * 쓰기는 master 만 한다.
 *
 * 기관 관리자에게 준 것은 조회 권한이다. 생성·수정·삭제까지 열면 자기 기관 행을
 * 고쳐 소속을 바꾸는 식으로 스코프 자체를 우회할 수 있다.
 */
export function assertWriteAllowed(actor: AdminActor): void {
  if (actor.role !== "master") {
    throw createError({ statusCode: 403, statusMessage: "쓰기 권한이 없습니다." });
  }
}
