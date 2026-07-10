import { useRef } from 'react'
import { motion as m, useMotionValue, useSpring, useTransform } from 'framer-motion'
import './BookMockup.css'

const MotionDiv = m.div

/**
 * Realistic 3D CSS hardcover book mockup.
 * Cloth-bound cover, foil title, page block, spine, and contact shadow.
 */
export default function BookMockup() {
  const ref = useRef(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)

  const springX = useSpring(mx, { stiffness: 120, damping: 18 })
  const springY = useSpring(my, { stiffness: 120, damping: 18 })

  const rotateY = useTransform(springX, [-0.5, 0.5], [-18, 8])
  const rotateX = useTransform(springY, [-0.5, 0.5], [12, -6])

  function onMove(e) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    mx.set(x)
    my.set(y)
  }

  function onLeave() {
    mx.set(0)
    my.set(0)
  }

  return (
    <div
      className="book-stage"
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      aria-hidden="true"
    >
      <div className="book-atmosphere" />
      <div className="book-surface" />

      <MotionDiv
        className="book-float"
        style={{ rotateX, rotateY }}
        initial={{ opacity: 0, y: 48, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
      >
        <div className="book">
          <div className="book-face book-front">
            <div className="cover-cloth" />
            <div className="cover-grain" />
            <div className="cover-vignette" />
            <div className="cover-sheen" />

            <div className="cover-content">
              <p className="cover-series">Meridian Essays</p>
              <h2 className="cover-title">
                <span>Lumen</span>
              </h2>
              <div className="cover-rule" />
              <p className="cover-subtitle">
                On Presence,<br />Attention &amp; Craft
              </p>
              <p className="cover-author">Elena Voss</p>
            </div>

            <div className="cover-ornament" />
            <div className="cover-edge-highlight" />
          </div>

          <div className="book-face book-spine">
            <div className="spine-cloth" />
            <div className="spine-content">
              <span className="spine-author">Voss</span>
              <span className="spine-title">Lumen</span>
              <span className="spine-press">M</span>
            </div>
          </div>

          <div className="book-face book-pages">
            <div className="page-layers" />
          </div>

          <div className="book-face book-top">
            <div className="top-pages" />
          </div>

          <div className="book-face book-bottom">
            <div className="bottom-pages" />
          </div>

          <div className="book-face book-back">
            <div className="back-cloth" />
          </div>
        </div>
      </MotionDiv>

      <div className="book-shadow" />
      <div className="book-glow" />
    </div>
  )
}
