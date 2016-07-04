import devtoolPlugin from './plugins/devtool'
import applyMixin from './mixin'
import { mapGetters, mapActions } from './helpers'

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
      strict = false
    } = options

    // store internal state
    this._options = options
    this._committing = false
    this._actions = Object.create(null)
    this._mutations = Object.create(null)
    this._subscribers = []

    // bind commit and dispatch to self
    const store = this
    const { dispatch, commit } = this
    this.dispatch = function boundDispatch (type, payload) {
      return dispatch.call(store, type, payload)
    }
    this.commit = function boundCommit (type, payload) {
      return commit.call(store, type, payload)
    }

    // init state and getters
    const getters = extractModuleGetters(options.getters, modules)
    initStoreState(this, state, getters)

    // apply root module
    this.module([], options)

    // strict mode
    if (strict) enableStrictMode(this)

    // apply plugins
    plugins.concat(devtoolPlugin).forEach(plugin => plugin(this))
  }

  get state () {
    return this._vm.state
  }

  set state (v) {
    throw new Error('[vuex] Use store.replaceState() to explicit replace store state.')
  }

  replaceState (state) {
    this._committing = true
    this._vm.state = state
    this._committing = false
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
      const parentState = getNestedState(this.state, path.slice(0, -1))
      if (!parentState) debugger
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
    const store = this
    entry.push(function wrappedMutationHandler (payload) {
      handler(getNestedState(store.state, path), payload)
    })
  }

  action (type, handler, path = []) {
    const entry = this._actions[type] || (this._actions[type] = [])
    const store = this
    const { dispatch, commit } = this
    entry.push(function wrappedActionHandler (payload, cb) {
      let res = handler({
        dispatch,
        commit,
        state: getNestedState(store.state, path)
      }, payload, cb)
      if (!isPromise(res)) {
        res = Promise.resolve(res)
      }
      return res.catch(err => {
        console.error(`[vuex] error in Promise returned from action "${type}":`)
        console.error(err)
      })
    })
  }

  commit (type, payload) {
    // check object-style commit
    let mutation
    if (isObject(type) && type.type) {
      payload = mutation = type
      type = type.type
    } else {
      mutation = { type, payload }
    }
    const entry = this._mutations[type]
    if (!entry) {
      console.error(`[vuex] unknown mutation type: ${type}`)
      return
    }
    this._committing = true
    entry.forEach(function commitIterator (handler) {
      handler(payload)
    })
    this._committing = false
    if (!payload || !payload.silent) {
      this._subscribers.forEach(sub => sub(mutation, this.state))
    }
  }

  dispatch (type, payload) {
    const entry = this._actions[type]
    if (!entry) {
      debugger
      console.error(`[vuex] unknown action type: ${type}`)
      return
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
      const i = subs.indexOf(fn)
      if (i > -1) {
        subs.splice(i, 1)
      }
    }
  }

  hotUpdate (newOptions) {
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

    // update getters
    const getters = extractModuleGetters(newOptions.getters, newOptions.modules)
    if (Object.keys(getters).length) {
      const oldVm = this._vm
      initStoreState(this, this.state, getters)
      if (this.strict) {
        enableStrictMode(this)
      }
      // dispatch changes in all subscribed watchers
      // to force getter re-evaluation.
      this._committing = true
      oldVm.state = null
      this._committing = false
      Vue.nextTick(() => oldVm.$destroy())
    }
  }
}

function initStoreState (store, state, getters) {
  // bind getters
  store.getters = {}
  const computed = {}
  Object.keys(getters).forEach(key => {
    const fn = getters[key]
    // use computed to leverage its lazy-caching mechanism
    computed[key] = () => fn(store._vm.state)
    Object.defineProperty(store.getters, key, {
      get: () => store._vm[key]
    })
  })

  // use a Vue instance to store the state tree
  // suppress warnings just in case the user has added
  // some funky global mixins
  const silent = Vue.config.silent
  Vue.config.silent = true
  store._vm = new Vue({
    data: { state },
    computed
  })
  Vue.config.silent = silent
}

function extractModuleGetters (getters = {}, modules = {}, path = []) {
  if (!modules) return getters
  Object.keys(modules).forEach(key => {
    const module = modules[key]
    if (module.getters) {
      Object.keys(module.getters).forEach(getterKey => {
        const rawGetter = module.getters[getterKey]
        if (getters[getterKey]) {
          console.error(`[vuex] duplicate getter key: ${getterKey}`)
          return
        }
        getters[getterKey] = function wrappedGetter (state) {
          return rawGetter(getNestedState(state, path))
        }
      })
    }
    extractModuleGetters(getters, module.modules, path.concat(key))
  })
  return getters
}

function enableStrictMode (store) {
  store._vm.$watch('state', () => {
    if (!store._committing) {
      throw new Error(
        '[vuex] Do not mutate vuex store state outside mutation handlers.'
      )
    }
  }, { deep: true, sync: true })
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
    console.error(
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
  install,
  mapGetters,
  mapActions
}
