// =====================================================
// PDF DOWNLOAD SERVICE
// Purpose: Utilities for downloading PDFs from API
// =====================================================

/**
 * Download PDF from backend endpoint
 * @param {string} endpoint - API endpoint (e.g., 'prescription/123')
 * @param {string} filename - Name of file to save
 */
export const downloadPDF = async (endpoint, filename) => {
  try {
    const token = localStorage.getItem('token');
    const apiUrl = import.meta.env.VITE_API_URL || '';
    
    const response = await fetch(`${apiUrl}/api/pdf/${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/pdf'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.statusText}`);
    }

    // Get PDF as blob
    const blob = await response.blob();
    
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename || 'document.pdf');
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error('Error downloading PDF:', error);
    throw error;
  }
};

/**
 * Download prescription as PDF
 * @param {number} prescriptionId - ID of prescription
 */
export const downloadPrescriptionPDF = (prescriptionId, { language, templateId, withLetterhead = false } = {}) => {
  const params = new URLSearchParams();
  if (language) params.set('lang', language);
  if (templateId) params.set('template_id', templateId);
  if (withLetterhead) params.set('with_letterhead', '1');
  const qs = params.toString() ? `?${params.toString()}` : '';
  return downloadPDF(
    `prescription/${prescriptionId}${qs}`,
    `prescription_${prescriptionId}.pdf`
  );
};

/**
 * Download bill/invoice as PDF
 * @param {number} billId - ID of bill
 */
export const downloadBillingPDF = (billId, { withLetterhead = false } = {}) => {
  const params = new URLSearchParams();
  if (withLetterhead) params.set('with_letterhead', '1');
  const qs = params.toString() ? `?${params.toString()}` : '';
  return downloadPDF(
    `bill/${billId}${qs}`,
    `invoice_${billId}.pdf`
  );
};

/**
 * Download medical certificate as PDF
 * @param {number} certificateId - ID of certificate
 */
export const downloadCertificatePDF = (certificateId) => {
  return downloadPDF(
    `certificate/${certificateId}`,
    `certificate_${certificateId}.pdf`
  );
};

/**
 * Download referral as PDF
 * @param {number} referralId - ID of referral
 */
export const downloadReferralPDF = (referralId) => {
  return downloadPDF(
    `referral/${referralId}`,
    `referral_${referralId}.pdf`
  );
};

/**
 * View PDF in new window (instead of downloading)
 * @param {string} endpoint - API endpoint
 * @param {string} filename - Filename for reference
 */
export const viewPDFInWindow = async (endpoint, _filename) => {
  try {
    const token = localStorage.getItem('token');
    const apiUrl = import.meta.env.VITE_API_URL || '';
    
    const response = await fetch(`${apiUrl}/api/pdf/${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/pdf'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to load PDF: ${response.statusText}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');

    return true;
  } catch (error) {
    console.error('Error viewing PDF:', error);
    throw error;
  }
};

export default {
  downloadPDF,
  downloadPrescriptionPDF,
  downloadBillingPDF,
  downloadCertificatePDF,
  downloadReferralPDF,
  viewPDFInWindow
};
