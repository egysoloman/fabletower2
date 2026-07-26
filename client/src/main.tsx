import { render } from 'preact'
import '@fontsource/orbitron/500.css'
import '@fontsource/orbitron/700.css'
import '@fontsource/orbitron/900.css'
import '@fontsource/share-tech-mono/400.css'
import './styles.css'
import { App } from './app'

render(<App />, document.getElementById('app')!)

// --- PWA: service worker + install prompt + offline indicator ---------------
import { installPrompt, netOnline } from './settings'

if ('serviceWorker' in navigator && !location.port.startsWith('517')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {})
  })
}
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  installPrompt.value = e as never
})
window.addEventListener('online', () => (netOnline.value = true))
window.addEventListener('offline', () => (netOnline.value = false))
