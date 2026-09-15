import React from 'react';
import { BarChart3, Plus, Package, Wallet, Menu } from 'lucide-react';

// The sidebar (hamburger → collapsible groups) makes sense on desktop, but
// on a phone-first market it means every single action is 2+ taps away
// behind a drawer. This surfaces the handful of things a business owner
// does constantly — record a sale, check stock, check money owed — as one
// tap, with "More" opening the existing full sidebar for everything else.

interface MobileBottomNavProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  onMore: () => void;
}

const TABS: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Home', icon: BarChart3 },
  { id: 'add-sale', label: 'Sale', icon: Plus },
  { id: 'inventory', label: 'Stock', icon: Package },
  { id: 'cash-position', label: 'Money', icon: Wallet },
];

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab, onNavigate, onMore }) => (
  <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 safe-pb">
    <div className="flex items-stretch justify-around">
      {TABS.map(tab => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            className={`flex flex-col items-center justify-center gap-0.5 py-2 flex-1 min-h-[56px] transition-colors active:scale-95 ${
              isActive ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        );
      })}
      <button
        onClick={onMore}
        className="flex flex-col items-center justify-center gap-0.5 py-2 flex-1 min-h-[56px] text-gray-500 transition-colors active:scale-95"
      >
        <Menu className="w-5 h-5" />
        <span className="text-[10px] font-medium">More</span>
      </button>
    </div>
  </nav>
);

export default MobileBottomNav;
