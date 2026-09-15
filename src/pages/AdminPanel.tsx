import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Shield,
  LogOut,
  Home,
  Users,
  Settings,
  BarChart3,
  CreditCard,
  TrendingUp,
  Activity,
  ScrollText,
  AlertTriangle,
  Send
} from 'lucide-react';
import UserManagement from '../components/admin/UserManagement';
import SystemSettings from '../components/admin/SystemSettings';
import PaymentApprovals from '../components/admin/PaymentApprovals';
import AuditLogViewer from '../components/admin/AuditLogViewer';
import BroadcastEmail from '../components/admin/BroadcastEmail';
import { fetchPlatformStats } from '../services/admin/adminService';
import type { PlatformStats } from '../services/admin/adminService';
import { formatCurrency } from '../utils/format';
import toast from 'react-hot-toast';

type AdminTab = 'overview' | 'users' | 'payments' | 'audit' | 'settings' | 'broadcast';

export default function AdminPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<PlatformStats>({
    totalUsers: 0,
    activeUsers: 0,
    trialUsers: 0,
    suspendedUsers: 0,
    expiredUsers: 0,
    pendingPayments: 0,
    monthRevenue: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setStats(await fetchPlatformStats());
    } catch (error: any) {
      console.error('Error loading stats:', error);
      toast.error('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleGoToApp = () => {
    navigate('/app');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Admin Dashboard</h1>
                <p className="text-sm text-slate-600">TrackWyze Administration</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleGoToApp}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Home className="w-4 h-4" />
                Go to App
              </button>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-2">
              <button
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                  activeTab === 'overview'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <BarChart3 className="w-5 h-5" />
                <span>Overview</span>
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                  activeTab === 'users'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Users className="w-5 h-5" />
                <span>User Management</span>
              </button>

              <button
                onClick={() => setActiveTab('payments')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                  activeTab === 'payments'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span className="flex-1 text-left">Payment Approvals</span>
                {stats.pendingPayments > 0 && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    activeTab === 'payments' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'
                  }`}>
                    {stats.pendingPayments}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('audit')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                  activeTab === 'audit'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <ScrollText className="w-5 h-5" />
                <span>Audit Log</span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                  activeTab === 'settings'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Settings className="w-5 h-5" />
                <span>System Settings</span>
              </button>

              <button
                onClick={() => setActiveTab('broadcast')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                  activeTab === 'broadcast'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Send className="w-5 h-5" />
                <span>Broadcast Email</span>
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">System Overview</h2>
                  <p className="text-slate-600">Monitor your platform's key metrics and performance</p>
                </div>

                {stats.pendingPayments > 0 && (
                  <button
                    onClick={() => setActiveTab('payments')}
                    className="w-full flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 hover:bg-amber-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-100">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-900">
                          {stats.pendingPayments} payment{stats.pendingPayments === 1 ? '' : 's'} awaiting review
                        </h4>
                        <p className="text-sm text-slate-600">Approve or reject submitted proof of payment</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-amber-700">Review now →</span>
                  </button>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 rounded-lg bg-blue-100">
                        <Users className="w-6 h-6 text-blue-600" />
                      </div>
                      <TrendingUp className="w-5 h-5 text-green-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-1">{stats.totalUsers}</h3>
                    <p className="text-sm text-slate-600">Total Users</p>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 rounded-lg bg-green-100">
                        <Activity className="w-6 h-6 text-green-600" />
                      </div>
                      <TrendingUp className="w-5 h-5 text-green-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-1">{stats.activeUsers}</h3>
                    <p className="text-sm text-slate-600">Active Subscribers</p>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 rounded-lg bg-yellow-100">
                        <CreditCard className="w-6 h-6 text-yellow-600" />
                      </div>
                      <Activity className="w-5 h-5 text-blue-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-1">{stats.trialUsers}</h3>
                    <p className="text-sm text-slate-600">Trial Users</p>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 rounded-lg bg-emerald-100">
                        <TrendingUp className="w-6 h-6 text-emerald-600" />
                      </div>
                      <TrendingUp className="w-5 h-5 text-green-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-1">
                      {formatCurrency(stats.monthRevenue)}
                    </h3>
                    <p className="text-sm text-slate-600">Revenue This Month</p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => setActiveTab('users')}
                      className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="p-2 rounded-lg bg-blue-100">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-900">Manage Users</h4>
                        <p className="text-sm text-slate-600">View and manage user accounts</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('payments')}
                      className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="p-2 rounded-lg bg-yellow-100">
                        <CreditCard className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-900">Payment Approvals</h4>
                        <p className="text-sm text-slate-600">Review submitted proof of payment</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('audit')}
                      className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="p-2 rounded-lg bg-indigo-100">
                        <ScrollText className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-900">Audit Log</h4>
                        <p className="text-sm text-slate-600">See who changed what, and when</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('settings')}
                      className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="p-2 rounded-lg bg-slate-100">
                        <Settings className="w-5 h-5 text-slate-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-900">System Settings</h4>
                        <p className="text-sm text-slate-600">Configure system preferences</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">System Status</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium text-slate-900">Database</span>
                      </div>
                      <span className="text-sm text-green-600 font-medium">Operational</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium text-slate-900">Authentication</span>
                      </div>
                      <span className="text-sm text-green-600 font-medium">Operational</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium text-slate-900">API Services</span>
                      </div>
                      <span className="text-sm text-green-600 font-medium">Operational</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <UserManagement />
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <PaymentApprovals />
              </div>
            )}

            {activeTab === 'audit' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <AuditLogViewer />
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <SystemSettings />
              </div>
            )}

            {activeTab === 'broadcast' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <BroadcastEmail />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
