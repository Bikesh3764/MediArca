import React from 'react';

interface QueueBadgeProps {
  queueNumber: number;
  status?: 'WAITING' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED';
  size?: 'sm' | 'md' | 'lg';
  showStatusText?: boolean;
}

export const QueueBadge: React.FC<QueueBadgeProps> = ({
  queueNumber,
  status = 'WAITING',
  size = 'md',
  showStatusText = false,
}) => {
  let statusBg = 'bg-[#0066cc]/10 text-[#0066cc] border-[#0066cc]/30';
  let pulseColor = 'bg-[#0066cc]';
  let statusText = 'Waiting in Queue';

  if (status === 'IN_CONSULTATION') {
    statusBg = 'bg-emerald-50 text-emerald-700 border-emerald-300';
    pulseColor = 'bg-emerald-500';
    statusText = 'Currently in Consultation';
  } else if (status === 'COMPLETED') {
    statusBg = 'bg-gray-100 text-gray-700 border-gray-300';
    pulseColor = 'bg-gray-400';
    statusText = 'Consultation Completed';
  } else if (status === 'CANCELLED') {
    statusBg = 'bg-rose-50 text-rose-600 border-rose-200';
    pulseColor = 'bg-rose-400';
    statusText = 'Cancelled';
  }

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1',
    md: 'text-sm px-3.5 py-1.5',
    lg: 'text-base px-5 py-2 font-semibold',
  };

  return (
    <div className="inline-flex items-center gap-2">
      <div
        className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${statusBg} ${sizeClasses[size]}`}
      >
        {status === 'IN_CONSULTATION' && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${pulseColor}`}></span>
          </span>
        )}
        {status === 'WAITING' && (
          <span className="relative flex h-2 w-2">
            <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-[#0066cc] opacity-75"></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${pulseColor}`}></span>
          </span>
        )}
        <span>Queue #{queueNumber}</span>
      </div>
      {showStatusText && (
        <span className="text-xs text-[#7a7a7a] font-normal">{statusText}</span>
      )}
    </div>
  );
};
