import { render } from 'preact'
import '@fontsource/orbitron/500.css'
import '@fontsource/orbitron/700.css'
import '@fontsource/orbitron/900.css'
import '@fontsource/share-tech-mono/400.css'
import './styles.css'
import { App } from './app'

render(<App />, document.getElementById('app')!)
