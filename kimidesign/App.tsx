import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import FluidBackground from './components/FluidBackground'
import Navigation from './components/Navigation'
import HeroField from './sections/HeroField'
import PhilosophyCarousel from './sections/PhilosophyCarousel'
import ImmersiveGallery from './sections/ImmersiveGallery'
import MediumsGlossary from './sections/MediumsGlossary'
import Footer from './sections/Footer'
import ProjectDetail from './pages/ProjectDetail'
import { getProjectById } from './config'
import Topbar from './sections/Topbar'
import StatsSection from './sections/StatsSection'
import LiveDataSection from './sections/LiveDataSection'
import HearingsSection from './sections/HearingsSection'
import CourtsSection from './sections/CourtsSection'
import AnalyticsSection from './sections/AnalyticsSection'
import CalendarSection from './sections/CalendarSection'
import UpdatesSection from './sections/UpdatesSection'
import TeamSection from './sections/TeamSection'
import ContactSection from './sections/ContactSection'
import DeveloperCredit from './sections/DeveloperCredit'
import { useSupabaseData } from './hooks/useSupabase'

gsap.registerPlugin(ScrollTrigger)

function App() {
  const [fluidActive, setFluidActive] = useState(true)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const lenisRef = useRef<Lenis | null>(null)
  const savedScrollRef = useRef(0)
  const pendingScrollRef = useRef<number | null>(null)
  const selectedProject = selectedProjectId ? getProjectById(selectedProjectId) : null
  const { allRows, updates, loading } = useSupabaseData()

  const handleSelectProject = (id: string) => {
    savedScrollRef.current = window.scrollY
    pendingScrollRef.current = 0
    setSelectedProjectId(id)
  }

  const handleBack = () => {
    pendingScrollRef.current = savedScrollRef.current
    setSelectedProjectId(null)
  }

  useLayoutEffect(() => {
    if (pendingScrollRef.current === null) return
    const target = pendingScrollRef.current
    pendingScrollRef.current = null
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        lenisRef.current?.resize()
        lenisRef.current?.scrollTo(target, { immediate: true, force: true })
      })
    })
  }, [selectedProjectId])

  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.05 })
    lenisRef.current = lenis
    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add((time) => { lenis.raf(time * 1000) })
    gsap.ticker.lagSmoothing(0)
    return () => { lenis.destroy() }
  }, [])

  useEffect(() => {
    if (selectedProject) return
    const heroEl = document.getElementById('hero-section')
    const philEl = document.getElementById('philosophy')
    const galleryEl = document.getElementById('gallery')
    if (!heroEl || !philEl || !galleryEl) return

    const visibility = { hero: true, phil: false, gallery: false }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target === heroEl) visibility.hero = entry.isIntersecting
          if (entry.target === philEl) visibility.phil = entry.isIntersecting
          if (entry.target === galleryEl) visibility.gallery = entry.isIntersecting
        })
        setFluidActive(visibility.hero || visibility.phil || visibility.gallery)
      },
      { threshold: 0.05 }
    )
    observer.observe(heroEl)
    observer.observe(philEl)
    observer.observe(galleryEl)
    return () => observer.disconnect()
  }, [selectedProject])

  if (selectedProject) {
    return (
      <div style={{ position: 'relative' }}>
        <FluidBackground isActive={true} />
        <ProjectDetail project={selectedProject} onBack={handleBack} />
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <FluidBackground isActive={fluidActive} />
      <Topbar />
      <Navigation />

      <div id="hero-section" style={{ position: 'relative', zIndex: 1 }}>
        <HeroField />
      </div>

      <div id="philosophy" style={{ position: 'relative', zIndex: 2 }}>
        <PhilosophyCarousel />
      </div>

      <div id="gallery" style={{ position: 'relative', zIndex: 3 }}>
        <ImmersiveGallery onSelect={handleSelectProject} />
      </div>

      <div style={{ position: 'relative', zIndex: 50, background: '#050A0F' }}>
        <StatsSection allRows={allRows} />

        <div id="live-data">
          <LiveDataSection allRows={allRows} loading={loading} />
        </div>

        <div id="hearings">
          <HearingsSection allRows={allRows} />
        </div>

        <div id="courts">
          <CourtsSection allRows={allRows} />
        </div>

        <div id="analytics">
          <AnalyticsSection allRows={allRows} />
        </div>

        <div id="calendar">
          <CalendarSection allRows={allRows} />
        </div>

        <div id="updates">
          <UpdatesSection updates={updates} loading={loading} />
        </div>

        <div id="team">
          <TeamSection />
        </div>

        <div id="mediums">
          <MediumsGlossary />
        </div>

        <div id="contact">
          <ContactSection />
        </div>

        <div id="footer">
          <Footer />
        </div>

        <DeveloperCredit />
      </div>
    </div>
  )
}

export default App
