'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { NGO } from '@/types';
import toast from 'react-hot-toast';

export default function NGOVerificationPage() {
  const [pendingNGOs, setPendingNGOs] = useState<NGO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNGO, setSelectedNGO] = useState<NGO | null>(null);
  const [previewDocument, setPreviewDocument] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchPendingNGOs();
  }, []);

  const fetchPendingNGOs = async () => {
    try {
      // Method 1: Check users collection with verificationStatus
      const q1 = query(
        collection(db, 'users'),
        where('userType', '==', 'ngo'),
        where('verificationStatus', '==', 'pending')
      );
      const snapshot1 = await getDocs(q1);
      const ngosFromUsers = snapshot1.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      })) as NGO[];

      // Method 2: Check users collection with verified: false
      const q2 = query(
        collection(db, 'users'),
        where('userType', '==', 'ngo'),
        where('verified', '==', false)
      );
      const snapshot2 = await getDocs(q2);
      const ngosUnverified = snapshot2.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      })) as NGO[];

      // Method 3: Check ngoVerification collection
      const q3 = query(
        collection(db, 'ngoVerification'),
        where('status', '==', 'pending')
      );
      const snapshot3 = await getDocs(q3);
      const ngosFromVerification = await Promise.all(
        snapshot3.docs.map(async (verDoc) => {
          const userId = verDoc.id;
          const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', userId)));
          if (userDoc.docs.length > 0) {
            return {
              uid: userId,
              ...userDoc.docs[0].data(),
              ...verDoc.data(),
            } as NGO;
          }
          return null;
        })
      );

      // Combine all results and remove duplicates
      const allNGOs = [
        ...ngosFromUsers,
        ...ngosUnverified,
        ...ngosFromVerification.filter(ngo => ngo !== null),
      ];

      // Remove duplicates by uid
      const uniqueNGOs = Array.from(
        new Map(allNGOs.map(ngo => [ngo.uid, ngo])).values()
      );

      console.log('Found pending NGOs:', uniqueNGOs.length);
      setPendingNGOs(uniqueNGOs);
    } catch (error) {
      console.error('Error fetching NGOs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (ngoId: string, status: 'approved' | 'rejected', reason?: string) => {
    try {
      // Update users collection
      const ngoRef = doc(db, 'users', ngoId);
      const updateData: any = {
        verificationStatus: status,
        verified: status === 'approved',
        ngoVerified: status === 'approved',
        verifiedAt: new Date().toISOString(),
        verifiedBy: 'admin',
      };

      // Add rejection reason if provided
      if (status === 'rejected' && reason) {
        updateData.rejectionReason = reason;
        updateData.rejectedAt = new Date().toISOString();
      }

      await updateDoc(ngoRef, updateData);

      // Also update ngoVerification collection if it exists
      try {
        const verificationRef = doc(db, 'ngoVerification', ngoId);
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
        console.log('No ngoVerification doc to update');
      }

      // Send notification to NGO
      try {
        const notificationData: any = {
          userId: ngoId,
          type: status === 'approved' ? 'verification_approved' : 'verification_rejected',
          title: status === 'approved' ? 'Verification Approved!' : 'Application Rejected',
          message: status === 'approved'
            ? 'Congratulations! Your NGO verification has been approved. You now have full access to all features.'
            : `Your NGO verification application has been rejected. Reason: ${reason || 'Please contact support for details.'}`,
          read: false,
          createdAt: new Date().toISOString(),
          data: {
            verificationStatus: status,
            ...(status === 'rejected' && reason ? { rejectionReason: reason } : {}),
          },
        };

        // Add notification to notifications collection
        await addDoc(collection(db, 'notifications'), notificationData);

        console.log(`Notification sent to NGO ${ngoId}`);
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
        // Don't fail the whole operation if notification fails
      }

      setPendingNGOs(pendingNGOs.filter((ngo) => ngo.uid !== ngoId));
      setSelectedNGO(null);
      setShowRejectModal(false);
      setRejectionReason('');

      toast.success(`NGO ${status === 'approved' ? 'approved' : 'rejected'} successfully! Notification sent to organization.`);

      // Refresh the list
      fetchPendingNGOs();
    } catch (error) {
      console.error('Error updating NGO:', error);
      toast.error('Failed to update NGO status');
    }
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    if (selectedNGO) {
      handleVerification(selectedNGO.uid, 'rejected', rejectionReason);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading NGO applications...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-gray-800">NGO Verification</h1>

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
      {showRejectModal && selectedNGO && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Reject Application</h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for rejecting <strong>{selectedNGO.organizationName}</strong>'s application.
              This will help them understand what needs to be corrected.
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason (e.g., Invalid documents, Missing registration number, etc.)"
              className="w-full border border-gray-300 rounded-lg p-3 mb-4 min-h-[120px] focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Reject Application
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingNGOs.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-600">No pending NGO verifications</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* NGO List */}
          <div className="space-y-4">
            {pendingNGOs.map((ngo) => (
              <div
                key={ngo.uid}
                onClick={() => setSelectedNGO(ngo)}
                className={`bg-white rounded-lg shadow-md p-6 cursor-pointer transition-all ${selectedNGO?.uid === ngo.uid ? 'ring-2 ring-blue-500' : 'hover:shadow-lg'
                  }`}
              >
                <h3 className="text-xl font-semibold text-gray-800">{ngo.organizationName}</h3>
                <p className="text-gray-600 mt-1">{ngo.name}</p>
                <p className="text-sm text-gray-500 mt-2">{ngo.email}</p>
                {ngo.phone && <p className="text-sm text-gray-500">{ngo.phone}</p>}
                {ngo.registrationNumber && (
                  <p className="text-sm text-gray-500 mt-2">
                    Reg #: {ngo.registrationNumber}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-3">
                  Applied: {new Date(ngo.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>

          {/* NGO Details */}
          <div className="bg-white rounded-lg shadow-md p-6 sticky top-8 h-fit max-h-[calc(100vh-100px)] overflow-y-auto">
            {selectedNGO ? (
              <div>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">
                  {selectedNGO.organizationName}
                </h2>

                {/* AI Analysis Results */}
                {(selectedNGO as any).aiVerification && (
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h3 className="font-semibold text-blue-900 mb-2">🤖 AI Analysis</h3>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm text-blue-700">Overall Score: </span>
                        <span className="font-bold text-blue-900">
                          {(selectedNGO as any).aiVerification.overallScore}%
                        </span>
                      </div>
                      {(selectedNGO as any).aiVerification.riskFactors?.length > 0 && (
                        <div>
                          <span className="text-sm text-blue-700 font-semibold">Risk Factors:</span>
                          <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                            {(selectedNGO as any).aiVerification.riskFactors.map((risk: string, i: number) => (
                              <li key={i}>{risk}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {(selectedNGO as any).aiVerification.recommendations?.length > 0 && (
                        <div>
                          <span className="text-sm text-blue-700 font-semibold">AI Recommendations:</span>
                          <ul className="list-disc list-inside text-sm text-blue-800 mt-1">
                            {(selectedNGO as any).aiVerification.recommendations.map((rec: string, i: number) => (
                              <li key={i}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-3 mb-6">
                  <div>
                    <p className="text-sm text-gray-600">Contact Person</p>
                    <p className="font-medium">{selectedNGO.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{selectedNGO.email}</p>
                  </div>
                  {selectedNGO.phone && (
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium">{selectedNGO.phone}</p>
                    </div>
                  )}
                  {selectedNGO.address && (
                    <div>
                      <p className="text-sm text-gray-600">Address</p>
                      <p className="font-medium">{selectedNGO.address}</p>
                    </div>
                  )}
                  {selectedNGO.registrationNumber && (
                    <div>
                      <p className="text-sm text-gray-600">Registration Number</p>
                      <p className="font-medium">{selectedNGO.registrationNumber}</p>
                    </div>
                  )}
                </div>

                {selectedNGO.documents && selectedNGO.documents.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm text-gray-600 font-semibold mb-3">📄 Uploaded Documents ({selectedNGO.documents.length})</p>
                    <div className="space-y-2">
                      {selectedNGO.documents.map((doc: any, index: number) => {
                        const docUrl = typeof doc === 'string' ? doc : (doc?.uri || doc?.url || '');
                        return (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  Document {index + 1}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {typeof doc === 'string' ? 'PDF/Image' : doc.type || 'Document'}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setPreviewDocument(docUrl)}
                                className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Preview
                              </button>
                              <a
                                href={docUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                Open
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Show message if no documents */}
                {(!selectedNGO.documents || selectedNGO.documents.length === 0) && (
                  <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-800">
                      ⚠️ No documents uploaded by this NGO
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => handleVerification(selectedNGO.uid, 'approved')}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-medium"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="flex-1 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 font-medium"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                Select an NGO to view details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
