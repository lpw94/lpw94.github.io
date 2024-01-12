import{_ as s,c as a,o as n,U as p}from"./chunks/framework.F-SyL-18.js";const u=JSON.parse('{"title":"JavaScript对象继承","description":"","frontmatter":{},"headers":[],"relativePath":"artcle/js2.md","filePath":"artcle/js2.md"}'),e={name:"artcle/js2.md"},l=p(`<h1 id="javascript对象继承" tabindex="-1">JavaScript对象继承 <a class="header-anchor" href="#javascript对象继承" aria-label="Permalink to &quot;JavaScript对象继承&quot;">​</a></h1><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span>class Animal {</span></span>
<span class="line"><span>  constructor(name) {</span></span>
<span class="line"><span>    this.name = name;</span></span>
<span class="line"><span>  }</span></span>
<span class="line"><span>  </span></span>
<span class="line"><span>  // 父类方法</span></span>
<span class="line"><span>  speak() {</span></span>
<span class="line"><span>    console.log(\`\${this.name} makes a noise.\`);</span></span>
<span class="line"><span>  }</span></span>
<span class="line"><span>}</span></span>
<span class="line"><span></span></span>
<span class="line"><span>// 子类</span></span>
<span class="line"><span>class Dog extends Animal {</span></span>
<span class="line"><span>  constructor(name, breed) {</span></span>
<span class="line"><span>    super(name);</span></span>
<span class="line"><span>    this.breed = breed;</span></span>
<span class="line"><span>  }</span></span>
<span class="line"><span>  </span></span>
<span class="line"><span>  // 子类方法</span></span>
<span class="line"><span>  speak() {</span></span>
<span class="line"><span>    console.log(\`\${this.name} barks.\`);</span></span>
<span class="line"><span>  }</span></span>
<span class="line"><span>}</span></span>
<span class="line"><span></span></span>
<span class="line"><span>// 创建对象</span></span>
<span class="line"><span>const animal = new Animal(&#39;Animal&#39;);</span></span>
<span class="line"><span>const dog = new Dog(&#39;Dog&#39;, &#39;German Shepherd&#39;);</span></span>
<span class="line"><span></span></span>
<span class="line"><span>animal.speak();  // Output: Animal makes a noise.</span></span>
<span class="line"><span>dog.speak();  // Output: Dog barks.</span></span></code></pre></div><p>以上代码实现了JavaScript对象继承的功能。</p><p>首先定义了一个父类Animal，构造函数中接收一个name参数，并将其赋值给实例的name属性。类中还包含一个speak方法，用于输出动物的叫声。 然后定义了一个子类Dog，继承自Animal。子类的构造函数接收两个参数name和breed，其中name作为父类构造函数的参数传递，breed则是子类特有的属性。子类中重写了speak方法，用于输出狗的叫声。 最后，创建了一个父类对象animal和一个子类对象dog，分别调用它们的speak方法进行输出。</p><p>以上代码中使用了ES6的class语法来定义类，并使用了extends关键字来实现继承。父类的构造函数中使用super关键字来调用父类的构造函数。子类中重写了父类的方法，即实现了方法的覆盖。</p>`,5),i=[l];function c(t,o,r,m,d,_){return n(),a("div",null,i)}const g=s(e,[["render",c]]);export{u as __pageData,g as default};
