// =====================================================
// MY GENIE CONTROLLER
// AI-Powered Medical Assistant
// Symptoms → Diagnosis → Medicines Suggestions
// =====================================================

const axios = require('axios');
const { db } = require('../config/db');
const env = require('../config/env');

// Initialize OpenAI/Claude client
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';
const GENIE_MODEL = process.env.GENIE_MODEL || 'gpt-4-turbo';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-3-opus-20240229';
const OPENAI_API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
const CLAUDE_API_URL = process.env.CLAUDE_API_URL || 'https://api.anthropic.com/v1/messages';
const AI_MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS || '2000', 10);
const AI_TEMPERATURE = parseFloat(process.env.AI_TEMPERATURE || '0.7');

// Cache for diagnosis suggestions (in-memory)
const suggestionCache = new Map();
const CACHE_TTL = parseInt(process.env.GENIE_CACHE_TTL_MS || '300000', 10); // 5 minutes default

/**
 * MY GENIE MAIN ENDPOINT
 * Analyzes symptoms and suggests diagnoses + medicines
 * 
 * POST /api/my-genie/analyze
 * Body: {
 *   symptoms: ['fever', 'cough', 'fatigue'],
 *   patient_id: 123,
 *   age: 35,
 *   gender: 'M',
 *   medical_history: [],
 *   allergies: [],
 *   language: 'en'
 * }
 */
exports.analyzeSymptoms = async (req, res) => {
  try {
    const { symptoms, patient_id, age, gender, medical_history = [], allergies = [], language = 'en' } = req.body;

    // Validate input
    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Symptoms array is required and must not be empty' 
      });
    }

    // Check cache
    const cacheKey = JSON.stringify({ symptoms: symptoms.sort(), age, gender });
    const cached = suggestionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json({ 
        success: true, 
        data: cached.data,
        fromCache: true 
      });
    }

    // Build prompt for AI
    const prompt = buildMedicalPrompt(symptoms, age, gender, medical_history, allergies, language);

    // Call AI API
    let analysis;
    if (CLAUDE_API_KEY) {
      analysis = await callClaudeAPI(prompt);
    } else if (OPENAI_API_KEY) {
      analysis = await callOpenAIAPI(prompt);
    } else {
      return res.status(500).json({ 
        success: false, 
        error: 'AI API not configured' 
      });
    }

    // Parse AI response
    const suggestions = parseAISuggestions(analysis, language);

    // Save to database for audit trail
    if (patient_id) {
      await saveGenieAnalysis(patient_id, symptoms, suggestions);
    }

    // Cache result
    suggestionCache.set(cacheKey, {
      data: suggestions,
      timestamp: Date.now()
    });

    res.json({ 
      success: true, 
      data: suggestions 
    });

  } catch (error) {
    console.error('My Genie analysis error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to analyze symptoms' 
    });
  }
};

/**
 * Get suggestion details
 * GET /api/my-genie/suggestion/:id
 */
exports.getSuggestionDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.execute(`
      SELECT * FROM genie_suggestions 
      WHERE id = ?
    `, [id]);

    if (result.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Suggestion not found' 
      });
    }

    res.json({ 
      success: true, 
      data: result[0] 
    });

  } catch (error) {
    console.error('Error fetching suggestion:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch suggestion' 
    });
  }
};

/**
 * Save suggestion to prescription
 * POST /api/my-genie/apply/:suggestionId
 * Body: { prescription_id }
 */
exports.applySuggestion = async (req, res) => {
  try {
    const { suggestionId } = req.params;
    const { prescription_id } = req.body;

    if (!prescription_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Prescription ID is required' 
      });
    }

    // Get suggestion data
    const [suggestions] = await db.execute(`
      SELECT * FROM genie_suggestions 
      WHERE id = ?
    `, [suggestionId]);

    if (suggestions.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Suggestion not found' 
      });
    }

    // Link suggestion to prescription
    const suggestion = suggestions[0];
    await db.execute(`
      UPDATE prescriptions 
      SET genie_analysis = ?, genie_suggestion_id = ?
      WHERE id = ?
    `, [suggestion.analysis_result, suggestionId, prescription_id]);

    res.json({ 
      success: true, 
      message: 'Suggestion applied to prescription' 
    });

  } catch (error) {
    console.error('Error applying suggestion:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to apply suggestion' 
    });
  }
};

/**
 * Get history of analyses for patient
 * GET /api/my-genie/history/:patientId
 */
exports.getAnalysisHistory = async (req, res) => {
  try {
    const { patientId } = req.params;
    const limit = req.query.limit || 10;

    const [history] = await db.execute(`
      SELECT * FROM genie_analyses
      WHERE patient_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [patientId, parseInt(limit)]);

    res.json({ 
      success: true, 
      data: history 
    });

  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch analysis history' 
    });
  }
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function buildMedicalPrompt(symptoms, age, gender, medical_history, allergies, language) {
  const historyText = medical_history.length > 0 
    ? `Medical History: ${medical_history.join(', ')}`
    : 'No significant medical history';

  const allergyText = allergies.length > 0
    ? `Allergies: ${allergies.join(', ')}`
    : 'No known allergies';

  const languageNote = language !== 'en' 
    ? `Respond in ${language} language.`
    : '';

  return `
You are a medical assistant AI helping doctors provide better diagnoses and treatment suggestions.

Patient Information:
- Age: ${age}
- Gender: ${gender}
- ${historyText}
- ${allergyText}

Symptoms reported: ${symptoms.join(', ')}

Please provide:
1. **Possible Diagnoses** (2-4 most likely, in order of probability):
   - Diagnosis name
   - ICD Code (if applicable)
   - Probability (%)
   - Key diagnostic criteria

2. **Recommended Medicines** (for each diagnosis):
   - Medicine name
   - Dosage
   - Frequency
   - Duration
   - Contraindications to watch for

3. **Diagnostic Tests** (to confirm diagnosis):
   - Test name
   - Purpose

4. **General Advice**:
   - Lifestyle modifications
   - Warning signs to watch for
   - When to seek emergency care

5. **Follow-up**:
   - Recommended follow-up period
   - What to monitor

${languageNote}

Format your response as structured data that can be parsed.
IMPORTANT: This is a clinical decision support tool, not a replacement for professional diagnosis.
`;
}

async function callOpenAIAPI(prompt) {
  const response = await axios.post(OPENAI_API_URL, {
    model: GENIE_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are a medical clinical decision support system. Provide evidence-based suggestions to assist doctors in diagnosis and treatment planning.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: AI_TEMPERATURE,
    max_tokens: AI_MAX_TOKENS
  }, {
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data.choices[0].message.content;
}

async function callClaudeAPI(prompt) {
  const response = await axios.post(CLAUDE_API_URL, {
    model: CLAUDE_MODEL,
    max_tokens: AI_MAX_TOKENS,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  }, {
    headers: {
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    }
  });

  return response.data.content[0].text;
}

function parseAISuggestions(aiResponse, language) {
  // Parse AI response into structured format
  // This is a simple parser - can be enhanced
  
  return {
    raw_analysis: aiResponse,
    diagnoses: extractDiagnoses(aiResponse),
    medicines: extractMedicines(aiResponse),
    tests: extractTests(aiResponse),
    advice: extractAdvice(aiResponse),
    followup: extractFollowup(aiResponse),
    language: language,
    generated_at: new Date()
  };
}

function extractDiagnoses(text) {
  // Simple extraction - in production, use more robust parsing
  const diagnoses = [];
  const lines = text.split('\n');
  
  let inDiagnosisSection = false;
  for (const line of lines) {
    if (line.includes('Possible Diagnoses') || line.includes('Diagnosis')) {
      inDiagnosisSection = true;
      continue;
    }
    
    if (inDiagnosisSection && line.trim() && line.includes('-')) {
      diagnoses.push(line.trim());
    }
  }
  
  return diagnoses.slice(0, 4); // Max 4 diagnoses
}

function extractMedicines(text) {
  const medicines = [];
  const lines = text.split('\n');
  
  let inMedicineSection = false;
  for (const line of lines) {
    if (line.includes('Recommended Medicines') || line.includes('Medicine')) {
      inMedicineSection = true;
      continue;
    }
    
    if (inMedicineSection && line.trim() && line.includes('-')) {
      medicines.push(line.trim());
    }
  }
  
  return medicines.slice(0, 6); // Max 6 medicines
}

function extractTests(text) {
  const tests = [];
  const lines = text.split('\n');
  
  let inTestSection = false;
  for (const line of lines) {
    if (line.includes('Diagnostic Tests') || line.includes('Tests')) {
      inTestSection = true;
      continue;
    }
    
    if (inTestSection && line.trim() && line.includes('-')) {
      tests.push(line.trim());
    }
  }
  
  return tests.slice(0, 4); // Max 4 tests
}

function extractAdvice(text) {
  const advice = [];
  const lines = text.split('\n');
  
  let inAdviceSection = false;
  for (const line of lines) {
    if (line.includes('General Advice') || line.includes('Advice')) {
      inAdviceSection = true;
      continue;
    }
    
    if (inAdviceSection && line.trim() && line.includes('-')) {
      advice.push(line.trim());
    }
  }
  
  return advice;
}

function extractFollowup(text) {
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.includes('Follow-up') || line.includes('follow-up')) {
      return line.trim();
    }
  }
  
  return 'Follow-up as per diagnosis';
}

async function saveGenieAnalysis(patient_id, symptoms, suggestions) {
  try {
    await db.execute(`
      INSERT INTO genie_analyses (patient_id, symptoms, analysis_result, created_at)
      VALUES (?, ?, ?, NOW())
    `, [
      patient_id,
      JSON.stringify(symptoms),
      JSON.stringify(suggestions)
    ]);
  } catch (error) {
    console.error('Error saving genie analysis:', error);
  }
}
