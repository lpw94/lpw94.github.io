// aplayer 1.10.x 不自带 TypeScript 类型（package.json 里没有 types 字段），
// 这里只声明本项目实际用到的部分，够用即可。
declare module 'aplayer' {
  export type APlayerAudio = {
    name?: string
    artist?: string
    url: string
    cover?: string
    lrc?: string
  }

  export type APlayerOptions = {
    container: HTMLElement
    audio: APlayerAudio[]
    /** 右下角固定悬浮（可拖拽） */
    fixed?: boolean
    /** 折叠成小圆球，点一下展开 */
    mini?: boolean
    autoplay?: boolean
    theme?: string
    loop?: 'all' | 'one' | 'none'
    order?: 'list' | 'random'
    preload?: 'none' | 'metadata' | 'auto'
    volume?: number
    muted?: boolean
    listFolded?: boolean
    listMaxHeight?: string
    lrcType?: 0 | 1 | 2 | 3
    /** 用来在 localStorage 里记住音量 / 播放位置等 */
    storageName?: string
    mutex?: boolean
  }

  export default class APlayer {
    constructor(options: APlayerOptions)
    /** 底层 <audio>，用于挂 error 等原生事件 */
    audio: HTMLAudioElement
    list: { index: number; audios: APlayerAudio[] }
    play(): void
    pause(): void
    toggle(): void
    skipForward(): void
    skipBack(): void
    destroy(): void
    on(event: string, handler: (...args: unknown[]) => void): void
  }
}
