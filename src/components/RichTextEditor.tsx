import { useEffect, useRef, useState } from 'react'

type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  /**
   * 上传正文图片，返回可访问的公开地址。
   * 不传时不渲染「图片」上传按钮（编辑器本身不关心存储实现）。
   */
  onUploadImage?: (file: File) => Promise<string>
}

type Command = {
  label: string
  title: string
  cmd: string
  arg?: string
}

const COMMANDS: Command[] = [
  { label: '加粗', title: '加粗', cmd: 'bold' },
  { label: '斜体', title: '斜体', cmd: 'italic' },
  { label: '删除线', title: '删除线', cmd: 'strikeThrough' },
  { label: 'H2', title: '二级标题', cmd: 'formatBlock', arg: 'h2' },
  { label: 'H3', title: '三级标题', cmd: 'formatBlock', arg: 'h3' },
  { label: '正文', title: '普通段落', cmd: 'formatBlock', arg: 'p' },
  { label: '• 列表', title: '无序列表', cmd: 'insertUnorderedList' },
  { label: '1. 列表', title: '有序列表', cmd: 'insertOrderedList' },
  { label: '引用', title: '引用', cmd: 'formatBlock', arg: 'blockquote' },
  { label: '代码块', title: '代码块', cmd: 'formatBlock', arg: 'pre' },
  { label: '清格式', title: '清除格式', cmd: 'removeFormat' },
  { label: '撤销', title: '撤销', cmd: 'undo' },
  { label: '重做', title: '重做', cmd: 'redo' },
]

/** 拼进 HTML 属性前先转义，避免地址里的引号截断属性、破坏标签结构 */
function escapeAttr(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * 轻量富文本编辑器：基于 contentEditable + execCommand，不引入第三方依赖。
 * 输出为 HTML 字符串，因此详情页需要能渲染 HTML（见 PostDetail 里的分支判断）。
 */
export default function RichTextEditor({ value, onChange, placeholder, onUploadImage }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  /** 点按钮前的编辑器选区。系统文件选择框会夺走焦点并清空选区，必须提前存下来 */
  const savedRange = useRef<Range | null>(null)
  const [uploading, setUploading] = useState(false)

  // 只在外部值与当前内容不一致时同步（切换文章 / 切换编辑模式），
  // 打字过程中两者始终相同，所以不会重设 innerHTML 导致光标跳到开头。
  useEffect(() => {
    const el = bodyRef.current
    if (el && el.innerHTML !== value) el.innerHTML = value || ''
  }, [value])

  const sync = () => onChange(bodyRef.current?.innerHTML ?? '')

  const exec = (cmd: string, arg?: string) => {
    // 工具栏按钮用 onMouseDown preventDefault 保住了焦点与选区，这里再兜底一次
    bodyRef.current?.focus()
    document.execCommand(cmd, false, arg)
    sync()
  }

  /** 记录光标位置（仅当选区确实落在编辑器内才记录） */
  const saveSelection = () => {
    const el = bodyRef.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    if (el.contains(range.commonAncestorContainer)) savedRange.current = range.cloneRange()
  }

  /** 恢复之前记录的光标位置；选区已失效（内容被改过）时退回到正文末尾 */
  const restoreSelection = () => {
    const el = bodyRef.current
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    if (!sel) return
    sel.removeAllRanges()

    const saved = savedRange.current
    if (saved && el.contains(saved.startContainer)) {
      sel.addRange(saved)
      return
    }
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    sel.addRange(range)
  }

  /**
   * 需要选区的工具栏按钮统一走这里：
   * 阻止默认行为（不让按钮抢走焦点）并记下光标位置，
   * 之后无论是 prompt 还是文件选择框打断了焦点，都能把选区恢复回来。
   */
  const keepSelection = (e: React.MouseEvent) => {
    e.preventDefault()
    saveSelection()
  }

  /** 在当前光标处插入 HTML（图片段落等块级内容） */
  const insertHtml = (html: string) => {
    restoreSelection()
    document.execCommand('insertHTML', false, html)
    sync()
  }

  const insertLink = () => {
    const url = window.prompt('输入链接地址（例如 https://example.com）')
    if (!url) return
    restoreSelection()
    document.execCommand('createLink', false, url)
    sync()
  }

  // 按地址引用图片：外链、站内路径，或已上传到 Storage 的公开链接
  const insertImageByUrl = () => {
    const url = window.prompt('输入图片地址（https://… 或 /avatar.png 这样的站内路径）')
    if (!url) return
    const alt = window.prompt('图片描述（可留空，用于无障碍与图片加载失败时的提示）') ?? ''
    insertHtml(
      `<p class="post-img"><img src="${escapeAttr(url.trim())}" alt="${escapeAttr(alt.trim())}"></p>`
    )
  }

  /** 点「图片」按钮：唤起系统文件选择框（光标位置已由 keepSelection 存好） */
  const pickLocalImage = () => {
    fileRef.current?.click()
  }

  /** 上传选中的图片并插入到光标处（每张图单独成一个块级段落） */
  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // FileList 是实时集合，先转成数组再清空 value
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // 清空，保证同一个文件能被再次选择
    if (!files.length || !onUploadImage) return

    setUploading(true)
    try {
      const urls: string[] = []
      for (const file of files) urls.push(await onUploadImage(file))

      // 包在段落里 + CSS 里 img 设 display:block：图片天然独占一行，上下留白由 .post-img 提供。
      // 拼接时不要加换行符 —— .rte-body 是 white-space: pre-wrap，换行会被渲染成空行。
      insertHtml(
        urls
          .map(
            (url, i) =>
              `<p class="post-img"><img src="${escapeAttr(url)}" alt="${escapeAttr(files[i].name)}"></p>`
          )
          .join('')
      )
    } catch (err) {
      alert(`图片上传失败：${(err as Error).message}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rte">
      <div className="rte-toolbar">
        {COMMANDS.map((c) => (
          <button
            key={c.label}
            type="button"
            title={c.title}
            // 关键：阻止按钮抢走焦点，否则浏览器会丢失编辑器里的选区，命令作用不到选中文本
            onMouseDown={keepSelection}
            onClick={() => exec(c.cmd, c.arg)}
          >
            {c.label}
          </button>
        ))}
        <button type="button" title="插入链接" onMouseDown={keepSelection} onClick={insertLink}>
          链接
        </button>
        {onUploadImage && (
          <button
            type="button"
            title="插入图片（从本地上传，插入到当前光标位置）"
            disabled={uploading}
            onMouseDown={keepSelection}
            onClick={pickLocalImage}
          >
            {uploading ? '上传中…' : '图片'}
          </button>
        )}
        <button
          type="button"
          title="按图片地址插入（外链或已上传的图片链接）"
          onMouseDown={keepSelection}
          onClick={insertImageByUrl}
        >
          图片URL
        </button>
      </div>

      <div
        ref={bodyRef}
        className="rte-body"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="正文"
        data-placeholder={placeholder ?? '正文'}
        onInput={sync}
        onBlur={sync}
      />

      {/*
        文件选择框放在编辑器外面，避免被 contentEditable 当成正文内容。
        支持多选：会按选择顺序逐张上传，各占一行插入。
      */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleFiles}
      />
    </div>
  )
}
