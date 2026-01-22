import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useScroll, useTransform, useInView } from 'framer-motion'
import {
  Play, Zap, TrendingUp, Calendar, Battery, Users, FileText,
  Sparkles, DollarSign, Clock, Wand2, Globe, Award, BarChart3,
  Workflow, Rocket, ArrowRight, ChevronDown, Monitor, Smartphone,
  MessageCircle, Video, Search, Share2, Brain, Target, Star,
  CheckCircle, XCircle, Layers, RefreshCw
} from 'lucide-react'
import './App.css'

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 60 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }
  }
}

const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6 }
  }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 }
  }
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }
  }
}

const slideInLeft = {
  hidden: { opacity: 0, x: -100 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }
  }
}

const slideInRight = {
  hidden: { opacity: 0, x: 100 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }
  }
}

// Animated Counter Component
function AnimatedCounter({ value, suffix = '', prefix = '', duration = 2 }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  useEffect(() => {
    if (isInView) {
      let start = 0
      const end = parseFloat(value)
      const incrementTime = (duration * 1000) / end
      const timer = setInterval(() => {
        start += end / 50
        if (start >= end) {
          setCount(end)
          clearInterval(timer)
        } else {
          setCount(Math.floor(start * 100) / 100)
        }
      }, incrementTime)
      return () => clearInterval(timer)
    }
  }, [isInView, value, duration])

  return <span ref={ref}>{prefix}{count}{suffix}</span>
}

// Slide wrapper component
function Slide({ children, id, className = '' }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-20%" })

  return (
    <section
      ref={ref}
      id={id}
      className={`slide ${className}`}
    >
      <motion.div
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        variants={staggerContainer}
        className="container"
      >
        {children}
      </motion.div>
    </section>
  )
}

// Glass Card Component
function GlassCard({ children, className = '', delay = 0, hover = true }) {
  return (
    <motion.div
      variants={fadeInUp}
      className={`glass-card ${className}`}
      whileHover={hover ? { y: -8, transition: { duration: 0.3 } } : {}}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </motion.div>
  )
}

// Section Header Component
function SectionHeader({ eyebrow, title, subtitle, center = false }) {
  return (
    <div className={`section-header ${center ? 'text-center' : ''}`}>
      {eyebrow && (
        <motion.p variants={fadeInUp} className="section-eyebrow">
          {eyebrow}
        </motion.p>
      )}
      <motion.h2 variants={fadeInUp} className="section-title">
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p variants={fadeInUp} className="section-subtitle" style={center ? { margin: '0 auto' } : {}}>
          {subtitle}
        </motion.p>
      )}
    </div>
  )
}

// App Icon Visual
function AppIcon({ icon: Icon, color, delay = 0 }) {
  return (
    <motion.div
      className="app-icon"
      style={{
        background: `linear-gradient(135deg, ${color}40 0%, ${color}20 100%)`,
        border: `1px solid ${color}50`
      }}
      initial={{ opacity: 0, scale: 0, rotate: -180 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ delay: delay * 0.1, duration: 0.5, type: "spring" }}
      whileHover={{ scale: 1.1, rotate: 5 }}
    >
      <Icon size={28} color={color} />
    </motion.div>
  )
}

// Main App Component
function App() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const { scrollYProgress } = useScroll()
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])

  const slides = [
    'slide-1', 'slide-2', 'slide-3', 'slide-4', 'slide-5',
    'slide-6', 'slide-7', 'slide-8', 'slide-9', 'slide-10',
    'slide-11', 'slide-12', 'slide-13', 'slide-14', 'slide-15',
    'slide-16', 'slide-17', 'slide-18', 'slide-19', 'slide-20'
  ]

  const sections = [
    { name: 'The Why', slides: [0, 1, 2, 3] },
    { name: 'The Pain', slides: [4, 5, 6, 7] },
    { name: 'The Solution', slides: [8, 9, 10, 11] },
    { name: 'The Showcase', slides: [12, 13, 14, 15] },
    { name: 'Conclusion', slides: [16, 17, 18, 19] }
  ]

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight / 2
      slides.forEach((slideId, index) => {
        const element = document.getElementById(slideId)
        if (element) {
          const { offsetTop, offsetHeight } = element
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setCurrentSlide(index)
          }
        }
      })
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSlide = (index) => {
    const element = document.getElementById(slides[index])
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="presentation">
      {/* Background Elements */}
      <div className="gradient-bg" />
      <div className="gradient-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="orb orb-4" />
      </div>
      <div className="noise-overlay" />
      <div className="grid-pattern" />

      {/* Progress Bar */}
      <motion.div
        className="progress-bar"
        style={{ width: progressWidth }}
      />

      {/* Navigation */}
      <nav className="nav-dots">
        {slides.map((_, index) => (
          <motion.button
            key={index}
            className={`nav-dot ${currentSlide === index ? 'active' : ''}`}
            onClick={() => scrollToSlide(index)}
            whileHover={{ scale: 1.3 }}
            whileTap={{ scale: 0.9 }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          />
        ))}
      </nav>

      {/* Section Labels */}
      <div className="section-labels">
        {sections.map((section, index) => (
          <motion.div
            key={section.name}
            className={`section-label ${section.slides.includes(currentSlide) ? 'active' : ''}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <span className="section-number">0{index + 1}</span>
            <span className="section-name">{section.name}</span>
          </motion.div>
        ))}
      </div>

      {/* ==================== SECTION 1: THE WHY ==================== */}

      {/* Slide 1: Title */}
      <Slide id="slide-1" className="hero-slide">
        <div className="hero-content">
          <motion.div
            className="hero-badge"
            variants={scaleIn}
          >
            <Sparkles size={16} />
            <span>The Future of Content Creation</span>
          </motion.div>

          <motion.h1
            className="hero-title"
            variants={fadeInUp}
          >
            <span className="text-gradient">The Algorithmic</span>
            <br />
            <span className="hero-title-italic">Imperative</span>
          </motion.h1>

          <motion.p
            className="hero-subtitle"
            variants={fadeInUp}
          >
            Why AI avatars are no longer optional for creators,
            <br />entrepreneurs, and businesses in the digital age.
          </motion.p>

          <motion.div
            className="hero-cta"
            variants={fadeInUp}
          >
            <button className="btn-glass btn-primary">
              <Play size={20} />
              Begin Journey
            </button>
            <button className="btn-glass">
              Learn More
              <ArrowRight size={18} />
            </button>
          </motion.div>

          <motion.div
            className="scroll-indicator"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, repeat: Infinity, repeatType: "reverse", duration: 1.5 }}
          >
            <ChevronDown size={32} />
          </motion.div>
        </div>

        {/* Floating Elements */}
        <div className="hero-floats">
          <motion.div
            className="float-card float-1"
            animate={{ y: [-10, 10, -10], rotate: [-2, 2, -2] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Video size={24} />
            <span>Video Content</span>
          </motion.div>
          <motion.div
            className="float-card float-2"
            animate={{ y: [10, -10, 10], rotate: [2, -2, 2] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <Globe size={24} />
            <span>Global Reach</span>
          </motion.div>
          <motion.div
            className="float-card float-3"
            animate={{ y: [-5, 15, -5], rotate: [-1, 3, -1] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          >
            <Zap size={24} />
            <span>AI Powered</span>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 2: 6.84 Platforms */}
      <Slide id="slide-2">
        <div className="split-layout">
          <div className="split-content">
            <SectionHeader
              eyebrow="The Digital Landscape"
              title={<>The average user juggles <span className="text-gradient">6.84 platforms</span> daily</>}
              subtitle="Your audience is everywhere. But your presence can only be in so many places at once... or can it?"
            />

            <motion.div className="stat-highlight" variants={fadeInUp}>
              <div className="stat-value text-gradient">
                <AnimatedCounter value={6.84} suffix="" />
              </div>
              <div className="stat-label">Platforms Per User</div>
            </motion.div>
          </div>

          <motion.div className="split-visual" variants={slideInRight}>
            <div className="juggling-visual">
              {/* Central Figure */}
              <div className="juggler-figure">
                <div className="juggler-body">
                  <motion.div
                    className="juggler-head"
                    animate={{ rotate: [-5, 5, -5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <div className="juggler-torso" />
                </div>
              </div>

              {/* Orbiting Apps */}
              <div className="orbit-container">
                {[
                  { icon: Video, color: '#ff0050', name: 'TikTok' },
                  { icon: Monitor, color: '#ff0000', name: 'YouTube' },
                  { icon: Share2, color: '#E4405F', name: 'Instagram' },
                  { icon: MessageCircle, color: '#1DA1F2', name: 'Twitter' },
                  { icon: Users, color: '#0A66C2', name: 'LinkedIn' },
                  { icon: Smartphone, color: '#25D366', name: 'WhatsApp' },
                  { icon: Play, color: '#5865F2', name: 'Discord' },
                ].map((app, index) => (
                  <motion.div
                    key={app.name}
                    className="orbit-app"
                    style={{
                      '--orbit-delay': `${index * -2}s`,
                      '--orbit-duration': '14s'
                    }}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                  >
                    <div
                      className="app-bubble"
                      style={{
                        background: `linear-gradient(135deg, ${app.color}30 0%, ${app.color}10 100%)`,
                        borderColor: `${app.color}40`
                      }}
                    >
                      <app.icon size={24} color={app.color} />
                    </div>
                    <span className="app-name">{app.name}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 3: Video is King */}
      <Slide id="slide-3">
        <div className="centered-layout">
          <SectionHeader
            eyebrow="Market Reality"
            title={<><span className="hero-title-italic">Video</span> is King</>}
            subtitle="The video advertising market has exploded into a multi-billion dollar industry, and it's only accelerating."
            center
          />

          <motion.div className="market-visual" variants={scaleIn}>
            <div className="market-card glass-panel">
              <div className="market-crown">
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Award size={80} className="crown-icon" />
                </motion.div>
              </div>

              <div className="market-value">
                <span className="currency">$</span>
                <span className="amount text-gradient">
                  <AnimatedCounter value={140} suffix="" />
                </span>
                <span className="unit">B</span>
              </div>

              <div className="market-label">Video Ad Market</div>

              <div className="market-growth">
                <TrendingUp size={20} />
                <span>Growing 12% annually</span>
              </div>

              <div className="market-bars">
                {[2020, 2021, 2022, 2023, 2024, 2025].map((year, i) => (
                  <motion.div
                    key={year}
                    className="bar-item"
                    initial={{ height: 0 }}
                    whileInView={{ height: `${30 + i * 14}%` }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    viewport={{ once: true }}
                  >
                    <div className="bar" />
                    <span className="bar-year">{year}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 4: The Discovery Shift */}
      <Slide id="slide-4">
        <div className="split-layout reverse">
          <motion.div className="split-visual" variants={slideInLeft}>
            <div className="shift-visual">
              <div className="shift-comparison">
                <motion.div
                  className="shift-side search-side"
                  initial={{ x: 0 }}
                  whileInView={{ x: -20 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="shift-icon fading">
                    <Search size={48} />
                  </div>
                  <span className="shift-label">Traditional Search</span>
                  <div className="shift-arrow down">
                    <TrendingUp size={24} style={{ transform: 'rotate(180deg)' }} />
                  </div>
                </motion.div>

                <div className="shift-divider">
                  <motion.div
                    className="shift-vs"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    VS
                  </motion.div>
                </div>

                <motion.div
                  className="shift-side social-side"
                  initial={{ x: 0 }}
                  whileInView={{ x: 20 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="shift-icon glowing">
                    <Share2 size={48} />
                  </div>
                  <span className="shift-label">Social Discovery</span>
                  <div className="shift-arrow up">
                    <TrendingUp size={24} />
                  </div>
                </motion.div>
              </div>

              <div className="shift-stats">
                <div className="shift-stat">
                  <span className="stat-num">40%</span>
                  <span className="stat-desc">of Gen Z prefers TikTok over Google</span>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="split-content">
            <SectionHeader
              eyebrow="Paradigm Shift"
              title={<>The Discovery <span className="text-gradient">Revolution</span></>}
              subtitle="Social media has overtaken traditional search as the primary discovery engine for the next generation of consumers."
            />

            <motion.div className="insight-cards" variants={staggerContainer}>
              {[
                { icon: Video, title: 'Video-First', desc: 'Short-form video is the new homepage' },
                { icon: Users, title: 'Creator Trust', desc: 'People trust people, not brands' },
                { icon: Zap, title: 'Algorithm-Driven', desc: 'Content finds the audience, not vice versa' },
              ].map((item, i) => (
                <motion.div key={i} className="insight-card glass-card" variants={fadeInUp}>
                  <div className="insight-icon">
                    <item.icon size={24} />
                  </div>
                  <div className="insight-text">
                    <h4>{item.title}</h4>
                    <p>{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </Slide>

      {/* ==================== SECTION 2: THE PAIN ==================== */}

      {/* Slide 5: The Consistency Paradox */}
      <Slide id="slide-5">
        <div className="split-layout">
          <div className="split-content">
            <SectionHeader
              eyebrow="The Challenge"
              title={<>The Consistency <span className="hero-title-italic">Paradox</span></>}
              subtitle="The algorithm rewards consistency, but humans aren't machines. The pressure to post daily creates an impossible standard."
            />

            <motion.div className="paradox-quote" variants={fadeInUp}>
              <blockquote>
                "The algorithm demands consistency. Your humanity demands rest.
                <br />Something has to give."
              </blockquote>
            </motion.div>
          </div>

          <motion.div className="split-visual" variants={slideInRight}>
            <div className="calendar-visual">
              <div className="calendar-header">
                <span>Content Calendar</span>
                <span className="calendar-month">Every. Single. Day.</span>
              </div>
              <div className="calendar-grid">
                {Array.from({ length: 35 }, (_, i) => (
                  <motion.div
                    key={i}
                    className={`calendar-day ${i < 31 ? 'has-post' : 'empty'}`}
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.02 }}
                    viewport={{ once: true }}
                  >
                    {i < 31 && (
                      <>
                        <span className="day-number">{i + 1}</span>
                        <motion.span
                          className="post-badge"
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
                        >
                          POST
                        </motion.span>
                      </>
                    )}
                  </motion.div>
                ))}
              </div>
              <div className="calendar-footer">
                <div className="alert-badge">
                  <RefreshCw size={16} />
                  <span>Repeat Forever</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 6: 70% Burnout */}
      <Slide id="slide-6">
        <div className="centered-layout">
          <SectionHeader
            eyebrow="The Human Cost"
            title={<><span className="text-gradient">70%</span> of creators experience burnout</>}
            center
          />

          <motion.div className="burnout-visual" variants={scaleIn}>
            <div className="battery-container">
              <motion.div
                className="battery-icon"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className="battery-body">
                  <div className="battery-cap" />
                  <div className="battery-inner">
                    <motion.div
                      className="battery-level critical"
                      initial={{ width: '100%' }}
                      whileInView={{ width: '15%' }}
                      transition={{ duration: 2, delay: 0.5 }}
                      viewport={{ once: true }}
                    />
                  </div>
                  <div className="battery-warning">
                    <Battery size={32} />
                  </div>
                </div>
                <span className="battery-text">CRITICAL</span>
              </motion.div>

              <div className="burnout-stats">
                <div className="burnout-stat">
                  <span className="burnout-value text-gradient">
                    <AnimatedCounter value={70} suffix="%" />
                  </span>
                  <span className="burnout-label">Creator Burnout Rate</span>
                </div>

                <div className="burnout-symptoms">
                  {['Creative exhaustion', 'Inconsistent posting', 'Revenue decline', 'Mental health impact'].map((symptom, i) => (
                    <motion.div
                      key={symptom}
                      className="symptom-item"
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 + i * 0.15 }}
                      viewport={{ once: true }}
                    >
                      <XCircle size={18} className="symptom-icon" />
                      <span>{symptom}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 7: One-Person Army */}
      <Slide id="slide-7">
        <div className="centered-layout">
          <SectionHeader
            eyebrow="The Reality Check"
            title={<>The One-Person Army <span className="hero-title-italic">Fallacy</span></>}
            subtitle="Modern content creation demands the work of an entire team. But most creators are doing it alone."
            center
          />

          <motion.div className="hats-visual" variants={scaleIn}>
            <div className="person-center">
              <motion.div
                className="person-figure"
                animate={{ rotate: [-2, 2, -2] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <div className="figure-head" />
                <div className="figure-body" />
              </motion.div>
            </div>

            <div className="hats-orbit">
              {[
                { role: 'Scriptwriter', icon: FileText, color: '#667eea' },
                { role: 'Director', icon: Video, color: '#764ba2' },
                { role: 'Editor', icon: Layers, color: '#f093fb' },
                { role: 'Marketer', icon: TrendingUp, color: '#4facfe' },
                { role: 'Designer', icon: Sparkles, color: '#f5576c' },
                { role: 'Strategist', icon: Target, color: '#00f2fe' },
                { role: 'Manager', icon: Calendar, color: '#38ef7d' },
                { role: 'Analyst', icon: BarChart3, color: '#fee140' },
                { role: 'Host', icon: Users, color: '#fa709a' },
                { role: 'SEO Expert', icon: Search, color: '#11998e' },
              ].map((hat, i) => (
                <motion.div
                  key={hat.role}
                  className="hat-item"
                  style={{
                    '--hat-angle': `${i * 36}deg`,
                    '--hat-color': hat.color
                  }}
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.15, zIndex: 10 }}
                >
                  <div className="hat-icon" style={{ background: `linear-gradient(135deg, ${hat.color}40, ${hat.color}20)` }}>
                    <hat.icon size={20} color={hat.color} />
                  </div>
                  <span className="hat-role">{hat.role}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 8: Ideation Fatigue */}
      <Slide id="slide-8">
        <div className="split-layout reverse">
          <motion.div className="split-visual" variants={slideInLeft}>
            <div className="blank-page-visual">
              <motion.div
                className="cursor-blink"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                |
              </motion.div>
              <div className="page-container">
                <div className="page-header">
                  <div className="dot red" />
                  <div className="dot yellow" />
                  <div className="dot green" />
                </div>
                <div className="page-content">
                  <div className="page-title">New Video Idea</div>
                  <div className="page-body">
                    <motion.span
                      className="typing-cursor"
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    >
                      _
                    </motion.span>
                  </div>
                </div>
                <div className="page-footer">
                  <span className="word-count">0 words</span>
                  <span className="ideas-left">Ideas remaining: 0</span>
                </div>
              </div>

              <div className="thought-bubbles">
                {['?', '...', '?!', ''].map((thought, i) => (
                  <motion.div
                    key={i}
                    className="thought-bubble"
                    animate={{
                      y: [-5, 5, -5],
                      opacity: [0.3, 0.7, 0.3]
                    }}
                    transition={{
                      duration: 2 + i * 0.5,
                      repeat: Infinity,
                      delay: i * 0.3
                    }}
                  >
                    {thought}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          <div className="split-content">
            <SectionHeader
              eyebrow="Creative Block"
              title={<>Ideation <span className="text-gradient">Fatigue</span></>}
              subtitle="The blank page becomes your enemy when you need to create content daily. Coming up with fresh, engaging ideas is exhausting."
            />

            <motion.div className="fatigue-stats" variants={staggerContainer}>
              <motion.div className="fatigue-stat glass-card" variants={fadeInUp}>
                <Brain size={32} className="fatigue-icon" />
                <div className="fatigue-info">
                  <span className="fatigue-num">4-6 hours</span>
                  <span className="fatigue-desc">Average time spent on ideation per week</span>
                </div>
              </motion.div>
              <motion.div className="fatigue-stat glass-card" variants={fadeInUp}>
                <RefreshCw size={32} className="fatigue-icon" />
                <div className="fatigue-info">
                  <span className="fatigue-num">60%</span>
                  <span className="fatigue-desc">Creators recycle old ideas due to burnout</span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </Slide>

      {/* ==================== SECTION 3: THE SOLUTION ==================== */}

      {/* Slide 9: Enter the Avatar */}
      <Slide id="slide-9" className="solution-intro">
        <div className="centered-layout">
          <motion.div
            className="solution-badge"
            variants={scaleIn}
          >
            <Sparkles size={20} />
            <span>The Game Changer</span>
          </motion.div>

          <SectionHeader
            title={<>Enter the <span className="text-gradient">Avatar</span></>}
            subtitle="AI-powered digital twins that look, sound, and move just like you. Without the limitations of being human."
            center
          />

          <motion.div className="avatar-comparison" variants={fadeInUp}>
            <div className="comparison-container glass-panel">
              <div className="comparison-side realistic">
                <div className="avatar-preview">
                  <motion.div
                    className="avatar-frame premium"
                    animate={{
                      boxShadow: [
                        '0 0 30px rgba(102, 126, 234, 0.3)',
                        '0 0 60px rgba(102, 126, 234, 0.5)',
                        '0 0 30px rgba(102, 126, 234, 0.3)'
                      ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <div className="avatar-silhouette realistic">
                      <div className="silhouette-head" />
                      <div className="silhouette-shoulders" />
                      <div className="silhouette-features">
                        <div className="feature-eye left" />
                        <div className="feature-eye right" />
                        <div className="feature-mouth" />
                      </div>
                    </div>
                    <div className="ai-badge">
                      <Sparkles size={14} />
                      AI
                    </div>
                  </motion.div>
                </div>
                <h3 className="comparison-title">Realistic AI Avatar</h3>
                <ul className="comparison-features">
                  <li><CheckCircle size={16} /> Indistinguishable from real video</li>
                  <li><CheckCircle size={16} /> Professional appearance</li>
                  <li><CheckCircle size={16} /> Perfect for business content</li>
                  <li><CheckCircle size={16} /> High trust factor</li>
                </ul>
              </div>

              <div className="comparison-vs">
                <motion.span
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  VS
                </motion.span>
              </div>

              <div className="comparison-side cartoon">
                <div className="avatar-preview">
                  <div className="avatar-frame basic">
                    <div className="avatar-silhouette cartoon">
                      <div className="cartoon-head">
                        <div className="cartoon-eye left" />
                        <div className="cartoon-eye right" />
                        <div className="cartoon-smile" />
                      </div>
                      <div className="cartoon-body" />
                    </div>
                  </div>
                </div>
                <h3 className="comparison-title">Basic Cartoon</h3>
                <ul className="comparison-features dimmed">
                  <li><XCircle size={16} /> Obviously artificial</li>
                  <li><XCircle size={16} /> Limited expressiveness</li>
                  <li><XCircle size={16} /> Lower engagement</li>
                  <li><XCircle size={16} /> Feels impersonal</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 10: 99% Cost Reduction */}
      <Slide id="slide-10">
        <div className="centered-layout">
          <SectionHeader
            eyebrow="The Economics"
            title={<>The <span className="text-gradient">99%</span> Cost Revolution</>}
            subtitle="What once required a full production crew, studio, and thousands of dollars can now be done for the price of a coffee."
            center
          />

          <motion.div className="cost-visual" variants={scaleIn}>
            <div className="cost-comparison">
              <motion.div
                className="cost-side traditional"
                initial={{ x: -50, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                <div className="cost-label">Traditional Production</div>
                <div className="cost-amount crossed">
                  <span className="currency">$</span>
                  <span className="value">10,000</span>
                </div>
                <div className="cost-line" />
                <ul className="cost-includes">
                  <li>Studio rental</li>
                  <li>Camera crew</li>
                  <li>Lighting setup</li>
                  <li>Professional editing</li>
                  <li>Hair & makeup</li>
                </ul>
              </motion.div>

              <div className="cost-arrow">
                <motion.div
                  animate={{ x: [0, 10, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ArrowRight size={48} />
                </motion.div>
              </div>

              <motion.div
                className="cost-side ai-avatar"
                initial={{ x: 50, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                viewport={{ once: true }}
              >
                <div className="cost-label">AI Avatar</div>
                <div className="cost-amount highlighted">
                  <span className="currency">$</span>
                  <span className="value text-gradient">89</span>
                </div>
                <div className="cost-badge">
                  <Zap size={16} />
                  <span>99% Savings</span>
                </div>
                <ul className="cost-includes success">
                  <li><CheckCircle size={14} /> Unlimited videos</li>
                  <li><CheckCircle size={14} /> Instant generation</li>
                  <li><CheckCircle size={14} /> No scheduling hassle</li>
                  <li><CheckCircle size={14} /> Always camera-ready</li>
                  <li><CheckCircle size={14} /> Professional quality</li>
                </ul>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 11: 24/7 Reliability */}
      <Slide id="slide-11">
        <div className="split-layout">
          <div className="split-content">
            <SectionHeader
              eyebrow="Always On"
              title={<><span className="text-gradient">24/7</span> Reliability</>}
              subtitle="Your AI avatar never sleeps, never gets sick, never has a bad hair day. It's ready to create content any time, any day."
            />

            <motion.div className="reliability-features" variants={staggerContainer}>
              {[
                { icon: Clock, title: 'Round the Clock', desc: 'Create content at 3 AM or 3 PM' },
                { icon: Globe, title: 'Any Timezone', desc: 'Serve global audiences instantly' },
                { icon: Zap, title: 'Zero Downtime', desc: 'No sick days, no vacations' },
                { icon: Star, title: 'Consistent Quality', desc: 'Same professional output every time' },
              ].map((feature, i) => (
                <motion.div key={i} className="reliability-feature glass-card" variants={fadeInUp}>
                  <div className="feature-icon">
                    <feature.icon size={24} />
                  </div>
                  <div className="feature-content">
                    <h4>{feature.title}</h4>
                    <p>{feature.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          <motion.div className="split-visual" variants={slideInRight}>
            <div className="city-visual">
              <div className="city-skyline">
                {Array.from({ length: 12 }, (_, i) => (
                  <motion.div
                    key={i}
                    className="building"
                    style={{
                      height: `${30 + Math.random() * 50}%`,
                      left: `${i * 8}%`
                    }}
                    initial={{ y: 100, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    viewport={{ once: true }}
                  >
                    {Array.from({ length: Math.floor(Math.random() * 8) + 2 }, (_, j) => (
                      <motion.div
                        key={j}
                        className="window"
                        animate={{
                          opacity: [0.2, 0.8, 0.2],
                        }}
                        transition={{
                          duration: 2 + Math.random() * 2,
                          repeat: Infinity,
                          delay: Math.random() * 2
                        }}
                      />
                    ))}
                  </motion.div>
                ))}
              </div>

              <div className="moon">
                <motion.div
                  className="moon-glow"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 4, repeat: Infinity }}
                />
              </div>

              <motion.div
                className="avatar-working"
                animate={{ y: [-5, 5, -5] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <div className="avatar-workspace glass-card">
                  <div className="workspace-screen">
                    <motion.div
                      className="screen-content"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <Video size={24} />
                    </motion.div>
                  </div>
                  <div className="avatar-mini">
                    <Sparkles size={16} />
                  </div>
                  <span className="working-label">Creating content...</span>
                </div>
              </motion.div>

              <div className="stars">
                {Array.from({ length: 20 }, (_, i) => (
                  <motion.div
                    key={i}
                    className="star"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 40}%`
                    }}
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{
                      duration: 1 + Math.random() * 2,
                      repeat: Infinity,
                      delay: Math.random() * 2
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 12: Solving Ideation */}
      <Slide id="slide-12">
        <div className="centered-layout">
          <SectionHeader
            eyebrow="Workflow Revolution"
            title={<>From Script to Screen in <span className="text-gradient">Minutes</span></>}
            subtitle="Never face a blank page again. AI helps generate ideas, writes scripts, and produces videos - all in one seamless flow."
            center
          />

          <motion.div className="workflow-visual" variants={fadeInUp}>
            <div className="workflow-steps">
              {[
                { icon: Brain, title: 'Ideate', desc: 'AI generates topic ideas', color: '#667eea' },
                { icon: FileText, title: 'Script', desc: 'Auto-writes engaging scripts', color: '#764ba2' },
                { icon: Wand2, title: 'Generate', desc: 'Avatar brings it to life', color: '#f093fb' },
                { icon: Video, title: 'Publish', desc: 'Ready for all platforms', color: '#4facfe' },
              ].map((step, i) => (
                <motion.div
                  key={step.title}
                  className="workflow-step"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.2 }}
                  viewport={{ once: true }}
                >
                  <div className="step-connector">
                    {i < 3 && (
                      <motion.div
                        className="connector-line"
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        transition={{ delay: 0.3 + i * 0.2, duration: 0.5 }}
                        viewport={{ once: true }}
                      />
                    )}
                  </div>
                  <motion.div
                    className="step-icon glass-card"
                    style={{
                      background: `linear-gradient(135deg, ${step.color}30, ${step.color}10)`,
                      borderColor: `${step.color}40`
                    }}
                    whileHover={{ scale: 1.1, y: -5 }}
                  >
                    <step.icon size={32} color={step.color} />
                  </motion.div>
                  <div className="step-number">{String(i + 1).padStart(2, '0')}</div>
                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-desc">{step.desc}</p>
                </motion.div>
              ))}
            </div>

            <motion.div
              className="workflow-result glass-panel"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1 }}
              viewport={{ once: true }}
            >
              <div className="result-preview">
                <div className="preview-screen">
                  <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Play size={48} />
                  </motion.div>
                </div>
              </div>
              <div className="result-info">
                <span className="result-time">Total time: 5 minutes</span>
                <span className="result-quality">Professional quality video ready</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </Slide>

      {/* ==================== SECTION 4: THE SHOWCASE ==================== */}

      {/* Slide 13: Platform Face-off */}
      <Slide id="slide-13">
        <div className="centered-layout">
          <SectionHeader
            eyebrow="Market Leaders"
            title={<>Platform <span className="text-gradient">Face-Off</span></>}
            subtitle="Comparing the top AI avatar platforms to help you make the right choice for your needs."
            center
          />

          <motion.div className="comparison-table-container" variants={fadeInUp}>
            <div className="comparison-table glass-panel">
              <div className="table-header">
                <div className="header-cell feature">Feature</div>
                <div className="header-cell platform heygen">
                  <span className="platform-name">HeyGen</span>
                  <span className="platform-badge">Popular</span>
                </div>
                <div className="header-cell platform synthesia">
                  <span className="platform-name">Synthesia</span>
                  <span className="platform-badge">Enterprise</span>
                </div>
              </div>

              <div className="table-body">
                {[
                  { feature: 'Realistic Avatars', heygen: true, synthesia: true },
                  { feature: 'Custom Avatar Training', heygen: true, synthesia: true },
                  { feature: 'Instant Avatar', heygen: true, synthesia: false },
                  { feature: 'Voice Cloning', heygen: true, synthesia: true },
                  { feature: 'Multi-language Support', heygen: '40+', synthesia: '120+' },
                  { feature: 'API Access', heygen: true, synthesia: true },
                  { feature: 'Starting Price', heygen: '$29/mo', synthesia: '$89/mo' },
                  { feature: 'Free Trial', heygen: true, synthesia: true },
                ].map((row, i) => (
                  <motion.div
                    key={row.feature}
                    className="table-row"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <div className="row-cell feature">{row.feature}</div>
                    <div className="row-cell value">
                      {typeof row.heygen === 'boolean' ? (
                        row.heygen ? <CheckCircle size={20} className="check" /> : <XCircle size={20} className="cross" />
                      ) : (
                        <span className="text-value">{row.heygen}</span>
                      )}
                    </div>
                    <div className="row-cell value">
                      {typeof row.synthesia === 'boolean' ? (
                        row.synthesia ? <CheckCircle size={20} className="check" /> : <XCircle size={20} className="cross" />
                      ) : (
                        <span className="text-value">{row.synthesia}</span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 14: Multilingual Magic */}
      <Slide id="slide-14">
        <div className="centered-layout">
          <SectionHeader
            eyebrow="Global Reach"
            title={<>Multilingual <span className="hero-title-italic">Magic</span></>}
            subtitle="Speak to the world in their language. AI avatars can deliver your message in 120+ languages with perfect pronunciation."
            center
          />

          <motion.div className="globe-visual" variants={scaleIn}>
            <div className="globe-container">
              <motion.div
                className="globe"
                animate={{ rotateY: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              >
                <div className="globe-surface" />
                <div className="globe-grid" />
              </motion.div>

              <div className="flags-orbit">
                {[
                  { flag: '🇺🇸', lang: 'English' },
                  { flag: '🇪🇸', lang: 'Spanish' },
                  { flag: '🇫🇷', lang: 'French' },
                  { flag: '🇩🇪', lang: 'German' },
                  { flag: '🇨🇳', lang: 'Chinese' },
                  { flag: '🇯🇵', lang: 'Japanese' },
                  { flag: '🇰🇷', lang: 'Korean' },
                  { flag: '🇧🇷', lang: 'Portuguese' },
                  { flag: '🇮🇳', lang: 'Hindi' },
                  { flag: '🇸🇦', lang: 'Arabic' },
                  { flag: '🇷🇺', lang: 'Russian' },
                  { flag: '🇮🇹', lang: 'Italian' },
                ].map((item, i) => (
                  <motion.div
                    key={item.lang}
                    className="flag-item"
                    style={{ '--flag-index': i, '--total-flags': 12 }}
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    viewport={{ once: true }}
                    whileHover={{ scale: 1.2, zIndex: 10 }}
                  >
                    <span className="flag-emoji">{item.flag}</span>
                    <span className="flag-lang">{item.lang}</span>
                  </motion.div>
                ))}
              </div>

              <div className="language-count">
                <motion.span
                  className="count-number text-gradient"
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  transition={{ delay: 1, type: "spring" }}
                  viewport={{ once: true }}
                >
                  120+
                </motion.span>
                <span className="count-label">Languages Supported</span>
              </div>
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 15: Case Study Virgin Voyages */}
      <Slide id="slide-15">
        <div className="split-layout">
          <div className="split-content">
            <SectionHeader
              eyebrow="Case Study"
              title={<>Virgin Voyages × <span className="text-gradient">JLo</span></>}
              subtitle="How Virgin Voyages created a hyper-personalized experience by using an AI avatar of Jennifer Lopez to greet each passenger by name."
            />

            <motion.div className="case-study-stats" variants={staggerContainer}>
              <motion.div className="case-stat glass-card" variants={fadeInUp}>
                <span className="case-stat-value">300K+</span>
                <span className="case-stat-label">Personalized Videos</span>
              </motion.div>
              <motion.div className="case-stat glass-card" variants={fadeInUp}>
                <span className="case-stat-value">1:1</span>
                <span className="case-stat-label">Personal Greeting</span>
              </motion.div>
              <motion.div className="case-stat glass-card" variants={fadeInUp}>
                <span className="case-stat-value">∞</span>
                <span className="case-stat-label">Scale Potential</span>
              </motion.div>
            </motion.div>

            <motion.blockquote className="case-quote" variants={fadeInUp}>
              "Each passenger received a personalized video of JLo welcoming them by name.
              Impossible at scale with traditional video."
            </motion.blockquote>
          </div>

          <motion.div className="split-visual" variants={slideInRight}>
            <div className="jlo-visual glass-panel">
              <div className="video-frame">
                <div className="frame-header">
                  <div className="dot red" />
                  <div className="dot yellow" />
                  <div className="dot green" />
                  <span className="frame-title">Personalized Welcome</span>
                </div>
                <div className="frame-content">
                  <div className="avatar-figure jlo">
                    <motion.div
                      className="figure-glow"
                      animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <div className="figure-silhouette" />
                  </div>
                  <div className="speech-bubble">
                    <motion.span
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      viewport={{ once: true }}
                    >
                      "Hi <span className="highlight">[Your Name]</span>, welcome aboard!"
                    </motion.span>
                  </div>
                </div>
                <div className="virgin-logo">
                  <span>VIRGIN</span>
                  <span className="voyages">VOYAGES</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 16: Small Business Case Study */}
      <Slide id="slide-16">
        <div className="split-layout reverse">
          <motion.div className="split-visual" variants={slideInLeft}>
            <div className="growth-chart glass-panel">
              <div className="chart-header">
                <h4>Revenue Growth</h4>
                <span className="chart-period">After AI Avatar Implementation</span>
              </div>
              <div className="chart-content">
                <svg viewBox="0 0 400 200" className="growth-svg">
                  <defs>
                    <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#667eea" stopOpacity="0.5"/>
                      <stop offset="100%" stopColor="#667eea" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <motion.path
                    d="M 0 180 Q 50 170 100 150 T 200 100 T 300 60 T 400 20"
                    fill="none"
                    stroke="url(#premiumGradient)"
                    strokeWidth="3"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    transition={{ duration: 2, delay: 0.5 }}
                    viewport={{ once: true }}
                  />
                  <defs>
                    <linearGradient id="premiumGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#667eea"/>
                      <stop offset="100%" stopColor="#764ba2"/>
                    </linearGradient>
                  </defs>
                  <motion.path
                    d="M 0 180 Q 50 170 100 150 T 200 100 T 300 60 T 400 20 L 400 200 L 0 200 Z"
                    fill="url(#chartGradient)"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 1.5 }}
                    viewport={{ once: true }}
                  />
                </svg>
                <div className="chart-labels">
                  <span>Before</span>
                  <span>After</span>
                </div>
              </div>
              <div className="chart-highlight">
                <TrendingUp size={24} />
                <span className="highlight-value">+340%</span>
                <span className="highlight-label">Sales Increase</span>
              </div>
            </div>
          </motion.div>

          <div className="split-content">
            <SectionHeader
              eyebrow="Success Story"
              title={<>Small Business <span className="text-gradient">Wins Big</span></>}
              subtitle="How a local fitness coach 10x'd their reach using AI avatars to create consistent, personalized content at scale."
            />

            <motion.div className="success-metrics" variants={staggerContainer}>
              {[
                { metric: '10x', label: 'Content Output', icon: Video },
                { metric: '340%', label: 'Sales Increase', icon: TrendingUp },
                { metric: '85%', label: 'Time Saved', icon: Clock },
                { metric: '$0', label: 'Production Cost', icon: DollarSign },
              ].map((item, i) => (
                <motion.div key={item.label} className="success-metric glass-card" variants={fadeInUp}>
                  <item.icon size={24} className="metric-icon" />
                  <span className="metric-value text-gradient">{item.metric}</span>
                  <span className="metric-label">{item.label}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </Slide>

      {/* ==================== SECTION 5: CONCLUSION ==================== */}

      {/* Slide 17: Hybrid Workflow */}
      <Slide id="slide-17">
        <div className="centered-layout">
          <SectionHeader
            eyebrow="Best of Both Worlds"
            title={<>The <span className="text-gradient">Hybrid</span> Workflow</>}
            subtitle="AI doesn't replace human creativity—it amplifies it. You direct, the AI executes."
            center
          />

          <motion.div className="hybrid-visual" variants={fadeInUp}>
            <div className="hybrid-container glass-panel">
              <div className="hybrid-side human">
                <motion.div
                  className="hybrid-icon"
                  animate={{ y: [-5, 5, -5] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Users size={48} />
                </motion.div>
                <h3>Human Director</h3>
                <ul className="hybrid-tasks">
                  <li><Brain size={16} /> Creative Strategy</li>
                  <li><Target size={16} /> Brand Voice</li>
                  <li><Star size={16} /> Quality Control</li>
                  <li><MessageCircle size={16} /> Audience Connection</li>
                </ul>
              </div>

              <div className="hybrid-connector">
                <motion.div
                  className="connector-pulse"
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <Workflow size={32} />
                <span>Synergy</span>
              </div>

              <div className="hybrid-side ai">
                <motion.div
                  className="hybrid-icon"
                  animate={{ y: [5, -5, 5] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Sparkles size={48} />
                </motion.div>
                <h3>AI Actor</h3>
                <ul className="hybrid-tasks">
                  <li><Video size={16} /> Content Production</li>
                  <li><Clock size={16} /> 24/7 Availability</li>
                  <li><Globe size={16} /> Multi-language</li>
                  <li><Zap size={16} /> Instant Scaling</li>
                </ul>
              </div>
            </div>

            <motion.div
              className="hybrid-result"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              viewport={{ once: true }}
            >
              <span className="result-equals">=</span>
              <span className="result-text">Unlimited Creative Potential</span>
            </motion.div>
          </motion.div>
        </div>
      </Slide>

      {/* Slide 18: Future Outlook 2026 */}
      <Slide id="slide-18">
        <div className="centered-layout">
          <SectionHeader
            eyebrow="What's Coming"
            title={<>Future Outlook <span className="text-gradient">2026</span></>}
            subtitle="The AI avatar revolution is just beginning. Here's what the near future holds."
            center
          />

          <motion.div className="future-grid" variants={staggerContainer}>
            {[
              {
                icon: Target,
                title: 'Hyper-Personalization',
                desc: 'Every viewer gets a unique, personalized version of your content tailored to their preferences.',
                color: '#667eea'
              },
              {
                icon: MessageCircle,
                title: 'Real-time Interaction',
                desc: 'AI avatars that can have live conversations, answer questions, and engage in real-time.',
                color: '#764ba2'
              },
              {
                icon: Brain,
                title: 'Emotional Intelligence',
                desc: 'Avatars that can read and respond to viewer emotions for deeper engagement.',
                color: '#f093fb'
              },
              {
                icon: Globe,
                title: 'Seamless Translation',
                desc: 'Content automatically adapted for cultural nuances, not just language translation.',
                color: '#4facfe'
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                className="future-card glass-card"
                variants={fadeInUp}
                whileHover={{ y: -10, scale: 1.02 }}
              >
                <div
                  className="future-icon"
                  style={{ background: `linear-gradient(135deg, ${item.color}40, ${item.color}20)` }}
                >
                  <item.icon size={32} color={item.color} />
                </div>
                <h3 className="future-title">{item.title}</h3>
                <p className="future-desc">{item.desc}</p>
                <motion.div
                  className="future-glow"
                  style={{ background: item.color }}
                  animate={{ opacity: [0.1, 0.3, 0.1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Slide>

      {/* Slide 19: Start Your Twin */}
      <Slide id="slide-19" className="cta-slide">
        <div className="cta-content">
          <motion.div
            className="cta-badge"
            variants={scaleIn}
          >
            <Rocket size={20} />
            <span>Your Turn</span>
          </motion.div>

          <motion.h2
            className="cta-title"
            variants={fadeInUp}
          >
            <span className="cta-line">Start Your</span>
            <span className="cta-line text-gradient">Digital Twin</span>
            <span className="cta-line hero-title-italic">Today</span>
          </motion.h2>

          <motion.p
            className="cta-subtitle"
            variants={fadeInUp}
          >
            Join thousands of creators and businesses who have already
            <br />transformed their content strategy with AI avatars.
          </motion.p>

          <motion.div
            className="cta-buttons"
            variants={fadeInUp}
          >
            <button className="btn-glass btn-primary btn-large">
              <Sparkles size={24} />
              Create Your Avatar
              <ArrowRight size={20} />
            </button>
            <button className="btn-glass btn-large">
              <Play size={20} />
              Watch Demo
            </button>
          </motion.div>

          <motion.div
            className="cta-features"
            variants={staggerContainer}
          >
            {['No credit card required', '5-minute setup', 'Free trial available'].map((feature, i) => (
              <motion.span key={feature} className="cta-feature" variants={fadeInUp}>
                <CheckCircle size={16} />
                {feature}
              </motion.span>
            ))}
          </motion.div>
        </div>

        {/* Animated Background Elements */}
        <div className="cta-bg-elements">
          <motion.div
            className="cta-orb cta-orb-1"
            animate={{
              scale: [1, 1.2, 1],
              x: [-20, 20, -20],
              y: [-10, 10, -10]
            }}
            transition={{ duration: 8, repeat: Infinity }}
          />
          <motion.div
            className="cta-orb cta-orb-2"
            animate={{
              scale: [1.2, 1, 1.2],
              x: [20, -20, 20],
              y: [10, -10, 10]
            }}
            transition={{ duration: 10, repeat: Infinity }}
          />
        </div>
      </Slide>

      {/* Slide 20: Q&A */}
      <Slide id="slide-20" className="qa-slide">
        <div className="qa-content">
          <motion.div
            className="qa-icon"
            variants={scaleIn}
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <MessageCircle size={80} />
          </motion.div>

          <motion.h2
            className="qa-title"
            variants={fadeInUp}
          >
            Questions<span className="text-gradient">?</span>
          </motion.h2>

          <motion.p
            className="qa-subtitle"
            variants={fadeInUp}
          >
            Let's discuss how AI avatars can transform your content strategy
          </motion.p>

          <motion.div
            className="qa-contact"
            variants={fadeInUp}
          >
            <div className="contact-card glass-card">
              <div className="contact-info">
                <span className="contact-label">Ready to get started?</span>
                <span className="contact-action">Schedule a consultation</span>
              </div>
              <ArrowRight size={24} />
            </div>
          </motion.div>

          <motion.div
            className="qa-decoration"
            variants={staggerContainer}
          >
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="decoration-dot"
                variants={fadeIn}
                animate={{
                  y: [-10, 10, -10],
                  opacity: [0.3, 0.7, 0.3]
                }}
                transition={{
                  duration: 2 + i * 0.5,
                  repeat: Infinity,
                  delay: i * 0.2
                }}
              />
            ))}
          </motion.div>
        </div>
      </Slide>

    </div>
  )
}

export default App
