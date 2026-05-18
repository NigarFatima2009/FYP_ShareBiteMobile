/**
 * Advanced Duplicate Detection Service for Donations
 * 
 * Implements multiple ML techniques from research:
 * 1. TF-IDF + Cosine Similarity (Text Similarity)
 * 2. Jaccard Similarity (Set-based comparison)
 * 3. Levenshtein Distance (Edit distance for typos)
 * 4. N-gram Fingerprinting (Fuzzy matching)
 * 5. Weighted Ensemble (Combines all methods)
 * 
 * No external libraries needed - pure JavaScript implementation
 */

// ==================== TEXT PREPROCESSING ====================

/**
 * Normalize text for comparison
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Remove punctuation
    .replace(/\s+/g, ' ')       // Normalize whitespace
    .trim();
}

/**
 * Tokenize text into words
 */
function tokenize(text) {
  return normalizeText(text)
    .split(' ')
    .filter(word => word.length > 1);
}

/**
 * Remove common stop words
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i',
  'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its',
  'food', 'donation', 'available', 'pickup', 'fresh', 'homemade'
]);

function removeStopWords(tokens) {
  return tokens.filter(token => !STOP_WORDS.has(token));
}

/**
 * Stem words (simple suffix removal)
 */
function stemWord(word) {
  // Simple stemming rules
  if (word.endsWith('ing')) return word.slice(0, -3);
  if (word.endsWith('ed')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  if (word.endsWith('ly')) return word.slice(0, -2);
  return word;
}

function stemTokens(tokens) {
  return tokens.map(stemWord);
}

// ==================== SIMILARITY ALGORITHMS ====================

/**
 * 1. TF-IDF + Cosine Similarity
 * Best for: Comparing document content
 */
function calculateTF(tokens) {
  const tf = {};
  const total = tokens.length || 1;
  tokens.forEach(token => {
    tf[token] = (tf[token] || 0) + 1;
  });
  Object.keys(tf).forEach(token => {
    tf[token] = tf[token] / total;
  });
  return tf;
}

function calculateIDF(documents) {
  const idf = {};
  const totalDocs = documents.length || 1;
  const docFreq = {};
  
  documents.forEach(tokens => {
    const unique = new Set(tokens);
    unique.forEach(token => {
      docFreq[token] = (docFreq[token] || 0) + 1;
    });
  });
  
  Object.keys(docFreq).forEach(token => {
    idf[token] = Math.log(totalDocs / docFreq[token]) + 1;
  });
  
  return idf;
}

function cosineSimilarity(vec1, vec2) {
  const keys = new Set([...Object.keys(vec1), ...Object.keys(vec2)]);
  let dot = 0, mag1 = 0, mag2 = 0;
  
  keys.forEach(key => {
    const v1 = vec1[key] || 0;
    const v2 = vec2[key] || 0;
    dot += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  });
  
  const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
  return magnitude === 0 ? 0 : dot / magnitude;
}

function tfidfSimilarity(text1, text2, allTexts = []) {
  const tokens1 = stemTokens(removeStopWords(tokenize(text1)));
  const tokens2 = stemTokens(removeStopWords(tokenize(text2)));
  
  if (tokens1.length === 0 || tokens2.length === 0) return 0;
  
  const allTokens = [tokens1, tokens2, ...allTexts.map(t => 
    stemTokens(removeStopWords(tokenize(t)))
  )];
  
  const idf = calculateIDF(allTokens);
  
  const tfidf1 = {};
  const tfidf2 = {};
  const tf1 = calculateTF(tokens1);
  const tf2 = calculateTF(tokens2);
  
  tokens1.forEach(t => { tfidf1[t] = (tf1[t] || 0) * (idf[t] || 1); });
  tokens2.forEach(t => { tfidf2[t] = (tf2[t] || 0) * (idf[t] || 1); });
  
  return cosineSimilarity(tfidf1, tfidf2);
}

/**
 * 2. Jaccard Similarity
 * Best for: Set-based comparison (what words are shared)
 */
function jaccardSimilarity(text1, text2) {
  const set1 = new Set(stemTokens(removeStopWords(tokenize(text1))));
  const set2 = new Set(stemTokens(removeStopWords(tokenize(text2))));
  
  if (set1.size === 0 && set2.size === 0) return 1;
  if (set1.size === 0 || set2.size === 0) return 0;
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * 3. Levenshtein Distance (Edit Distance)
 * Best for: Catching typos and minor variations
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  
  if (m === 0) return n;
  if (n === 0) return m;
  
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return dp[m][n];
}

function levenshteinSimilarity(text1, text2) {
  const s1 = normalizeText(text1);
  const s2 = normalizeText(text2);
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  const distance = levenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  
  return 1 - (distance / maxLen);
}

/**
 * 4. N-gram Fingerprinting
 * Best for: Fuzzy matching with word order consideration
 */
function getNgrams(text, n = 2) {
  const normalized = normalizeText(text);
  const ngrams = [];
  
  for (let i = 0; i <= normalized.length - n; i++) {
    ngrams.push(normalized.substring(i, i + n));
  }
  
  return ngrams;
}

function ngramSimilarity(text1, text2, n = 2) {
  const ngrams1 = new Set(getNgrams(text1, n));
  const ngrams2 = new Set(getNgrams(text2, n));
  
  if (ngrams1.size === 0 && ngrams2.size === 0) return 1;
  if (ngrams1.size === 0 || ngrams2.size === 0) return 0;
  
  const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
  const union = new Set([...ngrams1, ...ngrams2]);
  
  return intersection.size / union.size;
}

/**
 * 5. Word N-gram Similarity
 * Best for: Phrase-level matching
 */
function getWordNgrams(text, n = 2) {
  const words = tokenize(text);
  const ngrams = [];
  
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push(words.slice(i, i + n).join(' '));
  }
  
  return ngrams;
}

function wordNgramSimilarity(text1, text2, n = 2) {
  const ngrams1 = new Set(getWordNgrams(text1, n));
  const ngrams2 = new Set(getWordNgrams(text2, n));
  
  if (ngrams1.size === 0 && ngrams2.size === 0) return 1;
  if (ngrams1.size === 0 || ngrams2.size === 0) return 0;
  
  const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
  const union = new Set([...ngrams1, ...ngrams2]);
  
  return intersection.size / union.size;
}

// ==================== ENSEMBLE DUPLICATE DETECTION ====================

/**
 * Weighted Ensemble Similarity
 * Combines multiple algorithms for robust detection
 */
function ensembleSimilarity(text1, text2, allTexts = []) {
  // Calculate individual similarities
  const tfidf = tfidfSimilarity(text1, text2, allTexts);
  const jaccard = jaccardSimilarity(text1, text2);
  const levenshtein = levenshteinSimilarity(text1, text2);
  const ngram2 = ngramSimilarity(text1, text2, 2);
  const ngram3 = ngramSimilarity(text1, text2, 3);
  const wordNgram = wordNgramSimilarity(text1, text2, 2);
  
  // Weighted combination (weights based on research effectiveness)
  const weights = {
    tfidf: 0.25,       // Good for content similarity
    jaccard: 0.20,     // Good for word overlap
    levenshtein: 0.15, // Good for typos
    ngram2: 0.15,      // Good for character-level similarity
    ngram3: 0.10,      // Good for longer patterns
    wordNgram: 0.15    // Good for phrase matching
  };
  
  const weightedScore = 
    tfidf * weights.tfidf +
    jaccard * weights.jaccard +
    levenshtein * weights.levenshtein +
    ngram2 * weights.ngram2 +
    ngram3 * weights.ngram3 +
    wordNgram * weights.wordNgram;
  
  return {
    ensemble: weightedScore,
    breakdown: {
      tfidf: Math.round(tfidf * 100),
      jaccard: Math.round(jaccard * 100),
      levenshtein: Math.round(levenshtein * 100),
      ngram2: Math.round(ngram2 * 100),
      ngram3: Math.round(ngram3 * 100),
      wordNgram: Math.round(wordNgram * 100)
    }
  };
}

// ==================== DONATION-SPECIFIC DETECTION ====================

/**
 * Create donation fingerprint for comparison
 */
function createDonationFingerprint(donation) {
  const title = donation.title || '';
  const description = donation.description || '';
  const location = donation.location || donation.pickupAddress || '';
  const foodType = donation.foodType || '';
  
  return {
    fullText: `${title} ${description} ${location} ${foodType}`,
    title: normalizeText(title),
    titleTokens: stemTokens(removeStopWords(tokenize(title))),
    descTokens: stemTokens(removeStopWords(tokenize(description))),
    locationTokens: tokenize(location),
    foodType: normalizeText(foodType)
  };
}

/**
 * Main duplicate detection function for donations
 */
function detectDuplicateDonation(newDonation, existingDonations, threshold = 0.60) {
  if (!existingDonations || existingDonations.length === 0) {
    return {
      isDuplicate: false,
      highestSimilarity: 0,
      message: 'No existing donations to compare',
      duplicates: [],
      allSimilarities: [],
      algorithm: 'Ensemble (TF-IDF + Jaccard + Levenshtein + N-gram)'
    };
  }
  
  const newFingerprint = createDonationFingerprint(newDonation);
  const allTexts = existingDonations.map(d => 
    `${d.title || ''} ${d.description || ''}`
  );
  
  const similarities = existingDonations.map(existing => {
    const existingFingerprint = createDonationFingerprint(existing);
    
    // 1. Exact title match (100% duplicate)
    if (newFingerprint.title === existingFingerprint.title && newFingerprint.title.length > 0) {
      return {
        donationId: existing.id,
        title: existing.title,
        location: existing.location || existing.pickupAddress,
        similarity: 1.0,
        isExactMatch: true,
        method: 'Exact Title Match'
      };
    }
    
    // 2. Ensemble similarity for fuzzy matching
    const ensembleResult = ensembleSimilarity(
      newFingerprint.fullText,
      existingFingerprint.fullText,
      allTexts
    );
    
    // 3. Title-specific similarity (weighted higher)
    const titleSimilarity = ensembleSimilarity(
      newDonation.title || '',
      existing.title || '',
      []
    );
    
    // Combined score: 60% full text, 40% title
    const combinedScore = ensembleResult.ensemble * 0.6 + titleSimilarity.ensemble * 0.4;
    
    return {
      donationId: existing.id,
      title: existing.title,
      location: existing.location || existing.pickupAddress,
      similarity: Math.round(combinedScore * 100) / 100,
      isExactMatch: false,
      method: 'Ensemble ML',
      breakdown: ensembleResult.breakdown
    };
  });
  
  // Sort by similarity (highest first)
  similarities.sort((a, b) => b.similarity - a.similarity);
  
  // Find duplicates above threshold
  const duplicates = similarities.filter(s => s.similarity >= threshold);
  
  // Determine result
  const isDuplicate = duplicates.length > 0;
  const highestMatch = similarities[0];
  
  let message = '';
  if (isDuplicate) {
    if (highestMatch.isExactMatch) {
      message = `⚠️ Exact duplicate! "${highestMatch.title}" already exists.`;
    } else {
      message = `⚠️ ${Math.round(highestMatch.similarity * 100)}% similar to "${highestMatch.title}"`;
    }
  } else {
    message = '✅ No duplicates detected';
  }
  
  return {
    isDuplicate,
    highestSimilarity: highestMatch?.similarity || 0,
    threshold,
    message,
    duplicates,
    allSimilarities: similarities.slice(0, 5),
    algorithm: 'Ensemble (TF-IDF + Jaccard + Levenshtein + N-gram)',
    tokensAnalyzed: newFingerprint.titleTokens.length + newFingerprint.descTokens.length
  };
}

/**
 * Quick duplicate check (faster, less accurate)
 */
function quickDuplicateCheck(newTitle, existingTitles) {
  const normalizedNew = normalizeText(newTitle);
  
  for (const existing of existingTitles) {
    const normalizedExisting = normalizeText(existing);
    
    // Exact match
    if (normalizedNew === normalizedExisting) {
      return { isDuplicate: true, match: existing, similarity: 1.0 };
    }
    
    // High Jaccard similarity
    const jaccard = jaccardSimilarity(newTitle, existing);
    if (jaccard > 0.8) {
      return { isDuplicate: true, match: existing, similarity: jaccard };
    }
    
    // High Levenshtein similarity (catches typos)
    const levenshtein = levenshteinSimilarity(newTitle, existing);
    if (levenshtein > 0.85) {
      return { isDuplicate: true, match: existing, similarity: levenshtein };
    }
  }
  
  return { isDuplicate: false, match: null, similarity: 0 };
}

// ==================== EXPORTS ====================

module.exports = {
  // Main detection
  detectDuplicateDonation,
  quickDuplicateCheck,
  
  // Individual algorithms
  tfidfSimilarity,
  jaccardSimilarity,
  levenshteinSimilarity,
  ngramSimilarity,
  wordNgramSimilarity,
  ensembleSimilarity,
  
  // Utilities
  normalizeText,
  tokenize,
  removeStopWords,
  stemTokens,
  createDonationFingerprint,
  
  // Constants
  STOP_WORDS
};
