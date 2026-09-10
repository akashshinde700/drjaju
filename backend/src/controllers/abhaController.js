const { getDb } = require('../config/db');
const axios = require('axios');
const crypto = require('crypto');
const { getLocalDateString } = require('../utils/localDate');

// ABDM API Configuration (all configurable via env)
const ABDM_BASE_URL = process.env.ABDM_BASE_URL || 'https://abha.abdm.gov.in';
const ABHA_REGISTER_URL = `${ABDM_BASE_URL}/abha/v3/register/aadhaar`;
const ABHA_LOGIN_URL = `${ABDM_BASE_URL}/abha/v3/login`;
const ABDM_API_TIMEOUT = parseInt(process.env.ABDM_API_TIMEOUT_MS || '30000', 10);
const ABHA_SESSION_EXPIRY = parseInt(process.env.ABHA_SESSION_EXPIRY_MS || '900000', 10); // 15 minutes default

/**
 * Generate a unique session ID
 */
function generateSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Log ABHA API calls for debugging and audit
 */
async function logAbhaApiCall(db, data) {
  try {
    // Align with DB schema: endpoint, method, request_body, response_body, status_code, error_message
    await db.execute(
      `INSERT INTO abha_api_logs (
        endpoint, method, request_body, response_body, status_code, error_message
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.api_endpoint,
        data.http_method,
        JSON.stringify({ patient_id: data.patient_id || null, session_id: data.session_id || null, headers: data.request_headers || {}, body: data.request_body || {} }),
        JSON.stringify(data.response_body || {}),
        data.response_status || null,
        data.error_message || null
      ]
    );
  } catch (error) {
    console.error('Failed to log ABHA API call:', error);
  }
}

/**
 * Step 1: Initiate ABHA registration with Aadhaar
 * POST /api/abha/register/init
 */
async function initiateRegistration(req, res) {
  const startTime = Date.now();
  const db = getDb();

  try {
    const { patient_id, aadhaar_number, mobile_number } = req.body;

    if (!aadhaar_number) {
      return res.status(400).json({
        error: 'aadhaar_number is required'
      });
    }

    // Validate Aadhaar number format (12 digits)
    if (!/^\d{12}$/.test(aadhaar_number)) {
      return res.status(400).json({
        error: 'Invalid Aadhaar number format. Must be 12 digits.'
      });
    }

    // Check if patient exists (if patient_id provided)
    if (patient_id) {
      const [patients] = await db.execute(
        `SELECT p.id, p.name, aa.abha_number
         FROM patients p
         LEFT JOIN abha_accounts aa ON aa.id = p.abha_account_id
         WHERE p.id = ?`,
        [patient_id]
      );

      if (patients.length === 0) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      // Check if patient already has ABHA
      if (patients[0].abha_number) {
        return res.status(400).json({
          error: 'Patient already has an ABHA number',
          abha_number: patients[0].abha_number
        });
      }
    }

    // Generate session ID
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + ABHA_SESSION_EXPIRY); // 15 minutes

    // Create registration session (use columns that exist in schema)
    await db.execute(
      `INSERT INTO abha_registration_sessions (
        session_id, aadhaar_number, mobile_number, status, expires_at, request_data
      ) VALUES (?, ?, ?, 'initiated', ?, ?)`,
      [sessionId, aadhaar_number, mobile_number || null, expiresAt, JSON.stringify({ patient_id: patient_id || null })]
    );

    // Call ABDM API to send OTP
    const requestBody = {
      aadhaar: aadhaar_number,
      mobile: mobile_number
    };

    try {
      const apiResponse = await axios.post(
        `${ABHA_REGISTER_URL}/generate-otp`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: ABDM_API_TIMEOUT
        }
      );

      const responseTime = Date.now() - startTime;

      // Log API call
      await logAbhaApiCall(db, {
        patient_id,
        session_id: sessionId,
        api_endpoint: `${ABHA_REGISTER_URL}/generate-otp`,
        http_method: 'POST',
        request_body: { aadhaar: '****', mobile: mobile_number },
        response_status: apiResponse.status,
        response_body: apiResponse.data,
        response_time_ms: responseTime
      });

      // Update session with transaction ID
      if (apiResponse.data.txnId) {
        await db.execute(
          `UPDATE abha_registration_sessions
           SET txn_id = ?, status = 'otp_sent', response_data = ?
           WHERE session_id = ?`,
          [apiResponse.data.txnId, JSON.stringify(apiResponse.data), sessionId]
        );
      }

      res.json({
        success: true,
        session_id: sessionId,
        txn_id: apiResponse.data.txnId,
        message: 'OTP sent to Aadhaar registered mobile number',
        expires_in: 900 // 15 minutes in seconds
      });

    } catch (apiError) {
      const responseTime = Date.now() - startTime;
      const errorMessage = apiError.response?.data?.message || apiError.message;

      // Log API error
      await logAbhaApiCall(db, {
        patient_id,
        session_id: sessionId,
        api_endpoint: `${ABHA_REGISTER_URL}/generate-otp`,
        http_method: 'POST',
        request_body: { aadhaar: '****', mobile: mobile_number },
        response_status: apiError.response?.status,
        response_body: apiError.response?.data,
        response_time_ms: responseTime,
        error_message: errorMessage
      });

      // Update session with error (store error details in response_data)
      await db.execute(
        `UPDATE abha_registration_sessions
         SET status = 'failed', response_data = ?, error_message = ?
         WHERE session_id = ?`,
        [JSON.stringify({ error: errorMessage }), errorMessage, sessionId]
      );

      throw apiError;
    }

  } catch (error) {
    console.error('ABHA registration initiation error:', error);

    if (error.response?.data) {
      return res.status(error.response.status || 500).json({
        error: 'ABDM API error',
        message: error.response.data.message || error.message,
        details: error.response.data
      });
    }

    res.status(500).json({
      error: 'Failed to initiate ABHA registration',
      message: error.message
    });
  }
}

/**
 * Step 2: Verify OTP and complete registration
 * POST /api/abha/register/verify-otp
 */
async function verifyRegistrationOtp(req, res) {
  const startTime = Date.now();
  const db = getDb();

  try {
    const { session_id, otp, txn_id } = req.body;

    if (!session_id || !otp) {
      return res.status(400).json({
        error: 'session_id and otp are required'
      });
    }

    // Get session details
    const [sessions] = await db.execute(
      `SELECT * FROM abha_registration_sessions
       WHERE session_id = ? AND status = 'otp_sent'
       AND expires_at > NOW()`,
      [session_id]
    );

    if (sessions.length === 0) {
      return res.status(400).json({
        error: 'Invalid or expired session'
      });
    }

    const session = sessions[0];

    // Call ABDM API to verify OTP
    const requestBody = {
      otp: otp,
      txnId: txn_id || session.txn_id
    };

    try {
      const apiResponse = await axios.post(
        `${ABHA_REGISTER_URL}/verify-otp`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: ABDM_API_TIMEOUT
        }
      );

      const responseTime = Date.now() - startTime;

      // Log API call
      await logAbhaApiCall(db, {
        patient_id: session.patient_id,
        session_id: session_id,
        api_endpoint: `${ABHA_REGISTER_URL}/verify-otp`,
        http_method: 'POST',
        request_body: { txnId: requestBody.txnId, otp: '****' },
        response_status: apiResponse.status,
        response_body: apiResponse.data,
        response_time_ms: responseTime
      });

      const abhaData = apiResponse.data;

      // Update session (store API response in response_data and mark completed)
      await db.execute(
        `UPDATE abha_registration_sessions
         SET status = 'completed', response_data = ?
         WHERE session_id = ?`,
        [JSON.stringify(abhaData), session_id]
      );

      // Create or update ABHA account record
      if (abhaData.ABHANumber || abhaData.healthIdNumber) {
        const abhaNumber = abhaData.ABHANumber || abhaData.healthIdNumber;
        const abhaAddress = abhaData.healthId || abhaData.preferredAbhaAddress;
        let patientId = session.patient_id;

        // If no patient was selected, create a new patient
        if (!patientId) {
          const patientName = abhaData.name || abhaData.fullName || `${abhaData.firstName || ''} ${abhaData.lastName || ''}`.trim();
          const patientPhone = abhaData.mobile || null;

          try {
            const [result] = await db.execute(
              `INSERT INTO patients (
                patient_id, name, phone, email, gender,
                address, state, district, pincode
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                `PAT${Date.now()}`, // Generate unique patient ID
                patientName,
                patientPhone,
                abhaData.email || null,
                abhaData.gender?.toLowerCase() || null,
                abhaData.address || null,
                abhaData.stateName || abhaData.state || null,
                abhaData.districtName || abhaData.district || null,
                abhaData.pincode || null
              ]
            );
            patientId = result.insertId;
          } catch (err) {
            console.error('Failed to create patient:', err);
            // Continue without creating patient, just save ABHA account
          }
        }

        // Insert into abha_accounts table (patient_id lives on patients.abha_account_id,
        // not here — abha_accounts has no patient_id column)
        await db.execute(
          `INSERT INTO abha_accounts (
            abha_number, abha_address, health_id,
            name, first_name, middle_name, last_name,
            gender, date_of_birth, mobile, email,
            address_line, district, state, pincode,
            kyc_verified, status, aadhaar_verified,
            mobile_verified, email_verified,
            abdm_access_token, registered_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            abha_address = VALUES(abha_address),
            name = VALUES(name),
            mobile = VALUES(mobile),
            status = 'active',
            updated_at = NOW()`,
          [
            abhaNumber,
            abhaAddress,
            abhaAddress,
            abhaData.name || abhaData.fullName,
            abhaData.firstName,
            abhaData.middleName,
            abhaData.lastName,
            abhaData.gender?.toLowerCase(),
            abhaData.dateOfBirth || abhaData.dob,
            abhaData.mobile,
            abhaData.email,
            abhaData.address,
            abhaData.districtName || abhaData.district,
            abhaData.stateName || abhaData.state,
            abhaData.pincode,
            abhaData.kycVerified ? 1 : 0,
            'active',
            1, // Aadhaar verified through OTP
            abhaData.mobile ? 1 : 0,
            abhaData.email ? 1 : 0,
            abhaData.token || abhaData.xToken
          ]
        );

        // Link patient to the account (insertId is 0 on ON DUPLICATE KEY UPDATE,
        // so resolve the real id by abha_number either way)
        if (patientId) {
          const [acctRows] = await db.execute(
            'SELECT id FROM abha_accounts WHERE abha_number = ? LIMIT 1',
            [abhaNumber]
          );
          const abhaAccountId = acctRows[0]?.id;
          if (abhaAccountId) {
            await db.execute(
              'UPDATE patients SET abha_account_id = ? WHERE id = ?',
              [abhaAccountId, patientId]
            );
          }
        }
      }

      // Get patient info to return
      const [patients] = await db.execute(
        `SELECT id, patient_id, name, phone, email FROM patients WHERE id = ?`,
        [patientId]
      );

      res.json({
        success: true,
        message: 'ABHA registration completed successfully',
        abha_number: abhaData.ABHANumber || abhaData.healthIdNumber,
        abha_address: abhaData.healthId || abhaData.preferredAbhaAddress,
        patient_id: patientId,
        patient: patients[0] || null,
        has_abha: true,
        linked: true,
        data: abhaData
      });

    } catch (apiError) {
      const responseTime = Date.now() - startTime;
      const errorMessage = apiError.response?.data?.message || apiError.message;

      // Log API error
      await logAbhaApiCall(db, {
        patient_id: session.patient_id,
        session_id: session_id,
        api_endpoint: `${ABHA_REGISTER_URL}/verify-otp`,
        http_method: 'POST',
        request_body: { txnId: requestBody.txnId, otp: '****' },
        response_status: apiError.response?.status,
        response_body: apiError.response?.data,
        response_time_ms: responseTime,
        error_message: errorMessage
      });

      // Update session with error (store error details in response_data)
      await db.execute(
        `UPDATE abha_registration_sessions
         SET status = 'failed', response_data = ?, error_message = ?
         WHERE session_id = ?`,
        [JSON.stringify({ error: errorMessage }), errorMessage, session_id]
      );

      throw apiError;
    }

  } catch (error) {
    console.error('ABHA OTP verification error:', error);

    if (error.response?.data) {
      return res.status(error.response.status || 500).json({
        error: 'ABDM API error',
        message: error.response.data.message || error.message,
        details: error.response.data
      });
    }

    res.status(500).json({
      error: 'Failed to verify OTP',
      message: error.message
    });
  }
}

/**
 * Step 1: Initiate ABHA login
 * POST /api/abha/login/init
 */
async function initiateLogin(req, res) {
  const startTime = Date.now();
  const db = getDb();

  try {
    const { patient_id, abha_address, auth_method = 'aadhaar_otp' } = req.body;

    if (!patient_id || !abha_address) {
      return res.status(400).json({
        error: 'patient_id and abha_address are required'
      });
    }

    // Check if patient exists
    const [patients] = await db.execute(
      'SELECT id, name, abha_number FROM patients WHERE id = ?',
      [patient_id]
    );

    if (patients.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Generate session ID
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + ABHA_SESSION_EXPIRY); // 15 minutes

    // Create login session
    await db.execute(
      `INSERT INTO abha_login_sessions (
        patient_id, abha_address, session_id, auth_method,
        status, expires_at
      ) VALUES (?, ?, ?, ?, 'initiated', ?)`,
      [patient_id, abha_address, sessionId, auth_method, expiresAt]
    );

    // Call ABDM API to send OTP
    const requestBody = {
      healthId: abha_address,
      authMethod: auth_method
    };

    try {
      const apiResponse = await axios.post(
        `${ABHA_LOGIN_URL}/request-otp`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: ABDM_API_TIMEOUT
        }
      );

      const responseTime = Date.now() - startTime;

      // Log API call
      await logAbhaApiCall(db, {
        patient_id,
        session_id: sessionId,
        api_endpoint: `${ABHA_LOGIN_URL}/request-otp`,
        http_method: 'POST',
        request_body: requestBody,
        response_status: apiResponse.status,
        response_body: apiResponse.data,
        response_time_ms: responseTime
      });

      // Update session with transaction ID
      if (apiResponse.data.txnId) {
        await db.execute(
          `UPDATE abha_login_sessions
           SET txn_id = ?, status = 'otp_sent', response_data = ?
           WHERE session_id = ?`,
          [apiResponse.data.txnId, JSON.stringify(apiResponse.data), sessionId]
        );
      }

      res.json({
        success: true,
        session_id: sessionId,
        txn_id: apiResponse.data.txnId,
        message: 'OTP sent to registered mobile number',
        expires_in: 900 // 15 minutes in seconds
      });

    } catch (apiError) {
      const responseTime = Date.now() - startTime;
      const errorMessage = apiError.response?.data?.message || apiError.message;

      // Log API error
      await logAbhaApiCall(db, {
        patient_id,
        session_id: sessionId,
        api_endpoint: `${ABHA_LOGIN_URL}/request-otp`,
        http_method: 'POST',
        request_body: requestBody,
        response_status: apiError.response?.status,
        response_body: apiError.response?.data,
        response_time_ms: responseTime,
        error_message: errorMessage
      });

      // Update session with error (store error details in response_data)
      await db.execute(
        `UPDATE abha_login_sessions
         SET status = 'failed', response_data = ?, error_message = ?
         WHERE session_id = ?`,
        [JSON.stringify({ error: errorMessage }), errorMessage, sessionId]
      );

      throw apiError;
    }

  } catch (error) {
    console.error('ABHA login initiation error:', error);

    if (error.response?.data) {
      return res.status(error.response.status || 500).json({
        error: 'ABDM API error',
        message: error.response.data.message || error.message,
        details: error.response.data
      });
    }

    res.status(500).json({
      error: 'Failed to initiate ABHA login',
      message: error.message
    });
  }
}

/**
 * Step 2: Verify login OTP
 * POST /api/abha/login/verify-otp
 */
async function verifyLoginOtp(req, res) {
  const startTime = Date.now();
  const db = getDb();

  try {
    const { session_id, otp, txn_id } = req.body;

    if (!session_id || !otp) {
      return res.status(400).json({
        error: 'session_id and otp are required'
      });
    }

    // Get session details
    const [sessions] = await db.execute(
      `SELECT * FROM abha_login_sessions
       WHERE session_id = ? AND status = 'otp_sent'
       AND expires_at > NOW()`,
      [session_id]
    );

    if (sessions.length === 0) {
      return res.status(400).json({
        error: 'Invalid or expired session'
      });
    }

    const session = sessions[0];

    // Call ABDM API to verify OTP
    const requestBody = {
      otp: otp,
      txnId: txn_id || session.txn_id
    };

    try {
      const apiResponse = await axios.post(
        `${ABHA_LOGIN_URL}/verify-otp`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: ABDM_API_TIMEOUT
        }
      );

      const responseTime = Date.now() - startTime;

      // Log API call
      await logAbhaApiCall(db, {
        patient_id: session.patient_id,
        session_id: session_id,
        api_endpoint: `${ABHA_LOGIN_URL}/verify-otp`,
        http_method: 'POST',
        request_body: { txnId: requestBody.txnId, otp: '****' },
        response_status: apiResponse.status,
        response_body: apiResponse.data,
        response_time_ms: responseTime
      });

      const abhaData = apiResponse.data;

      // Update session (store response in response_data and mark authenticated)
      await db.execute(
        `UPDATE abha_login_sessions
         SET status = 'authenticated', response_data = ?
         WHERE session_id = ?`,
        [JSON.stringify(abhaData), session_id]
      );

      // Update ABHA account with latest information
      if (abhaData.healthIdNumber || abhaData.ABHANumber) {
        const abhaNumber = abhaData.healthIdNumber || abhaData.ABHANumber;

        await db.execute(
          `UPDATE abha_accounts
           SET abdm_token = ?,
               refresh_token = ?,
               token_expires_at = DATE_ADD(NOW(), INTERVAL 30 MINUTE),
               status = 'active',
               updated_at = NOW()
           WHERE patient_id = ?`,
          [
            abhaData.token || abhaData.xToken,
            abhaData.refreshToken,
            session.patient_id
          ]
        );
      }

      res.json({
        success: true,
        message: 'ABHA login successful',
        data: abhaData
      });

    } catch (apiError) {
      const responseTime = Date.now() - startTime;
      const errorMessage = apiError.response?.data?.message || apiError.message;

      // Log API error
      await logAbhaApiCall(db, {
        patient_id: session.patient_id,
        session_id: session_id,
        api_endpoint: `${ABHA_LOGIN_URL}/verify-otp`,
        http_method: 'POST',
        request_body: { txnId: requestBody.txnId, otp: '****' },
        response_status: apiError.response?.status,
        response_body: apiError.response?.data,
        response_time_ms: responseTime,
        error_message: errorMessage
      });

      // Update session with error (store error details in response_data)
      await db.execute(
        `UPDATE abha_login_sessions
         SET status = 'failed', response_data = ?, error_message = ?
         WHERE session_id = ?`,
        [JSON.stringify({ error: errorMessage }), errorMessage, session_id]
      );

      throw apiError;
    }

  } catch (error) {
    console.error('ABHA login OTP verification error:', error);

    if (error.response?.data) {
      return res.status(error.response.status || 500).json({
        error: 'ABDM API error',
        message: error.response.data.message || error.message,
        details: error.response.data
      });
    }

    res.status(500).json({
      error: 'Failed to verify login OTP',
      message: error.message
    });
  }
}

/**
 * Get ABHA account status for a patient
 * GET /api/abha/status/:patient_id
 */
async function getAbhaStatus(req, res) {
  try {
    const { patient_id } = req.params;
    const db = getDb();

    // Get ABHA account
    const [accounts] = await db.execute(
      `SELECT a.*, p.name as patient_name
       FROM abha_accounts a
       LEFT JOIN patients p ON p.abha_account_id = a.id
       WHERE p.id = ?`,
      [patient_id]
    );

    if (accounts.length === 0) {
      return res.json({
        has_abha: false,
        message: 'No ABHA account linked'
      });
    }

    const account = accounts[0];

    // Fetch associated ABHA records (medical history / QR etc.)
    const [records] = await db.execute(
      `SELECT id, abha_number, enrollment_status, enrolled_date, qr_code_url, created_at
       FROM abha_records WHERE patient_id = ? ORDER BY created_at DESC`,
      [patient_id]
    );

    // Try to get HFR ID from abha_meta table
    let hfrId = process.env.ABDM_FACILITY_ID || null;
    try {
      const [metaRows] = await db.execute('SELECT meta_value FROM abha_meta WHERE meta_key = ?', ['hfr_id']);
      if (metaRows && metaRows.length && metaRows[0].meta_value) hfrId = metaRows[0].meta_value;
    } catch (err) {
      // ignore if table doesn't exist
    }

    res.json({
      has_abha: true,
      abha_number: account.abha_number,
      abha_address: account.abha_address,
      status: account.status,
      kyc_verified: !!account.kyc_verified,
      aadhaar_verified: !!account.aadhaar_verified,
      mobile_verified: !!account.mobile_verified,
      registered_at: account.registered_at,
      hfr_id: hfrId,
      records: records || []
    });

  } catch (error) {
    console.error('Get ABHA status error:', error);
    res.status(500).json({
      error: 'Failed to get ABHA status',
      message: error.message
    });
  }
}


/**
 * Get ABHA records for a patient
 * GET /api/abha/records/:patient_id
 */
async function getAbhaRecords(req, res) {
  try {
    const { patient_id } = req.params;
    const db = getDb();
    const [rows] = await db.execute(
      `SELECT id, abha_number, enrollment_status, enrolled_date, qr_code_url, created_at, updated_at
       FROM abha_records WHERE patient_id = ? ORDER BY created_at DESC`,
      [patient_id]
    );
    res.json({ records: rows || [] });
  } catch (error) {
    console.error('Get ABHA records error:', error);
    res.status(500).json({ error: 'Failed to fetch records', message: error.message });
  }
}

/**
 * Unlink ABHA account from patient
 * POST /api/abha/unlink
 */
async function unlinkAbha(req, res) {
  try {
    const { patient_id } = req.body;

    if (!patient_id) {
      return res.status(400).json({ error: 'patient_id is required' });
    }

    const db = getDb();

    // Update patient table
    await db.execute(
      `UPDATE patients
       SET abha_number = NULL, abha_address = NULL, health_id = NULL
       WHERE id = ?`,
      [patient_id]
    );

    // Deactivate ABHA account
    await db.execute(
      `UPDATE abha_accounts
       SET status = 'deactivated', updated_at = NOW()
       WHERE patient_id = ?`,
      [patient_id]
    );

    res.json({
      success: true,
      message: 'ABHA account unlinked successfully'
    });

  } catch (error) {
    console.error('Unlink ABHA error:', error);
    res.status(500).json({
      error: 'Failed to unlink ABHA account',
      message: error.message
    });
  }
}

/**
 * Get ABHA stats for dashboard
 * GET /api/abha/stats
 */
async function getAbhaStats(req, res) {
  try {
    const db = getDb();
    const { start_date, end_date } = req.query;

    // Default to today if not provided
    const start = start_date || getLocalDateString();
    const end = end_date || getLocalDateString();

    // abha_accounts stats
    const [acctRows] = await db.execute(
      `SELECT
         COUNT(*) AS total,
         SUM(kyc_verified = 1) AS kyc_count,
         SUM(kyc_verified = 0) AS non_kyc_count
       FROM abha_accounts
       WHERE DATE(created_at) BETWEEN ? AND ?`,
      [start, end]
    );

    const acct = acctRows[0] || { total: 0, kyc_count: 0, non_kyc_count: 0 };

    // consent requests stats
    const [consRows] = await db.execute(
      `SELECT
         SUM(status = 'granted') AS consent_given,
         SUM(status = 'denied') AS consent_denied,
         SUM(status = 'revoked') AS consent_revoked
       FROM abha_consent_requests
       WHERE DATE(created_at) BETWEEN ? AND ?`,
      [start, end]
    );

    const cons = consRows[0] || { consent_given: 0, consent_denied: 0, consent_revoked: 0 };

    res.json({
      total: Number(acct.total || 0),
      kyc_count: Number(acct.kyc_count || 0),
      non_kyc_count: Number(acct.non_kyc_count || 0),
      consent_given: Number(cons.consent_given || 0),
      consent_declined: Number((cons.consent_denied || 0) + (cons.consent_revoked || 0))
    });
  } catch (error) {
    console.error('ABHA stats error:', error);
    res.status(500).json({ error: 'Failed to fetch ABHA stats', message: error.message });
  }
}

/**
 * ABHA Dashboard summary
 * GET /api/abha/dashboard
 */
async function getAbhaDashboard(req, res) {
  try {
    const db = getDb();
    const { startDate, endDate, filter } = req.query;

    // Basic counts
    const [totalRows] = await db.execute('SELECT COUNT(*) as total FROM patients');
    const totalPatients = totalRows[0]?.total || 0;

    const [linkedRows] = await db.execute(
      'SELECT COUNT(*) as linked FROM patients WHERE abha_account_id IS NOT NULL'
    );
    const linkedPatients = linkedRows[0]?.linked || 0;

    // Consent requests in range
    let consentCount = 0;
    if (startDate && endDate) {
      const [crows] = await db.execute(
        'SELECT COUNT(*) as cnt FROM abha_consent_requests WHERE DATE(created_at) BETWEEN ? AND ?',
        [startDate, endDate]
      );
      consentCount = crows[0]?.cnt || 0;
    } else {
      const [crows] = await db.execute('SELECT COUNT(*) as cnt FROM abha_consent_requests');
      consentCount = crows[0]?.cnt || 0;
    }

    // Pending uploads: ABHA accounts not yet verified
    const [pendingRows] = await db.execute(
      "SELECT COUNT(*) as pending FROM abha_accounts WHERE verification_status = 'pending'"
    );
    const pendingUploads = pendingRows[0]?.pending || 0;

    // HFR ID source: try abha_meta table, fallback to env
    let hfrId = process.env.ABDM_FACILITY_ID || '';
    try {
      await db.execute(
        `CREATE TABLE IF NOT EXISTS abha_meta (
          id INT NOT NULL AUTO_INCREMENT,
          meta_key VARCHAR(100) NOT NULL,
          meta_value TEXT DEFAULT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uk_abha_meta_key (meta_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
      );
      const [metaRows] = await db.execute('SELECT meta_value FROM abha_meta WHERE meta_key = ?', ['hfr_id']);
      if (metaRows.length && metaRows[0].meta_value) hfrId = metaRows[0].meta_value;
    } catch (err) {
      // non-fatal, continue with env value
      console.warn('abha_meta table access warning:', err.message);
    }

    res.json({
      hfr_id: hfrId,
      total_patients: Number(totalPatients),
      linked_patients: Number(linkedPatients),
      consent_requests: Number(consentCount),
      pending_uploads: Number(pendingUploads),
      last_updated: new Date().toISOString()
    });
  } catch (error) {
    console.error('ABHA dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch ABHA dashboard', message: error.message });
  }
}


/**
 * Update HFR ID
 * PATCH /api/abha/hfr-id
 */
async function updateHfrId(req, res) {
  try {
    const { hfr_id } = req.body;
    if (!hfr_id) return res.status(400).json({ error: 'hfr_id is required' });

    const db = getDb();
    await db.execute(
      `CREATE TABLE IF NOT EXISTS abha_meta (
        id INT NOT NULL AUTO_INCREMENT,
        meta_key VARCHAR(100) NOT NULL,
        meta_value TEXT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_abha_meta_key (meta_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
    );

    const [existing] = await db.execute('SELECT id FROM abha_meta WHERE meta_key = ?', ['hfr_id']);
    if (existing.length) {
      await db.execute('UPDATE abha_meta SET meta_value = ? WHERE meta_key = ?', [hfr_id, 'hfr_id']);
    } else {
      await db.execute('INSERT INTO abha_meta (meta_key, meta_value) VALUES (?, ?)', ['hfr_id', hfr_id]);
    }

    res.json({ success: true, hfr_id });
  } catch (error) {
    console.error('Update HFR ID error:', error);
    res.status(500).json({ error: 'Failed to update HFR ID', message: error.message });
  }
}

// Legacy stubs for backward compatibility
async function enroll(req, res) {
  return res.status(400).json({
    error: 'This endpoint is deprecated. Use /api/abha/register/init instead'
  });
}

async function link(req, res) {
  return res.status(400).json({
    error: 'This endpoint is deprecated. Use /api/abha/register/init or /api/abha/login/init instead'
  });
}

async function unlink(req, res) {
  return unlinkAbha(req, res);
}

async function status(req, res) {
  return getAbhaStatus(req, res);
}

module.exports = {
  // New ABHA endpoints
  initiateRegistration,
  verifyRegistrationOtp,
  initiateLogin,
  verifyLoginOtp,
  getAbhaStatus,
  getAbhaStats,
  unlinkAbha,
  getAbhaDashboard,
  updateHfrId,
  getAbhaRecords,

  // Legacy endpoints (for backward compatibility)
  enroll,
  link,
  unlink,
  status
};
