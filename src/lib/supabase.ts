import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  // 仅提示，不阻断渲染；配置 .env 后即可正常工作
  console.warn(
    '缺少 Supabase 环境变量，请在 .env 中配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY'
  )
}

// Dashboard 上的 /rest/v1、/auth/v1 等后缀不是项目地址的一部分，
// 这里统一裁掉，避免拼出 .../rest/v1/auth/v1/otp 这类 404 路径
const normalizedUrl = (supabaseUrl || 'https://placeholder.supabase.co')
  .trim()
  .replace(/\/(rest|auth|storage|realtime)\/v1\/?$/, '')
  .replace(/\/+$/, '')

// 未配置时使用占位值兜底，避免 createClient 抛错导致整个页面白屏
export const supabase = createClient(
  normalizedUrl,
  supabaseAnonKey || 'placeholder-anon-key'
)
