import React from 'react';
import Card from './Card';

interface PageHeaderProps {
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

const DEFAULT_ICON_COLOR = 'text-blue-600';

/** The title-card every feature page opens with — icon, heading, one-line explanation, and optional right-aligned actions (a button, nav controls). `children` renders below the header row for things like tabs or filters. */
const PageHeader: React.FC<PageHeaderProps> = ({ icon: Icon, iconColor = DEFAULT_ICON_COLOR, title, description, actions, children }) => {
  const branded = iconColor === DEFAULT_ICON_COLOR;
  return (
    <Card className="relative overflow-hidden animate-slide-up">
      {/* A faint brand wash in the corner so headers don't read as plain white boxes. */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-12 w-56 h-56 rounded-full bg-blue-400/10 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <span
            className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${
              branded ? 'bg-gradient-to-br from-blue-500 to-blue-700 shadow-glow' : 'bg-gray-50 ring-1 ring-gray-200'
            }`}
          >
            <Icon className={`w-5 h-5 ${branded ? 'text-white' : iconColor}`} />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-gray-900 leading-tight">{title}</h2>
            {description && <p className="text-gray-500 text-sm mt-0.5">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="relative">{children}</div>}
    </Card>
  );
};

export default PageHeader;
