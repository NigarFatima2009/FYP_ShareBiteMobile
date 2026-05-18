'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Delivery } from '@/types';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'in_progress' | 'completed' | 'pending'>('all');

  useEffect(() => {
    // Always fetch all deliveries and filter client-side
    // This ensures we see all deliveries regardless of status field variations
    const q = collection(db, 'deliveries');

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let deliveriesData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Normalize status field - handle different possible values
          status: data.status || 'pending',
        };
      }) as Delivery[];
      
      // Apply filter client-side
      if (filter !== 'all') {
        deliveriesData = deliveriesData.filter(d => d.status === filter);
      }
      
      // Sort by most recent first (check multiple date fields)
      deliveriesData.sort((a, b) => {
        const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 
                     a.startedAt ? new Date(a.startedAt).getTime() : 0;
        const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 
                     b.startedAt ? new Date(b.startedAt).getTime() : 0;
        return dateB - dateA;
      });
      
      console.log(`Loaded ${deliveriesData.length} deliveries (filter: ${filter})`);
      setDeliveries(deliveriesData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching deliveries:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [filter]);

  if (loading) {
    return <div className="text-center py-12">Loading deliveries...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Delivery Tracking</h1>
        
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('in_progress')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'in_progress'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            Active ({deliveries.filter(d => d.status === 'in_progress').length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'completed'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            Completed ({deliveries.filter(d => d.status === 'completed').length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'pending'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            Pending ({deliveries.filter(d => d.status === 'pending').length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            All ({deliveries.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Delivery List */}
        <div className="space-y-4">
          {deliveries.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-600">
              No deliveries found
            </div>
          ) : (
            deliveries.map((delivery) => (
              <div
                key={delivery.id}
                onClick={() => setSelectedDelivery(delivery)}
                className={`bg-white rounded-lg shadow-md p-4 cursor-pointer transition-all ${
                  selectedDelivery?.id === delivery.id ? 'ring-2 ring-blue-500' : 'hover:shadow-lg'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-gray-800">{delivery.volunteerName}</h3>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      delivery.status === 'in_progress'
                        ? 'bg-yellow-100 text-yellow-800'
                        : delivery.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {delivery.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-1">
                  From: {delivery.pickupLocation.address}
                </p>
                <p className="text-sm text-gray-600">
                  To: {delivery.dropoffLocation.address}
                </p>
                {delivery.startedAt && (
                  <p className="text-xs text-gray-400 mt-2">
                    Started: {new Date(delivery.startedAt).toLocaleString()}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Map View */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md overflow-hidden" style={{ height: '600px' }}>
            <MapView deliveries={deliveries} selectedDelivery={selectedDelivery} />
          </div>
          
          {selectedDelivery && (
            <div className="bg-white rounded-lg shadow-md p-6 mt-4">
              <h3 className="text-xl font-bold mb-4 text-gray-800">Delivery Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Volunteer</p>
                  <p className="font-medium">{selectedDelivery.volunteerName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="font-medium capitalize">{selectedDelivery.status.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Pickup Location</p>
                  <p className="font-medium">{selectedDelivery.pickupLocation.address}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Dropoff Location</p>
                  <p className="font-medium">{selectedDelivery.dropoffLocation.address}</p>
                </div>
                {selectedDelivery.startedAt && (
                  <div>
                    <p className="text-sm text-gray-600">Started At</p>
                    <p className="font-medium">{new Date(selectedDelivery.startedAt).toLocaleString()}</p>
                  </div>
                )}
                {selectedDelivery.completedAt && (
                  <div>
                    <p className="text-sm text-gray-600">Completed At</p>
                    <p className="font-medium">{new Date(selectedDelivery.completedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
