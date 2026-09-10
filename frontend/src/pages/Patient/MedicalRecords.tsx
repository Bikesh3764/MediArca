import React, { useEffect, useState } from 'react';
import { api, MedicalRecord } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SubNav } from '../../components/layout/SubNav';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import { FileText, Upload, Trash2, Eye, Plus, X, AlertCircle } from 'lucide-react';

export const MedicalRecords: React.FC = () => {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('Lab Report');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();

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
    if (user) fetchRecords();
  }, [user]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a PDF or image file');
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', uploadTitle || selectedFile.name);
    formData.append('category', uploadCategory);

    try {
      await api.uploadRecord(formData);
      setShowUploadModal(false);
      setUploadTitle('');
      setSelectedFile(null);
      fetchRecords();
    } catch (err: any) {
      setError(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
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

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      <SubNav title="Medical Vault" subtitle="Secure prescriptions & diagnostic reports">
        <AppleButton
          variant="primary"
          size="sm"
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-1.5"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload Document
        </AppleButton>
      </SubNav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-[18px] bg-white border border-[#e0e0e0] animate-pulse"></div>
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="bg-white rounded-[20px] border border-[#e0e0e0] p-12 text-center max-w-md mx-auto">
            <FileText className="w-12 h-12 text-[#7a7a7a] mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-[#1d1d1f]">Your vault is empty</h3>
            <p className="text-xs text-[#7a7a7a] mt-1 mb-5 leading-relaxed">
              Upload blood reports, scan documents, or discharge summaries to share directly with your doctors.
            </p>
            <AppleButton
              variant="primary"
              size="md"
              onClick={() => setShowUploadModal(true)}
            >
              Upload First Document
            </AppleButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {records.map((rec) => (
              <UtilityCard key={rec.id} hoverEffect className="flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-[11px] font-semibold text-[#0066cc] bg-[#0066cc]/10 px-2.5 py-0.5 rounded-full">
                      {rec.category}
                    </span>
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="text-[#7a7a7a] hover:text-rose-600 transition-colors p-1"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h4 className="text-[15px] font-semibold text-[#1d1d1f] line-clamp-2 mb-1">
                    {rec.title}
                  </h4>
                  <span className="text-[11px] text-[#7a7a7a] block">
                    Uploaded: {new Date(rec.uploadedAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="pt-4 mt-4 border-t border-[#f0f0f0] flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-[#7a7a7a]">
                    {rec.fileType || 'Doc'}
                  </span>
                  <a
                    href={`http://localhost:5000${rec.fileUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0066cc] hover:underline"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Inspect File
                  </a>
                </div>
              </UtilityCard>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[22px] border border-[#e0e0e0] max-w-md w-full p-6 sm:p-8 shadow-2xl">
            <div className="flex justify-between items-center pb-4 border-b border-[#f0f0f0]">
              <h3 className="text-lg font-semibold text-[#1d1d1f]">Upload Medical Document</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-[#7a7a7a]"
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
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Lipid Profile, Chest X-Ray"
                  className="w-full h-11 px-4 rounded-xl border border-[#e0e0e0] text-[14px] focus:outline-none focus:border-[#0066cc]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Category
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-[#e0e0e0] text-[14px] bg-white focus:outline-none focus:border-[#0066cc]"
                >
                  <option value="Lab Report">Lab Report</option>
                  <option value="Scan">Scan / Imaging (X-Ray, MRI)</option>
                  <option value="Prescription">External Prescription</option>
                  <option value="Discharge Summary">Discharge Summary</option>
                  <option value="Other">Other Medical File</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  File (PDF, PNG, JPG)
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[#7a7a7a] file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#0066cc] file:text-white hover:file:bg-[#0071e3] file:cursor-pointer"
                />
              </div>

              <div className="pt-4 border-t border-[#f0f0f0] flex justify-end gap-2">
                <AppleButton
                  variant="ghost"
                  size="sm"
                  type="button"
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
                  {uploading ? 'Uploading...' : 'Save to Vault'}
                </AppleButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
