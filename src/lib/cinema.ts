// 放映厅片单。想换片：只改这个数组，页面与样式都不用动。
//
// source 支持两种写法：
//   { type: 'mp4',    src: 'https://.../xxx.mp4' }      → 用原生 <video> 播放
//                       也可以把文件丢进 public/videos/，写 '/videos/xxx.mp4'
//   { type: 'iframe', src: 'https://player.bilibili.com/player.html?bvid=BVxxxx' }
//                                                       → 用外站播放器（B 站 / YouTube）
//
// colors 是没有封面图时海报的渐变起止色；想用真封面就填 poster（图片 URL）。
export type FilmSource =
  | { type: 'mp4'; src: string }
  | { type: 'iframe'; src: string }

export type Film = {
  id: string
  title: string
  /** 副标题 / 外文原名 */
  subtitle?: string
  category: string
  year?: string
  /** 海报右下角的小角标，可写时长（'9:56'）或类型（'预告 0:52'、'素材样片'） */
  badge: string
  desc: string
  tags: string[]
  colors: [string, string]
  /** 封面图，缺省时用 colors 渐变 */
  poster?: string
  /** 版权与出处，直接显示在影片信息里 */
  credit: string
  source: FilmSource
}

// 当前片源都是开放授权、可直接外链播放的短片（媒体文件托管在 media.w3.org、
// 以及 MDN / video.js 的公开示例 CDN 上），不涉及商业片版权，换片时注意同样规则。
export const FILMS: Film[] = [
  {
    id: 'big-buck-bunny',
    title: 'Big Buck Bunny',
    subtitle: '大雄兔',
    category: '动画短片',
    year: '2008',
    badge: '9:56',
    desc:
      '一只块头很大、性子很软的兔子，被三只小飞鼠一再来找麻烦，最后决定还手。Blender 基金会「Open Movie」计划的第二部作品，从建模、绑定到渲染全流程都用开源软件完成，也成了此后十几年里最常被拿来测试播放性能的片子。',
    tags: ['3D 动画', '喜剧', '开源电影'],
    colors: ['#f59e0b', '#b91c1c'],
    credit: 'Blender Foundation · CC BY 3.0',
    source: { type: 'mp4', src: 'https://media.w3.org/2010/05/bunny/movie.mp4' },
  },
  {
    id: 'sintel',
    title: 'Sintel',
    subtitle: '辛特尔',
    category: '动画短片',
    year: '2010',
    badge: '预告 0:52',
    desc:
      '独自旅行的女孩辛特尔救下一只幼龙，取名 Scales；幼龙被掳走后，她翻过雪山与荒原去找它。这是全片的预告，画面质感与配乐是这部作品最常被提起的部分。',
    tags: ['3D 动画', '奇幻', '开源电影'],
    colors: ['#0ea5e9', '#1e3a8a'],
    credit: 'Blender Foundation · CC BY 3.0',
    source: { type: 'mp4', src: 'https://media.w3.org/2010/05/sintel/trailer.mp4' },
  },
  {
    id: 'oceans',
    title: 'Oceans',
    subtitle: '海洋',
    category: '纪录样片',
    badge: '示范短片',
    desc:
      '一段水下海洋的空镜素材，节奏很慢，光从水面斜射下来。原本是 video.js 播放器长期使用的演示片，因为画面干净、码率适中，常被当作检验视频链路是否正常的参照。',
    tags: ['自然', '空镜', '演示素材'],
    colors: ['#0891b2', '#0f172a'],
    credit: 'video.js 公开演示素材',
    source: { type: 'mp4', src: 'https://vjs.zencdn.net/v/oceans.mp4' },
  },
  {
    id: 'flower',
    title: 'Flower',
    subtitle: '花',
    category: '实拍素材',
    badge: '素材样片',
    desc:
      '一段几秒钟的微距实拍，镜头缓慢推近花蕊。来自 MDN 的 CC0 示例视频，常被用来演示 <video> 标签的最小可用写法——没有配乐，也没有叙事，就是一段单纯的画面。',
    tags: ['微距', 'CC0', '教学示例'],
    colors: ['#db2777', '#7c3aed'],
    credit: 'MDN 示例素材 · CC0',
    source: {
      type: 'mp4',
      src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    },
  },
  {
    id: 'friday',
    title: 'Friday',
    subtitle: '周五',
    category: '实拍素材',
    badge: '素材样片',
    desc:
      '同样出自 MDN 的 CC0 素材，人物实拍、室内自然光，画面里有轻微的手持晃动。用来验证播放器在真人肤色与复杂光线下的色彩还原是否正常。',
    tags: ['人像', 'CC0', '教学示例'],
    colors: ['#475569', '#0f172a'],
    credit: 'MDN 示例素材 · CC0',
    source: {
      type: 'mp4',
      src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4',
    },
  },
  {
    id: 'a-movie',
    title: 'A Movie',
    subtitle: 'W3C 示范片',
    category: '技术示范',
    badge: '示范短片',
    desc:
      'W3C 用于 HTML5 视频规范的示范片段，画面本身没什么情节，它的意义在于当年为「浏览器能不能原生播视频」这件事提供了一个人人可引用的样本。',
    tags: ['规范示范', '历史', '测试素材'],
    colors: ['#6366f1', '#111827'],
    credit: 'W3C 公开示范素材',
    source: { type: 'mp4', src: 'https://media.w3.org/2010/05/video/movie_300.mp4' },
  },
]
