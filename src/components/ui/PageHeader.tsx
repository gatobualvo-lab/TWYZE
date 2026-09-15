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

/** The title-card every feature page opens with — icon, heading, one-line explanation, and optional right-aligned actions (a button, nav controls). `children` renders below the header row for things like tabs or filters. */
const PageHeader: React.FC<PageHeaderProps> = ({ icon: Icon, iconColor = 'text-blue-600', title, description, actions, children }) => (
  <Card>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Icon className={`w-5 h-5 ${iconColor}`} /> {title}
        </h2>
        {description && <p className="text-gray-500 text-sm mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
    {children}
  </Card>
);

export default PageHeader;
