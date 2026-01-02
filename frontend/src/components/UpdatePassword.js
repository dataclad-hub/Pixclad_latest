import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { supabase } from '../supabaseClient';

// --- NEW MUI IMPORTS ---
import {
    Container,
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    CircularProgress,
    Alert,
    Link,
    Grid,
    AppBar,
    Toolbar
} from '@mui/material';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import Avatar from '@mui/material/Avatar';
import logo from '../logo.png'
// --- END OF IMPORTS ---

function UpdatePassword() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleUpdatePassword = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        // Supabase client automatically handles the token from the URL
        const { error } = await supabase.auth.updateUser({
            password: password
        });

        if (error) {
            setError(error.message);
        } else {
            setMessage('Password updated successfully! Redirecting to login...');
            setTimeout(() => {
                navigate('/login');
            }, 3000); // Wait 3 seconds before redirecting
        }
        setLoading(false);
    };

    return (
        <div>
            <AppBar position="static" elevation={1} sx={{bgcolor: "#1b2a41"}}>
                <Toolbar>
                    <Typography fontFamily="'Montserrat'" variant="h3" component="div" sx={{ display:"flex", flexGrow: 1, justifyContent: "center", padding: "40px 0", marginRight: "28px"}} color="#f7f7f7">
                        {/* Welcome, {session?.user?.email ?? 'User'} */}
                        <img src={logo} alt="PixClad logo" style={{ width: 57, height: 57, objectFit: "contain", gap: 1}} />
                            PixClad
                    </Typography>
                </Toolbar>
            </AppBar>
            <div style={{backgroundColor: "#1b2a41", minHeight: "100vh", padding: "1px 0"}}>
                <Container component="main" maxWidth="sm">
                    <Paper 
                        elevation={6}
                        sx={{
                            marginTop: 8,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: 4,
                            borderRadius: 2
                        }}
                    >
                        <Avatar sx={{ m: 1, bgcolor: '#ff6b6b' }}>
                            <VpnKeyIcon />
                        </Avatar>
                        <Typography component="h1" variant="h5" color="#1b2a41">
                            Update Your Password
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1, textAlign: 'center', color: "#1b2a41" }}>
                            Enter your new password below.
                        </Typography>
                        <Box component="form" onSubmit={handleUpdatePassword} noValidate sx={{ mt: 3 }}>
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                name="password"
                                label="New Password"
                                type="password"
                                id="password"
                                autoFocus
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            
                            {error && (
                                <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
                                    {error}
                                </Alert>
                            )}
                            {message && (
                                <Alert severity="success" sx={{ mt: 2, width: '100%' }}>
                                    {message}
                                </Alert>
                            )}

                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                sx={{ mt: 3, mb: 2, height: '48px', backgroundColor: "#ff6b6b" }}
                                disabled={loading}
                            >
                                {loading ? <CircularProgress size={24} color="inherit" /> : "Update Password"}
                            </Button>
                            
                            <Grid container justifyContent="center">
                                <Grid item>
                                    <Typography variant="body2" sx={{color: "#1b2a41"}}>
                                        <Link component={RouterLink} to="/login" variant="body2" color="#ff6b6b">
                                            {"Back to Sign in"}
                                        </Link>
                                    </Typography>
                                </Grid>
                            </Grid>
                        </Box>
                    </Paper>
                </Container>
            </div>
        </div>
    );
}

export default UpdatePassword;