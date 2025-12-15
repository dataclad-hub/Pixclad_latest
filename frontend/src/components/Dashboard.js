

import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Uploader from './Uploader'; // Make sure this is imported
// --- MUI IMPORTS FOR THE HEADER ---
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import logo from '../logo.png'

function Dashboard({ session }) {
    const navigate = useNavigate();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    return (
        <Box>
            {/* --- THIS IS THE HEADER WITH YOUR WELCOME ID AND LOGOUT --- */}
            <AppBar position="static" elevation={1} sx={{bgcolor: "#1b2a41", padding: "37px 0"}}>
                <Toolbar>
                    <Typography fontFamily="'Montserrat'" variant="h3" component="div" sx={{ display:"flex", flexGrow: 1, justifyContent: "center", marginLeft: "65px"}} color="#f7f7f7">
                        {/* Welcome, {session?.user?.email ?? 'User'} */}
                        <img src={logo} alt="PixClad logo" style={{ width: 57, height: 57, objectFit: "contain", gap: 1}} />
                          PixClad
                    </Typography>
                    <Button color="error" variant="contained" onClick={handleLogout}>
                        Logout
                    </Button>
                </Toolbar>
            </AppBar>
            <Uploader/>
        </Box>
    );
}

export default Dashboard;