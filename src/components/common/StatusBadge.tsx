import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const getStyle = (s: string) => {
    switch (s) {
      case 'APPROVED':
      case 'VERIFIED':
      case 'COMPLIED':
      case 'RECOMMENDED':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'CORRECTION_REQUIRED':
      case 'DEFICIENCIES_OBSERVED':
      case 'DEFICIENT':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'REJECTED':
      case 'OVERDUE':
      case 'EXPIRED':
      case 'NOT_RECOMMENDED':
        return 'text-rose-700 bg-rose-50 border-rose-200';
      case 'UNDER_SCRUTINY':
      case 'UNDER_EVC':
      case 'UNDER_SAC_SHC':
      case 'SUBMITTED':
      case 'RESUBMITTED':
      case 'SCHEDULED':
      case 'ACTIVE':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'DRAFT':
      case 'PENDING':
      default:
        return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const formatText = (s: string) => {
    return s.replace(/_/g, ' ');
  };

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-medium rounded border ${getStyle(
        status
      )} ${sizeClasses} whitespace-nowrap uppercase tracking-wider`}
    >
      {formatText(status)}
    </span>
  );
};
