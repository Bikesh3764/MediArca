import React, { useEffect, useState } from 'react';
import { api, MedicalRecord, getFileUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  FileText,
  Upload,
  Trash2,
  Eye,
  X,
  AlertCircle,
  ExternalLink,
  Download,
  Layers,
  ShieldCheck,
  Calendar,
  Stethoscope,
  User as UserIcon,
} from 'lucide-react';

const CATEGORIES = ['All', 'Prescription', 'Lab Report', 'Scan', 'Discharge Summary', 'Other'];

export const MedicalRecords: React.FC = () => {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('Lab Report');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewRecord, setPreviewRecord] = useState<MedicalRecord | null>(null);

  const { user, loading: loadingAuth } = useAuth();

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await api.getRecords();
      setRecords(data);
    } catch (err) {
      console.error('Failed to load records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loadingAuth && user) fetchRecords();
  }, [user, loadingAuth]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a PDF or image file');
      return;
    }

    if (selectedFile.size > 1 * 1024 * 1024) {
      setError('File size exceeds 1 MB limit. Please upload a document under 1 MB.');
      return;
    }

    setUploading(true);
    setUploadProgress(20);
    setError(null);

    const interval = setInterval(() => {
      setUploadProgress((prev) => (prev < 90 ? prev + 15 : prev));
    }, 200);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', uploadTitle || selectedFile.name);
    formData.append('category', uploadCategory);

    try {
      await api.uploadRecord(formData);
      setUploadProgress(100);
      clearInterval(interval);
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadTitle('');
        setSelectedFile(null);
        setUploading(false);
        setUploadProgress(0);
        fetchRecords();
      }, 400);
    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || 'Failed to upload document');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this medical document from your vault?')) return;
    try {
      await api.deleteRecord(id);
      fetchRecords();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const filteredRecords = selectedCategory === 'All'
    ? records
    : records.filter((r) => r.category.toLowerCase().includes(selectedCategory.toLowerCase()));

  const getCategoryCount = (cat: string) => {
    if (cat === 'All') return records.length;
    return records.filter((r) => r.category.toLowerCase().includes(cat.toLowerCase())).length;
  };

  const isImageFile = (record: MedicalRecord) => {
    const ext = record.fileUrl.split('.').pop()?.toLowerCase();
    return ext === 'png' || ext === 'jpg' || ext === 'jpeg' || record.fileType?.includes('image');
  };

  const navItems: DashboardNavItem[] = [
    {
      id: 'appointments',
      label: 'Live Queue & Passes',
      icon: Calendar,
      path: '/patient/appointments',
    },
    {
      id: 'records',
      label: 'Medical Records Vault',
      icon: FileText,
      path: '/patient/records',
      active: true,
      badge: records.length > 0 ? records.length : undefined,
    },
    {
      id: 'find-doctors',
      label: 'Find Specialists',
      icon: Stethoscope,
      path: '/patient/doctors',
    },
    {
      id: 'profile',
      label: 'Patient Profile',
      icon: UserIcon,
      path: '/patient/profile',
    },
  ];

  return (
    <DashboardLayout
      portalType="PATIENT"
      portalSubtitle="PATIENT HEALTH RECORD"
      navItems={navItems}
      title="Medical Records Vault"
      subtitle="Secure storage for diagnostic reports, imaging scans, and digital prescriptions"
      headerAction={
        <AppleButton
          variant="primary"
          size="sm"
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-1.5 shadow-sm"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload Document
        </AppleButton>
      }
    >
      <div className="space-y-6">
        {/* Category Filters Bar */}
        <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-4 shadow-sm flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="text-xs font-semibold text-[#86868b] mr-2 flex items-center gap-1 flex-shrink-0">
            <Layers className="w-3.5 h-3.5 text-[#0088e8]" />
            Categories:
          </span>
          {CATEGORIES.map((cat) => {
            const count = getCategoryCount(cat);
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 flex-shrink-0 ${
                  isSelected
                    ? 'bg-[#1d1d1f] text-white shadow-sm'
                    : 'bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]'
                }`}
              >
                <span>{cat === 'Scan' ? 'Scans / Imaging' : cat === 'Prescription' ? 'Prescriptions' : cat}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-white text-[#86868b]'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-[20px] bg-white border border-[#e5e5ea] animate-pulse"></div>
            ))}
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-12 text-center max-w-md mx-auto shadow-sm">
            <FileText className="w-12 h-12 text-[#86868b] mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-[#1d1d1f]">
              {selectedCategory === 'All' ? 'Your vault is empty' : `No ${selectedCategory} documents found`}
            </h3>
            <p className="text-xs text-[#86868b] mt-1 mb-5 leading-relaxed">
              {selectedCategory === 'All'
                ? 'Upload blood reports, scan documents, or discharge summaries to share directly with your doctors.'
                : `Upload your ${selectedCategory} records to access them anytime.`}
            </p>
            <AppleButton
              variant="primary"
              size="md"
              onClick={() => setShowUploadModal(true)}
            >
              Upload Document
            </AppleButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecords.map((rec) => (
              <UtilityCard key={rec.id} hoverEffect className="flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-[11px] font-semibold text-[#0088e8] bg-[#0088e8]/10 px-2.5 py-0.5 rounded-full">
                      {rec.category}
                    </span>
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="text-[#86868b] hover:text-rose-600 transition-colors p-1"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h4
                    onClick={() => setPreviewRecord(rec)}
                    className="text-[15px] font-semibold text-[#1d1d1f] line-clamp-2 mb-1 cursor-pointer hover:text-[#0088e8] transition-colors"
                  >
                    {rec.title}
                  </h4>
                  <span className="text-[11px] text-[#86868b] block">
                    Uploaded: {new Date(rec.uploadedAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="pt-4 mt-4 border-t border-[#f0f0f0] flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-[#86868b]">
                    {rec.fileType || 'Doc'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPreviewRecord(rec)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#0088e8] hover:underline"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </button>
                    <a
                      href={getFileUrl(rec.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#86868b] hover:text-[#1d1d1f] transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </UtilityCard>
            ))}
          </div>
        )}
      </div>

      {/* Instant In-App Document Preview Modal */}
      {previewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[20px] border border-[#e5e5ea] max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#f0f0f0]">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-[#0088e8]" />
                <div>
                  <h3 className="text-base font-semibold text-[#1d1d1f] truncate max-w-[320px] sm:max-w-md">
                    {previewRecord.title}
                  </h3>
                  <span className="text-[11px] text-[#86868b]">{previewRecord.category}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={getFileUrl(previewRecord.fileUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl text-[#86868b] hover:bg-gray-100 hover:text-[#1d1d1f] transition-colors"
                  title="Open in new window"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <a
                  href={getFileUrl(previewRecord.fileUrl)}
                  download
                  className="p-2 rounded-xl text-[#86868b] hover:bg-gray-100 hover:text-[#1d1d1f] transition-colors"
                  title="Download file"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setPreviewRecord(null)}
                  className="p-2 rounded-xl hover:bg-gray-100 text-[#86868b] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Preview Body */}
            <div className="flex-1 p-6 overflow-y-auto flex items-center justify-center bg-[#f5f5f7]">
              {isImageFile(previewRecord) ? (
                <img
                  src={getFileUrl(previewRecord.fileUrl)}
                  alt={previewRecord.title}
                  className="max-h-[65vh] max-w-full object-contain rounded-xl shadow-sm border border-[#e5e5ea]"
                />
              ) : (
                <div className="w-full h-[65vh] flex flex-col bg-white rounded-xl border border-[#e5e5ea] overflow-hidden shadow-inner">
                  <iframe
                    src={getFileUrl(previewRecord.fileUrl)}
                    title={previewRecord.title}
                    className="w-full flex-1 border-0"
                  />
                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-[#86868b]">
                    <span>Viewing PDF preview</span>
                    <a
                      href={getFileUrl(previewRecord.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#0088e8] font-medium hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open in New Tab
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-[#f0f0f0] bg-white flex justify-end">
              <AppleButton variant="ghost" size="sm" onClick={() => setPreviewRecord(null)}>
                Close Preview
              </AppleButton>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal with Progress */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[20px] border border-[#e5e5ea] max-w-md w-full p-6 sm:p-8 shadow-2xl">
            <div className="flex justify-between items-center pb-4 border-b border-[#f0f0f0]">
              <h3 className="text-lg font-semibold text-[#1d1d1f]">Upload Medical Document</h3>
              <button
                disabled={uploading}
                onClick={() => setShowUploadModal(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-[#86868b]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="my-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleUpload} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  required
                  disabled={uploading}
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Lipid Profile, Chest X-Ray, Blood Test"
                  className="w-full h-11 px-4 rounded-xl border border-[#e5e5ea] text-[14px] focus:outline-none focus:border-[#0088e8]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Category
                </label>
                <select
                  disabled={uploading}
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-[#e5e5ea] text-[14px] bg-white focus:outline-none focus:border-[#0088e8]"
                >
                  <option value="Lab Report">Lab Report</option>
                  <option value="Scan">Scan / Imaging (X-Ray, MRI)</option>
                  <option value="Prescription">External Prescription</option>
                  <option value="Discharge Summary">Discharge Summary</option>
                  <option value="Other">Other Medical File</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-[#1d1d1f]">
                    File (PDF, PNG, JPG)
                  </label>
                  {selectedFile && (
                    <span className="text-[11px] font-mono text-[#0088e8]">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  required
                  disabled={uploading}
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    if (f && f.size > 1 * 1024 * 1024) {
                      setError('File size exceeds 1 MB limit. Please upload a document under 1 MB.');
                      setSelectedFile(null);
                      e.target.value = '';
                      return;
                    }
                    setError(null);
                    setSelectedFile(f);
                  }}
                  className="w-full text-xs text-[#86868b] file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#0088e8] file:text-white hover:file:bg-[#0284c7] file:cursor-pointer"
                />
                <p className="text-[11px] text-[#86868b] mt-1.5 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0088e8]" />
                  <span>Max file size: 1 MB. Accepted formats: PDF, PNG, JPG.</span>
                </p>
              </div>

              {/* Upload Progress Bar */}
              {uploading && (
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-100 space-y-2">
                  <div className="flex justify-between text-xs text-[#0088e8] font-medium">
                    <span>Securing document into vault...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#0088e8] h-full transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-[#f0f0f0] flex justify-end gap-2">
                <AppleButton
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={uploading}
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </AppleButton>
                <AppleButton
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={uploading}
                >
                  {uploading ? 'Encrypting & Saving...' : 'Save to Vault'}
                </AppleButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
