## State

### Single State Tree

Vuex uses a **single state tree** - that is, this single object contains all your application level state and serves as the "single source of truth". This makes it straightforward to locate a specific piece of state, and allows us to easily take snapshots of the current app state for debugging purposes.

The single state tree does not conflict with modularity - in later chapters we will discuss how to split your state managing logic into sub modules.

### Reactive State

Similar to `data` objects passed to Vue instances, the `state` object, once passed into a Vuex instance, becomes reactive powered by [Vue's reactivity system](http://vuejs.org/guide/reactivity.html). This means binding Vuex state to Vue components is as simple as returning it from within a computed property:

``` js
// inside a Vue component module

// import a vuex instance
import vuex from './vuex'

export default {
  computed: {
    message () {
      return vuex.state.message
    }
  }
}
```

> Flux reference: this can be roughly compared to [`mapStateToProps`](https://github.com/rackt/react-redux/blob/master/docs/api.md#connectmapstatetoprops-mapdispatchtoprops-mergeprops-options) in Redux and [getters](https://optimizely.github.io/nuclear-js/docs/04-getters.html) in NuclearJS.

Why don't we just use `data` to bind to vuex state? Consider the following example:

``` js
export default {
  data () {
    return {
      message: vuex.state.message
    }
  }
}
```

Because the `data` function does not track any reactive dependencies, we are only getting a static reference to `vuex.state.message`. When the Vuex state is mutated later, the component has no idea that something has changed. In comparison, computed properties track all reactive dependencies when they are evaluated, so they reactively re-evaluate when the related vuex state mutates.

### State Can Only Be Mutated by Vuex Mutations

Using read-only computed properties has another benefit in that it helps emphasizing the rule that **components should never directly mutate Vuex state**. Because we want every state mutation to be explicit and trackable, all vuex state mutations must be conducted inside vuex mutation handlers.

So essentially, our Vue components now becomes very thin: they connect to Vuex state via read-only computed properties, and the only way for them to affect Vuex state is by calling **actions**, which in turn trigger **mutations**. They can still possess and operate on their local state if necessary, but we no longer put any data-fetching or global-state-mutating logic inside individual components.
