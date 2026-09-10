import React from 'react';
import DOMPurify from 'dompurify';

// Printable A4 letterhead wrapper. Renders header/footer and a content slot for the prescription body.
// showLetterhead=false renders the A4 page with ONLY the content (no clinic header/footer)
export default function Letterhead({ children, template = null, showLetterhead = true }) {
  if (!showLetterhead) {
    return (
      <div style={{ width: '210mm', background: 'white', fontFamily: 'Arial, sans-serif', padding: '20mm 15mm' }}>
        {children}
      </div>
    );
  }

  return (
    <div className="rx-letterhead">
      <style>{`
        /* Scope all styles under .rx-letterhead to avoid leaking into app */
        .rx-letterhead { font-family: Arial, sans-serif; }
        .rx-letterhead .a4-page {
          width: 210mm; min-height: 297mm; background: white; margin: 0 auto; position: relative;
          display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        .rx-letterhead .header-wrapper {
          display: flex; justify-content: space-between; align-items: stretch; background: linear-gradient(90deg, #ffffff 60%, #e3f2fd 100%);
          border-bottom: 3px solid #0288d1; position: relative; height: 140px; overflow: hidden;
        }
        .rx-letterhead .header-left { width: 15%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding-left: 10px; }
        .rx-letterhead .heart-logo { font-size: 50px; color: #d32f2f; }
        .rx-letterhead .healing-text { font-size: 8px; font-weight: bold; color: #d32f2f; text-align: center; margin-top: 5px; }
        .rx-letterhead .header-center { width: 50%; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding-left: 10px; }
        .rx-letterhead .clinic-name-row { display: flex; align-items: center; }
        .rx-letterhead .om-symbol { font-size: 55px; color: #d32f2f; margin-right: 15px; line-height: 1; }
        .rx-letterhead .clinic-text h1 { margin: 0; color: #d32f2f; font-size: 26px; font-weight: 800; line-height: 1.1; text-transform: uppercase; }
        .rx-letterhead .tagline-box { background-color: #0277bd; color: white; padding: 3px 15px; border-radius: 20px; font-size: 11px; font-weight: bold; letter-spacing: 1px; margin-top: 5px; margin-left: 70px; box-shadow: 2px 2px 5px rgba(0,0,0,0.2); }
        .rx-letterhead .header-right { width: 35%; background-color: #0277bd; color: white; display: flex; flex-direction: column; justify-content: center; padding: 10px 20px 10px 40px; text-align: right; position: relative; clip-path: polygon(15% 0, 100% 0, 100% 100%, 0% 100%); }
        .rx-letterhead .dr-name { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
        .rx-letterhead .dr-details { font-size: 11px; line-height: 1.4; }
        .rx-letterhead .content-area { flex-grow: 1; padding: 40px 50px; font-size: 14px; color: #333; }
        .rx-letterhead .footer-wrapper { width: 100%; font-size: 11px; color: #333; }
        .rx-letterhead .footer-address { background-color: #fffde7; padding: 8px 10px; text-align: center; border-top: 1px solid #ddd; font-weight: bold; }
        .rx-letterhead .footer-contact { background-color: #fffde7; padding: 5px 10px 10px 10px; display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 15px; font-weight: bold; padding-bottom: 15px; }

        /* Print tweaks */
        @media print {
          .rx-letterhead .a4-page { width: 100%; min-height: 0 !important; height: auto !important; display: block !important; box-shadow: none; margin: 0; border: none; }
          .rx-letterhead * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { margin: 0; }
        }
      `}</style>

      <div className="a4-page">
        {/* HEADER START - Dynamic template or default static header */}
        {template ? (
          <div className="template-header" style={{ padding: '20px', borderBottom: '2px solid #e5e7eb' }}>
            {/* Template Header Image */}
            {template.header_image && (
              <div className="mb-4 text-center">
                <img
                  src={template.header_image}
                  alt="Header"
                  className="max-w-full h-auto"
                  style={{ maxHeight: '140px', margin: '0 auto' }}
                />
              </div>
            )}

            {/* Template Header Content */}
            {template.header_content && (
              <div className="mb-4">
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(template.header_content) }} />
              </div>
            )}
          </div>
        ) : (
          <div className="header-wrapper">
            {/* Green slanted line */}
            <div style={{ position: 'absolute', right: '34%', top: 0, bottom: 0, width: 6, background: '#43a047', transform: 'skewX(-12deg)', zIndex: 1 }} />

            <div className="header-left">
              <div className="heart-logo" aria-hidden>❤️</div>
              <div className="healing-text">THE HEALING HANDS</div>
            </div>

            <div className="header-center">
              <div className="clinic-name-row">
                <div className="om-symbol">🕉</div>
                <div className="clinic-text">
                  <h1>CLINIC AND <br/> DIAGNOSTIC CENTER</h1>
                </div>
              </div>
              <div className="tagline-box">THE ULTIMATE POWER TO HEAL</div>
            </div>

            <div className="header-right">
              <div className="dr-name">Dr. Gopal Jaju</div>
              <div className="dr-details">
                M.B.B.S., MD Medicine<br/>
                Physician, Intensivist<br/>
                Echocardiographer<br/>
                <strong>Reg.No.:</strong> 11-39360
              </div>
            </div>
          </div>
        )}
        {/* HEADER END */}

        {/* CONTENT BODY START */}
        <div className="content-area" id="dynamic-content">
          {children || (
            <p style={{ color: '#999', textAlign: 'center', marginTop: 100 }}>
              [ Content Area: Patient Details, Prescription, or Letter text goes here ]
            </p>
          )}
        </div>
        {/* CONTENT BODY END */}

        {/* FOOTER START - Dynamic template or default static footer */}
        {template ? (
          <div className="template-footer" style={{ padding: '20px', borderTop: '2px solid #e5e7eb' }}>
            {/* Template Footer Content */}
            {template.footer_content && (
              <div className="mb-4 text-center">
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(template.footer_content) }} />
              </div>
            )}

            {/* Template Footer Image */}
            {template.footer_image && (
              <div className="text-center">
                <img
                  src={template.footer_image}
                  alt="Footer"
                  className="max-w-full h-auto"
                  style={{ maxHeight: '100px', margin: '0 auto' }}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="footer-wrapper">
            <div className="footer-address">
              1st Floor, Tower B, City Vista, Office No. 22 to 25, Kharadi, Pune, Maharashtra 411014
            </div>
            <div className="footer-contact">
              <span>Email: omclinic.live@gmail.com</span>
              <span>|</span>
              <span><strong>Time:</strong> Mon. to Sat. 9 am to 9 pm</span>
              <span>|</span>
              <span>For Appointments: 8530345858</span>
              <span>|</span>
              <span><strong>Sunday by appointment only</strong></span>
            </div>
          </div>
        )}
        {/* FOOTER END */}
      </div>
    </div>
  );
}
