import React from 'react';

export const LoadingSkeleton = ({ type = 'table', rows = 5, columns = 4 }) => {
  const renderTableSkeleton = () => (
    <div className="skeleton-table">
      <style jsx>{`
        .skeleton-table {
          background: linear-gradient(145deg, #ffffff 0%, #fafbfc 100%);
          border-radius: 20px;
          padding: 32px;
          box-shadow: 
            0 20px 40px rgba(0,0,0,0.08),
            0 8px 16px rgba(0,0,0,0.04),
            inset 0 1px 0 rgba(255,255,255,0.9);
          border: 1px solid rgba(255,255,255,0.2);
          position: relative;
          overflow: hidden;
        }
        
        .skeleton-table::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255,255,255,0.4),
            transparent
          );
          animation: tableShine 2s infinite;
        }
        
        .skeleton-title {
          height: 32px;
          width: 280px;
          background: linear-gradient(
            135deg,
            #e8f4f8 0%,
            #f0f8ff 25%,
            #e3f2fd 50%,
            #f0f8ff 75%,
            #e8f4f8 100%
          );
          background-size: 300% 100%;
          animation: gradientShimmer 2.5s ease-in-out infinite;
          border-radius: 12px;
          margin-bottom: 28px;
          position: relative;
          box-shadow: 0 4px 12px rgba(31, 168, 220, 0.1);
        }
        
        .skeleton-filters {
          display: flex;
          gap: 16px;
          margin-bottom: 32px;
          flex-wrap: wrap;
        }
        
        .skeleton-filter {
          height: 44px;
          background: linear-gradient(
            135deg,
            #f8f9fa 0%,
            #ffffff 25%,
            #f1f3f4 50%,
            #ffffff 75%,
            #f8f9fa 100%
          );
          background-size: 300% 100%;
          animation: gradientShimmer 2s ease-in-out infinite;
          border-radius: 12px;
          border: 2px solid #e9ecef;
          position: relative;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        
        .skeleton-filter:nth-child(1) { width: 140px; }
        .skeleton-filter:nth-child(2) { width: 160px; }
        .skeleton-filter:nth-child(3) { width: 120px; }
        
        .skeleton-cards {
          display: grid;
          gap: 20px;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        }
        
        .skeleton-card-item {
          background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
          border-radius: 16px;
          padding: 24px;
          border: 1px solid #e9ecef;
          box-shadow: 
            0 8px 24px rgba(0,0,0,0.06),
            0 4px 8px rgba(0,0,0,0.03);
          position: relative;
          overflow: hidden;
        }
        
        .skeleton-card-item::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255,255,255,0.6),
            transparent
          );
          animation: cardShine 2.5s infinite;
        }
        
        .skeleton-card-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }
        
        .skeleton-avatar {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(
            135deg,
rgb(229, 238, 241) 0%,
rgb(210, 225, 231) 50%,
rgb(165, 175, 179) 100%
          );
          background-size: 200% 200%;
          animation: avatarPulse 2s ease-in-out infinite;
          box-shadow: 0 4px 12px rgba(31, 168, 220, 0.2);
        }
        
        .skeleton-card-content {
          flex: 1;
        }
        
        .skeleton-name {
          height: 20px;
          background: linear-gradient(
            135deg,
            #e8f4f8 0%,
            #f0f8ff 50%,
            #e8f4f8 100%
          );
          background-size: 200% 100%;
          animation: gradientShimmer 2s ease-in-out infinite;
          border-radius: 8px;
          margin-bottom: 12px;
          width: 160px;
        }
        
        .skeleton-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }
        
        .skeleton-detail {
          height: 16px;
          background: linear-gradient(
            135deg,
            #f1f3f4 0%,
            #ffffff 50%,
            #f1f3f4 100%
          );
          background-size: 200% 100%;
          animation: gradientShimmer 1.8s ease-in-out infinite;
          border-radius: 6px;
        }
        
        .skeleton-detail:nth-child(1) { width: 80px; }
        .skeleton-detail:nth-child(2) { width: 100px; }
        .skeleton-detail:nth-child(3) { width: 90px; }
        .skeleton-detail:nth-child(4) { width: 110px; }
        
        .skeleton-badges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        
        .skeleton-badge {
          height: 24px;
          border-radius: 12px;
          background: linear-gradient(
            135deg,
            #e8f5e8 0%,
            #f0f8f0 50%,
            #e8f5e8 100%
          );
          background-size: 200% 100%;
          animation: gradientShimmer 2.2s ease-in-out infinite;
        }
        
        .skeleton-badge:nth-child(1) { width: 70px; }
        .skeleton-badge:nth-child(2) { width: 60px; }
        .skeleton-badge:nth-child(3) { width: 80px; }
        
        /* Animations */
        @keyframes gradientShimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        @keyframes tableShine {
          0% { left: -100%; }
          100% { left: 100%; }
        }
        
        @keyframes cardShine {
          0% { left: -100%; }
          100% { left: 100%; }
        }
        
        @keyframes avatarPulse {
          0%, 100% { 
            background-position: 0% 0%;
            transform: scale(1);
          }
          50% { 
            background-position: 100% 100%;
            transform: scale(1.05);
          }
        }
        
        /* Mobile responsive styles */
        @media (max-width: 768px) {
          .skeleton-table {
            padding: 20px;
            border-radius: 16px;
          }
          .skeleton-title {
            width: 100%;
            height: 28px;
            margin-bottom: 24px;
          }
          .skeleton-filters {
            flex-direction: column;
            gap: 12px;
            margin-bottom: 28px;
          }
          .skeleton-filter {
            width: 100% !important;
            height: 40px;
          }
          .skeleton-cards {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .skeleton-card-item {
            padding: 20px;
          }
          .skeleton-avatar {
            width: 48px;
            height: 48px;
          }
          .skeleton-details {
            grid-template-columns: 1fr;
            gap: 10px;
          }
        }
        
        /* Extra small screens */
        @media (max-width: 480px) {
          .skeleton-table {
            padding: 16px;
            border-radius: 12px;
          }
          .skeleton-title {
            height: 24px;
            margin-bottom: 20px;
          }
          .skeleton-filters {
            margin-bottom: 24px;
          }
          .skeleton-filter {
            height: 36px;
          }
          .skeleton-card-item {
            padding: 16px;
          }
          .skeleton-card-header {
            gap: 12px;
            margin-bottom: 16px;
          }
          .skeleton-avatar {
            width: 44px;
            height: 44px;
          }
          .skeleton-name {
            height: 18px;
            width: 120px;
            margin-bottom: 10px;
          }
          .skeleton-detail {
            height: 14px;
          }
          .skeleton-badge {
            height: 20px;
          }
        }
      `}</style>
      
      <div className="skeleton-title"></div>
      
      <div className="skeleton-filters">
        <div className="skeleton-filter"></div>
        <div className="skeleton-filter"></div>
        <div className="skeleton-filter"></div>
      </div>
      
      <div className="skeleton-cards">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="skeleton-card-item">
            <div className="skeleton-card-header">
              <div className="skeleton-avatar"></div>
              <div className="skeleton-card-content">
                <div className="skeleton-name"></div>
              </div>
            </div>
            <div className="skeleton-details">
              <div className="skeleton-detail"></div>
              <div className="skeleton-detail"></div>
              <div className="skeleton-detail"></div>
              <div className="skeleton-detail"></div>
            </div>
            <div className="skeleton-badges">
              <div className="skeleton-badge"></div>
              <div className="skeleton-badge"></div>
              <div className="skeleton-badge"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCardSkeleton = () => (
    <div className="skeleton-card">
      <style jsx>{`
        .skeleton-card {
          background: linear-gradient(145deg, #ffffff 0%, #fafbfc 100%);
          border-radius: 24px;
          padding: 40px;
          box-shadow: 
            0 24px 48px rgba(0,0,0,0.08),
            0 12px 24px rgba(0,0,0,0.04),
            inset 0 1px 0 rgba(255,255,255,0.9);
          border: 1px solid rgba(255,255,255,0.2);
          position: relative;
          overflow: hidden;
        }
        
        .skeleton-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255,255,255,0.5),
            transparent
          );
          animation: cardShine 3s infinite;
        }
        
        .skeleton-card-title {
          height: 36px;
          width: 250px;
          background: linear-gradient(
            135deg,
            #e8f4f8 0%,
            #f0f8ff 25%,
            #e3f2fd 50%,
            #f0f8ff 75%,
            #e8f4f8 100%
          );
          background-size: 300% 100%;
          animation: gradientShimmer 2.5s ease-in-out infinite;
          border-radius: 16px;
          margin-bottom: 36px;
          box-shadow: 0 4px 16px rgba(31, 168, 220, 0.12);
        }
        
        .skeleton-form-group {
          margin-bottom: 28px;
          position: relative;
        }
        
        .skeleton-label {
          height: 18px;
          width: 140px;
          background: linear-gradient(
            135deg,
            #f1f3f4 0%,
            #ffffff 50%,
            #f1f3f4 100%
          );
          background-size: 200% 100%;
          animation: gradientShimmer 2s ease-in-out infinite;
          border-radius: 8px;
          margin-bottom: 12px;
        }
        
        .skeleton-input {
          height: 52px;
          width: 100%;
          background: linear-gradient(
            135deg,
            #f8f9fa 0%,
            #ffffff 25%,
            #f1f3f4 50%,
            #ffffff 75%,
            #f8f9fa 100%
          );
          background-size: 300% 100%;
          animation: gradientShimmer 2.2s ease-in-out infinite;
          border-radius: 14px;
          border: 2px solid #e9ecef;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          position: relative;
        }
        
        .skeleton-button {
          height: 52px;
          width: 220px;
          background: linear-gradient(
            135deg,
            #1FA8DC 0%,
            #87CEEB 25%,
            #1FA8DC 50%,
            #87CEEB 75%,
            #1FA8DC 100%
          );
          background-size: 300% 100%;
          animation: buttonShimmer 2.5s ease-in-out infinite;
          border-radius: 16px;
          margin-top: 24px;
          box-shadow: 0 6px 20px rgba(31, 168, 220, 0.2);
        }
        
        /* Animations */
        @keyframes gradientShimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        @keyframes buttonShimmer {
          0%, 100% { 
            background-position: 0% 50%;
            transform: scale(1);
          }
          50% { 
            background-position: 100% 50%;
            transform: scale(1.02);
          }
        }
        
        @keyframes cardShine {
          0% { left: -100%; }
          100% { left: 100%; }
        }
        
        /* Mobile responsive styles for card */
        @media (max-width: 768px) {
          .skeleton-card {
            padding: 28px;
            border-radius: 20px;
          }
          .skeleton-card-title {
            width: 100%;
            height: 32px;
            margin-bottom: 32px;
          }
          .skeleton-form-group {
            margin-bottom: 24px;
          }
          .skeleton-label {
            width: 100px;
            height: 16px;
          }
          .skeleton-input {
            height: 48px;
          }
          .skeleton-button {
            width: 100%;
            height: 48px;
          }
        }
        
        /* Extra small screens for card */
        @media (max-width: 480px) {
          .skeleton-card {
            padding: 20px;
            border-radius: 16px;
          }
          .skeleton-card-title {
            height: 28px;
            margin-bottom: 28px;
          }
          .skeleton-form-group {
            margin-bottom: 20px;
          }
          .skeleton-label {
            height: 14px;
            width: 80px;
          }
          .skeleton-input {
            height: 44px;
          }
          .skeleton-button {
            height: 44px;
          }
        }
      `}</style>
      
      <div className="skeleton-card-title"></div>
      
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="skeleton-form-group">
          <div className="skeleton-label"></div>
          <div className="skeleton-input"></div>
        </div>
      ))}
      
      <div className="skeleton-button"></div>
    </div>
  );

  const renderListSkeleton = () => (
    <div className="skeleton-list">
      <style jsx>{`
        .skeleton-list {
          background: linear-gradient(145deg, #ffffff 0%, #fafbfc 100%);
          border-radius: 20px;
          padding: 28px;
          box-shadow: 
            0 20px 40px rgba(0,0,0,0.08),
            0 8px 16px rgba(0,0,0,0.04),
            inset 0 1px 0 rgba(255,255,255,0.9);
          border: 1px solid rgba(255,255,255,0.2);
          position: relative;
          overflow: hidden;
        }
        
        .skeleton-list::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255,255,255,0.4),
            transparent
          );
          animation: listShine 2.5s infinite;
        }
        
        .skeleton-list-item {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 20px 0;
          border-bottom: 1px solid rgba(0,0,0,0.04);
          position: relative;
        }
        
        .skeleton-list-item:last-child {
          border-bottom: none;
        }
        
        .skeleton-avatar {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(
            135deg,
            #1FA8DC 0%,
            #87CEEB 25%,
            #20B2AA 50%,
            #87CEEB 75%,
            #1FA8DC 100%
          );
          background-size: 300% 300%;
          animation: avatarPulse 2.5s ease-in-out infinite;
          box-shadow: 0 6px 16px rgba(31, 168, 220, 0.2);
          position: relative;
        }
        
        .skeleton-content {
          flex: 1;
        }
        
        .skeleton-name {
          height: 22px;
          width: 180px;
          background: linear-gradient(
            135deg,
            #e8f4f8 0%,
            #f0f8ff 25%,
            #e3f2fd 50%,
            #f0f8ff 75%,
            #e8f4f8 100%
          );
          background-size: 300% 100%;
          animation: gradientShimmer 2.2s ease-in-out infinite;
          border-radius: 10px;
          margin-bottom: 10px;
          box-shadow: 0 2px 8px rgba(31, 168, 220, 0.08);
        }
        
        .skeleton-subtitle {
          height: 18px;
          width: 130px;
          background: linear-gradient(
            135deg,
            #f1f3f4 0%,
            #ffffff 25%,
            #f8f9fa 50%,
            #ffffff 75%,
            #f1f3f4 100%
          );
          background-size: 300% 100%;
          animation: gradientShimmer 2s ease-in-out infinite;
          border-radius: 8px;
        }
        
        .skeleton-status {
          width: 80px;
          height: 28px;
          border-radius: 14px;
          background: linear-gradient(
            135deg,
            #e8f5e8 0%,
            #f0f8f0 25%,
            #e8f5e8 50%,
            #f0f8f0 75%,
            #e8f5e8 100%
          );
          background-size: 300% 100%;
          animation: gradientShimmer 2.4s ease-in-out infinite;
        }
        
        /* Animations */
        @keyframes gradientShimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        @keyframes avatarPulse {
          0%, 100% { 
            background-position: 0% 0%;
            transform: scale(1);
          }
          50% { 
            background-position: 100% 100%;
            transform: scale(1.05);
          }
        }
        
        @keyframes listShine {
          0% { left: -100%; }
          100% { left: 100%; }
        }
        
        /* Mobile responsive styles for list */
        @media (max-width: 768px) {
          .skeleton-list {
            padding: 20px;
            border-radius: 16px;
          }
          .skeleton-list-item {
            gap: 16px;
            padding: 16px 0;
          }
          .skeleton-avatar {
            width: 48px;
            height: 48px;
          }
          .skeleton-name {
            width: 140px;
            height: 20px;
            margin-bottom: 8px;
          }
          .skeleton-subtitle {
            width: 100px;
            height: 16px;
          }
          .skeleton-status {
            width: 70px;
            height: 24px;
          }
        }
        
        /* Extra small screens for list */
        @media (max-width: 480px) {
          .skeleton-list {
            padding: 16px;
            border-radius: 12px;
          }
          .skeleton-list-item {
            gap: 12px;
            padding: 12px 0;
          }
          .skeleton-avatar {
            width: 44px;
            height: 44px;
          }
          .skeleton-name {
            width: 120px;
            height: 18px;
            margin-bottom: 6px;
          }
          .skeleton-subtitle {
            width: 80px;
            height: 14px;
          }
          .skeleton-status {
            width: 60px;
            height: 20px;
          }
        }
      `}</style>
      
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton-list-item">
          <div className="skeleton-avatar"></div>
          <div className="skeleton-content">
            <div className="skeleton-name"></div>
            <div className="skeleton-subtitle"></div>
          </div>
          <div className="skeleton-status"></div>
        </div>
      ))}
    </div>
  );

  switch (type) {
    case 'table':
      return renderTableSkeleton();
    case 'card':
      return renderCardSkeleton();
    case 'list':
      return renderListSkeleton();
    default:
      return renderTableSkeleton();
  }
};

export default LoadingSkeleton;

