
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Uploader from './Uploader';

// --- MUI IMPORTS FOR THE HEADER ---
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';

function Dashboard({ session }) {
    const navigate = useNavigate();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    return (
        <Box>
            {/* --- HEADER --- */}
            <AppBar position="static" color="default" elevation={1}>
                <Toolbar sx={{ justifyContent: 'space-between' }}>
                    <Typography variant="h6" component="div">
                        Welcome, {session?.user?.email}!
                    </Typography>
                    <Button color="error" variant="contained" onClick={handleLogout}>
                        Logout
                    </Button>
                </Toolbar>
            </AppBar>

            {/* --- MAIN CONTENT CENTERED --- */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '80vh', // adjusts vertical centering area
                }}
            >
                <Uploader />
            </Box>
        </Box>
    );
}

export default Dashboard;
