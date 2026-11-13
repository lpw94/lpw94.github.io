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

// ── 图片压缩：超过 1MB 的位图上传前先压成 webp ──────────────────────
// 背景：Supabase 免费版 Storage 只有 1GB，博客截图动辄 3~5MB，很快就会爆。
// 方案：canvas 重绘转 webp（透明保留、压缩率高），先原尺寸降质量、
//       压不动再逐级降分辨率；gif（动图）/ svg（矢量）压不动也没意义，原样上传。

/** 压缩阈值：1MB */
const COMPRESS_LIMIT = 1024 * 1024
/** 分辨率阶梯：先原尺寸压质量，压不动再缩小长边 */
const SCALES = [1, 0.75, 0.6, 0.45]
/** webp 质量阶梯 */
const QUALITIES = [0.85, 0.75, 0.6]

const kb = (n: number) => Math.round(n / 1024)

/** 位图才压缩（gif 动图 / svg 矢量 / 其他非位图格式跳过） */
const isCompressible = (f: File) => /^image\/(jpeg|png|webp)$/.test(f.type)

/** 把压缩产物包装回 File（扩展名改成 .webp，与 contentType 一致） */
function toWebpFile(blob: Blob, orig: File): File {
  const base = orig.name.replace(/\.[^.]*$/, '') || 'image'
  return new File([blob], `${base}.webp`, { type: 'image/webp' })
}

/**
 * 压缩入口：超过 1MB 的 jpeg/png/webp 转 webp。
 * 档位全试完仍超过 1MB（极端大图）时，返回压出来的最小结果——仍显著优于原图。
 * 任何解码失败都回退原文件：压缩是优化，不能阻断上传。
 */
async function maybeCompress(file: File): Promise<File> {
  if (file.size <= COMPRESS_LIMIT || !isCompressible(file)) return file

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return file
  }

  let best: Blob | null = null
  try {
    for (const scale of SCALES) {
      const w = Math.max(1, Math.round(bitmap.width * scale))
      const h = Math.max(1, Math.round(bitmap.height * scale))
      canvas.width = w
      canvas.height = h
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(bitmap, 0, 0, w, h)
      for (const q of QUALITIES) {
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', q))
        if (!blob) continue
        if (blob.size <= COMPRESS_LIMIT) return toWebpFile(blob, file)
        if (!best || blob.size < best.size) best = blob
      }
    }
  } finally {
    bitmap.close()
  }
  return best ? toWebpFile(best, file) : file
}

export type UploadResult = {
  /** 可直接用于 <img src> 的公开地址 */
  url: string
  /** 压缩信息：原图超 1MB 且压缩成功时非空（用于调用方提示） */
  compressed: { beforeKB: number; afterKB: number } | null
}

/**
 * 上传图片到 covers 桶（超 1MB 的位图自动压缩成 webp 再传）。
 * folder 用于区分用途：封面沿用 `covers`（历史路径），正文内嵌图用 `content`。
 */
export async function uploadImage(file: File, folder = ''): Promise<UploadResult> {
  const finalFile = await maybeCompress(file)
  const path = makeObjectPath(folder, finalFile.name)

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, finalFile, { contentType: finalFile.type || undefined })

  if (error) throw new Error(error.message)

  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  const compressed =
    finalFile !== file ? { beforeKB: kb(file.size), afterKB: kb(finalFile.size) } : null
  return { url, compressed }
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

  const { data, error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) return false
  // RLS 没放开 DELETE 时，remove() 会「成功」但返回空数组，对象其实还在。
  // 不能只看 error，否则后台会误以为旧封面/旧 PDF 已清理。
  return Array.isArray(data) ? data.some((o) => o.name === path) : true
}

/** 上面这个删除函数其实是「按 URL 删本桶对象」，图片和 PDF 通用；
    另起一个语义中性的名字给 PDF 清理用，旧调用点保持不变。 */
export const deleteFile = deleteImage

/** PDF 体积上限：20MB（免费版 Storage 只有 1GB，浏览器内嵌预览太大也会卡） */
const PDF_LIMIT = 20 * 1024 * 1024

export type PdfUploadResult = {
  /** 可直接给 <iframe>/<a> 用的公开地址 */
  url: string
  /** 原始文件名，对象 key 是随机串，展示要靠它 */
  name: string
  size: number
}

/**
 * 上传 PDF 到同一个 covers 桶的 pdfs/ 子目录。
 * 不压缩、不改内容，只做类型与体积校验；路径沿用 makeObjectPath 的随机 key 规则，
 * 所以中文文件名也不会触发 Storage 的 "Invalid key"。
 */
export async function uploadPdf(file: File): Promise<PdfUploadResult> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!isPdf) throw new Error('请选择 PDF 文件（.pdf）')
  if (file.size > PDF_LIMIT) throw new Error('PDF 不能超过 20MB')

  const path = makeObjectPath('pdfs', file.name)
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: 'application/pdf' })

  if (error) throw new Error(error.message)

  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  return { url, name: file.name, size: file.size }
}
