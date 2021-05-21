
作为一名资深vue菜鸟玩家，最近由于跳槽转换了react技术栈，突然换了玩具，还有点不太适应，总有身在曹营心在汉的感觉，所以就开始了一些列的娱乐封装  


## 现成的api我不用，哎，就是玩
细数一下vue的常用api都有哪些：
- beforeCreate
- created
- mounted
- unmounted
- watch
- computed  
ok，就先针对这几个常用的play一下;

那么为了完成上述的实现也得摸清楚react有没有现成能用的，毕竟剩下的时间还可以写更多bug。
第一个能对应上的就是componentDidMount，其次是componentWillUnmount，最后就是半天没搞明白的componentDidUpdate,好了剩下的就瞎搞吧，映射表如下：

```javascript
const API = {
  beforeCreate: 'constructor',
  mounted: 'componentDidMount',
  unmounted: 'componentWillUnmount',
  beforeUpdate: 'shouldComponentUpdate',
  watch: 'componentDidUpdate',
  didCatch: 'componentDidCatch',
};
```


## 开胃菜
先写几个用得着的小函数,毕竟闲着也是闲着

```javascript
function $defineProperty(target, key, descriptor) {
  return Object.defineProperty(target, key, descriptor);
}

function getKeys(target) {
  return Object.keys(target);
}

function type(obj, type) {
  return Object.prototype.toString.call(obj).slice(8, -1).toLocaleLowerCase() === type;
}

['String', 'Object', 'Function', 'Array'].forEach((key) => {
  type['is' + key] = function(target) {
    return type(target, key.toLocaleLowerCase());
  };
});
```

## 喝点茶
首先先回顾一下vue的生命周期和mixin内的各种执行规则；
- beforeCreate(父) -> created(父) -> beforeMount(父) -> beforeCreate(子) -> created(子) -> beforeMount(子) -> mounted(子) -> mounted(父)
- data执行组件先于mixin
- 生命周期执行mixin先于组件
- 若组件和mixin的methods重名，则取组件的methods

嗯，还行，还没忘干净，接下来就开始顺序执行吧(可能会略有出入)


## 上硬菜

- 初始化data  
> 这个好说直接判断data是函数还是对象，赋值给组件的this.state，记住vue的data如果是函数会有一个当前实例的vm传入
```javascript
function initData(data, vm) {
  vm.state = {
    ...(type.isFunction(data) ? data.call(vm, vm) : data),
    ...vm.state,
  };
}
```
- 初始化computed  
> 为了省事没做vue那一套依赖收集，就直接拦截吧，主要是get和set的操作，he! tui！
```javascript
function initComputed(computeOption = {}, descriptors) {
  const keys = getKeys(computeOption);
  const config = {
    configurable: true,
    enumerable: true,
  };
  keys.forEach((key) => {
    const item = computeOption[key];
    if (descriptors.hasOwnProperty(key)) {
      console.warn('[defineComponent Warning]  The instance already owns the property：' + key);
      return;
    }

    if (type.isFunction(item)) {
      $defineProperty(descriptors, key, { get: item, ...config });
    } else if (type.isObject(item)) {
      const { get, set } = computeOption[key];
      $defineProperty(descriptors, key, { get, set, ...config });
    }
  });
  return descriptors;
}
```
- 初始化methods  
> 这个就更简单了，把methods对象的东西直接放到react 类组件中即可

```javascript
function initMethods(from = {}, to) {
  Object.keys(from).forEach((key) => {
    if (to[key]) {
      return;
    }
    const method = function() {
      return from[key].apply(to, arguments);
    };
    to[key] = method.bind(to);
  });
}
```
- 初始化生命周期
> 就按照前边我们的映射表一一对应的挂到react中，需要特别注意的是watch和考虑mixin的处理, 所以生命周期我们也遵循vue的内部原理用数组排队，tui tui真费劲
```javascript
function initLifecycle(from, to) {
  const lifecycle = to.lifecycle;
  Object.keys(from).forEach((key) => {
    const queue = lifecycle[API[key]] = (lifecycle[API[key]] || []);
    const watchFn = function() {
      initWatch.apply(to, [from[key], to, ...arguments]);
    };
    queue.push(key === 'watch' ? watchFn : from[key]);
    to[API[key]] = function(...res) {
      queue.forEach((item) => item.apply(to, [...res]));
    };
  });
}
```

- 初始化init
> 把上边实现的聚合在一起，方便一块调用（懒逼）
```javascript
function init(option, vm) {
  const { data = {}, methods = {}, computed, mixins, ...lifecycle } = option;

  initData(data, vm);
  initComputed(computed, vm);

  initMethods(methods, vm);
  initLifecycle(lifecycle, vm);
  initMixin(mixins, vm);
}
```

- 接下来实现mixin
> 个人感觉vue的mixin真的很实用，在一些场景下，mixin给我们提供了更多的聚合能力，当然万物都有缺点，但是我选择忽略，vue就是好
> 理解起来也很简单，把mixin里的按照上边顺序循环注入

```javascript
function initMixin(mixins = [], vm) {
  if (!mixins.length) return;
  mixins.forEach((mixin) => {
    init(mixin, vm);
  });
}
```

## 吃完结账

本身应用就是react，所以上边的一切乱操刀都是为了这个玩意服务，所以该认怂的时候就得认

```javascript

import React from 'react';
export default function defineComponent(option) {
  const { props, render } = option;

  class Super extends React.Component {
    constructor(prop) {
      super(prop);
      this.lifecycle = {};
      init(option, this);
    }

    render = render || function() {
      return null;
    }
  }

  props && (Super.defaultProps = props);

  return Super;
}

```

## 对账
来实操下，看看代码能不能跑起来(主要是展示咋用)

```javascript
const mixin = {
  data() {
    return {
      a: 'mixin',
      age: 30
    }
  },
  mounted() {
    console.log('mixin-componentDidMount')
  },

}

export default defineComponent({
  mixins: [mixin],
  data() {
    return {
      name: '奥特之光',
      age: 18,
      profession: '滴滴BUG工程师'
    }
  },

  computed: {
    info() {
      const {name, age} = this.state;
      return name.concat('-', age)
    },
    todo: {
      get() {
        return '写bug'
      },
      set() {
        this.setState(Object.assign(this.state, {
          he: 'tui'
        }))
      }
    }
  },

  watch: {
    he:'say',

    tui(newVal, oldVal) {
      this.say();
    },

    pei: [
      this.say
    ]
  }, 

  methods: {
    say() {
      console.log(this.info)
    }
  },

  mounted() {
    console.log('componentDidMount')
  },

  beforeCreate() {
    console.log('constructor')
  },

  unmounted() {
    console.log('componentWillUnmount')
  },

  render() {
    return (
      <div>啥也不是系列</div>
    )
  }
})
```

## 最后
菜鸟手写，有不恰当的处理请指(轻)教(喷)，欢迎一起讨论！谢(讨)谢(好)！
