import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SitesPage from './pages/SitesPage.jsx';
import ChargersPage from './pages/ChargersPage.jsx';
import FaultsPage from './pages/FaultsPage.jsx';
import MaintenancePage from './pages/MaintenancePage.jsx';
import VisitsPage from './pages/VisitsPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import './../styles.css';

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'sites', element: <SitesPage /> },
      { path: 'chargers', element: <ChargersPage /> },
      { path: 'faults', element: <FaultsPage /> },
      { path: 'maintenance', element: <MaintenancePage /> },
      { path: 'visits', element: <VisitsPage /> },
      { path: 'users', element: <UsersPage /> }
    ]
  }
]);

ReactDOM.createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
