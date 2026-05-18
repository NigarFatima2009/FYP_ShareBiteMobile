'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';
import { IoStatsChart, IoCheckmarkCircle, IoCar, IoPeople, IoMenu, IoClose } from 'react-icons/io5';
import { Toaster } from 'react-hot-toast';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/');
        return;
      }

      try {
        // ✅ SECURITY: Verify user has admin role
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();

        // TEMPORARY BYPASS: Allow admin@sharebite.com or specific UID access even if role is missing
        const isSpecialAdmin =
          user.email?.trim().toLowerCase() === 'admin@sharebite.com' ||
          user.uid === 'oTjSOIKPRMetFbXG1LQ4bzo1rXq1';

        if ((!userData || userData.role !== 'admin') && !isSpecialAdmin) {
          console.warn('Unauthorized access attempt to admin panel');
          await signOut(auth);
          router.push('/?error=unauthorized');
          return;
        }

        setLoading(false);
      } catch (error) {
        console.error('Error verifying admin role:', error);
        await signOut(auth);
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const navItems = [
    { href: '/dashboard', label: 'Overview', icon: IoStatsChart },
    { href: '/dashboard/ngo-verification', label: 'NGO Verification', icon: IoCheckmarkCircle },
    { href: '/dashboard/donor-verification', label: 'Donor Verification', icon: IoCheckmarkCircle },
    { href: '/dashboard/volunteer-verification', label: 'Volunteer Verification', icon: IoCar },
    { href: '/dashboard/users', label: 'Users', icon: IoPeople },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#4ade80',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white shadow-md z-50 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-blue-600">ShareBite</h1>
          <p className="text-xs text-gray-600">Admin Panel</p>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          {sidebarOpen ? <IoClose className="w-6 h-6" /> : <IoMenu className="w-6 h-6" />}
        </button>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed left-0 top-0 h-full w-64 bg-white shadow-lg z-50 transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold text-blue-600">ShareBite</h1>
          <p className="text-sm text-gray-600">Admin Panel</p>
        </div>

        <nav className="p-4">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${pathname === item.href
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
                  }`}
              >
                <IconComponent className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
