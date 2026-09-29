import React, { useEffect, useState } from 'react';
import { api, MedicalRecord } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout, DashboardNavItem } from '../../components/layout/DashboardLayout';
import { AppleButton } from '../../components/ui/AppleButton';
import { UtilityCard } from '../../components/ui/UtilityCard';
import {
  FileText,
  Trash2,
  Eye,
  X,
  ExternalLink,
  Download,
  Layers,
  Calendar,
  Stethoscope,
  User as UserIcon,
} from 'lucide-react';

const CATEGORIES = ['All', 'Lab Report', 'Scan', 'Discharge Summary', 'Other'];

export const MedicalRecords: React.FC = () => {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [previewRecord, setPreviewRecord] = useState<MedicalRecord | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

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

  useEffect(() => {
    let active = true;
    let currentBlobUrl: string | null = null;

    if (previewRecord) {
      setPreviewLoading(true);
      setPreviewError(null);
      api.fetchRecordBlob(previewRecord.id)
        .then((blob) => {
          if (!active) return;
          currentBlobUrl = URL.createObjectURL(blob);
          setPreviewBlobUrl(currentBlobUrl);
          setPreviewLoading(false);
        })
        .catch((err) => {
          if (!active) return;
          console.error('Failed to load record blob:', err);
          setPreviewError(err.message || 'Failed to load document preview');
          setPreviewLoading(false);
        });
    } else {
      setPreviewBlobUrl(null);
      setPreviewLoading(false);
      setPreviewError(null);
    }

    return () => {
      active = false;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [previewRecord]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this clinical record from your record history?')) return;
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
    if (!record || !record.fileUrl) return false;
    const cleanUrl = record.fileUrl.split('?')[0].split('#')[0];
    const ext = cleanUrl.split('.').pop()?.toLowerCase();
    return ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp' || record.fileType?.includes('image');
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
      label: 'Clinical Records',
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
      title="Medical Records"
      subtitle="Your diagnostic reports, clinical notes, and prescriptions"
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
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 flex-shrink-0 active:scale-[0.98] ${
                  isSelected
                    ? 'bg-[#1d1d1f] text-white shadow-xs font-semibold'
                    : 'bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]'
                }`}
              >
                <span>{cat === 'Scan' ? 'Scans / Imaging' : cat}</span>
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
            <FileText className="w-12 h-12 text-[#86868b] mx-auto mb-3 opacity-60" />
            <h3 className="text-lg font-semibold text-[#1d1d1f]">
              {selectedCategory === 'All' ? 'No Clinical Records Found' : `No ${selectedCategory} records found`}
            </h3>
            <p className="text-xs text-[#86868b] mt-1.5 leading-relaxed">
              Official medical summaries, lab findings, and diagnostic records issued by your doctors will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecords.map((rec) => (
              <UtilityCard key={rec.id} hoverEffect className="flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-[11px] font-semibold text-[#0088e8] bg-[#0088e8]/10 border border-[#0088e8]/20 px-2.5 py-0.5 rounded-full">
                      {rec.category}
                    </span>
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="text-[#86868b] hover:text-rose-600 transition-colors p-1"
                      title="Delete record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h4 className="text-base font-semibold text-[#1d1d1f] mb-1 line-clamp-1">
                    {rec.title}
                  </h4>
                  <p className="text-xs text-[#86868b] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(rec.uploadedAt).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-[#f0f0f0] flex items-center justify-between">
                  <span className="text-[11px] font-mono text-[#86868b] uppercase">
                    {rec.fileType?.split('/')[1] || 'PDF'}
                  </span>
                  <div className="flex items-center gap-2">
                    <AppleButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewRecord(rec)}
                      className="text-xs px-3 py-1.5"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      Preview
                    </AppleButton>
                    <button
                      type="button"
                      onClick={() => api.downloadRecord(rec.id, `${rec.title}.${rec.fileType?.split('/')[1] || 'pdf'}`)}
                      className="p-1.5 text-[#86868b] hover:text-[#0088e8] transition-colors rounded-full hover:bg-gray-100"
                      title="Download file"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </UtilityCard>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xl animate-fadeIn">
          <div className="bg-white rounded-[24px] border border-[#e5e5ea] max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-[#f0f0f0]">
              <div>
                <h3 className="text-base font-semibold text-[#1d1d1f]">{previewRecord.title}</h3>
                <p className="text-xs text-[#86868b] mt-0.5">
                  Category: {previewRecord.category} • Issued on{' '}
                  {new Date(previewRecord.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => api.viewRecord(previewRecord.id, previewRecord.title)}
                  className="flex items-center gap-1 text-xs text-[#0088e8] hover:underline font-medium px-2 py-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in New Tab
                </button>
                <button
                  onClick={() => setPreviewRecord(null)}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-[#86868b]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-[#f5f5f7] flex items-center justify-center min-h-[350px]">
              {previewLoading ? (
                <div className="flex flex-col items-center gap-2 text-sm text-[#86868b]">
                  <div className="w-6 h-6 border-2 border-[#0088e8] border-t-transparent rounded-full animate-spin" />
                  <span>Loading clinical document...</span>
                </div>
              ) : previewError ? (
                <div className="text-center p-6">
                  <p className="text-sm font-semibold text-rose-600 mb-1">Preview Unavailable</p>
                  <p className="text-xs text-[#86868b]">{previewError}</p>
                </div>
              ) : previewBlobUrl ? (
                isImageFile(previewRecord) ? (
                  <img
                    src={previewBlobUrl}
                    alt={previewRecord.title}
                    className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-sm bg-white"
                  />
                ) : (
                  <iframe
                    src={previewBlobUrl}
                    title={previewRecord.title}
                    className="w-full h-[70vh] rounded-xl border border-[#e5e5ea] bg-white shadow-sm"
                  />
                )
              ) : null}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
