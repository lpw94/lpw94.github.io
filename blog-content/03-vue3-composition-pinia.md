从 Options API 切到组合式 API（Composition API），很多人第一反应是「写法变复杂了」。但真正用起来会发现，它解决的是 Options API 最致命的两个问题：**逻辑被拆散在各个选项里、跨组件复用只能靠 mixin**。这篇文章用一个「用户列表 + 搜索 + 收藏」的小场景，把 `ref`/`computed`/`watch`、组合式函数（composables）和 Pinia 串起来讲。

## 一、setup 与响应式基础

组合式 API 的核心是把「相关的逻辑」写在一起，而不是按 `data` / `methods` / `computed` 切开。

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const keyword = ref('')
const users = ref<{ id: number; name: string }[]>([])

// computed 有缓存：只有 users/keyword 变化时才重算
const filtered = computed(() =>
  users.value.filter((u) => u.name.includes(keyword.value))
)

// watch 处理副作用：这里用来做日志/请求
watch(keyword, (next, prev) => {
  console.log(`搜索词从「${prev}」变为「${next}」`)
})

async function load() {
  users.value = await fetch('/api/users').then((r) => r.json())
}
load()
</script>

<template>
  <input v-model="keyword" placeholder="搜索用户" />
  <ul>
    <li v-for="u in filtered" :key="u.id">{{ u.name }}</li>
  </ul>
</template>
```

几个要点：

- `ref` 用于**基本类型和需要整体替换的对象**，模板里自动解包，脚本里要 `.value`；
- `reactive` 适合**深层对象**，但整体替换会丢响应性，所以组合式 API 里我更推荐统一用 `ref`；
- `computed` 是**派生状态**，不要在里面做副作用；
- `watch` 是**副作用**，别用它来做纯派生计算 —— 那是 `computed` 的活。

## 二、组合式函数：真正解决复用问题

Options API 里复用逻辑要靠 mixin，来源不清晰、命名还容易冲突。组合式 API 直接**把一条逻辑写成一个函数**，返回它暴露的状态：

```ts
// composables/useFetch.ts
import { ref, watch, type Ref } from 'vue'

export function useFetch<T>(url: Ref<string> | string) {
  const data = ref<T | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const run = async () => {
    loading.value = true
    error.value = null
    try {
      const target = typeof url === 'string' ? url : url.value
      data.value = await fetch(target).then((r) => r.json())
    } catch (e) {
      error.value = e as Error
    } finally {
      loading.value = false
    }
  }

  if (typeof url !== 'string') watch(url, run)
  run()

  return { data, loading, error, refresh: run }
}
```

组件里一行接入，来源清晰、无命名冲突：

```ts
const { data: users, loading } = useFetch<User[]>('/api/users')
```

**约定**：组合式函数名以 `use` 开头；返回 `ref` 而不是 `reactive`，便于解构。

## 三、Pinia：状态管理

跨组件共享的状态（登录用户、主题、购物车）交给 Pinia。它没有 mutation，`state` / `getters` / `actions` 更贴近直觉。

```ts
// stores/user.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  const profile = ref<{ name: string; email: string } | null>(null)
  const favorites = ref<number[]>([])

  const isLoggedIn = computed(() => profile.value !== null)

  async function login(email: string, password: string) {
    profile.value = await api.login(email, password)
  }

  function toggleFavorite(id: number) {
    const i = favorites.value.indexOf(id)
    i > -1 ? favorites.value.splice(i, 1) : favorites.value.push(id)
  }

  function logout() {
    profile.value = null
    favorites.value = []
  }

  return { profile, favorites, isLoggedIn, login, toggleFavorite, logout }
})
```

组件里直接用，Pinia 会自动追踪依赖、按需更新：

```vue
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'

const user = useUserStore()
// 解构时用 storeToRefs 保持响应性（直接解构会丢）
const { profile, isLoggedIn } = storeToRefs(user)
</script>

<template>
  <span v-if="isLoggedIn">{{ profile?.email }}</span>
  <button @click="user.logout()">退出</button>
</template>
```

**要点**：`setup` 语法写 store 时，`state` 用 `ref`、`getters` 用 `computed`、`actions` 用普通函数；从 store 解构必须用 `storeToRefs`，否则响应性会丢失。

持久化（刷新后保留登录态）用插件即可：

```ts
// main.ts
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
```

然后在 store 里加 `{ persist: true }`。

## 四、和 React Hooks 的心智差异

| 维度 | Vue 组合式 API | React Hooks |
| --- | --- | --- |
| 更新模型 | 细粒度响应式，依赖自动收集 | 状态变更触发组件重渲染 |
| 依赖声明 | `computed`/`watch` 自动追踪 | 手写依赖数组，易漏写 |
| 闭包陷阱 | 基本没有（`ref` 是稳定对象） | `useEffect` 闭包易过期，需依赖补齐 |
| 复用方式 | composables 函数 | 自定义 Hook |
| 状态管理 | Pinia | Redux / Zustand / Jotai |

最直观的感受：**Vue 不需要你手写依赖数组**，`computed` 用到谁就自动依赖谁；而 React 的 `useEffect`/`useCallback` 依赖写漏了就会出诡异 bug。相对地，React 的「一次渲染 = 一份快照」模型在调试时更容易推理。

## 小结

组合式 API 的收益不在语法本身，而在**组织方式**：逻辑按「关注点」聚拢，复用靠普通函数，状态管理交给 Pinia。掌握三个关键词就够了 —— **`ref` 管状态、`computed` 管派生、`watch` 管副作用**，加上 `storeToRefs` 避免解构丢响应性。把这套用顺了，中大型 Vue 项目的可维护性会明显好过 Options API + mixin 的年代。
