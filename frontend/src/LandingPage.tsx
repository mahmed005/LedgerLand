import { useEffect, useRef, useState } from 'react'
import './LandingPage.css'

// ── Icons (inline SVG helpers) ─────────────────────────────────────────────
const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)
const ChainIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="6" height="10" rx="2" />
    <rect x="16" y="7" width="6" height="10" rx="2" />
    <path d="M8 12h8" />
  </svg>
)
const FingerprintIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
    <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
    <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
    <path d="M2 12a10 10 0 0 1 18-6" />
    <path d="M2 17c1.73 0 3.33-.73 4.5-1.9" />
    <path d="M6 10.7C5.35 11.39 5 12.15 5 13" />
    <path d="M8 10a4 4 0 0 1 8 0c0 1.52-.07 3.04-.2 4.56" />
    <path d="M22 12a10 10 0 0 0-2.71-6.87" />
  </svg>
)
const CloudIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
  </svg>
)
const ZapIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
)
const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" />
  </svg>
)
const BuildingIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21V7l9-4 9 4v14" />
    <path d="M9 21v-6h6v6" />
    <path d="M9 9h.01M12 9h.01M15 9h.01M9 13h.01M12 13h.01M15 13h.01" />
  </svg>
)
const GavelIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="m14 13-8.5 8.5a2.12 2.12 0 1 1-3-3L11 10" />
    <path d="m16 16 6-6" />
    <path d="m8 8 6-6" />
    <path d="m9 7 8 8" />
    <path d="m21 11-8-8" />
  </svg>
)
const ArrowRightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
)
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

// ── Main Component ──────────────────────────────────────────────────────────
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const heroRef = useRef<HTMLElement>(null)
  const featuresRef = useRef<HTMLElement>(null)
  const howRef = useRef<HTMLElement>(null)
  const rolesRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Intersection Observer for scroll animations
  useEffect(() => {
    // Immediately show hero elements (above the fold)
    document.querySelectorAll('.lp-hero .animate-on-scroll').forEach((el, i) => {
      setTimeout(() => el.classList.add('visible'), i * 120)
    })

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    )
    document.querySelectorAll('.animate-on-scroll:not(.lp-hero .animate-on-scroll)').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth' })
    setMobileMenuOpen(false)
  }

  const features = [
    {
      icon: <ChainIcon />,
      title: 'Blockchain Immutability',
      desc: 'Every land record is written onto an Ethereum-compatible blockchain. Once recorded, no one — not even administrators — can alter or delete ownership data.',
      color: 'teal',
    },
    {
      icon: <FingerprintIcon />,
      title: 'NADRA Biometric Auth',
      desc: 'Every property transfer is verified against NADRA\'s national identity database via biometric authentication, ensuring only the rightful owner can authorize changes.',
      color: 'gold',
    },
    {
      icon: <CloudIcon />,
      title: 'IPFS Document Storage',
      desc: 'Title deeds and legal documents are stored on the InterPlanetary File System — decentralized and permanent, immune to physical loss or tampering.',
      color: 'violet',
    },
    {
      icon: <ZapIcon />,
      title: 'Smart Contract Transfers',
      desc: 'Automated smart contracts handle ownership changes instantly upon biometric clearance, reducing the traditional 30–60 day process to minutes.',
      color: 'blue',
    },
    {
      icon: <EyeIcon />,
      title: 'Full Audit Transparency',
      desc: 'A complete, searchable history of every property transaction is visible to judicial authorities, eliminating disputes and enabling justice.',
      color: 'green',
    },
    {
      icon: <ShieldIcon />,
      title: 'Role-Based Security',
      desc: 'Separate access tiers for Citizens, Patwaris, and Court Authorities ensure each user only sees and acts on information relevant to their role.',
      color: 'rose',
    },
  ]

  const steps = [
    { num: '01', title: 'Create Your Account', desc: 'Sign up as a Citizen, Government Official, or Court Authority. Your identity is verified against NADRA records.' },
    { num: '02', title: 'Biometric Verification', desc: 'Authorize any property action with biometric authentication — fingerprint or CNIC — providing an unforgeable proof of identity.' },
    { num: '03', title: 'Instant, Permanent Transfer', desc: 'Smart contracts execute the transfer on-chain. Documents are pinned to IPFS. Your ownership record is permanent and public.' },
  ]

  const roles = [
    {
      icon: <UserIcon />,
      role: 'Citizens',
      color: 'teal',
      points: ['Browse & verify property records', 'Manage your property portfolio', 'Initiate ownership transfers', 'Upload legal documentation securely'],
    },
    {
      icon: <BuildingIcon />,
      role: 'Patwaris & Officials',
      color: 'gold',
      points: ['Register new land parcels', 'Review transfer requests', 'Maintain district-level records', 'Generate official digital certificates'],
    },
    {
      icon: <GavelIcon />,
      role: 'Judiciary & Courts',
      color: 'violet',
      points: ['Access full property audit trails', 'Verify ownership history instantly', 'Resolve disputes with evidence', 'Issue court-ordered transfers'],
    },
  ]

  return (
    <div className="lp-root">
      {/* ── Navbar ── */}
      <header className={`lp-nav${scrolled ? ' lp-nav--scrolled' : ''}`}>
        <div className="lp-nav__inner">
          <a href="#" className="lp-nav__brand">
            <span className="lp-nav__logo-mark">⬡</span>
            <span className="lp-nav__logo-text">Ledger<em>Land</em></span>
          </a>

          <nav className={`lp-nav__links${mobileMenuOpen ? ' open' : ''}`}>
            <button onClick={() => scrollTo(featuresRef)}>Features</button>
            <button onClick={() => scrollTo(howRef)}>How It Works</button>
            <button onClick={() => scrollTo(rolesRef)}>For You</button>
            <a href="/search" className="lp-nav__search-link">Search Records</a>
          </nav>

          <div className="lp-nav__actions">
            <a href="/signin" className="lp-btn lp-btn--ghost">Sign In</a>
            <a href="/signup" className="lp-btn lp-btn--primary">Get Started</a>
          </div>

          <button
            className={`lp-nav__hamburger${mobileMenuOpen ? ' active' : ''}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="lp-hero" ref={heroRef}>
        <div className="lp-hero__bg-grid" />
        <div className="lp-hero__glow lp-hero__glow--1" />
        <div className="lp-hero__glow lp-hero__glow--2" />

        <div className="lp-hero__content">
          <div className="lp-hero__badge animate-on-scroll">
            <span className="lp-badge">🇵🇰 Powered by Blockchain &amp; NADRA</span>
          </div>

          <h1 className="lp-hero__title animate-on-scroll">
            Pakistan's Land Registry,
            <br />
            <span className="lp-gradient-text">Made Immutable.</span>
          </h1>

          <p className="lp-hero__subtitle animate-on-scroll">
            LedgerLand replaces fraud-prone paper records with a tamper-proof,
            blockchain-backed system. Every property. Every owner. Every transfer —
            verified by biometrics, permanent on-chain.
          </p>

          <div className="lp-hero__cta animate-on-scroll">
            <a href="/signup" className="lp-btn lp-btn--primary lp-btn--lg">
              Create Account <ArrowRightIcon />
            </a>
            <a href="/signin" className="lp-btn lp-btn--outline lp-btn--lg">
              Sign In
            </a>
          </div>

          <div className="lp-hero__stats animate-on-scroll">
            {[
              { val: '100%', label: 'Tamper-Proof' },
              { val: '0', label: 'Middlemen' },
              { val: '<5min', label: 'Transfer Time' },
              { val: '3', label: 'User Roles' },
            ].map((s) => (
              <div className="lp-stat" key={s.label}>
                <strong>{s.val}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lp-hero__visual animate-on-scroll">
          <div className="lp-hero__img-wrap">
            <img src="/hero-illustration.png" alt="LedgerLand blockchain map visualization" />
            <div className="lp-hero__img-badge lp-hero__img-badge--1">
              <span className="dot dot--green" /> Verified on-chain
            </div>
            <div className="lp-hero__img-badge lp-hero__img-badge--2">
              <span className="dot dot--teal" /> NADRA Biometric ✓
            </div>
            <div className="lp-hero__img-badge lp-hero__img-badge--3">
              <span className="dot dot--gold" /> IPFS Stored
            </div>
          </div>
        </div>
      </section>

      {/* ── Problem Banner ── */}
      <section className="lp-problem">
        <div className="lp-problem__inner animate-on-scroll">
          <p className="lp-problem__stat">⚠️ Millions of land disputes plague Pakistan annually</p>
          <p className="lp-problem__copy">
            Traditional patwari records are paper-based, easily forged, and lost. Ownership transfers take
            <strong> 30–60 days</strong>, involve multiple middlemen, and leave citizens vulnerable to fraud.
            <strong> LedgerLand ends this.</strong>
          </p>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="lp-section" ref={featuresRef} id="features">
        <div className="lp-container">
          <div className="lp-section__header animate-on-scroll">
            <span className="lp-section__eyebrow">Core Capabilities</span>
            <h2 className="lp-section__title">Built on trust. Designed for Pakistan.</h2>
            <p className="lp-section__sub">
              Six foundational pillars that make LedgerLand the most secure land registry system in the country.
            </p>
          </div>

          <div className="lp-features-grid">
            {features.map((f, i) => (
              <div className={`lp-feature-card lp-feature-card--${f.color} animate-on-scroll`} key={i} style={{ animationDelay: `${i * 80}ms` }}>
                <div className="lp-feature-card__icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="lp-section lp-section--dark" ref={howRef} id="how-it-works">
        <div className="lp-container">
          <div className="lp-section__header animate-on-scroll">
            <span className="lp-section__eyebrow">The Process</span>
            <h2 className="lp-section__title">Three steps to permanent ownership.</h2>
            <p className="lp-section__sub">From sign-up to a blockchain-recorded deed — the whole journey, simplified.</p>
          </div>

          <div className="lp-steps">
            {steps.map((s, i) => (
              <div className="lp-step animate-on-scroll" key={i} style={{ animationDelay: `${i * 120}ms` }}>
                <div className="lp-step__num">{s.num}</div>
                <div className="lp-step__connector" />
                <div className="lp-step__body">
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── User Roles ── */}
      <section className="lp-section" ref={rolesRef} id="roles">
        <div className="lp-container">
          <div className="lp-section__header animate-on-scroll">
            <span className="lp-section__eyebrow">Who It's For</span>
            <h2 className="lp-section__title">One platform. Three powerful roles.</h2>
            <p className="lp-section__sub">LedgerLand serves Citizens, Government Officials, and the Judiciary — each with tailored tools.</p>
          </div>

          <div className="lp-roles-grid">
            {roles.map((r, i) => (
              <div className={`lp-role-card lp-role-card--${r.color} animate-on-scroll`} key={i} style={{ animationDelay: `${i * 120}ms` }}>
                <div className="lp-role-card__icon">{r.icon}</div>
                <h3>{r.role}</h3>
                <ul>
                  {r.points.map((p, j) => (
                    <li key={j}>
                      <span className="lp-check"><CheckIcon /></span>
                      {p}
                    </li>
                  ))}
                </ul>
                <a href="/signup" className="lp-btn lp-btn--card">
                  Join as {r.role.split(' ')[0]} <ArrowRightIcon />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="lp-cta-banner">
        <div className="lp-cta-banner__glow" />
        <div className="lp-cta-banner__content animate-on-scroll">
          <h2>Secure your land. Preserve your legacy.</h2>
          <p>Join thousands of citizens, officials, and judges already using LedgerLand to protect property rights in Pakistan.</p>
          <div className="lp-cta-banner__btns">
            <a href="/signup" className="lp-btn lp-btn--primary lp-btn--lg">Create Free Account</a>
            <a href="/signin" className="lp-btn lp-btn--ghost lp-btn--lg">Sign In</a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer__inner">
          <div className="lp-footer__brand">
            <span className="lp-nav__logo-mark">⬡</span>
            <span className="lp-nav__logo-text">Ledger<em>Land</em></span>
            <p>Securing Pakistan's soil with blockchain.</p>
          </div>
          <div className="lp-footer__links">
            <h4>Product</h4>
            <a href="#">Features</a>
            <a href="#">How It Works</a>
            <a href="#">User Roles</a>
          </div>
          <div className="lp-footer__links">
            <h4>Account</h4>
            <a href="/signin">Sign In</a>
            <a href="/signup">Sign Up</a>
          </div>
          <div className="lp-footer__links">
            <h4>Technology</h4>
            <a href="#">Ethereum Blockchain</a>
            <a href="#">IPFS Storage</a>
            <a href="#">NADRA Integration</a>
          </div>
        </div>
        <div className="lp-footer__bottom">
          <p>© 2026 LedgerLand · Group 7 · NUST SEECS · Built with React, Solidity &amp; ❤️</p>
        </div>
      </footer>
    </div>
  )
}
