import React, { useState, useEffect } from 'react';
import { Search, Eye, ChevronLeft, ChevronRight, User, Calendar, Phone, Mail, Shield, ShieldOff, Ban, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import toast from 'react-hot-toast';
import LoadingScreen from '../LoadingScreen';
import { updateUserSubscription } from '../../services/admin/adminService';

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_number: string;
  created_at: string;
  subscription_status: string;
  trial_start_date: string | null;
  trial_end_date: string | null;
  subscription_expiry: string | null;
  current_billing_cycle: string;
  role: string;
  last_login: string | null;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [subscriptionActionLoading, setSubscriptionActionLoading] = useState(false);
  const usersPerPage = 10;

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, statusFilter]);

  useEffect(() => {
    setTotalPages(Math.ceil(filteredUsers.length / usersPerPage));
  }, [filteredUsers]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setUsers(data || []);
      setFilteredUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(user => 
        (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.phone_number && user.phone_number.includes(searchTerm))
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => user.subscription_status === statusFilter);
    }
    
    setFilteredUsers(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const viewUserDetails = (user: UserProfile) => {
    setSelectedUser(user);
    setShowUserDetails(true);
  };

  const toggleRole = async (user: UserProfile) => {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    const verb = nextRole === 'admin' ? 'Promote to admin' : 'Demote to user';
    if (!window.confirm(`${verb}: ${user.full_name || user.email || user.id}?`)) return;

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser?.id === user.id && nextRole === 'user') {
      toast.error('You cannot demote yourself.');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role: nextRole, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) {
      toast.error(`Failed to update role: ${error.message}`);
      return;
    }

    toast.success(`Role updated to ${nextRole}.`);
    setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, role: nextRole } : u)));
    if (selectedUser?.id === user.id) {
      setSelectedUser({ ...selectedUser, role: nextRole });
    }
  };

  const applySubscriptionUpdate = async (
    user: UserProfile,
    label: string,
    update: Parameters<typeof updateUserSubscription>[1]
  ) => {
    if (!window.confirm(`${label}: ${user.full_name || user.email || user.id}?`)) return;

    setSubscriptionActionLoading(true);
    try {
      await updateUserSubscription(user.id, update);
      const patch: Partial<UserProfile> = {
        ...(update.subscriptionStatus !== undefined && { subscription_status: update.subscriptionStatus }),
        ...(update.subscriptionExpiry !== undefined && { subscription_expiry: update.subscriptionExpiry }),
        ...(update.currentBillingCycle !== undefined && { current_billing_cycle: update.currentBillingCycle }),
        ...(update.trialEndDate !== undefined && { trial_end_date: update.trialEndDate }),
      };
      setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, ...patch } : u)));
      setSelectedUser(prev => (prev && prev.id === user.id ? { ...prev, ...patch } : prev));
      toast.success(`${label} applied`);
    } catch (error: any) {
      toast.error(error?.message || `Failed to ${label.toLowerCase()}`);
    } finally {
      setSubscriptionActionLoading(false);
    }
  };

  const extendTrial = (user: UserProfile, days: number) => {
    const base = user.trial_end_date && new Date(user.trial_end_date) > new Date()
      ? new Date(user.trial_end_date)
      : new Date();
    base.setDate(base.getDate() + days);
    applySubscriptionUpdate(user, `Extend trial by ${days} days`, { trialEndDate: base.toISOString() });
  };

  const activateSubscription = (user: UserProfile, days: number, billingCycle: string) => {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    applySubscriptionUpdate(user, `Activate for ${days} days`, {
      subscriptionStatus: 'active',
      subscriptionExpiry: expiry.toISOString(),
      currentBillingCycle: billingCycle,
    });
  };

  const suspendUser = (user: UserProfile) => {
    applySubscriptionUpdate(user, 'Suspend account', { subscriptionStatus: 'suspended' });
  };

  const reactivateUser = (user: UserProfile) => {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);
    applySubscriptionUpdate(user, 'Reactivate account', {
      subscriptionStatus: 'active',
      subscriptionExpiry: expiry.toISOString(),
    });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getPaginatedUsers = () => {
    const startIndex = (currentPage - 1) * usersPerPage;
    const endIndex = startIndex + usersPerPage;
    return filteredUsers.slice(startIndex, endIndex);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'trial':
        return 'bg-blue-100 text-blue-800';
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      case 'suspended':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search users by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div className="w-full md:w-64">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Statuses</option>
            <option value="trial">Trial</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {getPaginatedUsers().length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No users found matching your criteria
                </td>
              </tr>
            ) : (
              getPaginatedUsers().map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{user.full_name || 'Unnamed User'}</div>
                        <div className="text-sm text-gray-500">{user.role === 'admin' ? 'Administrator' : 'User'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.email || 'No email'}</div>
                    <div className="text-sm text-gray-500">{user.phone_number || 'No phone'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(user.subscription_status)}`}>
                      {user.subscription_status.charAt(0).toUpperCase() + user.subscription_status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => viewUserDetails(user)}
                        className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      <button
                        onClick={() => toggleRole(user)}
                        className={`flex items-center gap-1 ${
                          user.role === 'admin'
                            ? 'text-amber-700 hover:text-amber-900'
                            : 'text-emerald-700 hover:text-emerald-900'
                        }`}
                        title={user.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                      >
                        {user.role === 'admin' ? (
                          <>
                            <ShieldOff className="w-4 h-4" />
                            Demote
                          </>
                        ) : (
                          <>
                            <Shield className="w-4 h-4" />
                            Make admin
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{(currentPage - 1) * usersPerPage + 1}</span> to{' '}
            <span className="font-medium">
              {Math.min(currentPage * usersPerPage, filteredUsers.length)}
            </span>{' '}
            of <span className="font-medium">{filteredUsers.length}</span> users
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {showUserDetails && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">User Details</h3>
                <button
                  onClick={() => setShowUserDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* User Profile */}
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900">{selectedUser.full_name || 'Unnamed User'}</h4>
                    <p className="text-sm text-gray-500">
                      {selectedUser.role === 'admin' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <Shield className="w-3 h-3 mr-1" />
                          Administrator
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                          <User className="w-3 h-3 mr-1" />
                          Regular User
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h5 className="font-medium text-gray-900 mb-3">Contact Information</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-2">
                      <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Email</p>
                        <p className="text-sm text-gray-900">{selectedUser.email || 'No email'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Phone</p>
                        <p className="text-sm text-gray-900">{selectedUser.phone_number || 'No phone'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h5 className="font-medium text-gray-900 mb-3">Account Information</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-2">
                      <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Joined</p>
                        <p className="text-sm text-gray-900">{formatDate(selectedUser.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Last Login</p>
                        <p className="text-sm text-gray-900">{selectedUser.last_login ? formatDate(selectedUser.last_login) : 'Never'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subscription Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h5 className="font-medium text-gray-900 mb-3">Subscription Information</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Status</p>
                      <p className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(selectedUser.subscription_status)}`}>
                        {selectedUser.subscription_status.charAt(0).toUpperCase() + selectedUser.subscription_status.slice(1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Billing Cycle</p>
                      <p className="text-sm text-gray-900">
                        {selectedUser.current_billing_cycle === 'trial' ? 'Free Trial' :
                         selectedUser.current_billing_cycle === 'month2-3' ? 'Months 2-3 (KES 500/month)' :
                         selectedUser.current_billing_cycle === 'month4+' ? 'Month 4+ (KES 1000/month)' : 'Unknown'}
                      </p>
                    </div>
                    {selectedUser.subscription_status === 'trial' && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Trial Ends</p>
                        <p className="text-sm text-gray-900">{formatDate(selectedUser.trial_end_date)}</p>
                      </div>
                    )}
                    {selectedUser.subscription_expiry && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Subscription Expires</p>
                        <p className="text-sm text-gray-900">{formatDate(selectedUser.subscription_expiry)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Manual Subscription Controls */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h5 className="font-medium text-gray-900 mb-1">Subscription Actions</h5>
                  <p className="text-xs text-gray-500 mb-3">
                    Use these to manually grant or restrict access while billing is handled manually (e.g. after confirming an M-Pesa payment).
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.subscription_status === 'trial' && (
                      <button
                        onClick={() => extendTrial(selectedUser, 14)}
                        disabled={subscriptionActionLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
                      >
                        <Clock className="w-4 h-4" />
                        Extend trial 14 days
                      </button>
                    )}
                    <button
                      onClick={() => activateSubscription(selectedUser, 30, 'month2-3')}
                      disabled={subscriptionActionLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Activate 30 days
                    </button>
                    {selectedUser.subscription_status === 'suspended' ? (
                      <button
                        onClick={() => reactivateUser(selectedUser)}
                        disabled={subscriptionActionLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Reactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => suspendUser(selectedUser)}
                        disabled={subscriptionActionLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 disabled:opacity-50"
                      >
                        <Ban className="w-4 h-4" />
                        Suspend
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowUserDetails(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;