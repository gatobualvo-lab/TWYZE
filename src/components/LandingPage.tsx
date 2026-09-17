import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Package,
  Shield,
  Users,
  LogIn,
  ArrowRight,
  CheckCircle2,
  Smartphone,
  Laptop,
  Tablet,
  Menu,
  X,
  UserCog,
  FileText,
  Sparkles,
} from 'lucide-react';
import { BILLING_PLANS } from '../utils/subscription';

const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// Real screenshots from the live app (captured from a demo account, not
// hand-coded mockup data) — framed in a lightweight browser-chrome card so
// they read as "this is what's actually in your browser."
const ScreenshotCard: React.FC<{ src: string; alt: string; label: string; width: number; height: number; maxWidth?: string }> = ({
  src, alt, label, width, height, maxWidth = 'max-w-xl',
}) => (
  <div className={`relative w-full ${maxWidth} mx-auto`}>
    <div className="absolute -inset-4 bg-gradient-to-tr from-blue-200/60 via-sky-100/40 to-emerald-100/40 blur-2xl rounded-3xl" />
    <div className="relative bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200/70 overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <div className="ml-3 text-xs font-medium text-gray-500">{label}</div>
      </div>
      <img src={src} alt={alt} width={width} height={height} className="w-full h-auto block" loading="lazy" />
    </div>
  </div>
);

const DashboardMockup: React.FC = () => (
  <ScreenshotCard
    src="/screenshots/dashboard-hero.png"
    alt="TrackWyze dashboard showing today's sales, weekly and monthly profit, expenses, business health score, and a 30-day sales trend"
    label="trackwyze.com / dashboard"
    width={1752}
    height={879}
  />
);

const NAV_LINKS = [
  { id: 'features', label: 'Features' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'trust', label: 'Why Trackwyze' },
  { id: 'contact', label: 'Contact' },
];

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleMobileNav = (id: string) => {
    setIsMobileMenuOpen(false);
    scrollToId(id);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-100 safe-pt">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <img
                src="/ChatGPT Image Jun 24, 2025, 12_26_32 AM.png"
                alt="Trackwyze Logo"
                className="h-8 w-8"
              />
              <span className="text-lg font-bold text-gray-900 tracking-tight">Trackwyze</span>
            </div>

            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
              {NAV_LINKS.map(link => (
                <button key={link.id} onClick={() => scrollToId(link.id)} className="hover:text-gray-900 transition">
                  {link.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => navigate('/login')}
                className="hidden sm:inline-flex px-3 sm:px-4 py-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition"
              >
                <LogIn className="w-4 h-4 inline mr-1" />
                Login
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-600/20 transition"
              >
                Get Started
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(open => !open)}
                className="md:hidden p-2 -mr-2 text-gray-600 hover:text-gray-900"
                aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {isMobileMenuOpen && (
            <div className="md:hidden pb-4 flex flex-col gap-1 text-sm font-medium text-gray-700 animate-slide-up">
              {NAV_LINKS.map(link => (
                <button
                  key={link.id}
                  onClick={() => handleMobileNav(link.id)}
                  className="text-left px-2 py-2.5 rounded-lg hover:bg-gray-50"
                >
                  {link.label}
                </button>
              ))}
              <button
                onClick={() => { setIsMobileMenuOpen(false); navigate('/login'); }}
                className="text-left px-2 py-2.5 rounded-lg hover:bg-gray-50 sm:hidden"
              >
                <LogIn className="w-4 h-4 inline mr-1.5" />
                Login
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_rgba(59,130,246,0.10),_transparent_60%),radial-gradient(ellipse_at_bottom_left,_rgba(16,185,129,0.08),_transparent_60%)]"
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20 lg:pt-20 lg:pb-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold ring-1 ring-blue-100">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Built for small and growing businesses
              </div>
              <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 leading-[1.05]">
                Track Your Business.
                <span className="block text-blue-600">Know Your Profit.</span>
              </h1>
              <p className="mt-5 text-lg text-gray-600 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Manage sales, expenses, inventory, suppliers, and deliveries in one simple system.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:justify-center lg:justify-start">
                <button
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base shadow-lg shadow-blue-600/20 transition"
                >
                  Get Started for Free
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-semibold text-base transition"
                >
                  <LogIn className="w-4 h-4" />
                  Login
                </button>
              </div>

              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 justify-center lg:justify-start text-sm text-gray-600">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Free trial
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  No credit card
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Works on any device
                </span>
              </div>
            </div>

            <div className="order-first lg:order-last">
              <DashboardMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-sm text-blue-600 font-semibold tracking-wider uppercase">Features</h2>
            <p className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
              Everything you need to grow your business
            </p>
            <p className="mt-3 text-lg text-gray-600">
              One clean workspace for the numbers that actually move your business.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: BarChart3,
                tint: 'text-blue-600',
                bg: 'bg-blue-50',
                title: 'Track Profit in Real Time',
                body: 'See daily, weekly and monthly profit the moment a sale is recorded.',
              },
              {
                icon: Package,
                tint: 'text-emerald-600',
                bg: 'bg-emerald-50',
                title: 'Never Run Out of Stock',
                body: 'Live inventory levels with reorder alerts so bestsellers stay in stock.',
              },
              {
                icon: FileText,
                tint: 'text-teal-600',
                bg: 'bg-teal-50',
                title: 'Quotations, Invoices & Receipts',
                body: 'Create professional documents in seconds and track every one to payment.',
              },
              {
                icon: UserCog,
                tint: 'text-violet-600',
                bg: 'bg-violet-50',
                title: 'Team Access, Your Rules',
                body: 'Invite staff and control exactly what each person can see — including who can view buying prices and profit.',
              },
              {
                icon: Sparkles,
                tint: 'text-pink-600',
                bg: 'bg-pink-50',
                title: 'Business Insights, Not Just Numbers',
                body: 'A built-in advisor flags opportunities and risks so you know what to do next, not just what happened.',
              },
              {
                icon: Users,
                tint: 'text-orange-600',
                bg: 'bg-orange-50',
                title: 'Suppliers & Deliveries',
                body: 'Manage vendors, payments and delivery fees from one clean dashboard.',
              },
              {
                icon: Shield,
                tint: 'text-sky-600',
                bg: 'bg-sky-50',
                title: 'Your Data, Protected',
                body: 'Encrypted storage and role-based access keep your business data safe.',
              },
              {
                icon: Smartphone,
                tint: 'text-indigo-600',
                bg: 'bg-indigo-50',
                title: 'Works Everywhere You Do',
                body: 'A full desktop app plus a browser experience that stays in sync on tablet and mobile.',
              },
            ].map(({ icon: Icon, tint, bg, title, body }) => (
              <div
                key={title}
                className="group bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-gray-200 transition-all duration-200"
              >
                <div className={`inline-flex p-2.5 rounded-lg ${bg} ${tint} ring-1 ring-inset ring-black/5`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-gray-900">{title}</h3>
                <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Business Advisor */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-50 text-pink-700 text-xs font-semibold ring-1 ring-pink-100">
                <Sparkles className="w-3.5 h-3.5" />
                AI Business Advisor
              </div>
              <h2 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
                Ask your business anything
              </h2>
              <p className="mt-4 text-lg text-gray-600 leading-relaxed">
                Real answers grounded in your real TrackWyze data — not generic advice. Ask why profit
                dropped, which customers to chase for payment, or what's about to run out of stock, and
                get a straight answer with the numbers behind it.
              </p>
              <ul className="mt-6 space-y-3 text-left inline-block lg:block">
                {[
                  'Explains what happened and why, in plain language',
                  'Flags risks — like slow-paying customers — before they hurt cash flow',
                  'Recommends specific next actions, not just data',
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <ScreenshotCard
              src="/screenshots/ai-advisor.png"
              alt="AI Business Advisor chat answering 'How is my business performing?' with a health score, real figures, and specific recommendations"
              label="trackwyze.com / advisor"
              width={1068}
              height={835}
              maxWidth="max-w-md"
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-sm text-blue-600 font-semibold tracking-wider uppercase">Pricing</h2>
            <p className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
              Simple pricing that grows with you
            </p>
            <p className="mt-3 text-lg text-gray-600">
              Every plan includes full access to every feature. No hidden tiers, no feature gates.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
            <div className="rounded-2xl border border-gray-200 p-8 flex flex-col">
              <h3 className="text-lg font-bold text-gray-900">Free Trial</h3>
              <p className="mt-1 text-sm text-gray-500">Month 1</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-gray-900">KES 0</span>
              </div>
              <p className="mt-2 text-sm text-gray-600">Full access to every feature. No credit card required.</p>
              <button
                onClick={() => navigate('/login')}
                className="mt-8 w-full py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold text-sm transition"
              >
                Start Free Trial
              </button>
            </div>

            <div className="relative rounded-2xl border-2 border-blue-600 p-8 flex flex-col shadow-lg shadow-blue-600/10 md:-translate-y-2">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-semibold">
                Most Popular
              </div>
              <h3 className="text-lg font-bold text-gray-900">Early Bird</h3>
              <p className="mt-1 text-sm text-gray-500">Months 2&ndash;3</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-gray-900">KES {BILLING_PLANS['month2-3'].amount}</span>
                <span className="text-sm font-medium text-gray-500">/ month</span>
              </div>
              <p className="mt-2 text-sm text-gray-600">Everything in the trial, at a discounted rate while your business grows.</p>
              <button
                onClick={() => navigate('/login')}
                className="mt-8 w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm shadow-blue-600/20 transition"
              >
                Get Started
              </button>
            </div>

            <div className="rounded-2xl border border-gray-200 p-8 flex flex-col">
              <h3 className="text-lg font-bold text-gray-900">Regular</h3>
              <p className="mt-1 text-sm text-gray-500">Month 4 onwards</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-gray-900">KES {BILLING_PLANS['month4+'].amount}</span>
                <span className="text-sm font-medium text-gray-500">/ month</span>
              </div>
              <p className="mt-2 text-sm text-gray-600">Full price once you're established. Cancel any time, no lock-in.</p>
              <button
                onClick={() => navigate('/login')}
                className="mt-8 w-full py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold text-sm transition"
              >
                Get Started
              </button>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-gray-500">
            Pay by M-Pesa or card, or submit proof of payment manually &mdash; whatever's easiest for you.
          </p>
        </div>
      </section>

      {/* Trust / Built for section */}
      <section id="trust" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-sm text-blue-600 font-semibold tracking-wider uppercase">
                Why Trackwyze
              </h2>
              <p className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
                Built for small and growing businesses
              </p>
              <p className="mt-4 text-lg text-gray-600 leading-relaxed">
                Stop juggling spreadsheets and receipts. Trackwyze replaces them with one honest
                view of your sales, costs and profit &mdash; so you always know where your money is going.
              </p>

              <ul className="mt-6 space-y-3">
                {[
                  'Record a sale in seconds and see profit instantly',
                  'Know exactly which products and vendors make you money',
                  'Keep ad spend, delivery fees and expenses in one place',
                  'Access your data from desktop, tablet or mobile',
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{point}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex items-center gap-6 text-gray-500">
                <div className="flex items-center gap-2">
                  <Laptop className="w-5 h-5" />
                  <span className="text-sm font-medium">Desktop</span>
                </div>
                <div className="flex items-center gap-2">
                  <Tablet className="w-5 h-5" />
                  <span className="text-sm font-medium">Tablet</span>
                </div>
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  <span className="text-sm font-medium">Mobile</span>
                </div>
              </div>
            </div>

            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* Cross-device */}
      <section className="py-16 bg-gray-50 border-y border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
            Access Trackwyze from any device
          </h2>
          <p className="mt-3 text-lg text-gray-600">
            Desktop, tablet or mobile &mdash; Trackwyze runs in your browser and stays in sync on every screen.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-blue-600">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Start Tracking Today
          </h2>
          <p className="mt-4 text-lg text-blue-100">
            Join business owners who replaced the guesswork with clear numbers.
          </p>
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-white hover:bg-blue-50 text-blue-700 font-semibold text-base shadow-lg transition"
            >
              Start Tracking Today
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-gray-900 text-gray-300">
        <div className="max-w-7xl mx-auto py-14 px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-2">
                <img
                  className="h-8 w-8"
                  src="/ChatGPT Image Jun 24, 2025, 12_26_32 AM.png"
                  alt="Trackwyze"
                />
                <span className="text-lg font-bold text-white">Trackwyze</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-gray-400 max-w-sm">
                Track your business. Know your profit. A simple operating system for small and
                growing businesses.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white tracking-wider uppercase">Product</h3>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <button onClick={() => scrollToId('features')} className="hover:text-white transition">
                    Features
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollToId('pricing')} className="hover:text-white transition">
                    Pricing
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollToId('trust')} className="hover:text-white transition">
                    Why Trackwyze
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white tracking-wider uppercase">Account</h3>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <button onClick={() => navigate('/login')} className="hover:text-white transition">
                    Login
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/login')} className="hover:text-white transition">
                    Sign up
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/help')} className="hover:text-white transition">
                    Help Center
                  </button>
                </li>
                <li>
                  <a href="mailto:hello@trackwyze.app" className="hover:text-white transition">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} Trackwyze. All rights reserved.
            </p>
            <div className="flex items-center gap-5 text-sm text-gray-500">
              <button onClick={() => navigate('/terms')} className="hover:text-white transition">Terms</button>
              <button onClick={() => navigate('/privacy')} className="hover:text-white transition">Privacy</button>
              <button onClick={() => navigate('/refund')} className="hover:text-white transition">Refunds</button>
            </div>
            <p className="text-sm text-gray-500">Track Smart. Profit Wise.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
