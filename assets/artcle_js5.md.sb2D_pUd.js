import{_ as s,c as n,o as a,U as p}from"./chunks/framework.F-SyL-18.js";const g=JSON.parse('{"title":"JavaScript对象属性","description":"","frontmatter":{},"headers":[],"relativePath":"artcle/js5.md","filePath":"artcle/js5.md"}'),e={name:"artcle/js5.md"},o=p(`<h1 id="javascript对象属性" tabindex="-1">JavaScript对象属性 <a class="header-anchor" href="#javascript对象属性" aria-label="Permalink to &quot;JavaScript对象属性&quot;">​</a></h1><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span>// 定义一个Person对象</span></span>
<span class="line"><span>function Person(name, age) {</span></span>
<span class="line"><span>  this.name = name; // 姓名属性</span></span>
<span class="line"><span>  this.age = age; // 年龄属性</span></span>
<span class="line"><span>}</span></span>
<span class="line"><span></span></span>
<span class="line"><span>// 创建两个Person对象实例</span></span>
<span class="line"><span>var person1 = new Person(&quot;Jack&quot;, 30);</span></span>
<span class="line"><span>var person2 = new Person(&quot;Amy&quot;, 25);</span></span>
<span class="line"><span></span></span>
<span class="line"><span>// 打印person1对象的属性</span></span>
<span class="line"><span>console.log(&quot;person1的属性：&quot;);</span></span>
<span class="line"><span>console.log(&quot;姓名：&quot; + person1.name);</span></span>
<span class="line"><span>console.log(&quot;年龄：&quot; + person1.age);</span></span>
<span class="line"><span></span></span>
<span class="line"><span>// 打印person2对象的属性</span></span>
<span class="line"><span>console.log(&quot;person2的属性：&quot;);</span></span>
<span class="line"><span>console.log(&quot;姓名：&quot; + person2.name);</span></span>
<span class="line"><span>console.log(&quot;年龄：&quot; + person2.age);</span></span></code></pre></div>`,2),t=[o];function l(c,i,r,u,_,d){return a(),n("div",null,t)}const m=s(e,[["render",l]]);export{g as __pageData,m as default};
