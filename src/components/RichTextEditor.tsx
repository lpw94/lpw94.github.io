import { useEffect, useRef } from 'react'

type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
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
export default function RichTextEditor({ value, onChange, placeholder }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null)

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

  const insertLink = () => {
    const url = window.prompt('输入链接地址（例如 https://example.com）')
    if (!url) return
    bodyRef.current?.focus()
    document.execCommand('createLink', false, url)
    sync()
  }

  // 插入图片：按 src 引用地址，可以是外链，也可以是站内路径或 Storage 里封面图的公开链接
  const insertImage = () => {
    const url = window.prompt('输入图片地址（https://… 或 /avatar.png 这样的站内路径）')
    if (!url) return
    const alt = window.prompt('图片描述（可留空，用于无障碍与图片加载失败时的提示）') ?? ''
    bodyRef.current?.focus()
    document.execCommand(
      'insertHTML',
      false,
      `<img src="${escapeAttr(url.trim())}" alt="${escapeAttr(alt.trim())}">`
    )
    sync()
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
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(c.cmd, c.arg)}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          title="插入链接"
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertLink}
        >
          链接
        </button>
        <button
          type="button"
          title="插入图片（按地址引用）"
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertImage}
        >
          图片
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
    </div>
  )
}
