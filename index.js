/*
 * @FilePath     : /fe-esApp/src/common/js/defineComponent.js
 * @Author       : LiYang
 * @Date         : 2021-05-08 18:18:43
 * @LastEditTime : 2021-05-10 15:07:26
 * @LastEditors  : Please set LastEditors
 * @Description  :
 */
import React from 'react';

const API = {
  beforeCreate: 'constructor',
  mounted: 'componentDidMount',
  unmounted: 'componentWillUnmount',
  beforeUpdate: 'shouldComponentUpdate',
  watch: 'componentDidUpdate',
  didCatch: 'componentDidCatch',
};

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

function initComputed(computeOption = {}, descriptors) {
  const keys = getKeys(computeOption);
  const config = {
    configurable: true,
    enumerable: true,
  };
  keys.forEach((key) => {
    const item = computeOption[key];
    // eslint-disable-next-line no-prototype-builtins
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

function initLifecycle(from, to) {
  const lifecycle = to.lifecycle;
  Object.keys(from).forEach((key) => {
    // eslint-disable-next-line no-multi-assign
    const queue = lifecycle[API[key]] = (lifecycle[API[key]] || []);
    const watchFn = function() {
      // eslint-disable-next-line no-use-before-define
      initWatch.apply(to, [from[key], to, ...arguments]);
    };
    queue.push(key === 'watch' ? watchFn : from[key]);
    to[API[key]] = function(...res) {
      queue.forEach((item) => item.apply(to, [...res]));
    };
  });
}

function initData(data, vm) {
  vm.state = {
    ...(type.isFunction(data) ? data.call(vm, vm) : data),
    ...vm.state,
  };
}

function initMixin(mixins = [], vm) {
  // eslint-disable-next-line no-useless-return
  if (!mixins.length) return;
  mixins.forEach((mixin) => {
    // eslint-disable-next-line no-use-before-define
    init(mixin, vm);
  });
}

function initWatch(option, vm, prevProps, prevState) {
  Object.keys(option).forEach((key) => {
    const oldValue = prevProps[key] || prevState[key];
    const newValue = vm.props[key] || vm.state[key];
    let callbacks = [];

    if (Array.isArray(option[key])) {
      callbacks = callbacks.concat(option[key]);
    } else {
      callbacks.push(option[key]);
    }

    if (oldValue !== newValue) {
      callbacks.forEach((fun) => {
        let handle = function() {};
        if (type.isFunction(fun)) {
          handle = fun;
        }
        if (type.isString(fun) && type.isFunction(vm[fun])) {
          handle = vm[fun];
        }
        handle.apply(vm, [newValue, oldValue]);
      });
    }
  });
}

function init(option, vm) {
  const { data = {}, methods = {}, computed, mixins, ...lifecycle } = option;

  initData(data, vm);
  initComputed(computed, vm);

  initMethods(methods, vm);
  initLifecycle(lifecycle, vm);
  initMixin(mixins, vm);
}

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

  // eslint-disable-next-line no-unused-expressions
  props && (Super.defaultProps = props);

  return Super;
}
