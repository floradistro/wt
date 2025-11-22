// Jest setup file to mock React Native globals

// Mock global timers - avoids the TypeScript error in React Native's jest setup
global.clearTimeout = (id) => clearTimeout(id)
global.setTimeout = (fn, ms) => setTimeout(fn, ms)
global.clearInterval = (id) => clearInterval(id)
global.setInterval = (fn, ms) => setInterval(fn, ms)
