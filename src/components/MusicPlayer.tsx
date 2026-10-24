import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import APlayer from 'aplayer'
import 'aplayer/dist/APlayer.min.css'
import { clearCache, loadPlaylist, type Song } from '../lib/meting'

type Phase = 'loading' | 'ready' | 'error'

/**
 * 全局轻量悬浮音乐播放器（APlayer + 网易云歌单）。
 *
 * 为什么用 createPortal 挂 body：
 *   APlayer 的悬浮模式靠 `position: fixed`，只要祖先元素有 transform / filter /
 *   backdrop-filter，fixed 就会退化成相对该祖先定位。站点的 .container 就带
 *   backdrop-filter，所以必须把播放器直接挂到 body 下。
 *
 * 为什么加载完才创建 APlayer：
 *   公共 Meting 接口返回的直链有相当比例是 404（版权 / VIP），先探测过滤再交给
 *   播放器，才能保证「点了就有声」。探测结果会缓存 6 小时，刷新不再重复探测。
 */
export default function MusicPlayer() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [songs, setSongs] = useState<Song[]>([])
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [errMsg, setErrMsg] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  // ① 拉歌单 + 探测可播性
  useEffect(() => {
    let cancelled = false
    setPhase('loading')
    setErrMsg('')
    setProgress({ done: 0, total: 0 })

    loadPlaylist((done, total) => {
      if (!cancelled) setProgress({ done, total })
    })
      .then((res) => {
        if (cancelled) return
        setSongs(res.songs)
        setPhase('ready')
      })
      .catch((e: Error) => {
        if (cancelled) return
        setErrMsg(e?.message || '歌单加载失败')
        setPhase('error')
      })

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  // ② 有歌了再初始化 APlayer（fixed + mini = 右下角小悬浮球，点开是完整播放器）
  useEffect(() => {
    const host = hostRef.current
    if (!songs.length || !host) return

    const ap = new APlayer({
      container: host,
      audio: songs.map((s) => ({
        name: s.name,
        artist: s.artist,
        url: s.url,
        cover: s.cover,
        lrc: s.lrc,
      })),
      fixed: true,
      mini: true,
      autoplay: false, // 浏览器禁止无声自动播放，等用户点
      theme: '#2563eb',
      loop: 'all',
      order: 'list',
      preload: 'metadata',
      volume: 0.5,
      listFolded: true,
      listMaxHeight: '240px',
      lrcType: 0,
      mutex: true,
      storageName: 'blog-music',
    })

    // 兜底：个别链接在探测之后才失效（签名过期），播放报错就自动跳下一首。
    // 只在真正播放时跳——预加载元数据失败不该静默切歌；连续失败 8 次就停手。
    let fails = 0
    const onError = () => {
      if (ap.audio.paused) return
      fails += 1
      if (fails < 8) ap.skipForward()
    }
    const onPlaying = () => {
      fails = 0
    }
    ap.audio.addEventListener('error', onError)
    ap.audio.addEventListener('playing', onPlaying)

    // 折叠态就是一个封面小方块，补两句提示，免得看不出怎么用
    host.querySelector('.aplayer-pic')?.setAttribute('title', '点击播放 / 暂停')
    host.querySelector('.aplayer-miniswitcher')?.setAttribute('title', '展开播放器')

    return () => {
      ap.audio.removeEventListener('error', onError)
      ap.audio.removeEventListener('playing', onPlaying)
      ap.destroy()
      host.innerHTML = ''
    }
  }, [songs])

  const retry = () => {
    clearCache()
    setSongs([])
    setReloadToken((n) => n + 1)
  }

  return createPortal(
    <>
      {/* APlayer 的挂载点：fixed 定位由它自己的 CSS 负责 */}
      <div ref={hostRef} className="mp-host" />

      {/* 准备中 / 失败时的占位胶囊，就位后让位给 APlayer */}
      {phase === 'loading' && (
        <div className="mp-boot" role="status" aria-live="polite">
          <span className="mp-boot-dot" aria-hidden="true" />
          <span>
            {progress.total > 0
              ? `正在准备歌单 ${progress.done}/${progress.total}`
              : '正在拉取歌单…'}
          </span>
        </div>
      )}

      {phase === 'error' && (
        <button type="button" className="mp-boot mp-boot-error" onClick={retry}>
          <span aria-hidden="true">🎵</span>
          <span>{errMsg}，点此重试</span>
        </button>
      )}
    </>,
    document.body
  )
}
