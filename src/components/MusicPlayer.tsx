import { useEffect, useRef, useState } from 'react'

type Track = {
  title: string
  artist: string
  src: string
}

// ── 播放列表 ─────────────────────────────────────────────
// 想换成自己的歌：直接改这个数组。
// src 可以是任何可公开访问的音频 URL（mp3 / ogg / m4a），
// 也可以把文件放到 public/music/ 下，用 '/music/xxx.mp3' 相对路径引用。
//
// 当前内置两批免费可商用音乐（2026-09 验证直链全部 200）：
//  · Kevin MacLeod（incompetech.com）：CC-BY 4.0，使用时保留作者署名即可；
//  · SoundHelix：专门生成的免费测试电子乐，无版权顾虑。
const KM = 'https://incompetech.com/music/royalty-free/mp3-royaltyfree'
const SH = 'https://www.soundhelix.com/examples/mp3'

const TRACKS: Track[] = [
  // —— Kevin MacLeod：旋律系（欢快 / 俏皮 / 爵士 / 氛围）——
  { title: '悠然 Carefree', artist: 'Kevin MacLeod · CC-BY', src: `${KM}/Carefree.mp3` },
  { title: '猴子转陀螺 Monkeys Spinning Monkeys', artist: 'Kevin MacLeod · 滑稽', src: `${KM}/Monkeys%20Spinning%20Monkeys.mp3` },
  { title: '给小鸭子梳毛 Fluffing a Duck', artist: 'Kevin MacLeod · 俏皮', src: `${KM}/Fluffing%20a%20Duck.mp3` },
  { title: '鬼鬼祟祟 Sneaky Snitch', artist: 'Kevin MacLeod · 悬疑俏皮', src: `${KM}/Sneaky%20Snitch.mp3` },
  { title: '像素波尔卡 Pixel Peeker Polka', artist: 'Kevin MacLeod · 波尔卡', src: `${KM}/Pixel%20Peeker%20Polka%20-%20faster.mp3` },
  { title: '大堂时光 Lobby Time', artist: 'Kevin MacLeod · 爵士', src: `${KM}/Lobby%20Time.mp3` },
  { title: '每日甲虫 Daily Beetle', artist: 'Kevin MacLeod · 轻快', src: `${KM}/Daily%20Beetle.mp3` },
  { title: '墙纸 Wallpaper', artist: 'Kevin MacLeod · 氛围', src: `${KM}/Wallpaper.mp3` },
  { title: '快乐男孩 Happy Boy Theme', artist: 'Kevin MacLeod · 欢快', src: `${KM}/Happy%20Boy%20Theme.mp3` },

  // —— SoundHelix：电子氛围系（适合当背景）——
  { title: '星尘电子 01', artist: 'SoundHelix · 电子氛围', src: `${SH}/SoundHelix-Song-1.mp3` },
  { title: '星尘电子 02', artist: 'SoundHelix · 电子氛围', src: `${SH}/SoundHelix-Song-2.mp3` },
  { title: '星尘电子 03', artist: 'SoundHelix · 电子氛围', src: `${SH}/SoundHelix-Song-3.mp3` },
  { title: '星尘电子 04', artist: 'SoundHelix · 电子氛围', src: `${SH}/SoundHelix-Song-4.mp3` },
  { title: '星尘电子 05', artist: 'SoundHelix · 电子氛围', src: `${SH}/SoundHelix-Song-5.mp3` },
  { title: '星尘电子 06', artist: 'SoundHelix · 电子氛围', src: `${SH}/SoundHelix-Song-6.mp3` },
  { title: '星尘电子 07', artist: 'SoundHelix · 电子氛围', src: `${SH}/SoundHelix-Song-7.mp3` },
  { title: '星尘电子 08', artist: 'SoundHelix · 电子氛围', src: `${SH}/SoundHelix-Song-8.mp3` },
  { title: '星尘电子 09', artist: 'SoundHelix · 电子氛围', src: `${SH}/SoundHelix-Song-9.mp3` },
  { title: '星尘电子 10', artist: 'SoundHelix · 电子氛围', src: `${SH}/SoundHelix-Song-10.mp3` },
]

const fmt = (sec: number) => {
  if (!Number.isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * 全局悬浮音乐播放器：挂在 Layout，SPA 翻页组件不卸载，音乐不会断。
 * 折叠是一个右下圆钮，点击展开玻璃面板（封面 / 进度 / 控制 / 音量 / 列表）。
 * 浏览器禁止无声自动播放，所以默认不自动播，需用户点一下。
 */
export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  const [expanded, setExpanded] = useState(
    () => localStorage.getItem('mp_expanded') === '1'
  )
  const [playing, setPlaying] = useState(false)
  const [trackIdx, setTrackIdx] = useState(() => {
    const n = Number(localStorage.getItem('mp_track') || '0')
    return Number.isInteger(n) && n >= 0 && n < TRACKS.length ? n : 0
  })
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(() => {
    const v = Number(localStorage.getItem('mp_volume') || '0.7')
    return v >= 0 && v <= 1 ? v : 0.7
  })
  const [error, setError] = useState('')

  const track = TRACKS[trackIdx]

  // 初始化 audio 单例 + 事件绑定（只建一次，跨页面存活）
  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audioRef.current = audio

    const onTime = () => setCurrent(audio.currentTime)
    const onMeta = () => setDuration(audio.duration)
    const onEnded = () => {
      // 列表循环：播完自动下一首
      setTrackIdx((i) => (i + 1) % TRACKS.length)
    }
    const onError = () => {
      setPlaying(false)
      setError('音频加载失败，可换下一首试试')
    }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.pause()
      audioRef.current = null
    }
  }, [])

  // 切歌：换 src 并复位进度；若之前在播则自动续播
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    localStorage.setItem('mp_track', String(trackIdx))
    setError('')
    setCurrent(0)
    setDuration(0)
    audio.src = track.src
    if (playing) {
      audio.play().catch(() => setPlaying(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackIdx])

  // 音量同步 + 持久化
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
    localStorage.setItem('mp_volume', String(volume))
  }, [volume])

  // 展开状态持久化
  useEffect(() => {
    localStorage.setItem('mp_expanded', expanded ? '1' : '0')
  }, [expanded])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      // 首次播放前还没设 src（切歌 effect 已设过，这里兜底）
      if (!audio.src) audio.src = track.src
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false)) // 浏览器拦截时不报错，仅保持暂停态
    }
  }

  const switchTrack = (i: number) => setTrackIdx(((i % TRACKS.length) + TRACKS.length) % TRACKS.length)

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    const bar = barRef.current
    if (!audio || !bar || !duration) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * duration
    setCurrent(audio.currentTime)
  }

  const pct = duration ? (current / duration) * 100 : 0

  return (
    <div className="music-player">
      {expanded && (
        <div className="mp-panel" role="region" aria-label="音乐播放器">
          <div className="mp-head">
            <div className={`mp-cover${playing ? ' spin' : ''}`} aria-hidden="true">
              🎵
            </div>
            <div className="mp-info">
              <div className="mp-title" title={track.title}>{track.title}</div>
              <div className="mp-artist muted">{track.artist}</div>
            </div>
            <button
              type="button"
              className="mp-collapse"
              onClick={() => setExpanded(false)}
              aria-label="收起播放器"
            >
              ▾
            </button>
          </div>

          <div
            className="mp-progress"
            ref={barRef}
            onClick={seek}
            role="slider"
            aria-label="播放进度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
          >
            <div className="mp-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="mp-times muted">
            <span>{fmt(current)}</span>
            <span>{fmt(duration)}</span>
          </div>

          {error && <p className="mp-error">{error}</p>}

          <div className="mp-controls">
            <button type="button" onClick={() => switchTrack(trackIdx - 1)} aria-label="上一首">
              ⏮
            </button>
            <button
              type="button"
              className="mp-play"
              onClick={togglePlay}
              aria-label={playing ? '暂停' : '播放'}
            >
              {playing ? '⏸' : '▶'}
            </button>
            <button type="button" onClick={() => switchTrack(trackIdx + 1)} aria-label="下一首">
              ⏭
            </button>
          </div>

          <div className="mp-volume">
            <span aria-hidden="true">{volume === 0 ? '🔇' : '🔊'}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              aria-label="音量"
            />
          </div>

          <ul className="mp-list">
            {TRACKS.map((t, i) => (
              <li key={t.src}>
                <button
                  type="button"
                  className={i === trackIdx ? 'active' : ''}
                  onClick={() => switchTrack(i)}
                >
                  <span className="mp-list-title">{t.title}</span>
                  <span className="muted">{i === trackIdx && playing ? '播放中' : t.artist}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        className={`mp-fab${playing ? ' playing' : ''}`}
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? '收起音乐播放器' : '打开音乐播放器'}
        aria-expanded={expanded}
        title="音乐播放器"
      >
        <span aria-hidden="true">{playing ? '🎶' : '🎵'}</span>
      </button>
    </div>
  )
}
