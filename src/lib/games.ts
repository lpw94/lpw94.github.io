import { supabase } from './supabase'

/** 小游戏注册表：侧边栏入口、弹窗标题、排行榜排序都从这里取 */
export type GameId = 'snake' | 'minesweeper' | 'g2048' | 'plane'

export type GameDef = {
  id: GameId
  name: string
  icon: string
  /** 排行榜里分数列的文案 */
  scoreLabel: string
  /** true = 分数越小越好（扫雷用时）；false = 越大越好 */
  asc: boolean
}

export const GAMES: GameDef[] = [
  { id: 'snake', name: '贪吃蛇', icon: '🐍', scoreLabel: '食物', asc: false },
  { id: 'minesweeper', name: '扫雷', icon: '💣', scoreLabel: '用时(秒)', asc: true },
  { id: 'g2048', name: '2048', icon: '🔢', scoreLabel: '分数', asc: false },
  { id: 'plane', name: '飞机大战', icon: '✈️', scoreLabel: '得分', asc: false },
]

export type ScoreRow = {
  id: number
  player: string
  score: number
  created_at: string
}

/** 拉取某游戏的 top N 排行榜；表不存在等异常返回 null（调用方降级显示） */
export async function fetchLeaderboard(game: GameId, asc: boolean, limit = 10): Promise<ScoreRow[] | null> {
  try {
    const { data, error } = await supabase
      .from('game_scores')
      .select('id,player,score,created_at')
      .eq('game', game)
      .order('score', { ascending: asc })
      .order('created_at', { ascending: true })
      .limit(limit)
    if (error) {
      console.warn('排行榜拉取失败（表可能还没建）：', error.message)
      return null
    }
    return (data ?? []) as ScoreRow[]
  } catch {
    return null
  }
}

/** 提交分数；昵称统一截断到 12 字符。返回是否成功 */
export async function submitScore(game: GameId, player: string, score: number): Promise<boolean> {
  const name = player.trim().slice(0, 12) || '匿名'
  try {
    const { error } = await supabase.from('game_scores').insert({ game, player: name, score })
    if (error) {
      console.warn('分数提交失败：', error.message)
      return false
    }
    return true
  } catch {
    return false
  }
}

/** 玩家昵称本地记忆 */
export const playerNameStore = {
  get: () => localStorage.getItem('game_player_name') || '',
  set: (n: string) => localStorage.setItem('game_player_name', n),
}
