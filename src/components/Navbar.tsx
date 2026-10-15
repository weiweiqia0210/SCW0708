import React from 'react';
import { Home, Sparkles, BookMarked, Settings, User } from 'lucide-react';
import { ActiveNavTab } from '../types';

interface NavbarProps {
  activeTab: ActiveNavTab;
  onTabChange: (tab: ActiveNavTab) => void;
  className?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange, className = '' }) => {
  const tabs: { id: ActiveNavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: '首页', icon: Home },
    { id: 'create', label: '创作', icon: Sparkles },
    { id: 'shelf', label: '书架', icon: BookMarked },
    { id: 'settings', label: '设置', icon: Settings },
    { id: 'profile', label: '我的', icon: User },
  ];

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-sky-100 shadow-[0_-2px_12px_rgba(186,230,253,0.2)] safe-area-pb ${className}`}
    >
      <div className="max-w-xl mx-auto px-3 py-1 flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-200 relative ${
                isActive
                  ? 'text-sky-600 font-medium'
                  : 'text-slate-400 hover:text-slate-600 active:scale-95'
              }`}
            >
              {isActive && (
                <span className="absolute -top-1 w-7 h-1 bg-sky-500 rounded-full shadow-[0_1px_4px_rgba(14,165,233,0.5)]" />
              )}
              <div
                className={`p-1 rounded-lg transition-colors ${
                  isActive ? 'bg-sky-50 text-sky-600' : ''
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
              </div>
              <span className="text-[11px] mt-0.5 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
