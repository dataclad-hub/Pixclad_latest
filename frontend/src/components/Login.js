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
    Grid
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Avatar from '@mui/material/Avatar';
import { AppBar, Toolbar} from '@mui/material';
import logo from '../logo.png'
// --- END OF IMPORTS ---

function Login() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError('');

        const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            setError(error.message);
        } else {
            navigate('/dashboard'); // Redirect to dashboard on success
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
                            borderRadius: 2,
                        }}
                    >
                        <Avatar sx={{ m: 1, bgcolor: '#ff6b6b' }}>
                            <LockOutlinedIcon />
                        </Avatar>
                        <Typography component="h1" variant="h5" color='#1b2a41'>
                            Sign In
                        </Typography>
                        <Box component="form" onSubmit={handleLogin} noValidate sx={{ mt: 1 }}>
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                id="email"
                                label="Email Address"
                                name="email"
                                autoComplete="email"
                                autoFocus
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                name="password"
                                label="Password"
                                type="password"
                                id="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            
                            {error && (
                                <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
                                    {error}
                                </Alert>
                            )}
                                
                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                sx={{ mt: 3, mb: 2, height: '48px', backgroundColor: "#ff6b6b", color: "#f7f7f7" }}
                                disabled={loading}
                            >
                                {loading ? <CircularProgress size={24} color="inherit" /> : "Sign In"}
                            </Button>
                            
                            <Grid container justifyContent="space-between">
                                <Grid item xs>
                                    <Link component={RouterLink} to="/forgot-password" variant="body2" sx={{color: "#ff6b6b"}}>
                                        Forgot password?
                                    </Link>
                                </Grid>
                                <Grid item xs>
                                    <Typography variant="body2" sx={{color: "#1b2a41"}}>
                                        {"Don't have an account? "}
                                            <Link component={RouterLink} to="/register" variant="body2" sx={{color: "#ff6b6b"}}>
                                                Sign Up
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

export default Login;