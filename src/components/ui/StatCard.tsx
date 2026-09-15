import React from 'react';
import Card from './Card';

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  onClick?: () => void;
}

/** The icon-circle + label + value pattern used for every KPI number in the app (today's sales, outstanding balance, health score factors, etc.). */
const StatCard: React.FC<StatCardProps> = ({ icon: Icon, iconBg, iconColor, label, value, sublabel, onClick }) => (
  <Card padding="sm" hoverable={!!onClick} onClick={onClick}>
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 ${iconBg}`}>
      <Icon className={`w-4 h-4 ${iconColor}`} />
    </div>
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-lg font-bold text-gray-900 tabular-nums mt-0.5">{value}</p>
    {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
  </Card>
);

export default StatCard;
