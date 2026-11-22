import React, { useState } from 'react';
import { X, Upload, AlertCircle, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface DocumentUploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
  applicationId?: string;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  onClose,
  onSuccess,
  applicationId
}) => {
  const { token, user } = useAuth();
  const [docType, setDocType] = useState('FIRE_SAFETY_NOC');
  const [title, setTitle] = useState('');
  const [fileName, setFileName] = useState('fire_safety_noc_certificate.pdf');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0]);

  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  const [validTo, setValidTo] = useState(oneYearFromNow.toISOString().split('T')[0]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDocTypeChange = (type: string) => {
    setDocType(type);
    switch (type) {
      case 'FIRE_SAFETY_NOC':
        setTitle('Fire Safety NOC from Chief Fire Officer');
        setFileName('fire_safety_noc_2026.pdf');
        break;
      case 'LAND_REGISTRATION':
        setTitle('Freehold Land Registry Deed & Government Allotment Order');
        setFileName('land_registry_title_deed.pdf');
        break;
      case 'BUILDING_COMPLETION':
        setTitle('Municipal Building Occupancy & Structural Soundness Certificate');
        setFileName('building_occupancy_certificate.pdf');
        break;
      case 'LAND_USE_CERTIFICATE':
        setTitle('District Magistrate Land Use & Non-Agricultural Conversion');
        setFileName('land_use_conversion_order.pdf');
        break;
      case 'FACULTY_CADRE_LIST':
        setTitle('Approved Faculty Cadre & Selection Committee Proceedings');
        setFileName('faculty_cadre_roll_2026.pdf');
        break;
      case 'AUDITED_BALANCE_SHEET':
        setTitle('Chartered Accountant Certified Balance Sheet & Audit Report');
        setFileName('audited_financials_2025_26.pdf');
        break;
      case 'AICTE_AFFIDAVIT':
        setTitle('Notarized AICTE Anti-Ragging & Compliance Affidavit');
        setFileName('notarized_aicte_affidavit.pdf');
        break;
      default:
        setTitle('Prescribed Statutory Document');
        setFileName('statutory_document.pdf');
    }
  };

  React.useEffect(() => {
    handleDocTypeChange('FIRE_SAFETY_NOC');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/compliance/documents/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          document_type: docType,
          title,
          file_name: fileName,
          valid_from: validFrom,
          valid_to: validTo,
          application_id: applicationId || null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload document.');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error uploading document.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">Upload Prescribed Statutory Document</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Secure private repository with statutory validity monitoring
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Prescribed Document Type *
            </label>
            <select
              value={docType}
              onChange={e => handleDocTypeChange(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900"
            >
              <option value="FIRE_SAFETY_NOC">Fire Safety Clearance (NOC)</option>
              <option value="LAND_REGISTRATION">Land Ownership & Title Registry</option>
              <option value="BUILDING_COMPLETION">Building Occupancy & Soundness</option>
              <option value="LAND_USE_CERTIFICATE">Land Use / Non-Agricultural Certificate</option>
              <option value="FACULTY_CADRE_LIST">Faculty Cadre Roster & Pay Scales</option>
              <option value="AUDITED_BALANCE_SHEET">Audited Financial Balance Sheets</option>
              <option value="AICTE_AFFIDAVIT">Notarized AICTE Compliance Affidavit</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Document Display Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              File Attachment *
            </label>
            <div className="border border-dashed border-slate-300 rounded-lg p-3 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="font-mono text-slate-800 font-medium">{fileName}</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">1.8 MB · application/pdf</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Valid From Date *
              </label>
              <input
                type="date"
                value={validFrom}
                onChange={e => setValidFrom(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 font-mono"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Expiry / Renewal Due Date *
              </label>
              <input
                type="date"
                value={validTo}
                onChange={e => setValidTo(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 font-mono"
                required
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            aakalan automatically calculates expiry warnings 30 days prior to expiry date and alerts the scrutiny officer.
          </p>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded hover:bg-slate-50 cursor-pointer font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{loading ? 'Uploading...' : 'Securely Upload Document'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
