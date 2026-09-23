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
