import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { siteConfig } from './config'

if (siteConfig.siteTitle) {
  document.title = siteConfig.siteTitle
}
if (siteConfig.language) {
  document.documentElement.lang = siteConfig.language
}
if (siteConfig.siteDescription) {
  let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'description'
    document.head.appendChild(meta)
  }
  meta.content = siteConfig.siteDescription
}

createRoot(document.getElementById('root')!).render(<App />)
