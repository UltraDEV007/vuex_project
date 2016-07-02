import devtoolPlugin from './plugins/devtool'
import strictPlugin from './plugins/strict'
import applyMixin from './mixin'

let Vue // bind on install

class Store {
  constructor (options = {}) {
    if (!Vue) {
      throw new Error(
        '[vuex] must call Vue.use(Vuex) before creating a store instance.'
      )
    }

    if (typeof Promise === 'undefined') {
      throw new Error(
        '[vuex] vuex requires a Promise polyfill in this browser.'
      )
    }

    const {
      state = {},
      modules = {},
      plugins = [],
      getters = {},
      strict = false
    } = options

    // store internal state
    this._options = options
    this._dispatching = false
    this._events = Object.create(null)
    this._actions = Object.create(null)
    this._mutations = Object.create(null)
    this._subscribers = []

    // bind dispatch and call to self
    this.call = bind(this.call, this)
    this.dispatch = bind(this.dispatch, this)

    // use a Vue instance to store the state tree
    // suppress warnings just in case the user has added
    // some funky global mixins
    const silent = Vue.config.silent
    Vue.config.silent = true
    this._vm = new Vue({ data: { state }})
    Vue.config.silent = silent

    // apply root module
    this.module([], options)

    // apply plugins
    plugins = plugins.concat(
      strict
        ? [devtoolPlugin, strictPlugin]
        : [devtoolPlugin]
    )
    plugins.forEach(plugin => plugin(this))
  }

  get state () {
    return this._vm.state
  }

  set state (v) {
    throw new Error('[vuex] Use store.replaceState() to explicit replace store state.')
  }

  replaceState (state) {
    this._dispatching = true
    this._vm.state = state
    this._dispatching = false
  }

  module (path, module, hot) {
    if (typeof path === 'string') path = [path]
    if (!Array.isArray(path)) {
      throw new Error('[vuex] module path must be a string or an Array.')
    }

    const isRoot = !path.length
    const {
      state,
      actions,
      mutations,
      modules
    } = module

    // set state
    if (!isRoot && !hot) {
      const parentState = get(this.state, path.slice(-1))
      const moduleName = path[path.length - 1]
      Vue.set(parentState, moduleName, state || {})
    }

    if (mutations) {
      Object.keys(mutations).forEach(key => {
        this.mutation(key, mutations[key], path)
      })
    }

    if (actions) {
      Object.keys(actions).forEach(key => {
        this.action(key, actions[key], path)
      })
    }

    if (modules) {
      Object.keys(modules).forEach(key => {
        this.module(path.concat(key), modules[key], hot)
      })
    }
  }

  mutation (type, handler, path = []) {
    const entry = this._mutations[type] || (this._mutations[type] = [])
    entry.push(payload => {
      handler(getNestedState(this.state, path), payload)
    })
   },

  action (type, handler, path = []) {
    const entry = this._actions[type] || (this._actions[type] = [])
    entry.push((payload, cb) => {
      let res = handler({
        call: this.call,
        dispatch: this.dispatch,
        state: getNestedState(this.state, path)
      }, payload, cb)
      if (!isPromise(res)) {
        res = Promise.resolve(res)
      }
      return res.catch(err => {
        console.warn(`[vuex] error in Promise returned from action ${type}`)
        console.warn(err)
      })
    })
  }

  dispatch (type, payload) {
    const entry = this._mutations[type]
    if (!entry) {
      console.warn(`[vuex] unknown mutation type: ${type}`)
      return
    }
    // check object-style dispatch
    let mutation
    if (isObject(type)) {
      payload = mutation = type
    } else {
      mutation = { type, payload }
    }
    this._dispatching = true
    entry.forEach(handler => handler(payload))
    this._dispatching = false
    this._subscribers.forEach(sub => sub(mutation, state))
  }

  call (type, payload, cb) {
    const entry = this._actions[type]
    if (!entry) {
      console.warn(`[vuex] unknown action type: ${type}`)
      return
    }
    if (typeof payload === 'function') {
      cb = payload
      payload = undefined
    }
    return entry.length > 1
      ? Promise.all(entry.map(handler => handler(payload)))
      : entry[0](payload)
  }

  subscribe (fn) {
    const subs = this._subscribers
    if (subs.indexOf(fn) < 0) {
      subs.push(fn)
    }
    return () => {
      let i = subs.indexOf(fn)
      if (i > -1) {
        subs.splice(i, 1)
      }
    }
  }

  update (newOptions) {
    this._actions = Object.create(null)
    this._mutations = Object.create(null)
    const options = this._options
    if (newOptions.actions) {
      options.actions = newOptions.actions
    }
    if (newOptions.mutations) {
      options.mutations = newOptions.mutations
    }
    if (newOptions.modules) {
      for (const key in newOptions.modules) {
        options.modules[key] = newOptions.modules[key]
      }
    }
    this.module([], options, true)
  }
}

function bind (fn, ctx) {
  return () => fn.apply(ctx, arguments)
}

function isObject (obj) {
  return obj !== null && typeof obj === 'object'
}

function isPromise (val) {
  return val && typeof val.then === 'function'
}

function getNestedState (state, path) {
  return path.reduce((state, key) => state[key], state)
}

function install (_Vue) {
  if (Vue) {
    console.warn(
      '[vuex] already installed. Vue.use(Vuex) should be called only once.'
    )
    return
  }
  Vue = _Vue
  applyMixin(Vue)
}

// auto install in dist mode
if (typeof window !== 'undefined' && window.Vue) {
  install(window.Vue)
}

export default {
  Store,
  install
}
