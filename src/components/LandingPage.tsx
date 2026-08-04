import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Package,
  Shield,
  Users,
  LogIn,
  ArrowRight,
  TrendingUp,
  Receipt,
  CheckCircle2,
  Smartphone,
  Laptop,
  Tablet,
} from 'lucide-react';

const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const DashboardMockup: React.FC = () => (
  <div className="relative w-full max-w-xl mx-auto">
    <div className="absolute -inset-4 bg-gradient-to-tr from-blue-200/60 via-sky-100/40 to-emerald-100/40 blur-2xl rounded-3xl" />
    <div className="relative bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200/70 overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <div className="ml-3 text-xs font-medium text-gray-500">trackwyze.app / dashboard</div>
      </div>

      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Overview</div>
            <div className="text-lg font-bold text-gray-900">Today at a glance</div>
          </div>
          <div className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
            Live
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 p-3">
            <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              Profit
            </div>
            <div className="mt-2 text-xl font-extrabold text-gray-900">KES 48,200</div>
            <div className="text-xs text-emerald-600 font-medium mt-0.5">+12.4% vs yesterday</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-blue-50 to-white border border-blue-100 p-3">
            <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold">
              <BarChart3 className="w-3.5 h-3.5" />
              Sales
            </div>
            <div className="mt-2 text-xl font-extrabold text-gray-900">KES 182,900</div>
            <div className="text-xs text-blue-600 font-medium mt-0.5">34 orders today</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-orange-50 to-white border border-orange-100 p-3">
            <div className="flex items-center gap-2 text-orange-700 text-xs font-semibold">
              <Receipt className="w-3.5 h-3.5" />
              Expenses
            </div>
            <div className="mt-2 text-xl font-extrabold text-gray-900">KES 22,450</div>
            <div className="text-xs text-orange-600 font-medium mt-0.5">Ads + vendors</div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-gray-800">Revenue this week</div>
            <div className="text-xs text-gray-400">Mon - Sun</div>
          </div>
          <div className="flex items-end gap-2 h-24">
            {[40, 62, 48, 78, 56, 90, 72].map((h, i) => (
              <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-blue-500 to-sky-400" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Package className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <div className="text-xs text-gray-500">In stock</div>
              <div className="text-sm font-bold text-gray-900">128 SKUs</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <div className="text-xs text-gray-500">Suppliers</div>
              <div className="text-sm font-bold text-gray-900">12 active</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-100">
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
              <button onClick={() => scrollToId('features')} className="hover:text-gray-900 transition">
                Features
              </button>
              <button onClick={() => scrollToId('trust')} className="hover:text-gray-900 transition">
                Why Trackwyze
              </button>
              <button onClick={() => scrollToId('contact')} className="hover:text-gray-900 transition">
                Contact
              </button>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => navigate('/login')}
                className="px-3 sm:px-4 py-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition"
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
            </div>
          </div>
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
                icon: Shield,
                tint: 'text-sky-600',
                bg: 'bg-sky-50',
                title: 'Your Data, Protected',
                body: 'Encrypted storage and role-based access keep your business data safe.',
              },
              {
                icon: Users,
                tint: 'text-orange-600',
                bg: 'bg-orange-50',
                title: 'Suppliers & Deliveries',
                body: 'Manage vendors, payments and delivery fees from one clean dashboard.',
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
            <p className="text-sm text-gray-500">Track Smart. Profit Wise.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
