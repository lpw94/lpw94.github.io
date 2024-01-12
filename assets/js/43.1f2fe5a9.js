(window.webpackJsonp=window.webpackJsonp||[]).push([[43],{368:function(n,e,a){"use strict";a.r(e);var t=a(0),s=Object(t.a)({},(function(){var n=this._self._c;return n("ContentSlotsDistributor",{attrs:{"slot-key":this.$parent.slotKey}},[n("h1",{attrs:{id:"javascript响应式原理"}},[n("a",{staticClass:"header-anchor",attrs:{href:"#javascript响应式原理"}},[this._v("#")]),this._v(" JavaScript响应式原理")]),this._v(" "),n("div",{staticClass:"language- extra-class"},[n("pre",{pre:!0,attrs:{class:"language-text"}},[n("code",[this._v("class Observer {\n  constructor() {\n    this.subscribers = [];\n  }\n\n  // 注册观察者\n  subscribe(callback) {\n    this.subscribers.push(callback);\n  }\n\n  // 通知观察者更新\n  notify(data) {\n    this.subscribers.forEach(callback => {\n      callback(data);\n    });\n  }\n}\n\n// 定义可观察对象\nclass Observable {\n  constructor() {\n    this.observers = new Observer();\n  }\n\n  // 添加观察者\n  addObserver(callback) {\n    this.observers.subscribe(callback);\n  }\n\n  // 通知观察者更新\n  notifyObservers(data) {\n    this.observers.notify(data);\n  }\n}\n\n// 定义响应式对象\nclass ReactiveObject {\n  constructor(data) {\n    this.data = data;\n    this.observe(this.data);\n  }\n\n  // 监听数据，实现响应式\n\n  observe(data) {\n    if (!data || typeof data !== 'object') {\n      return;\n    }\n\n    Object.keys(data).forEach(key => {\n      let val = data[key];\n\n      // 递归监听子对象\n      this.observe(val);\n\n      // 为每个属性定义getter和setter\n      Object.defineProperty(data, key, {\n        enumerable: true,\n        configurable: true,\n        get: function() {\n          console.log(`访问属性：${key}，值为：${val}`);\n          return val;\n        },\n        set: function(newVal) {\n          console.log(`设置属性：${key}，新值为：${newVal}`);\n          if (val === newVal)\n            return;\n          val = newVal;\n          // 通知观察者更新\n          this.notifyObservers();\n        }\n      });\n    });\n  }\n}\n\n// 使用示例\nconst data = {\n  name: 'John',\n  age: 25\n};\n\nconst reactiveObj = new ReactiveObject(data);\n\nreactiveObj.addObserver(() => {\n  console.log('观察者1被通知更新');\n});\n\nreactiveObj.addObserver(() => {\n  console.log('观察者2被通知更新');\n});\n\nreactiveObj.data.name = 'Alice';\n")])])])])}),[],!1,null,null,null);e.default=s.exports}}]);