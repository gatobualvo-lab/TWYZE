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

/** The icon-tile + label + value pattern used for every KPI number in the app (today's sales, outstanding balance, health score factors, etc.). */
const StatCard: React.FC<StatCardProps> = ({ icon: Icon, iconBg, iconColor, label, value, sublabel, onClick }) => (
  <Card padding="sm" hoverable={!!onClick} onClick={onClick}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${iconBg}`}>
      <Icon className={`w-[18px] h-[18px] ${iconColor}`} />
    </div>
    <p className="text-xs font-medium text-gray-500 tracking-wide">{label}</p>
    <p className="font-display text-xl font-bold text-gray-900 tabular-nums mt-0.5">{value}</p>
    {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
  </Card>
);

export default StatCard;
