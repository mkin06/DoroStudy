// MAIN ENTRY POINT


import React from 'react';
import ReactDOM from 'react-dom/client';
import TimerPage from './pages/TimerPage';
import './index.css';  // Global CSS nếu có
import App from './App';

// Tạo root element và render app
ReactDOM.createRoot(document.getElementById('root')).render(
    // <React.StrictMode>
    //     <TimerPage />
    // </React.StrictMode>
<React.StrictMode>
        <App />
    </React.StrictMode>
);
