import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
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
import LockResetIcon from '@mui/icons-material/LockReset';
import Avatar from '@mui/material/Avatar';
// --- END OF IMPORTS ---

function ForgotPassword() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handlePasswordReset = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/update-password', // Redirect to your update password page
        });

        if (error) {
            setError(error.message);
        } else {
            setMessage('Password reset email sent! Please check your inbox.');
        }
        setLoading(false);
    };

    return (
        <Container component="main" maxWidth="xs">
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
                <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
                    <LockResetIcon />
                </Avatar>
                <Typography component="h1" variant="h5">
                    Reset Password
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
                    Enter your email and we'll send you a link to reset your password.
                </Typography>
                <Box component="form" onSubmit={handlePasswordReset} noValidate sx={{ mt: 3 }}>
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
                        sx={{ mt: 3, mb: 2, height: '48px' }}
                        disabled={loading}
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : "Send Reset Link"}
                    </Button>
                    
                    <Grid container justifyContent="flex-end">
                        <Grid item>
                            <Link component={RouterLink} to="/login" variant="body2">
                                {"Remembered your password? Sign in"}
                            </Link>
                        </Grid>
                    </Grid>
                </Box>
            </Paper>
        </Container>
    );
}

export default ForgotPassword;