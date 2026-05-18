'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Volunteer } from '@/types';
import toast from 'react-hot-toast';

export default function VolunteerVerificationPage() {
  const [pendingVolunteers, setPendingVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);
  const [previewDocument, setPreviewDocument] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchPendingVolunteers();
  }, []);

  const fetchPendingVolunteers = async () => {
    try {
      // Method 1: Check users collection with verificationStatus
      const q1 = query(
        collection(db, 'users'),
        where('userType', '==', 'volunteer'),
        where('verificationStatus', '==', 'pending')
      );
      const snapshot1 = await getDocs(q1);
      const volunteersFromUsers = snapshot1.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      })) as Volunteer[];

      // Method 2: Check users collection with verified: false
      const q2 = query(
        collection(db, 'users'),
        where('userType', '==', 'volunteer'),
        where('verified', '==', false)
      );
      const snapshot2 = await getDocs(q2);
      const volunteersUnverified = snapshot2.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      })) as Volunteer[];

      // Method 3: Check volunteerVerification collection
      const q3 = query(
        collection(db, 'volunteerVerification'),
        where('status', '==', 'pending')
      );
      const snapshot3 = await getDocs(q3);
      const volunteersFromVerification = await Promise.all(
        snapshot3.docs.map(async (verDoc) => {
          const userId = verDoc.id;
          const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', userId)));
          if (userDoc.docs.length > 0) {
            return {
              uid: userId,
              ...userDoc.docs[0].data(),
              ...verDoc.data(),
            } as Volunteer;
          }
          return null;
        })
      );

      // Combine all results and remove duplicates
      const allVolunteers = [
        ...volunteersFromUsers,
        ...volunteersUnverified,
        ...volunteersFromVerification.filter(v => v !== null),
      ];

      // Remove duplicates by uid
      const uniqueVolunteers = Array.from(
        new Map(allVolunteers.map(v => [v.uid, v])).values()
      ).filter(v => v.verificationStatus === 'pending');

      console.log('Found pending Volunteers:', uniqueVolunteers.length);
      setPendingVolunteers(uniqueVolunteers);
    } catch (error) {
      console.error('Error fetching Volunteers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (volunteerId: string, status: 'approved' | 'rejected', reason?: string) => {
    try {
      // Update users collection
      const volunteerRef = doc(db, 'users', volunteerId);
      const updateData: any = {
        verificationStatus: status,
        verified: status === 'approved',
        volunteerVerified: status === 'approved',
        verifiedAt: new Date().toISOString(),
        verifiedBy: 'admin',
      };

      if (status === 'rejected' && reason) {
        updateData.rejectionReason = reason;
        updateData.rejectedAt = new Date().toISOString();
      }

      await updateDoc(volunteerRef, updateData);

      // Also update volunteerVerification collection
      try {
        const verificationRef = doc(db, 'volunteerVerification', volunteerId);
        const verificationUpdateData: any = {
          status: status,
          verifiedAt: new Date().toISOString(),
          verifiedBy: 'admin',
        };

        if (status === 'rejected' && reason) {
          verificationUpdateData.rejectionReason = reason;
          verificationUpdateData.rejectedAt = new Date().toISOString();
        }

        await updateDoc(verificationRef, verificationUpdateData);
      } catch {
        console.log('No volunteerVerification doc to update');
      }

      // Send notification
      try {
        const notificationData: any = {
          userId: volunteerId,
          type: status === 'approved' ? 'verification_approved' : 'verification_rejected',
          title: status === 'approved' ? 'Verification Approved!' : 'Application Rejected',
          message: status === 'approved'
            ? 'Congratulations! Your volunteer account has been verified. You can now start taking delivery requests.'
            : `Your volunteer verification has been rejected. Reason: ${reason || 'Please contact support.'}`,
          read: false,
          createdAt: new Date().toISOString(),
          data: {
            verificationStatus: status,
            ...(status === 'rejected' && reason ? { rejectionReason: reason } : {}),
          },
        };
        await addDoc(collection(db, 'notifications'), notificationData);
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
      }

      setPendingVolunteers(pendingVolunteers.filter((v) => v.uid !== volunteerId));
      setSelectedVolunteer(null);
      setShowRejectModal(false);
      setRejectionReason('');

      toast.success(`Volunteer ${status === 'approved' ? 'approved' : 'rejected'} successfully!`);
      fetchPendingVolunteers();
    } catch (error) {
      console.error('Error updating Volunteer:', error);
      toast.error('Failed to update Volunteer status');
    }
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    if (selectedVolunteer) {
      handleVerification(selectedVolunteer.uid, 'rejected', rejectionReason);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading Volunteer applications...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Volunteer Verification</h1>

      {/* Document Preview Modal */}
      {previewDocument && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewDocument(null)}
        >
          <div className="relative max-w-6xl max-h-[90vh] w-full bg-white rounded-lg overflow-hidden flex flex-col pt-12">
            <button
              onClick={() => setPreviewDocument(null)}
              className="absolute top-2 right-4 z-10 bg-red-600 text-white px-4 py-1.5 rounded-lg hover:bg-red-700 text-sm font-medium"
            >
              Close
            </button>
            {previewDocument.toLowerCase().endsWith('.pdf') ? (
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewDocument)}&embedded=true`}
                className="w-full flex-1"
                title="Document Preview"
              />
            ) : (
              <img
                src={previewDocument}
                className="w-full h-full object-contain"
                alt="Document Preview"
              />
            )}
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {showRejectModal && selectedVolunteer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Reject Application</h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for rejecting <strong>{selectedVolunteer.name}</strong>'s application.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full border border-gray-300 rounded-lg p-3 mb-4 min-h-[120px]"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowRejectModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg">Cancel</button>
              <button onClick={handleReject} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg">Reject</button>
            </div>
          </div>
        </div>
      )}

      {pendingVolunteers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-600">No pending volunteer verifications</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {pendingVolunteers.map((volunteer) => (
              <div
                key={volunteer.uid}
                onClick={() => setSelectedVolunteer(volunteer)}
                className={`bg-white rounded-lg shadow-md p-6 cursor-pointer transition-all ${selectedVolunteer?.uid === volunteer.uid ? 'ring-2 ring-blue-500' : 'hover:shadow-lg'}`}
              >
                <h3 className="text-xl font-semibold text-gray-800">{volunteer.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{volunteer.email}</p>
                {volunteer.phone && <p className="text-sm text-gray-500">{volunteer.phone}</p>}
                <p className="text-xs text-gray-400 mt-3">Applied: {volunteer.createdAt ? new Date(volunteer.createdAt).toLocaleDateString() : 'N/A'}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 sticky top-8 h-fit max-h-[calc(100vh-100px)] overflow-y-auto">
            {selectedVolunteer ? (
              <div>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">{selectedVolunteer.name}</h2>
                <div className="space-y-3 mb-6">
                  <div><p className="text-sm text-gray-600">Email</p><p className="font-medium">{selectedVolunteer.email}</p></div>
                  {selectedVolunteer.phone && <div><p className="text-sm text-gray-600">Phone</p><p className="font-medium">{selectedVolunteer.phone}</p></div>}
                  {selectedVolunteer.address && <div><p className="text-sm text-gray-600">Address</p><p className="font-medium">{selectedVolunteer.address}</p></div>}
                  {selectedVolunteer.hasVehicle !== undefined && (
                    <div><p className="text-sm text-gray-600">Has Vehicle</p><p className="font-medium">{selectedVolunteer.hasVehicle ? 'Yes' : 'No'}</p></div>
                  )}
                  {selectedVolunteer.vehicleType && <div><p className="text-sm text-gray-600">Vehicle Type</p><p className="font-medium">{selectedVolunteer.vehicleType}</p></div>}
                  {selectedVolunteer.licenseNumber && <div><p className="text-sm text-gray-600">License Number</p><p className="font-medium">{selectedVolunteer.licenseNumber}</p></div>}
                </div>

                {selectedVolunteer.documents && selectedVolunteer.documents.length > 0 ? (
                  <div className="mb-6">
                    <p className="text-sm text-gray-600 font-semibold mb-3">📄 Documents ({selectedVolunteer.documents.length})</p>
                    <div className="space-y-2">
                      {selectedVolunteer.documents.map((doc: any, index: number) => {
                        const docUrl = typeof doc === 'string' ? doc : (doc?.uri || doc?.url || '');
                        return (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">Document {index + 1}</p>
                                <p className="text-xs text-gray-500">{typeof doc === 'string' ? 'PDF/Image' : doc.type || 'Document'}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setPreviewDocument(docUrl)} className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg">Preview</button>
                              <a href={docUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-gray-600 text-white text-sm rounded-lg">Open</a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-yellow-800 text-sm">⚠️ No documents uploaded</div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => handleVerification(selectedVolunteer.uid, 'approved')} className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium">Approve</button>
                  <button onClick={() => setShowRejectModal(true)} className="flex-1 bg-red-600 text-white py-3 rounded-lg font-medium">Reject</button>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">Select a volunteer to view details</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
