/**
 * Simple JSON Database Service
 * Handles reading/writing donations to local JSON file
 */

const fs = require('fs').promises;
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/donations.json');

/**
 * Read all donations from database
 */
const getAllDonations = async () => {
  try {
    const data = await fs.readFile(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist or is empty, return empty array
    if (error.code === 'ENOENT') {
      await saveDonations([]);
      return [];
    }
    throw error;
  }
};

/**
 * Save all donations to database
 */
const saveDonations = async (donations) => {
  try {
    await fs.writeFile(DB_PATH, JSON.stringify(donations, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving donations:', error);
    throw error;
  }
};

/**
 * Add a new donation
 */
const addDonation = async (donation) => {
  const donations = await getAllDonations();
  const newDonation = {
    ...donation,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  donations.push(newDonation);
  await saveDonations(donations);
  return newDonation;
};

/**
 * Get donations by user ID
 */
const getDonationsByUserId = async (userId) => {
  const donations = await getAllDonations();
  return donations.filter(d => d.donorId === userId);
};

/**
 * Get donation by ID
 */
const getDonationById = async (donationId) => {
  const donations = await getAllDonations();
  return donations.find(d => d.id === donationId);
};

/**
 * Update donation
 */
const updateDonation = async (donationId, updates) => {
  const donations = await getAllDonations();
  const index = donations.findIndex(d => d.id === donationId);
  
  if (index === -1) {
    throw new Error('Donation not found');
  }
  
  donations[index] = {
    ...donations[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  await saveDonations(donations);
  return donations[index];
};

/**
 * Delete donation
 */
const deleteDonation = async (donationId) => {
  const donations = await getAllDonations();
  const filtered = donations.filter(d => d.id !== donationId);
  
  if (filtered.length === donations.length) {
    throw new Error('Donation not found');
  }
  
  await saveDonations(filtered);
  return true;
};

/**
 * Get available donations (status = available)
 */
const getAvailableDonations = async () => {
  const donations = await getAllDonations();
  return donations.filter(d => d.status === 'available');
};

module.exports = {
  getAllDonations,
  saveDonations,
  addDonation,
  getDonationsByUserId,
  getDonationById,
  updateDonation,
  deleteDonation,
  getAvailableDonations,
};
