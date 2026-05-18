/**
 * Mock NGO Verification Test Data
 * 
 * Use this data to test the AI document verification system.
 * Contains both valid and invalid test cases.
 */

// ============================================
// VALID NGO DATA - Should pass AI verification
// ============================================

export const VALID_NGO_DATA = {
  organizationName: 'Hope Foundation Pakistan',
  registrationNumber: 'NPO-2024-12345',
  taxId: 'TIN-987654321',
  address: '123 Charity Lane, Islamabad, Pakistan 44000',
  website: 'www.hopefoundation.pk',
  contactPerson: 'Muhammad Ali Khan',
  phone: '+923001234567',
  email: 'contact@hopefoundation.pk',
  description: 'Hope Foundation Pakistan is a registered non-profit organization dedicated to providing food assistance, education support, and healthcare services to underprivileged communities across Pakistan. Established in 2015, we have served over 50,000 families.',
  servicesProvided: 'Food Distribution, Emergency Relief, Education Support, Healthcare Camps, Orphan Care',
};

// Valid documents that should pass AI verification
export const VALID_DOCUMENTS = [
  {
    name: 'NPO_Registration_Certificate_2024.pdf',
    uri: 'file:///mock/npo_registration.pdf',
    type: 'application/pdf',
    size: 245000, // 245 KB
  },
  {
    name: 'Tax_Exempt_Certificate_TIN987654321.pdf',
    uri: 'file:///mock/tax_certificate.pdf',
    type: 'application/pdf',
    size: 189000, // 189 KB
  },
  {
    name: 'Board_of_Directors_List_2024.pdf',
    uri: 'file:///mock/board_list.pdf',
    type: 'application/pdf',
    size: 156000, // 156 KB
  },
  {
    name: 'Annual_Financial_Statement_2023.pdf',
    uri: 'file:///mock/financial_statement.pdf',
    type: 'application/pdf',
    size: 512000, // 512 KB
  },
  {
    name: 'Contact_Person_ID_Muhammad_Ali.jpg',
    uri: 'file:///mock/id_document.jpg',
    type: 'image/jpeg',
    size: 320000, // 320 KB
  },
];

// ============================================
// INVALID NGO DATA - Should fail AI verification
// ============================================

export const INVALID_NGO_DATA = {
  organizationName: 'Test Org',
  registrationNumber: 'ABC',
  taxId: '123',
  address: 'Some place',
  website: '',
  contactPerson: 'John',
  phone: '12345',
  email: 'test@test.com',
  description: 'Short description',
  servicesProvided: '',
};

// Invalid documents that should fail AI verification
export const INVALID_DOCUMENTS = [
  {
    name: 'sample_template_document.pdf', // Contains "sample" - fraud indicator
    uri: 'file:///mock/sample.pdf',
    type: 'application/pdf',
    size: 5000, // Very small - suspicious
  },
  {
    name: 'fake_certificate_test.pdf', // Contains "fake" and "test" - fraud indicators
    uri: 'file:///mock/fake.pdf',
    type: 'application/pdf',
    size: 5000,
  },
  {
    name: 'example_registration.pdf', // Contains "example" - fraud indicator
    uri: 'file:///mock/example.pdf',
    type: 'application/pdf',
    size: 5000,
  },
];

// ============================================
// MEDIUM RISK NGO DATA - Should require manual review
// ============================================

export const MEDIUM_RISK_NGO_DATA = {
  organizationName: 'Community Care Center',
  registrationNumber: 'REG-2023-5678',
  taxId: 'TAX-123456',
  address: '456 Service Road, Lahore, Pakistan',
  website: '',
  contactPerson: 'Sara Ahmed',
  phone: '+923009876543',
  email: 'info@communitycare.org',
  description: 'Community Care Center provides food and shelter services to homeless individuals in Lahore. We operate a soup kitchen and temporary housing facility.',
  servicesProvided: 'Food Distribution, Shelter Services',
};

// Medium risk documents - some issues but not critical
export const MEDIUM_RISK_DOCUMENTS = [
  {
    name: 'registration_document.pdf',
    uri: 'file:///mock/registration.pdf',
    type: 'application/pdf',
    size: 150000,
  },
  {
    name: 'tax_document.pdf',
    uri: 'file:///mock/tax.pdf',
    type: 'application/pdf',
    size: 150000, // Same size as above - slightly suspicious
  },
  {
    name: 'unknown_document.pdf', // Unknown type
    uri: 'file:///mock/unknown.pdf',
    type: 'application/pdf',
    size: 100000,
  },
];

// ============================================
// TEST SCENARIOS
// ============================================

export const TEST_SCENARIOS = {
  // Scenario 1: Perfect application - should auto-approve
  perfectApplication: {
    data: VALID_NGO_DATA,
    documents: VALID_DOCUMENTS,
    expectedScore: '85-100',
    expectedRisk: 'low',
    expectedResult: 'Auto-approve eligible',
  },

  // Scenario 2: Suspicious application - should reject
  suspiciousApplication: {
    data: INVALID_NGO_DATA,
    documents: INVALID_DOCUMENTS,
    expectedScore: '0-50',
    expectedRisk: 'high',
    expectedResult: 'Manual review required, likely rejection',
  },

  // Scenario 3: Needs review - manual approval needed
  needsReviewApplication: {
    data: MEDIUM_RISK_NGO_DATA,
    documents: MEDIUM_RISK_DOCUMENTS,
    expectedScore: '50-85',
    expectedRisk: 'medium',
    expectedResult: 'Manual review required',
  },

  // Scenario 4: Good data, suspicious documents
  mixedApplication: {
    data: VALID_NGO_DATA,
    documents: INVALID_DOCUMENTS,
    expectedScore: '40-70',
    expectedRisk: 'medium-high',
    expectedResult: 'Document issues flagged',
  },

  // Scenario 5: Missing documents
  incompleteApplication: {
    data: VALID_NGO_DATA,
    documents: [VALID_DOCUMENTS[0]], // Only 1 document
    expectedScore: '60-80',
    expectedRisk: 'medium',
    expectedResult: 'Incomplete documentation',
  },
};

// ============================================
// HELPER FUNCTION TO LOAD TEST DATA
// ============================================

export const loadTestData = (scenario: keyof typeof TEST_SCENARIOS) => {
  const testCase = TEST_SCENARIOS[scenario];
  return {
    formData: {
      ...testCase.data,
      documents: testCase.documents,
    },
    expected: {
      scoreRange: testCase.expectedScore,
      riskLevel: testCase.expectedRisk,
      result: testCase.expectedResult,
    },
  };
};

// ============================================
// DOCUMENT TYPE EXAMPLES
// ============================================

export const DOCUMENT_NAMING_GUIDE = {
  registration: [
    'NPO_Registration_Certificate.pdf',
    'Certificate_of_Incorporation.pdf',
    'Organization_Registration.pdf',
    'Nonprofit_Certificate.pdf',
  ],
  tax: [
    'Tax_Exempt_Certificate.pdf',
    'TIN_Certificate.pdf',
    'EIN_Document.pdf',
    'Tax_ID_Certificate.pdf',
    'Revenue_Exemption.pdf',
  ],
  license: [
    'Operating_License.pdf',
    'Permit_Certificate.pdf',
    'Authorization_Document.pdf',
    'License_to_Operate.pdf',
  ],
  identity: [
    'Director_ID_Card.jpg',
    'Passport_Copy.pdf',
    'National_ID.jpg',
    'Contact_Person_Identity.pdf',
  ],
  financial: [
    'Annual_Financial_Statement.pdf',
    'Audit_Report_2023.pdf',
    'Balance_Sheet.pdf',
    'Income_Statement.pdf',
  ],
};

// ============================================
// FRAUD INDICATORS TO AVOID
// ============================================

export const FRAUD_INDICATORS_TO_AVOID = [
  'sample',
  'template',
  'example',
  'test',
  'fake',
  'demo',
  'placeholder',
  'screenshot',
  'edited',
  'modified',
];

export default {
  VALID_NGO_DATA,
  VALID_DOCUMENTS,
  INVALID_NGO_DATA,
  INVALID_DOCUMENTS,
  MEDIUM_RISK_NGO_DATA,
  MEDIUM_RISK_DOCUMENTS,
  TEST_SCENARIOS,
  loadTestData,
  DOCUMENT_NAMING_GUIDE,
  FRAUD_INDICATORS_TO_AVOID,
};
