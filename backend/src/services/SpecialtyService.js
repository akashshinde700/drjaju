const { getDb } = require('../config/db');
const { ApiError } = require('../utils');

const dbRef = () => getDb();

const safeJsonParse = (value, defaultValue = null) => {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
};

const calculateCardiacRiskScore = (riskFactors) => {
  if (!riskFactors) return 'Low';
  const score = Object.values(riskFactors || {}).filter(Boolean).length;
  if (score === 0) return 'Low';
  if (score <= 3) return 'Moderate';
  return 'High';
};

const SpecialtyService = {
  async createCardiologyAssessment(payload, user) {
    const connection = await dbRef().getConnection();
    try {
      const {
        prescription_id,
        patient_id,
        doctor_id,
        bloodPressure,
        heartRate,
        ejectionFraction,
        cholesterol,
        nyhaClass,
        symptoms,
        riskFactors,
        medications,
        ecg,
        echo,
        notes,
      } = payload;

      if (!patient_id) {
        throw ApiError.badRequest('Patient ID is required');
      }

      const riskScore = calculateCardiacRiskScore(riskFactors);

      const [result] = await connection.query(
        `INSERT INTO cardiology_assessments (
          prescription_id, patient_id, doctor_id,
          bp_systolic, bp_diastolic, heart_rate, ejection_fraction,
          cholesterol_total, cholesterol_ldl, cholesterol_hdl, cholesterol_triglycerides,
          nyha_class, symptoms, risk_factors, risk_score, medications,
          ecg_findings, echo_findings, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
        [
          prescription_id || null,
          patient_id,
          doctor_id || user?.id,
          bloodPressure?.systolic || null,
          bloodPressure?.diastolic || null,
          heartRate || null,
          ejectionFraction || null,
          cholesterol?.total || null,
          cholesterol?.ldl || null,
          cholesterol?.hdl || null,
          cholesterol?.triglycerides || null,
          nyhaClass || null,
          JSON.stringify(symptoms || []),
          JSON.stringify(riskFactors || {}),
          riskScore,
          JSON.stringify(medications || {}),
          ecg || null,
          echo || null,
          notes || null,
          user?.id,
        ]
      );

      return { id: result.insertId, riskScore };
    } finally {
      connection.release();
    }
  },

  async getCardiologyByPatient(patientId) {
    const [assessments] = await dbRef().query(
      `SELECT ca.*, u.name as doctor_name
       FROM cardiology_assessments ca
       LEFT JOIN users u ON ca.doctor_id = u.id
       WHERE ca.patient_id = ?
       ORDER BY ca.created_at DESC`,
      [patientId]
    );

    const parsed = assessments.map((a) => ({
      ...a,
      symptoms: safeJsonParse(a.symptoms, []),
      riskFactors: safeJsonParse(a.risk_factors, {}),
      medications: safeJsonParse(a.medications, {}),
      bloodPressure: { systolic: a.bp_systolic, diastolic: a.bp_diastolic },
      cholesterol: {
        total: a.cholesterol_total,
        ldl: a.cholesterol_ldl,
        hdl: a.cholesterol_hdl,
        triglycerides: a.cholesterol_triglycerides,
      },
    }));

    return parsed;
  },

  async getCardiologyById(id) {
    const [assessments] = await dbRef().query(
      `SELECT ca.*, u.name as doctor_name
       FROM cardiology_assessments ca
       LEFT JOIN users u ON ca.doctor_id = u.id
       WHERE ca.id = ?`,
      [id]
    );

    if (assessments.length === 0) {
      throw ApiError.notFound('Cardiology assessment');
    }

    const a = assessments[0];
    return {
      ...a,
      symptoms: safeJsonParse(a.symptoms, []),
      riskFactors: safeJsonParse(a.risk_factors, {}),
      medications: safeJsonParse(a.medications, {}),
      bloodPressure: { systolic: a.bp_systolic, diastolic: a.bp_diastolic },
      cholesterol: {
        total: a.cholesterol_total,
        ldl: a.cholesterol_ldl,
        hdl: a.cholesterol_hdl,
        triglycerides: a.cholesterol_triglycerides,
      },
    };
  },

  async updateCardiologyAssessment(id, payload, user) {
    const connection = await dbRef().getConnection();
    try {
      const {
        bloodPressure,
        heartRate,
        ejectionFraction,
        cholesterol,
        nyhaClass,
        symptoms,
        riskFactors,
        medications,
        ecg,
        echo,
        notes,
      } = payload;

      const [existing] = await connection.query('SELECT id FROM cardiology_assessments WHERE id = ?', [id]);
      if (existing.length === 0) {
        throw ApiError.notFound('Cardiology assessment');
      }

      const riskScore = calculateCardiacRiskScore(riskFactors);

      await connection.query(
        `UPDATE cardiology_assessments SET
          bp_systolic = ?, bp_diastolic = ?, heart_rate = ?, ejection_fraction = ?,
          cholesterol_total = ?, cholesterol_ldl = ?, cholesterol_hdl = ?, cholesterol_triglycerides = ?,
          nyha_class = ?, symptoms = ?, risk_factors = ?, risk_score = ?, medications = ?,
          ecg_findings = ?, echo_findings = ?, notes = ?, updated_at = NOW(), updated_by = ?
         WHERE id = ?`,
        [
          bloodPressure?.systolic,
          bloodPressure?.diastolic,
          heartRate,
          ejectionFraction,
          cholesterol?.total,
          cholesterol?.ldl,
          cholesterol?.hdl,
          cholesterol?.triglycerides,
          nyhaClass,
          JSON.stringify(symptoms || []),
          JSON.stringify(riskFactors || {}),
          riskScore,
          JSON.stringify(medications || {}),
          ecg,
          echo,
          notes,
          user?.id,
          id,
        ]
      );

      return { riskScore };
    } finally {
      connection.release();
    }
  },

  async deleteCardiologyAssessment(id) {
    const [result] = await dbRef().query('DELETE FROM cardiology_assessments WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      throw ApiError.notFound('Cardiology assessment');
    }
    return true;
  },

  async createPediatricAssessment(payload, user) {
    const connection = await dbRef().getConnection();
    try {
      const {
        prescription_id,
        patient_id,
        doctor_id,
        birthHistory,
        currentVitals,
        growthPercentiles,
        immunization,
        milestones,
        feeding,
        calculatedDoses,
        notes,
      } = payload;

      if (!patient_id) {
        throw ApiError.badRequest('Patient ID is required');
      }

      const [result] = await connection.query(
        `INSERT INTO pediatric_assessments (
          prescription_id, patient_id, doctor_id,
          birth_gestational_age, birth_weight, birth_length, birth_delivery_type, birth_complications,
          current_weight, current_height, head_circumference, temperature, heart_rate, respiratory_rate,
          bmi, weight_percentile, height_percentile, bmi_percentile, growth_status,
          immunization_status, immunization_pending,
          milestone_motor, milestone_social, milestone_language, milestone_cognitive,
          feeding_type, feeding_frequency, feeding_issues,
          calculated_doses, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          prescription_id || null,
          patient_id,
          doctor_id || user?.id,
          birthHistory?.gestationalAge || null,
          birthHistory?.birthWeight || null,
          birthHistory?.birthLength || null,
          birthHistory?.deliveryType || null,
          birthHistory?.complications || null,
          currentVitals?.weight || null,
          currentVitals?.height || null,
          currentVitals?.headCircumference || null,
          currentVitals?.temperature || null,
          currentVitals?.heartRate || null,
          currentVitals?.respiratoryRate || null,
          growthPercentiles?.bmi || null,
          growthPercentiles?.weight || null,
          growthPercentiles?.height || null,
          growthPercentiles?.bmi || null,
          currentVitals?.growthStatus || null,
          JSON.stringify(immunization?.status || {}),
          JSON.stringify(immunization?.pending || []),
          milestones?.motor || null,
          milestones?.social || null,
          milestones?.language || null,
          milestones?.cognitive || null,
          feeding?.type || null,
          feeding?.frequency || null,
          JSON.stringify(feeding?.issues || []),
          JSON.stringify(calculatedDoses || []),
          notes || null,
          user?.id,
        ]
      );

      return { id: result.insertId };
    } finally {
      connection.release();
    }
  },

  async getPediatricByPatient(patientId) {
    const [assessments] = await dbRef().query(
      `SELECT pa.*, u.name as doctor_name, p.date_of_birth
       FROM pediatric_assessments pa
       LEFT JOIN users u ON pa.doctor_id = u.id
       LEFT JOIN patients p ON pa.patient_id = p.id
       WHERE pa.patient_id = ?
       ORDER BY pa.created_at DESC`,
      [patientId]
    );

    return assessments.map((a) => ({
      ...a,
      immunization_status: safeJsonParse(a.immunization_status, {}),
      immunization_pending: safeJsonParse(a.immunization_pending, []),
      feeding_issues: safeJsonParse(a.feeding_issues, []),
      calculated_doses: safeJsonParse(a.calculated_doses, []),
      birthHistory: {
        gestationalAge: a.birth_gestational_age,
        birthWeight: a.birth_weight,
        birthLength: a.birth_length,
        deliveryType: a.birth_delivery_type,
        complications: a.birth_complications,
      },
      currentVitals: {
        weight: a.current_weight,
        height: a.current_height,
        headCircumference: a.head_circumference,
        temperature: a.temperature,
        heartRate: a.heart_rate,
        respiratoryRate: a.respiratory_rate,
      },
      growthPercentiles: {
        weight: a.weight_percentile,
        height: a.height_percentile,
        bmi: a.bmi_percentile,
      },
      milestones: {
        motor: a.milestone_motor,
        social: a.milestone_social,
        language: a.milestone_language,
        cognitive: a.milestone_cognitive,
      },
      feeding: {
        type: a.feeding_type,
        frequency: a.feeding_frequency,
        issues: safeJsonParse(a.feeding_issues, []),
      },
    }));
  },

  async getPediatricById(id) {
    const [assessments] = await dbRef().query(
      `SELECT pa.*, u.name as doctor_name
       FROM pediatric_assessments pa
       LEFT JOIN users u ON pa.doctor_id = u.id
       WHERE pa.id = ?`,
      [id]
    );

    if (assessments.length === 0) {
      throw ApiError.notFound('Pediatric assessment');
    }

    const a = assessments[0];
    return {
      ...a,
      immunization_status: safeJsonParse(a.immunization_status, {}),
      immunization_pending: safeJsonParse(a.immunization_pending, []),
      feeding_issues: safeJsonParse(a.feeding_issues, []),
      calculated_doses: safeJsonParse(a.calculated_doses, []),
    };
  },

  async updatePediatricAssessment(id, payload, user) {
    const connection = await dbRef().getConnection();
    try {
      const {
        birthHistory,
        currentVitals,
        growthPercentiles,
        immunization,
        milestones,
        feeding,
        calculatedDoses,
        notes,
      } = payload;

      const [existing] = await connection.query('SELECT id FROM pediatric_assessments WHERE id = ?', [id]);
      if (existing.length === 0) {
        throw ApiError.notFound('Pediatric assessment');
      }

      await connection.query(
        `UPDATE pediatric_assessments SET
          birth_gestational_age = ?, birth_weight = ?, birth_length = ?, birth_delivery_type = ?, birth_complications = ?,
          current_weight = ?, current_height = ?, head_circumference = ?, temperature = ?, heart_rate = ?, respiratory_rate = ?,
          bmi = ?, weight_percentile = ?, height_percentile = ?, bmi_percentile = ?, growth_status = ?,
          immunization_status = ?, immunization_pending = ?,
          milestone_motor = ?, milestone_social = ?, milestone_language = ?, milestone_cognitive = ?,
          feeding_type = ?, feeding_frequency = ?, feeding_issues = ?,
          calculated_doses = ?, notes = ?, updated_at = NOW(), updated_by = ?
         WHERE id = ?`,
        [
          birthHistory?.gestationalAge,
          birthHistory?.birthWeight,
          birthHistory?.birthLength,
          birthHistory?.deliveryType,
          birthHistory?.complications,
          currentVitals?.weight,
          currentVitals?.height,
          currentVitals?.headCircumference,
          currentVitals?.temperature,
          currentVitals?.heartRate,
          currentVitals?.respiratoryRate,
          growthPercentiles?.bmi,
          growthPercentiles?.weight,
          growthPercentiles?.height,
          growthPercentiles?.bmi,
          currentVitals?.growthStatus,
          JSON.stringify(immunization?.status || {}),
          JSON.stringify(immunization?.pending || []),
          milestones?.motor,
          milestones?.social,
          milestones?.language,
          milestones?.cognitive,
          feeding?.type,
          feeding?.frequency,
          JSON.stringify(feeding?.issues || []),
          JSON.stringify(calculatedDoses || []),
          notes,
          user?.id,
          id,
        ]
      );

      return true;
    } finally {
      connection.release();
    }
  },

  async deletePediatricAssessment(id) {
    const [result] = await dbRef().query('DELETE FROM pediatric_assessments WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      throw ApiError.notFound('Pediatric assessment');
    }
    return true;
  },

  async createOrthopedicAssessment(payload, user) {
    const connection = await dbRef().getConnection();
    try {
      const {
        prescription_id,
        patient_id,
        doctor_id,
        chiefComplaint,
        painScore,
        affectedSide,
        bodyMap,
        range,
        specialTests,
        traumaHistory,
        surgicalHistory,
        imaging,
        diagnosis,
        treatment,
        notes,
      } = payload;

      if (!patient_id) {
        throw ApiError.badRequest('Patient ID is required');
      }

      const [result] = await connection.query(
        `INSERT INTO orthopedic_assessments (
          prescription_id, patient_id, doctor_id,
          chief_complaint, pain_score, affected_side, body_map,
          rom_flexion, rom_extension, rom_abduction, rom_adduction, rom_rotation,
          special_tests, trauma_history, surgical_history,
          xray_findings, mri_findings, ct_findings,
          diagnosis, treatment, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          prescription_id || null,
          patient_id,
          doctor_id || user?.id,
          chiefComplaint || null,
          painScore || null,
          affectedSide || null,
          JSON.stringify(bodyMap || []),
          range?.flexion || null,
          range?.extension || null,
          range?.abduction || null,
          range?.adduction || null,
          range?.rotation || null,
          JSON.stringify(specialTests || []),
          traumaHistory || null,
          surgicalHistory || null,
          imaging?.xray || null,
          imaging?.mri || null,
          imaging?.ct || null,
          diagnosis || null,
          treatment || null,
          notes || null,
          user?.id,
        ]
      );

      return { id: result.insertId };
    } finally {
      connection.release();
    }
  },

  async getOrthopedicByPatient(patientId) {
    const [assessments] = await dbRef().query(
      `SELECT oa.*, u.name as doctor_name
       FROM orthopedic_assessments oa
       LEFT JOIN users u ON oa.doctor_id = u.id
       WHERE oa.patient_id = ?
       ORDER BY oa.created_at DESC`,
      [patientId]
    );

    return assessments.map((a) => ({
      ...a,
      body_map: safeJsonParse(a.body_map, []),
      special_tests: safeJsonParse(a.special_tests, []),
      range: {
        flexion: a.rom_flexion,
        extension: a.rom_extension,
        abduction: a.rom_abduction,
        adduction: a.rom_adduction,
        rotation: a.rom_rotation,
      },
      imaging: {
        xray: a.xray_findings,
        mri: a.mri_findings,
        ct: a.ct_findings,
      },
    }));
  },

  async getOrthopedicById(id) {
    const [assessments] = await dbRef().query(
      `SELECT oa.*, u.name as doctor_name
       FROM orthopedic_assessments oa
       LEFT JOIN users u ON oa.doctor_id = u.id
       WHERE oa.id = ?`,
      [id]
    );

    if (assessments.length === 0) {
      throw ApiError.notFound('Orthopedic assessment');
    }

    const a = assessments[0];
    return {
      ...a,
      body_map: safeJsonParse(a.body_map, []),
      special_tests: safeJsonParse(a.special_tests, []),
    };
  },

  async updateOrthopedicAssessment(id, payload, user) {
    const connection = await dbRef().getConnection();
    try {
      const {
        chiefComplaint,
        painScore,
        affectedSide,
        bodyMap,
        range,
        specialTests,
        traumaHistory,
        surgicalHistory,
        imaging,
        diagnosis,
        treatment,
        notes,
      } = payload;

      const [existing] = await connection.query('SELECT id FROM orthopedic_assessments WHERE id = ?', [id]);
      if (existing.length === 0) {
        throw ApiError.notFound('Orthopedic assessment');
      }

      await connection.query(
        `UPDATE orthopedic_assessments SET
          chief_complaint = ?, pain_score = ?, affected_side = ?, body_map = ?,
          rom_flexion = ?, rom_extension = ?, rom_abduction = ?, rom_adduction = ?, rom_rotation = ?,
          special_tests = ?, trauma_history = ?, surgical_history = ?,
          xray_findings = ?, mri_findings = ?, ct_findings = ?,
          diagnosis = ?, treatment = ?, notes = ?, updated_at = NOW(), updated_by = ?
         WHERE id = ?`,
        [
          chiefComplaint,
          painScore,
          affectedSide,
          JSON.stringify(bodyMap || []),
          range?.flexion,
          range?.extension,
          range?.abduction,
          range?.adduction,
          range?.rotation,
          JSON.stringify(specialTests || []),
          traumaHistory,
          surgicalHistory,
          imaging?.xray,
          imaging?.mri,
          imaging?.ct,
          diagnosis,
          treatment,
          notes,
          user?.id,
          id,
        ]
      );

      return true;
    } finally {
      connection.release();
    }
  },

  async deleteOrthopedicAssessment(id) {
    const [result] = await dbRef().query('DELETE FROM orthopedic_assessments WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      throw ApiError.notFound('Orthopedic assessment');
    }
    return true;
  },

  async createOphthalmologyAssessment(payload, user) {
    const connection = await dbRef().getConnection();
    try {
      const {
        prescription_id,
        patient_id,
        doctor_id,
        chiefComplaint,
        visualAcuity,
        refraction,
        intraocularPressure,
        pupils,
        anteriorSegment,
        posteriorSegment,
        extraocularMovements,
        colorVision,
        contrastSensitivity,
        diagnosis,
        treatment,
        notes,
      } = payload;

      if (!patient_id) {
        throw ApiError.badRequest('Patient ID is required');
      }

      const placeholders = '?,'.repeat(58) + '?';
      const [result] = await connection.query(
        `INSERT INTO ophthalmology_assessments (
          prescription_id, patient_id, doctor_id, chief_complaint,
          va_od_uncorrected, va_od_corrected, va_od_pinhole,
          va_os_uncorrected, va_os_corrected, va_os_pinhole,
          refraction_od_sphere, refraction_od_cylinder, refraction_od_axis, refraction_od_add,
          refraction_os_sphere, refraction_os_cylinder, refraction_os_axis, refraction_os_add,
          iop_od, iop_os,
          pupil_od_size, pupil_od_reaction, pupil_os_size, pupil_os_reaction,
          anterior_od_lids, anterior_od_conjunctiva, anterior_od_cornea, anterior_od_anterior_chamber,
          anterior_od_iris, anterior_od_lens,
          anterior_os_lids, anterior_os_conjunctiva, anterior_os_cornea, anterior_os_anterior_chamber,
          anterior_os_iris, anterior_os_lens,
          posterior_od_vitreous, posterior_od_optic_disc, posterior_od_macula, posterior_od_vessels, posterior_od_periphery,
          posterior_os_vitreous, posterior_os_optic_disc, posterior_os_macula, posterior_os_vessels, posterior_os_periphery,
          eom_od, eom_os,
          color_vision, contrast_sensitivity,
          diagnosis, treatment, notes,
          created_by
        ) VALUES (${placeholders})`,
        [
          prescription_id || null,
          patient_id,
          doctor_id || user?.id,
          chiefComplaint || null,
          visualAcuity?.rightEye?.uncorrected || null,
          visualAcuity?.rightEye?.corrected || null,
          visualAcuity?.rightEye?.pinhole || null,
          visualAcuity?.leftEye?.uncorrected || null,
          visualAcuity?.leftEye?.corrected || null,
          visualAcuity?.leftEye?.pinhole || null,
          refraction?.rightEye?.sphere || null,
          refraction?.rightEye?.cylinder || null,
          refraction?.rightEye?.axis || null,
          refraction?.rightEye?.add || null,
          refraction?.leftEye?.sphere || null,
          refraction?.leftEye?.cylinder || null,
          refraction?.leftEye?.axis || null,
          refraction?.leftEye?.add || null,
          intraocularPressure?.rightEye || null,
          intraocularPressure?.leftEye || null,
          pupils?.rightEye?.size || null,
          pupils?.rightEye?.reaction || null,
          pupils?.leftEye?.size || null,
          pupils?.leftEye?.reaction || null,
          anteriorSegment?.rightEye?.lids || null,
          anteriorSegment?.rightEye?.conjunctiva || null,
          anteriorSegment?.rightEye?.cornea || null,
          anteriorSegment?.rightEye?.anteriorChamber || null,
          anteriorSegment?.rightEye?.iris || null,
          anteriorSegment?.rightEye?.lens || null,
          anteriorSegment?.leftEye?.lids || null,
          anteriorSegment?.leftEye?.conjunctiva || null,
          anteriorSegment?.leftEye?.cornea || null,
          anteriorSegment?.leftEye?.anteriorChamber || null,
          anteriorSegment?.leftEye?.iris || null,
          anteriorSegment?.leftEye?.lens || null,
          posteriorSegment?.rightEye?.vitreous || null,
          posteriorSegment?.rightEye?.opticDisc || null,
          posteriorSegment?.rightEye?.macula || null,
          posteriorSegment?.rightEye?.vessels || null,
          posteriorSegment?.rightEye?.periphery || null,
          posteriorSegment?.leftEye?.vitreous || null,
          posteriorSegment?.leftEye?.opticDisc || null,
          posteriorSegment?.leftEye?.macula || null,
          posteriorSegment?.leftEye?.vessels || null,
          posteriorSegment?.leftEye?.periphery || null,
          extraocularMovements?.rightEye || null,
          extraocularMovements?.leftEye || null,
          colorVision || null,
          contrastSensitivity || null,
          diagnosis || null,
          treatment || null,
          notes || null,
          user?.id,
        ]
      );

      return { id: result.insertId };
    } finally {
      connection.release();
    }
  },

  async getOphthalmologyByPatient(patientId) {
    const [assessments] = await dbRef().query(
      `SELECT oa.*, u.name as doctor_name
       FROM ophthalmology_assessments oa
       LEFT JOIN users u ON oa.doctor_id = u.id
       WHERE oa.patient_id = ?
       ORDER BY oa.created_at DESC`,
      [patientId]
    );

    return assessments.map((a) => ({
      ...a,
      visualAcuity: {
        rightEye: { uncorrected: a.va_od_uncorrected, corrected: a.va_od_corrected, pinhole: a.va_od_pinhole },
        leftEye: { uncorrected: a.va_os_uncorrected, corrected: a.va_os_corrected, pinhole: a.va_os_pinhole },
      },
      refraction: {
        rightEye: { sphere: a.refraction_od_sphere, cylinder: a.refraction_od_cylinder, axis: a.refraction_od_axis, add: a.refraction_od_add },
        leftEye: { sphere: a.refraction_os_sphere, cylinder: a.refraction_os_cylinder, axis: a.refraction_os_axis, add: a.refraction_os_add },
      },
      intraocularPressure: { rightEye: a.iop_od, leftEye: a.iop_os },
      pupils: {
        rightEye: { size: a.pupil_od_size, reaction: a.pupil_od_reaction },
        leftEye: { size: a.pupil_os_size, reaction: a.pupil_os_reaction },
      },
      extraocularMovements: { rightEye: a.eom_od, leftEye: a.eom_os },
    }));
  },

  async getOphthalmologyById(id) {
    const [assessments] = await dbRef().query(
      `SELECT oa.*, u.name as doctor_name
       FROM ophthalmology_assessments oa
       LEFT JOIN users u ON oa.doctor_id = u.id
       WHERE oa.id = ?`,
      [id]
    );

    if (assessments.length === 0) {
      throw ApiError.notFound('Ophthalmology assessment');
    }

    const a = assessments[0];
    return {
      ...a,
      visualAcuity: {
        rightEye: { uncorrected: a.va_od_uncorrected, corrected: a.va_od_corrected, pinhole: a.va_od_pinhole },
        leftEye: { uncorrected: a.va_os_uncorrected, corrected: a.va_os_corrected, pinhole: a.va_os_pinhole },
      },
      refraction: {
        rightEye: { sphere: a.refraction_od_sphere, cylinder: a.refraction_od_cylinder, axis: a.refraction_od_axis, add: a.refraction_od_add },
        leftEye: { sphere: a.refraction_os_sphere, cylinder: a.refraction_os_cylinder, axis: a.refraction_os_axis, add: a.refraction_os_add },
      },
      intraocularPressure: { rightEye: a.iop_od, leftEye: a.iop_os },
      pupils: {
        rightEye: { size: a.pupil_od_size, reaction: a.pupil_od_reaction },
        leftEye: { size: a.pupil_os_size, reaction: a.pupil_os_reaction },
      },
      extraocularMovements: { rightEye: a.eom_od, leftEye: a.eom_os },
    };
  },

  async updateOphthalmologyAssessment(id, payload, user) {
    const connection = await dbRef().getConnection();
    try {
      const {
        chiefComplaint,
        visualAcuity,
        refraction,
        intraocularPressure,
        pupils,
        extraocularMovements,
        colorVision,
        contrastSensitivity,
        diagnosis,
        treatment,
        notes,
      } = payload;

      const [existing] = await connection.query('SELECT id FROM ophthalmology_assessments WHERE id = ?', [id]);
      if (existing.length === 0) {
        throw ApiError.notFound('Ophthalmology assessment');
      }

      await connection.query(
        `UPDATE ophthalmology_assessments SET
          chief_complaint = ?, va_od_uncorrected = ?, va_od_corrected = ?, va_od_pinhole = ?,
          va_os_uncorrected = ?, va_os_corrected = ?, va_os_pinhole = ?,
          refraction_od_sphere = ?, refraction_od_cylinder = ?, refraction_od_axis = ?, refraction_od_add = ?,
          refraction_os_sphere = ?, refraction_os_cylinder = ?, refraction_os_axis = ?, refraction_os_add = ?,
          iop_od = ?, iop_os = ?,
          pupil_od_size = ?, pupil_od_reaction = ?, pupil_os_size = ?, pupil_os_reaction = ?,
          eom_od = ?, eom_os = ?,
          color_vision = ?, contrast_sensitivity = ?,
          diagnosis = ?, treatment = ?, notes = ?, updated_at = NOW(), updated_by = ?
         WHERE id = ?`,
        [
          chiefComplaint,
          visualAcuity?.rightEye?.uncorrected,
          visualAcuity?.rightEye?.corrected,
          visualAcuity?.rightEye?.pinhole,
          visualAcuity?.leftEye?.uncorrected,
          visualAcuity?.leftEye?.corrected,
          visualAcuity?.leftEye?.pinhole,
          refraction?.rightEye?.sphere,
          refraction?.rightEye?.cylinder,
          refraction?.rightEye?.axis,
          refraction?.rightEye?.add,
          refraction?.leftEye?.sphere,
          refraction?.leftEye?.cylinder,
          refraction?.leftEye?.axis,
          refraction?.leftEye?.add,
          intraocularPressure?.rightEye,
          intraocularPressure?.leftEye,
          pupils?.rightEye?.size,
          pupils?.rightEye?.reaction,
          pupils?.leftEye?.size,
          pupils?.leftEye?.reaction,
          extraocularMovements?.rightEye,
          extraocularMovements?.leftEye,
          colorVision,
          contrastSensitivity,
          diagnosis,
          treatment,
          notes,
          user?.id,
          id,
        ]
      );

      return true;
    } finally {
      connection.release();
    }
  },

  async deleteOphthalmologyAssessment(id) {
    const [result] = await dbRef().query('DELETE FROM ophthalmology_assessments WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      throw ApiError.notFound('Ophthalmology assessment');
    }
    return true;
  },

  async getSpecialtyAssessmentByPrescription(prescriptionId, specialtyType) {
    const map = {
      cardiology: 'cardiology_assessments',
      pediatrics: 'pediatric_assessments',
      orthopedics: 'orthopedic_assessments',
      ophthalmology: 'ophthalmology_assessments',
    };

    const table = map[String(specialtyType || '').toLowerCase()];
    if (!table) {
      throw ApiError.badRequest('Invalid specialty type. Valid: cardiology, pediatrics, orthopedics, ophthalmology');
    }

    const [assessments] = await dbRef().query(`SELECT * FROM ${table} WHERE prescription_id = ?`, [prescriptionId]);
    return assessments[0] || null;
  },

  async getAllAssessmentsByPatient(patientId) {
    const [cardiology] = await dbRef().query(
      `SELECT *, 'cardiology' as specialty_type FROM cardiology_assessments WHERE patient_id = ? ORDER BY created_at DESC`,
      [patientId]
    );
    const [pediatrics] = await dbRef().query(
      `SELECT *, 'pediatrics' as specialty_type FROM pediatric_assessments WHERE patient_id = ? ORDER BY created_at DESC`,
      [patientId]
    );
    const [orthopedics] = await dbRef().query(
      `SELECT *, 'orthopedics' as specialty_type FROM orthopedic_assessments WHERE patient_id = ? ORDER BY created_at DESC`,
      [patientId]
    );
    const [ophthalmology] = await dbRef().query(
      `SELECT *, 'ophthalmology' as specialty_type FROM ophthalmology_assessments WHERE patient_id = ? ORDER BY created_at DESC`,
      [patientId]
    );

    return {
      data: {
        cardiology: { count: cardiology.length, assessments: cardiology },
        pediatrics: { count: pediatrics.length, assessments: pediatrics },
        orthopedics: { count: orthopedics.length, assessments: orthopedics },
        ophthalmology: { count: ophthalmology.length, assessments: ophthalmology },
      },
      totalCount: cardiology.length + pediatrics.length + orthopedics.length + ophthalmology.length,
    };
  },
};

module.exports = SpecialtyService;
