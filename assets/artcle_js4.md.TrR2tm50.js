import{_ as n,c as s,o as a,U as p}from"./chunks/framework.F-SyL-18.js";const h=JSON.parse('{"title":"闭包函数","description":"","frontmatter":{},"headers":[],"relativePath":"artcle/js4.md","filePath":"artcle/js4.md"}'),e={name:"artcle/js4.md"},l=p(`<h1 id="闭包函数" tabindex="-1">闭包函数 <a class="header-anchor" href="#闭包函数" aria-label="Permalink to &quot;闭包函数&quot;">​</a></h1><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span>/**</span></span>
<span class="line"><span> * 闭包函数示例</span></span>
<span class="line"><span> * @param {number} num - 输入的数字</span></span>
<span class="line"><span> * @returns {function} - 返回一个闭包函数</span></span>
<span class="line"><span> */</span></span>
<span class="line"><span>function closureFunction(num) {</span></span>
<span class="line"><span>  /**</span></span>
<span class="line"><span>   * 闭包函数</span></span>
<span class="line"><span>   * @param {number} x - 输入的数字</span></span>
<span class="line"><span>   * @returns {number} - 返回输入的数字与闭包函数外部变量num的和</span></span>
<span class="line"><span>   */</span></span>
<span class="line"><span>  return function(x) {</span></span>
<span class="line"><span>    return num + x;</span></span>
<span class="line"><span>  };</span></span>
<span class="line"><span>}</span></span>
<span class="line"><span></span></span>
<span class="line"><span>// 示例调用</span></span>
<span class="line"><span>const closure = closureFunction(5);</span></span>
<span class="line"><span>console.log(closure(10)); // 输出 15</span></span>
<span class="line"><span>console.log(closure(-5)); // 输出 0</span></span></code></pre></div><p>以上代码实现了一个闭包函数，函数名称为closureFunction。该函数接受一个参数num，并返回一个闭包函数。</p><p>闭包函数是一个匿名函数，它在内部访问了外部函数closureFunction的局部变量num。闭包函数接受一个参数x，并返回num + x的值。通过闭包，我们可以保留closureFunction的局部变量，使其在闭包函数被调用时仍然有效。</p><p>示例调用展示了如何使用闭包函数。首先，我们使用closureFunction传入参数5初始化了一个闭包函数，然后通过该闭包函数分别计算了10和-5与5的和，得到了15和0的结果。</p>`,5),c=[l];function t(o,i,r,u,_,d){return a(),s("div",null,c)}const f=n(e,[["render",t]]);export{h as __pageData,f as default};
