import { useState, useRef } from 'react';
import axios from 'axios';
import {
    Box,
    Button,
    Container,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Typography,
    CircularProgress,
    Alert,
    List,
    ListItem,
    ListItemText,
    Paper,
    Grid,
    Link,
    LinearProgress,
    Tabs,
    Tab,
    Stack
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import GoogleIcon from '@mui/icons-material/Google';
import FindInPageIcon from '@mui/icons-material/FindInPage';

const API_BASE_URL = 'http://localhost:5001';

function Uploader() {
    const [currentTab, setCurrentTab] = useState(0);

    // --- Local Upload States ---
    const [files, setFiles] = useState([]);
    const [localDestination, setLocalDestination] = useState('local');
    const [localMessage, setLocalMessage] = useState('');
    const [localResults, setLocalResults] = useState({});
    const [isLocalLoading, setIsLocalLoading] = useState(false);
    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);

    // --- Google Drive States ---
    const [gdriveFolders, setGdriveFolders] = useState([]);
    const [gdriveDestination, setGdriveDestination] = useState('local');
    const [gdriveMessage, setGdriveMessage] = useState('');
    const [gdriveResults, setGdriveResults] = useState({});
    const [isFetchingFolders, setIsFetchingFolders] = useState(false);
    const [isProcessingFolder, setIsProcessingFolder] = useState(false);

    const handleTabChange = (event, newValue) => setCurrentTab(newValue);

    // --- Local Upload Logic ---
    const handleFileChange = (event) => {
        setFiles(Array.from(event.target.files));
        setLocalMessage('');
        setLocalResults({});
    };

    const handleLocalUpload = async () => {
        if (files.length === 0) {
            setLocalMessage('Error: Please select files or a folder first!');
            return;
        }
        setIsLocalLoading(true);
        setLocalMessage(`Processing ${files.length} item(s)...`);

        const formData = new FormData();
        files.forEach(file => formData.append('files', file));
        formData.append('destination', localDestination);

        try {
            const response = await axios.post(`${API_BASE_URL}/process-upload`, formData, { withCredentials: true });
            setLocalResults(response.data.results);
            setLocalMessage('Processing complete!');
        } catch (error) {
            console.error('Error uploading:', error);
            setLocalMessage(error.response?.status === 401 ? 'Error: Google Drive not connected.' : 'Error: Could not process the upload.');
        } finally {
            setIsLocalLoading(false);
        }
    };

    // --- Google Drive Logic ---
    const fetchGdriveFolders = async () => {
        setIsFetchingFolders(true);
        setGdriveMessage('Fetching folders...');
        setGdriveResults({});
        try {
            const response = await axios.get(`${API_BASE_URL}/auth/gdrive/files`, { withCredentials: true });
            setGdriveFolders(response.data);
            setGdriveMessage(response.data.length > 0 ? 'Select a folder to process.' : 'No folders found.');
        } catch (error) {
            console.error("Could not fetch Google Drive folders:", error);
            setGdriveMessage("Failed to fetch folders. Please try reconnecting.");
        }
        setIsFetchingFolders(false);
    };

    const handleProcessFolder = async (folderId, folderName) => {
        setIsProcessingFolder(true);
        setGdriveMessage(`Processing folder: "${folderName}"...`);
        setGdriveResults({});
        try {
            const response = await axios.post(
                `${API_BASE_URL}/auth/gdrive/process-folder/${folderId}`,
                { destination: gdriveDestination },
                { withCredentials: true }
            );
            setGdriveMessage(response.data.message);
            setGdriveResults(response.data.results || {});
        } catch (error) {
            console.error("Failed to process folder:", error);
            setGdriveMessage("Error processing folder.");
        }
        setIsProcessingFolder(false);
    };

    // --- Layout and Tabs ---
    return (
        <Container maxWidth="md">
            <Paper
                sx={{
                    marginTop: '40px',
                    boxShadow: 3,
                    borderRadius: 2,
                    overflow: 'hidden',
                }}
            >
                {/* --- TAB NAVIGATION --- */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: '#f9f9f9' }}>
                    <Tabs value={currentTab} onChange={handleTabChange} centered variant="fullWidth">
                        <Tab icon={<GoogleIcon />} iconPosition="start" label="Process from Google Drive" />
                        <Tab icon={<UploadFileIcon />} iconPosition="start" label="Upload from Computer" />
                    </Tabs>
                </Box>

                {/* --- GOOGLE DRIVE TAB --- */}
                {currentTab === 0 && (
                    <Box
                        sx={{
                            minHeight: '480px',
                            padding: { xs: 2, md: 4 },
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                        }}
                    >
                        <Typography variant="h6" gutterBottom>
                            Connect and Process Google Drive Folders
                        </Typography>

                        <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 3 }}>
                            <Link href={`${API_BASE_URL}/auth/gdrive/login`} underline="none">
                                <Button
                                    variant="contained"
                                    color="primary"
                                    startIcon={<GoogleIcon />}
                                    sx={{ width: 200, height: 50 }}
                                >
                                    Connect/Reconnect
                                </Button>
                            </Link>

                            <Button
                                variant="contained"
                                color="secondary"
                                startIcon={<FindInPageIcon />}
                                onClick={fetchGdriveFolders}
                                disabled={isFetchingFolders}
                                sx={{ width: 200, height: 50 }}
                            >
                                {isFetchingFolders ? 'Loading...' : 'Fetch Folders'}
                            </Button>
                        </Stack>

                        {isFetchingFolders && <LinearProgress sx={{ my: 2 }} />}
                        {gdriveFolders.length > 0 && (
                            <Box sx={{ mt: 2 }}>
                                <FormControl sx={{ minWidth: 200, mb: 2 }}>
                                    <InputLabel id="gdrive-dest-label">Destination</InputLabel>
                                    <Select
                                        labelId="gdrive-dest-label"
                                        value={gdriveDestination}
                                        label="Destination"
                                        onChange={(e) => setGdriveDestination(e.target.value)}
                                    >
                                        <MenuItem value="local">Local Folder</MenuItem>
                                        <MenuItem value="gdrive">Google Drive</MenuItem>
                                    </Select>
                                </FormControl>
                                <List sx={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 1 }}>
                                    {gdriveFolders.map(folder => (
                                        <ListItem
                                            button
                                            key={folder.id}
                                            onClick={() => !isProcessingFolder && handleProcessFolder(folder.id, folder.name)}
                                            disabled={isProcessingFolder}
                                        >
                                            <ListItemText primary={`📁 ${folder.name}`} />
                                        </ListItem>
                                    ))}
                                </List>
                            </Box>
                        )}
                        {isProcessingFolder && <LinearProgress sx={{ my: 2 }} color="secondary" />}
                        {gdriveMessage && (
                            <Alert
                                severity={gdriveMessage.startsWith('Error') || gdriveMessage.startsWith('Failed') ? 'error' : 'info'}
                                sx={{ mt: 2 }}
                            >
                                {gdriveMessage}
                            </Alert>
                        )}
                        {Object.keys(gdriveResults).length > 0 && <ResultsList title="Google Drive Results:" results={gdriveResults} />}
                    </Box>
                )}

                {/* --- LOCAL UPLOAD TAB --- */}
                {currentTab === 1 && (
                    <Box
                        sx={{
                            minHeight: '480px',
                            padding: { xs: 2, md: 4 },
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                        }}
                    >
                        <Typography variant="h6" gutterBottom>
                            Upload and Process Local Files
                        </Typography>

                        <Grid container spacing={2} justifyContent="center" alignItems="center" sx={{ my: 3 }}>
                            <Grid item xs={12} sm={5}>
                                <FormControl fullWidth>
                                    <InputLabel id="local-dest-label">Destination</InputLabel>
                                    <Select
                                        labelId="local-dest-label"
                                        value={localDestination}
                                        label="Destination"
                                        onChange={(e) => setLocalDestination(e.target.value)}
                                    >
                                        <MenuItem value="local">Local Folder</MenuItem>
                                        <MenuItem value="gdrive">Google Drive</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12} sm={7}>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        startIcon={<UploadFileIcon />}
                                        onClick={() => fileInputRef.current.click()}
                                        sx={{ width: 200, height: 50 }}
                                    >
                                        Select File(s)
                                    </Button>
                                    <Button
                                        variant="contained"
                                        color="secondary"
                                        startIcon={<FolderOpenIcon />}
                                        onClick={() => folderInputRef.current.click()}
                                        sx={{ width: 200, height: 50 }}
                                    >
                                        Select Folder
                                    </Button>
                                </Stack>
                            </Grid>
                        </Grid>

                        <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple style={{ display: 'none' }} />
                        <input type="file" ref={folderInputRef} onChange={handleFileChange} webkitdirectory="true" directory="true" style={{ display: 'none' }} />

                        {files.length > 0 && <Typography variant="body1" sx={{ my: 2 }}>{files.length} item(s) selected.</Typography>}

                        <Box sx={{ mt: 3 }}>
                            <Button
                                variant="contained"
                                size="large"
                                onClick={handleLocalUpload}
                                disabled={isLocalLoading || files.length === 0}
                                startIcon={isLocalLoading ? <CircularProgress size={20} color="inherit" /> : null}
                                sx={{ width: 220, height: 50 }}
                            >
                                {isLocalLoading ? 'Processing...' : 'Process Upload'}
                            </Button>
                        </Box>

                        {localMessage && (
                            <Alert severity={localMessage.startsWith('Error:') ? 'error' : 'info'} sx={{ mt: 3 }}>
                                {localMessage}
                            </Alert>
                        )}
                        {Object.keys(localResults).length > 0 && <ResultsList title="Local Upload Results:" results={localResults} />}
                    </Box>
                )}
            </Paper>
        </Container>
    );
}

// --- Results List Component ---
const ResultsList = ({ title, results }) => (
    <Box sx={{ mt: 3, textAlign: 'left' }}>
        <Typography variant="h6">{title}</Typography>
        <List sx={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #eee', borderRadius: '4px' }}>
            {Object.entries(results).map(([filename, tags]) => (
                <ListItem key={filename} sx={{ background: '#f9f9f9', my: 0.5, borderRadius: '4px' }}>
                    <ListItemText
                        primary={<strong>{filename}</strong>}
                        secondary={`Moved to folder: '${tags[0] || 'Uncategorized'}'`}
                    />
                </ListItem>
            ))}
        </List>
    </Box>
);

export default Uploader;