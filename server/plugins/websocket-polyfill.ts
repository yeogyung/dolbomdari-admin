// Node 20에는 전역 WebSocket이 없어 @supabase/supabase-js createClient가 실패 → ws로 폴리필
import ws from 'ws'

export default defineNitroPlugin(() => {
  if (!(globalThis as any).WebSocket) {
    ;(globalThis as any).WebSocket = ws
  }
})
