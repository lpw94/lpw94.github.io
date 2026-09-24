import { supabase } from './supabase'

/** 博客图片统一存放的公开桶（见 supabase/schema.sql） */
const BUCKET = 'covers'

/**
 * 生成安全的存储对象路径。
 * 不要把原始文件名拼进路径：中文、空格、#、? 等字符会让对象 key 非法，
 * Storage 会直接以 "Invalid key" 拒绝。统一改用「时间戳 + 随机串 + 规范化扩展名」。
 */
function makeObjectPath(folder: string, fileName: string) {
  const rawExt = fileName.includes('.') ? fileName.split('.').pop()! : ''
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  return folder ? `${folder}/${name}` : name
}

/**
 * 上传图片到 covers 桶，返回可直接用于 <img src> 的公开地址。
 * folder 用于区分用途：封面沿用 `covers`（历史路径），正文内嵌图用 `content`。
 */
export async function uploadImage(file: File, folder = ''): Promise<string> {
  const path = makeObjectPath(folder, file.name)

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined })

  if (error) throw new Error(error.message)

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/**
 * 从公开 URL 反解出 covers 桶内的对象路径。
 * 只认本项目的 Storage 地址（…/storage/v1/object/public/covers/…），
 * 外链或其它桶的地址返回 null，调用方据此跳过清理。
 */
export function bucketPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const i = url.indexOf(marker)
  if (i === -1) return null
  try {
    return decodeURIComponent(url.slice(i + marker.length).split('?')[0]) || null
  } catch {
    return null
  }
}

/**
 * 删除 covers 桶里的一张图（传入公开地址）。
 * 返回值含义：true = 已删除或不属于本桶（无需处理）；false = 删除失败（如 RLS 未放开）。
 */
export async function deleteImage(publicUrl: string): Promise<boolean> {
  const path = bucketPathFromUrl(publicUrl)
  if (!path) return true

  const { error } = await supabase.storage.from(BUCKET).remove([path])
  return !error
}
