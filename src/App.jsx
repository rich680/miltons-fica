import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context.jsx'
import Login from './pages/Login.jsx'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Clients from './pages/Clients.jsx'
import Transactions from './pages/Transactions.jsx'
import Screening from './pages/Screening.jsx'
import RiskRating from './pages/RiskRating.jsx'
import UBO from './pages/UBO.jsx'
import Reports from './pages/Reports.jsx'
import Agents from './pages/Agents.jsx'
import PepAuthorisations from './pages/PepAuthorisations.jsx'
import AuditLog from './pages/AuditLog.jsx'
import AgencyStaff from './pages/AgencyStaff.jsx'

function ProtectedRoute({ children }) {
  const { currentUser } = useApp()
  return currentUser ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"    element={<Dashboard />} />
            <Route path="clients"      element={<Clients />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="screening"    element={<Screening />} />
            <Route path="risk-rating"  element={<RiskRating />} />
            <Route path="ubo"          element={<UBO />} />
            <Route path="reports"      element={<Reports />} />
            <Route path="agents"       element={<Agents />} />
            <Route path="pep-auth"    element={<PepAuthorisations />} />
            <Route path="audit"       element={<AuditLog />} />
            <Route path="agency-staff" element={<AgencyStaff />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
