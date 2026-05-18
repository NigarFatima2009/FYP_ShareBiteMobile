'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { IoPeople, IoRestaurant, IoCube, IoHourglass, IoCar, IoCheckmarkDone } from 'react-icons/io5';

interface Stats {
  totalUsers: number;
  totalDonations: number;
  activeDonations: number;
  pendingNGOs: number;
  pendingDonors: number;
  pendingVolunteers: number;
  activeDeliveries: number;
  completedDeliveries: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalDonations: 0,
    activeDonations: 0,
    pendingNGOs: 0,
    pendingDonors: 0,
    pendingVolunteers: 0,
    activeDeliveries: 0,
    completedDeliveries: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch users count
        const usersSnap = await getDocs(collection(db, 'users'));
        const totalUsers = usersSnap.size;

        // Fetch pending NGOs
        const ngosQuery = query(
          collection(db, 'users'),
          where('userType', '==', 'ngo'),
          where('verificationStatus', '==', 'pending')
        );
        const ngosSnap = await getDocs(ngosQuery);
        const pendingNGOs = ngosSnap.size;

        // Fetch pending Donors
        const donorsQuery = query(
          collection(db, 'users'),
          where('userType', '==', 'donor'),
          where('verificationStatus', '==', 'pending')
        );
        const donorsSnap = await getDocs(donorsQuery);
        const pendingDonors = donorsSnap.size;

        // Fetch pending Volunteers
        const volunteersQuery = query(
          collection(db, 'users'),
          where('userType', '==', 'volunteer'),
          where('verificationStatus', '==', 'pending')
        );
        const volunteersSnap = await getDocs(volunteersQuery);
        const pendingVolunteers = volunteersSnap.size;

        // Fetch donations
        const donationsSnap = await getDocs(collection(db, 'donations'));
        const totalDonations = donationsSnap.size;
        const activeDonations = donationsSnap.docs.filter(
          (doc) => doc.data().status === 'available' || doc.data().status === 'claimed'
        ).length;

        // Fetch deliveries
        const deliveriesSnap = await getDocs(collection(db, 'deliveries'));
        const activeDeliveries = deliveriesSnap.docs.filter(
          (doc) => doc.data().status === 'in_progress'
        ).length;
        const completedDeliveries = deliveriesSnap.docs.filter(
          (doc) => doc.data().status === 'completed'
        ).length;

        setStats({
          totalUsers,
          totalDonations,
          activeDonations,
          pendingNGOs,
          pendingDonors,
          pendingVolunteers,
          activeDeliveries,
          completedDeliveries,
        });
      } catch (error: any) {
        console.error('Error fetching stats:', error);
        setError(`Permission Denied: ${error.message}. Please ensure your UID (oTjSOIKPRMetFbXG1LQ4bzo1rXq1) has the 'role: admin' field in Firestore.`);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, color: 'bg-blue-500', icon: IoPeople },
    { label: 'Total Donations', value: stats.totalDonations, color: 'bg-green-500', icon: IoRestaurant },
    { label: 'Active Donations', value: stats.activeDonations, color: 'bg-yellow-500', icon: IoCube },
    { label: 'Pending NGO Verifications', value: stats.pendingNGOs, color: 'bg-orange-500', icon: IoHourglass },
    { label: 'Active Deliveries', value: stats.activeDeliveries, color: 'bg-purple-500', icon: IoCar },
    { label: 'Completed Deliveries', value: stats.completedDeliveries, color: 'bg-teal-500', icon: IoCheckmarkDone },
  ];

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Dashboard Overview</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 font-bold mb-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Database Access Error
          </div>
          <p>{error}</p>
          <div className="mt-4 p-3 bg-red-50 rounded border border-red-200 text-sm">
            <strong>How to fix:</strong> Go to Firebase Console &gt; Firestore &gt; Users &gt; Find UID: <strong>oTjSOIKPRMetFbXG1LQ4bzo1rXq1</strong> &gt; Add field <strong>role</strong> (string) = <strong>admin</strong>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card) => {
          const IconComponent = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm mb-1">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-800">{card.value}</p>
                </div>
                <div className={`${card.color} w-16 h-16 rounded-full flex items-center justify-center`}>
                  <IconComponent className="w-8 h-8 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <a
            href="/dashboard/ngo-verification"
            className="p-4 border-2 border-orange-200 rounded-lg hover:bg-orange-50 transition-colors flex flex-col justify-center"
          >
            <h3 className="font-semibold text-orange-600">Review NGO Applications</h3>
            <p className="text-sm text-gray-600 mt-1">{stats.pendingNGOs} pending verifications</p>
          </a>
          
          <a
            href="/dashboard/donor-verification"
            className="p-4 border-2 border-green-200 rounded-lg hover:bg-green-50 transition-colors flex flex-col justify-center"
          >
            <h3 className="font-semibold text-green-600">Review Donor Applications</h3>
            <p className="text-sm text-gray-600 mt-1">{stats.pendingDonors} pending verifications</p>
          </a>

          <a
            href="/dashboard/volunteer-verification"
            className="p-4 border-2 border-purple-200 rounded-lg hover:bg-purple-50 transition-colors flex flex-col justify-center"
          >
            <h3 className="font-semibold text-purple-600">Review Volunteer Applications</h3>
            <p className="text-sm text-gray-600 mt-1">{stats.pendingVolunteers} pending verifications</p>
          </a>

          <a
            href="/dashboard/users"
            className="p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition-colors flex flex-col justify-center"
          >
            <h3 className="font-semibold text-blue-600">Manage Users</h3>
            <p className="text-sm text-gray-600 mt-1">{stats.totalUsers} registered users</p>
          </a>
        </div>
      </div>
    </div>
  );
}
