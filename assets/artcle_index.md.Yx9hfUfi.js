import{_ as s,c as n,o as a,U as p}from"./chunks/framework.F-SyL-18.js";const u=JSON.parse('{"title":"JavaScript响应式原理","description":"","frontmatter":{},"headers":[],"relativePath":"artcle/index.md","filePath":"artcle/index.md"}'),l={name:"artcle/index.md"},e=p(`<h1 id="javascript响应式原理" tabindex="-1">JavaScript响应式原理 <a class="header-anchor" href="#javascript响应式原理" aria-label="Permalink to &quot;JavaScript响应式原理&quot;">​</a></h1><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span>class Observer {</span></span>
<span class="line"><span>  constructor() {</span></span>
<span class="line"><span>    this.subscribers = [];</span></span>
<span class="line"><span>  }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>  // 注册观察者</span></span>
<span class="line"><span>  subscribe(callback) {</span></span>
<span class="line"><span>    this.subscribers.push(callback);</span></span>
<span class="line"><span>  }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>  // 通知观察者更新</span></span>
<span class="line"><span>  notify(data) {</span></span>
<span class="line"><span>    this.subscribers.forEach(callback =&gt; {</span></span>
<span class="line"><span>      callback(data);</span></span>
<span class="line"><span>    });</span></span>
<span class="line"><span>  }</span></span>
<span class="line"><span>}</span></span>
<span class="line"><span></span></span>
<span class="line"><span>// 定义可观察对象</span></span>
<span class="line"><span>class Observable {</span></span>
<span class="line"><span>  constructor() {</span></span>
<span class="line"><span>    this.observers = new Observer();</span></span>
<span class="line"><span>  }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>  // 添加观察者</span></span>
<span class="line"><span>  addObserver(callback) {</span></span>
<span class="line"><span>    this.observers.subscribe(callback);</span></span>
<span class="line"><span>  }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>  // 通知观察者更新</span></span>
<span class="line"><span>  notifyObservers(data) {</span></span>
<span class="line"><span>    this.observers.notify(data);</span></span>
<span class="line"><span>  }</span></span>
<span class="line"><span>}</span></span>
<span class="line"><span></span></span>
<span class="line"><span>// 定义响应式对象</span></span>
<span class="line"><span>class ReactiveObject {</span></span>
<span class="line"><span>  constructor(data) {</span></span>
<span class="line"><span>    this.data = data;</span></span>
<span class="line"><span>    this.observe(this.data);</span></span>
<span class="line"><span>  }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>  // 监听数据，实现响应式</span></span>
<span class="line"><span></span></span>
<span class="line"><span>  observe(data) {</span></span>
<span class="line"><span>    if (!data || typeof data !== &#39;object&#39;) {</span></span>
<span class="line"><span>      return;</span></span>
<span class="line"><span>    }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    Object.keys(data).forEach(key =&gt; {</span></span>
<span class="line"><span>      let val = data[key];</span></span>
<span class="line"><span></span></span>
<span class="line"><span>      // 递归监听子对象</span></span>
<span class="line"><span>      this.observe(val);</span></span>
<span class="line"><span></span></span>
<span class="line"><span>      // 为每个属性定义getter和setter</span></span>
<span class="line"><span>      Object.defineProperty(data, key, {</span></span>
<span class="line"><span>        enumerable: true,</span></span>
<span class="line"><span>        configurable: true,</span></span>
<span class="line"><span>        get: function() {</span></span>
<span class="line"><span>          console.log(\`访问属性：\${key}，值为：\${val}\`);</span></span>
<span class="line"><span>          return val;</span></span>
<span class="line"><span>        },</span></span>
<span class="line"><span>        set: function(newVal) {</span></span>
<span class="line"><span>          console.log(\`设置属性：\${key}，新值为：\${newVal}\`);</span></span>
<span class="line"><span>          if (val === newVal)</span></span>
<span class="line"><span>            return;</span></span>
<span class="line"><span>          val = newVal;</span></span>
<span class="line"><span>          // 通知观察者更新</span></span>
<span class="line"><span>          this.notifyObservers();</span></span>
<span class="line"><span>        }</span></span>
<span class="line"><span>      });</span></span>
<span class="line"><span>    });</span></span>
<span class="line"><span>  }</span></span>
<span class="line"><span>}</span></span>
<span class="line"><span></span></span>
<span class="line"><span>// 使用示例</span></span>
<span class="line"><span>const data = {</span></span>
<span class="line"><span>  name: &#39;John&#39;,</span></span>
<span class="line"><span>  age: 25</span></span>
<span class="line"><span>};</span></span>
<span class="line"><span></span></span>
<span class="line"><span>const reactiveObj = new ReactiveObject(data);</span></span>
<span class="line"><span></span></span>
<span class="line"><span>reactiveObj.addObserver(() =&gt; {</span></span>
<span class="line"><span>  console.log(&#39;观察者1被通知更新&#39;);</span></span>
<span class="line"><span>});</span></span>
<span class="line"><span></span></span>
<span class="line"><span>reactiveObj.addObserver(() =&gt; {</span></span>
<span class="line"><span>  console.log(&#39;观察者2被通知更新&#39;);</span></span>
<span class="line"><span>});</span></span>
<span class="line"><span></span></span>
<span class="line"><span>reactiveObj.data.name = &#39;Alice&#39;;</span></span></code></pre></div>`,2),c=[e];function i(t,r,o,d,b,v){return a(),n("div",null,c)}const _=s(l,[["render",i]]);export{u as __pageData,_ as default};
