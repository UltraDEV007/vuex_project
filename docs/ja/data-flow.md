# Data Flow

Let's build a simple counter app with Vuex to get a better understanding of the data flow inside Vuex apps. Note this is a trivial example solely for the purpose of explaining the concepts - in practice you don't need Vuex for such simple tasks.

### Setup

``` js
// store.js
import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)
```

### Define App State

``` js
const state = {
  count: 0
}
```

### Define Possible State Mutations

``` js
const mutations = {
  INCREMENT (state) {
    state.count++
  },
  DECREMENT (state) {
    state.count--
  }
}
```

### Define Callable Actions

``` js
const actions = {
  increment: 'INCREMENT',
  decrement: 'DECREMENT'
}
```

### Create a Vuex Store

``` js
export default new Vuex.Store({
  state,
  mutations,
  actions
})
```

### Use It in a Vue Component

**Template**

``` html
<div>
  Clicked: {{ count }} times
  <button v-on:click="increment">+</button>
  <button v-on:click="decrement">-</button>
</div>
```

**Script**

``` js
import store from './store.js'

export default {
  computed: {
    // bind to state using computed properties
    count () {
      return store.state.count
    }
  },
  methods: {
    increment: store.actions.increment,
    decrement: store.actions.decrement
  }
}
```

Here you will notice the component itself is extremely simple: it simply displays some state from the Vuex store (not even owning its own data), and calls some store actions on user input events.

You will also notice the data flow is unidirectional, as it should be in Flux:

<p align="center">
  <img width="700px" src="vuex.png">
</p>
