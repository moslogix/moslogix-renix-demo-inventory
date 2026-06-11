/**
 * Demo Mode Warning Banner
 * Displayed on all demo applications to warn users about trial limitations
 */

'use client';

import React, { useState, useEffect } from 'react';

export function DemoBanner() {
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // In a real implementation, fetch days remaining from server
    // For now, we show the banner without real-time data
    setIsVisible(true);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="demo-banner-warning">
      <div className="demo-banner-content">
        <div className="demo-banner-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div className="demo-banner-text">
          <span className="demo-banner-label">⚠️ DEMO MODE</span>
          <span className="demo-banner-message">
            This is a demo environment for testing purposes only. Data is not persistent and may be reset. Cannot be used for production or distribution.
          </span>
        </div>
        <button 
          className="demo-banner-close" 
          onClick={() => setIsVisible(false)}
          aria-label="Close demo warning"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <style jsx>{`
        .demo-banner-warning {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(239, 68, 68, 0.1) 100%);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-bottom: 2px solid rgba(239, 68, 68, 0.5);
          padding: 12px 16px;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 12px;
          z-index: 1000;
          position: sticky;
          top: 0;
          animation: slideDown 0.3s ease-out;
        }

        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .demo-banner-content {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 16px;
        }

        .demo-banner-icon {
          color: #f59e0b;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .demo-banner-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }

        .demo-banner-label {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #ef4444;
        }

        .demo-banner-message {
          font-size: 13px;
          color: #dc2626;
          font-weight: 500;
        }

        .demo-banner-close {
          flex-shrink: 0;
          background: transparent;
          border: none;
          cursor: pointer;
          color: #dc2626;
          padding: 4px 8px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s ease;
        }

        .demo-banner-close:hover {
          background-color: rgba(220, 38, 38, 0.1);
        }

        .demo-banner-close:active {
          background-color: rgba(220, 38, 38, 0.2);
        }

        @media (max-width: 768px) {
          .demo-banner-warning {
            flex-direction: column;
            align-items: flex-start;
          }

          .demo-banner-content {
            flex-direction: column;
            padding: 12px 16px;
          }

          .demo-banner-message {
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
}
