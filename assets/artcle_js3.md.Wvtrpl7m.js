import{_ as s,c as n,o as a,U as p}from"./chunks/framework.F-SyL-18.js";const h=JSON.parse('{"title":"typescript中泛型的使用方式","description":"","frontmatter":{},"headers":[],"relativePath":"artcle/js3.md","filePath":"artcle/js3.md"}'),e={name:"artcle/js3.md"},l=p(`<h1 id="typescript中泛型的使用方式" tabindex="-1">typescript中泛型的使用方式 <a class="header-anchor" href="#typescript中泛型的使用方式" aria-label="Permalink to &quot;typescript中泛型的使用方式&quot;">​</a></h1><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span>/**</span></span>
<span class="line"><span> * 泛型类</span></span>
<span class="line"><span> */</span></span>
<span class="line"><span>class GenericClass&lt;T&gt; {</span></span>
<span class="line"><span>  private value: T;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>  constructor(value: T) {</span></span>
<span class="line"><span>    this.value = value;</span></span>
<span class="line"><span>  }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>  /**</span></span>
<span class="line"><span>   * 返回成员变量值</span></span>
<span class="line"><span>   */</span></span>
<span class="line"><span>  getValue(): T {</span></span>
<span class="line"><span>    return this.value;</span></span>
<span class="line"><span>  }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>  /**</span></span>
<span class="line"><span>   * 设置成员变量值</span></span>
<span class="line"><span>   */</span></span>
<span class="line"><span>  setValue(value: T): void {</span></span>
<span class="line"><span>    this.value = value;</span></span>
<span class="line"><span>  }</span></span>
<span class="line"><span>}</span></span>
<span class="line"><span></span></span>
<span class="line"><span>/**</span></span>
<span class="line"><span> * 泛型函数</span></span>
<span class="line"><span> */</span></span>
<span class="line"><span>function genericFunction&lt;T&gt;(value: T): T {</span></span>
<span class="line"><span>  return value;</span></span>
<span class="line"><span>}</span></span>
<span class="line"><span></span></span>
<span class="line"><span>// 使用泛型类</span></span>
<span class="line"><span>const genericObj = new GenericClass&lt;number&gt;(10);</span></span>
<span class="line"><span>console.log(genericObj.getValue()); // 输出：10</span></span>
<span class="line"><span></span></span>
<span class="line"><span>genericObj.setValue(20);</span></span>
<span class="line"><span>console.log(genericObj.getValue()); // 输出：20</span></span>
<span class="line"><span></span></span>
<span class="line"><span>// 使用泛型函数</span></span>
<span class="line"><span>const result = genericFunction&lt;string&gt;(&quot;Hello, World!&quot;);</span></span>
<span class="line"><span>console.log(result); // 输出：Hello, World!</span></span></code></pre></div><p>以上代码是基于用户需求提供的typescript泛型例子，包含了泛型类和泛型函数的示例。具体的代码实现如下：</p><p>泛型类(GenericClass): 这个类接受一个类型参数T作为成员变量的类型。类中有两个方法：getValue()用于返回成员变量的值，setValue(value: T)用于设置成员变量的值。 泛型函数(genericFunction): 这个函数也接受一个类型参数T作为参数类型和返回值类型。函数内部简单地将传入的参数返回。 代码中使用了泛型类来创建一个对象genericObj，并对其进行了测试。首先，将数字10传入泛型类的构造函数并保存在成员变量中，然后调用getValue()方法打印出成员变量的值。接着，调用setValue()方法将数字20设置为新的成员变量值，再次调用getValue()方法打印出最新的成员变量值。最后，使用泛型函数genericFunction传入字符串&quot;Hello, World!&quot;并将返回值打印出来。</p>`,4),c=[l];function t(i,o,r,u,g,d){return a(),n("div",null,c)}const v=s(e,[["render",t]]);export{h as __pageData,v as default};
