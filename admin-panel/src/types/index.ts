export type UserType = 'donor' | 'ngo' | 'volunteer' | 'receiver';

export interface User {
  uid: string;
  email: string;
  name: string;
  userType: UserType;
  phone?: string;
  address?: string;
  verified?: boolean;
  createdAt: string;
}

export interface NGO extends User {
  userType: 'ngo';
  organizationName: string;
  registrationNumber?: string;
  documents?: any[];
  verificationStatus: 'pending' | 'approved' | 'rejected';
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface Donor extends User {
  userType: 'donor';
  fullName: string;
  cnic: string;
  documents?: any[];
  verificationStatus: 'pending' | 'approved' | 'rejected';
  occupation?: string;
  reasonForDonating?: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface Volunteer extends User {
  userType: 'volunteer';
  fullName: string;
  cnic: string;
  hasVehicle: boolean;
  vehicleType?: string;
  licenseNumber?: string;
  documents?: any[];
  verificationStatus: 'pending' | 'approved' | 'rejected';
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface Donation {
  id: string;
  donorId: string;
  donorName: string;
  title: string;
  description: string;
  foodType: string;
  quantity: string;
  expiryDate: string;
  location: {
    address: string;
    latitude: number;
    longitude: number;
  };
  images?: string[];
  status: 'available' | 'claimed' | 'picked_up' | 'delivered' | 'cancelled';
  claimedBy?: string;
  claimedByName?: string;
  volunteerId?: string;
  volunteerName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Delivery {
  id: string;
  donationId: string;
  volunteerId: string;
  volunteerName: string;
  pickupLocation: {
    address: string;
    latitude: number;
    longitude: number;
  };
  dropoffLocation: {
    address: string;
    latitude: number;
    longitude: number;
  };
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  startedAt?: string;
  completedAt?: string;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
}
