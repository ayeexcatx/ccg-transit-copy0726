/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import Drivers from './pages/Drivers';
import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AccessCodeLogin from './pages/AccessCodeLogin';
import AdminAccessCodes from './pages/AdminAccessCodes';
import AdminAnnouncements from './pages/AdminAnnouncements';
import AdminAvailability from './pages/AdminAvailability';
import AdminCompanies from './pages/AdminCompanies';
import AdminConfirmations from './pages/AdminConfirmations';
import AdminDashboard from './pages/AdminDashboard';
import AdminDispatches from './pages/AdminDispatches';
import AdminDriverProtocol from './pages/AdminDriverProtocol';
import AdminTemplateNotes from './pages/AdminTemplateNotes';
import AdminSmsCenter from './pages/AdminSmsCenter';
import AdminUserLookup from './pages/AdminUserLookup';
import Availability from './pages/Availability';
import Home from './pages/Home';
import Incidents from './pages/Incidents';
import Notifications from './pages/Notifications';
import Portal from './pages/Portal';
import Drivers from './pages/Drivers';
import Profile from './pages/Profile';
import Protocols from './pages/Protocols';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AccessCodeLogin": AccessCodeLogin,
    "AdminAccessCodes": AdminAccessCodes,
    "AdminAnnouncements": AdminAnnouncements,
    "AdminAvailability": AdminAvailability,
    "AdminCompanies": AdminCompanies,
    "AdminConfirmations": AdminConfirmations,
    "AdminDashboard": AdminDashboard,
    "AdminDispatches": AdminDispatches,
    "AdminDriverProtocol": AdminDriverProtocol,
    "AdminTemplateNotes": AdminTemplateNotes,
    "AdminSmsCenter": AdminSmsCenter,
    "AdminUserLookup": AdminUserLookup,
    "Availability": Availability,
    "Drivers": Drivers,
    "Home": Home,
    "Incidents": Incidents,
    "Notifications": Notifications,
    "Portal": Portal,
    "Profile": Profile,
    "Protocols": Protocols,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};