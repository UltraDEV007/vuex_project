import { STORAGE_KEY } from './index'

export default [{
  after: function (mutation, { todos }) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
  }
}]
