import { motion as m } from 'framer-motion'
import BookMockup from './BookMockup'
import './App.css'

const MotionP = m.p
const MotionH1 = m.h1
const MotionDiv = m.div

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }
  })
}

export default function App() {
  return (
    <div className="page">
      <div className="page-bg" aria-hidden="true">
        <div className="bg-wash" />
        <div className="bg-grain" />
        <div className="bg-beam" />
      </div>

      <header className="site-header">
        <a href="#top" className="logo">Meridian</a>
        <nav className="nav" aria-label="Primary">
          <a href="#excerpt">Excerpt</a>
          <a href="#order" className="nav-cta">Pre-order</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-visual">
            <BookMockup />
          </div>

          <div className="hero-copy">
            <MotionP
              className="brand-mark"
              custom={0}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
            >
              Meridian
            </MotionP>

            <MotionH1
              className="hero-title"
              custom={1}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
            >
              Lumen
            </MotionH1>

            <MotionP
              className="hero-lede"
              custom={2}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
            >
              A meditation on attention, craft, and the quiet work of becoming visible
              without disappearing.
            </MotionP>

            <MotionDiv
              className="hero-actions"
              custom={3}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
            >
              <a href="#order" className="btn-primary">Pre-order the hardcover</a>
              <a href="#excerpt" className="btn-ghost">Read an excerpt</a>
            </MotionDiv>
          </div>
        </section>

        <section className="excerpt" id="excerpt">
          <MotionDiv
            className="excerpt-inner"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="excerpt-label">From the opening</p>
            <blockquote className="excerpt-quote">
              <p>
                “We keep mistaking brightness for presence. Lumen is not the glare that
                announces you — it is the steady light that lets others see what you have
                made, and what you still refuse to rush.”
              </p>
            </blockquote>
            <p className="excerpt-attr">— Elena Voss</p>
          </MotionDiv>
        </section>

        <section className="order" id="order">
          <MotionDiv
            className="order-inner"
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 className="order-title">Cloth-bound. Foil-stamped. Built to keep.</h2>
            <p className="order-copy">
              First edition hardcover from Meridian Press. 248 pages, sewn binding,
              forest-green cloth with copper foil.
            </p>
            <a href="#top" className="btn-primary">Reserve your copy — $32</a>
          </MotionDiv>
        </section>
      </main>

      <footer className="site-footer">
        <p className="footer-brand">Meridian</p>
        <p className="footer-note">© 2026 Meridian Press. All rights reserved.</p>
      </footer>
    </div>
  )
}
