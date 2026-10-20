import React, { useEffect } from 'react';
import Button from './Button';

/**
 * Ant Design-inspired Modal Component for LeafLearn
 */
export default function Modal({
  open = false,
  title,
  onCancel,
  onOk,
  okText = 'Xác nhận',
  cancelText = 'Hủy',
  okType = 'primary',
  confirmLoading = false,
  danger = false,
  footer, // null to hide, or custom ReactNode
  closable = true,
  maskClosable = true,
  width = 'max-w-lg',
  children,
  className = '',
}) {
  // Handle ESC key press
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && closable && onCancel) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Lock body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, closable, onCancel]);

  if (!open) return null;

  const handleMaskClick = (e) => {
    if (e.target === e.currentTarget && maskClosable && onCancel) {
      onCancel();
    }
  };

  return (
    <div
      onClick={handleMaskClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-fadeIn transition-all duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-white rounded-xl shadow-[0_6px_24px_rgba(0,0,0,0.14)] border border-[#DCE5D8] w-full ${width} flex flex-col relative overflow-hidden transition-all transform duration-200 animate-scaleUp ${className}`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8EFE5] min-h-[56px]">
          <div className="font-bold text-[#1A2416] text-base sm:text-lg tracking-tight">
            {title}
          </div>
          {closable && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-[#66705F] hover:text-[#1A2416] hover:bg-[#F0F4EE] p-1.5 rounded-lg transition-colors cursor-pointer focus:outline-none"
              aria-label="Đóng"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="px-6 py-5 max-h-[75vh] overflow-y-auto text-sm text-[#2E3A28]">
          {children}
        </div>

        {/* Modal Footer */}
        {footer !== null && (
          <div className="px-6 py-3.5 border-t border-[#E8EFE5] bg-[#FAFDF9] flex items-center justify-end gap-2.5">
            {footer ? (
              footer
            ) : (
              <>
                {cancelText && (
                  <Button type="default" onClick={onCancel} disabled={confirmLoading}>
                    {cancelText}
                  </Button>
                )}
                <Button
                  type={okType}
                  danger={danger}
                  loading={confirmLoading}
                  onClick={onOk}
                >
                  {okText}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
