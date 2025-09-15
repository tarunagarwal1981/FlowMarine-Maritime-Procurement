import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { HomePage } from '../pages/HomePage';
import { DashboardPage } from '../pages/DashboardPage';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { RequisitionsPage } from '../pages/RequisitionsPage';
import { CatalogPage } from '../pages/CatalogPage';
import { ReportsPage } from '../pages/ReportsPage';
import { QuotesPage } from '../pages/QuotesPage';

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="requisitions/*" element={<RequisitionsPage />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="quotes" element={<QuotesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          
          {/* Redirect old routes */}
          <Route path="home" element={<Navigate to="/" replace />} />
          
          {/* 404 fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};