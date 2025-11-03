
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { supabase } from './supabaseClient';

// Import Components
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import ForgotPassword from './components/ForgotPassword';
import UpdatePassword from './components/UpdatePassword';

// This component protects routes that require authentication
const PrivateRoute = ({ session, children }) => {
    return session ? children : <Navigate to="/login" />;
};

function App() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for an active session when the app loads
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        // Listen for changes in authentication state (login, logout)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        // Cleanup the subscription when the component unmounts
        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return <div>Loading...</div>; // Show a loading indicator while checking session
    }

    return (
        <Router>
            <div className="App">
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/update-password" element={<UpdatePassword />} />
                    <Route 
                        path="/dashboard" 
                        element={
                            <PrivateRoute session={session}>
                                <Dashboard session={session} />
                            </PrivateRoute>
                        } 
                    />
                    <Route 
                        path="/" 
                        element={<Navigate to={session ? "/dashboard" : "/login"} />} 
                    />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
