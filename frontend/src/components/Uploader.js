// src/components/Uploader.js
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";

/* Brand tokens */
const DEEP_BLUE = "#1b2a41";
const CORAL_RED = "#ff6b6b";
const LIGHT_BG = "#f7f7f7";
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "";

/* Tiny UI helpers */
const StepTitle = ({ number, children }) => (
  <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
    <div style={{
      width: 36, height: 36, borderRadius: 10, background: DEEP_BLUE,
      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700,  marginRight: 12
    }}>{number}</div>
    <h3 style={{ margin: 0, color: DEEP_BLUE, fontSize: 18}}>{children}</h3>
  </div>
);

const CTAButton = ({ children, onClick, disabled, style = {} }) => (
  <button onClick={onClick} disabled={disabled}
    style={{
      border: "none", padding: "10px 16px", borderRadius: 12,
      cursor: disabled ? "not-allowed" : "pointer", fontWeight: 700,
      // background: `linear-gradient(135deg, ${DEEP_BLUE} 0%, ${CORAL_RED} 100%)`,
      background: CORAL_RED,
      color: "#fff", boxShadow: "0 8px 30px rgba(27,42,65,0.08)", ...style
    }}>
    {children}
  </button>
);

const OutlineButton = ({ children, onClick, disabled, style = {} }) => (
  <button onClick={onClick} disabled={disabled}
    style={{
      border: `1.5px solid ${DEEP_BLUE}`, padding: "10px 16px", borderRadius: 12,
      cursor: disabled ? "not-allowed" : "pointer", fontWeight: 600, background: "#fff",
      color: DEEP_BLUE, ...style
    }}>
    {children}
  </button>
);

export default function Uploader() {

  /* Drive states */
  const [isSourceConnected, setIsSourceConnected] = useState(false);
  const [isDestinationConnected, setIsDestinationConnected] = useState(false);
  const [gdriveDestination, setGdriveDestination] = useState("gdrive-source");
  const [gdriveFolders, setGdriveFolders] = useState([]);
  const [isFetchingFolders, setIsFetchingFolders] = useState(false);
  const [isProcessingFolder, setIsProcessingFolder] = useState(false);
  const [gdriveMessage, setGdriveMessage] = useState("");
  const [gdriveResults, setGdriveResults] = useState({});

  /* Local states */
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [localDestination, setLocalDestination] = useState("local");
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const [localMessage, setLocalMessage] = useState("");
  const [localResults, setLocalResults] = useState({});

  useEffect(() => {
    checkConnectionStatus();
    if (!document.getElementById("montserrat-font")) {
      const link = document.createElement("link");
      link.id = "montserrat-font";
      link.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
  }, []);

  async function checkConnectionStatus() {
    try {
      const res = await axios.get(`${API_BASE_URL}/auth/gdrive/status`, { withCredentials: true });
      setIsSourceConnected(Boolean(res.data?.source_connected));
      setIsDestinationConnected(Boolean(res.data?.destination_connected));
    } catch {
      setIsSourceConnected(false);
      setIsDestinationConnected(false);
    }
  }

  /* Drive actions */
  async function fetchGdriveFolders() {
    setGdriveFolders([]); setGdriveMessage(""); setIsFetchingFolders(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/auth/gdrive/files`, { withCredentials: true });
      setGdriveFolders(res.data || []);
      setGdriveMessage(res.data && res.data.length > 0 ? "Select a folder to process." : "No folders found in root.");
    } catch (err) {
      setGdriveMessage(err?.response?.status === 401 ? "Error: Source Account disconnected." : "Failed to fetch folders.");
    } finally {
      setIsFetchingFolders(false);
    }
  }

  async function handleProcessFolder(folderId, folderName) {
    setIsProcessingFolder(true); setGdriveMessage(`Processing folder: "${folderName}"...`); setGdriveResults({});
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/gdrive/process-folder/${folderId}`, { destination: gdriveDestination }, { withCredentials: true });
      let successMessage = res.data?.message || "Processing complete.";
      if (gdriveDestination !== "local" && !successMessage.includes("Output")) successMessage += " Results saved at the selected location's 'Output' folder.";
      setGdriveMessage(successMessage); setGdriveResults(res.data?.results || {});
    } catch (err) {
      setGdriveMessage(err?.response?.status === 401 && gdriveDestination === "gdrive-destination" ? "Error: Destination not connected." : "Error processing folder.");
    } finally {
      setIsProcessingFolder(false);
    }
  }

  /* Local actions */
  function handleFileChange(e) {
    const selected = Array.from(e.target.files || []);
    setFiles(selected); setLocalMessage(""); setLocalResults({});
  }

  const handleLocalUpload = async () => {
    if (files.length === 0) { setLocalMessage("Error: Please select files or a folder first!"); return; }
    setIsLocalLoading(true);
    setLocalMessage(`Processing ${files.length} item(s)...`);

    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    formData.append('destination', localDestination);

    try {
      if (localDestination === 'local') {
        const response = await axios.post(`${API_BASE_URL}/process-upload`, formData, {
          withCredentials: true,
          responseType: 'blob',
        });

        // Determine filename from header; fallback to timestamped name
        let filename = null;
        const contentDisp = response.headers && response.headers['content-disposition'];
        if (contentDisp) {
          const m = contentDisp.match(/filename\*?=(?:UTF-8'')??([^;"]+)?/);
          if (m && m[1]) filename = decodeURIComponent(m[1]);
        }
        if (!filename) {
          const now = new Date();
          const ts = now.toISOString().replace(/[:.]/g, '-');
          filename = `PixClad_Output_${ts}.zip`;
        }

        const blob = new Blob([response.data], { type: response.headers['content-type'] || 'application/zip' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        window.URL.revokeObjectURL(url);

        setLocalMessage('Download started — your categorized files are ready.');
        setLocalResults({});

      } else {
        // Save to Drive (existing flow)
        const res = await axios.post(`${API_BASE_URL}/process-upload`, formData, { withCredentials: true });
        setLocalResults(res.data.results || {}); setLocalMessage('Processing complete! Files saved to Google Drive.');
      }
    } catch (error) {
      // Try to parse JSON error blob if available
      if (error.response && error.response.data) {
        try {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const json = JSON.parse(reader.result);
              setLocalMessage(json.error || 'Error: Could not process the upload.');
            } catch {
              setLocalMessage('Error: Could not process the upload.');
            }
          };
          reader.readAsText(error.response.data);
        } catch {
          setLocalMessage('Error: Could not process the upload.');
        }
      } else {
        setLocalMessage('Error: Could not process the upload.');
      }
    } finally {
      setIsLocalLoading(false);
    }
  };

  const styles = {
    page: { minHeight: "100vh", background: DEEP_BLUE, fontFamily: "'Montserrat', sans-serif", padding: "40px 20px", color: LIGHT_BG },
    container: { maxWidth: 1360, margin: "0 auto" },
    card: { background: DEEP_BLUE, borderRadius: 16, boxShadow: "0 12px 40px rgba(11,18,30,0.06)", padding: 22 },
    headerRow: { display: "flex", justifyContent: "center", alignItems: "center", marginBottom: 18 },
    subtitle: { margin: "6px 0 0 0", color: "#6b7280", fontSize: 14 },
    modeSelector: { display: "flex", gap: 10, alignItems: "center" },
    grid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 40, justifyContent: "center", marginTop: 18, padding: 18,},
    tgrid: { display: "flex", gridTemplateColumns: "repeat(2, 1fr)", justifyContent: "space-between", width: "60%", alignItems: "center"},
    panel: { background: LIGHT_BG, borderRadius: 12, padding: 18, border: "1px solid rgba(0,0,0,0.04)", justifyContent: "center"},
    field: { marginTop: 12, display: "flex", flexDirection: "column", gap: 8, color: DEEP_BLUE },
    select: { padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)", background: LIGHT_BG },
    listItem: { padding: 12, borderRadius: 8, border: "1px solid rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
    resultBox: { marginTop: 14, padding: 12, borderRadius: 8, background: DEEP_BLUE, border: "1px solid #eee" },
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.headerRow}>
            <div style={styles.tgrid}>
              <h2 style={{ margin: 0, color: LIGHT_BG, fontSize: 22}}>External Files</h2>
              {/* <p style={styles.subtitle}>Connect a source account or upload files from your computer.</p> */}
              <h2 style={{ margin: 0, color: LIGHT_BG, fontSize: 22}}>Local Files</h2>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={styles.grid}>
              <div style={styles.panel}>
                <div style={{display: "flex", justifyContent: "center", padding: "12px", color: LIGHT_BG}}>
                  <StepTitle number="1" style={{color: LIGHT_BG}}>Connect Source</StepTitle>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
                    <div style={{ fontSize: 14, color: "#6b7280" }}>Link the account that contains the folders you want to process.</div>
                    <select style={styles.select}>
                      <option >Google Drive</option>
                      <option >Different Source (Upcoming Feature)</option>
                    </select>
                    <div style={{ marginTop: 8 }}>
                      <a href={`${API_BASE_URL}/auth/gdrive/login`} style={{ textDecoration: "none" }}>
                        <CTAButton>Connect Source Account</CTAButton>
                      </a>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  {isSourceConnected ? (
                    <div style={{ padding: 10, borderRadius: 8, background: "#e9f7ef", color: DEEP_BLUE, fontWeight: 600 }}>✅ Source Account Connected</div>
                  ) : (
                    <div style={{ padding: 10, borderRadius: 8, background: "#fff6f6", color: CORAL_RED }}>⚠ Source not connected</div>
                  )}
                </div>

                <div style={styles.field}>
                  <div style={{display: "flex", justifyContent: "center", padding: "12px", marginTop: 28}}>
                    <StepTitle number="2">Select Output Location</StepTitle>
                  </div>
                  <div style={{ fontSize: 14, color: "#6b7280"}}>Where should the processed files be saved?</div>
                  <select value={gdriveDestination} onChange={(e) => setGdriveDestination(e.target.value)} style={styles.select}>
                    <option value="gdrive-source">Same Drive ('Output' folder)</option>
                    <option value="gdrive-destination">Different Drive ('Output' folder)</option>
                    <option value="local">Download Locally</option>
                  </select>

                  {gdriveDestination === "gdrive-destination" && (
                    <div style={{ marginTop: 12 }}>
                      {!isDestinationConnected ? (
                        <a href={`${API_BASE_URL}/auth/gdrive/login-destination`} style={{ textDecoration: "none" }}>
                          <OutlineButton>Connect Output Drive</OutlineButton>
                        </a>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ padding: 10, borderRadius: 8, background: "#e9f7ef", color: DEEP_BLUE }}>✅ Output Drive Connected</div>
                          <a href={`${API_BASE_URL}/auth/gdrive/logout-destination`} style={{ textDecoration: "none" }}>
                            <button style={{ background: "transparent", border: "none", color: CORAL_RED, cursor: "pointer", fontWeight: 700 }}>Change</button>
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={styles.field}>
                  <div style={{display: "flex", justifyContent: "center", padding: "12px", marginTop: 28}}>
                    <StepTitle number="3">Fetch Folders</StepTitle>
                  </div>
                  <div style={{ fontSize: 14, color: "#6b7280" }}>Load folders from your source to pick one to process.</div>
                  <div style={{ marginTop: 8 }}>
                    <OutlineButton onClick={fetchGdriveFolders} disabled={!isSourceConnected || isFetchingFolders}>{isFetchingFolders ? "Fetching..." : "Fetch Folders"}</OutlineButton>
                  </div>
                  {isFetchingFolders && <div style={{ marginTop: 8 }}><progress style={{ width: "100%" }} /></div>}
                </div>

                <div style={styles.field}>
                  <div style={{display: "flex", justifyContent: "center", padding: "12px", color: DEEP_BLUE, marginTop: 28}}>
                    <StepTitle number="4">Select a Folder to Process</StepTitle>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    {gdriveFolders.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {gdriveFolders.map((f, i) => (
                          <div key={f.id || i} role="button" onClick={() => handleProcessFolder(f.id, f.name)} style={{ ...styles.listItem, cursor: isProcessingFolder ? "not-allowed" : "pointer", borderLeft: `6px solid ${CORAL_RED}`, opacity: isProcessingFolder ? 0.6 : 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div style={{ fontWeight: 700 }}>{f.name}</div>
                              <div style={{ fontSize: 13, color: DEEP_BLUE }}>{f.mimeType || ""}</div>
                            </div>
                            <div style={{ fontSize: 13, color: DEEP_BLUE }}></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: 12, borderRadius: 8, background: LIGHT_BG }}>
                        <div style={{ fontSize: 14, color: "#6b7280" }}>{gdriveMessage || "No folders loaded yet."}</div>
                        <div style={{ marginTop: 10 }}><OutlineButton onClick={fetchGdriveFolders}>Try Again</OutlineButton></div>
                      </div>
                    )}
                  </div>
                  {isProcessingFolder && <div style={{ marginTop: 8 }}><progress style={{ width: "100%" }} /></div>}
                </div>

                <div style={{ marginTop: 16 }}>
                  {gdriveMessage && <div style={{ padding: 12, borderRadius: 8, background: "#fff", color: DEEP_BLUE }}><strong>{gdriveMessage}</strong></div>}
                  {Object.keys(gdriveResults).length > 0 && (
                    <div style={styles.resultBox}><div style={{ fontWeight: 700, marginBottom: 8, color: LIGHT_BG }}>Processing Summary</div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {Object.entries(gdriveResults).map(([name, tags]) => (<div key={name} style={{ display: "flex", justifyContent: "space-between" }}><div>{name}</div><div style={{ color: CORAL_RED }}>{tags[0]?.name || "Uncategorized"}</div><div style={{ color: LIGHT_BG }}>{tags[0]?.conf || "0.00"}</div></div>))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ ...styles.panel }}>
                <div style={{display: "flex", justifyContent: "center", padding: "12px"}}>
                  <StepTitle number="1">Select Output Location</StepTitle>
                </div>
                <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 8 }}>Where should the processed files be saved?</div>
                <div><select value={localDestination} onChange={(e) => setLocalDestination(e.target.value)} style={styles.select}><option value="local">Download Locally</option><option value="gdrive">Save to Google Drive</option></select></div>

                {localDestination === "gdrive" && (
                  <div style={{ marginTop: 16 }}>{!isSourceConnected ? (<a href={`${API_BASE_URL}/auth/gdrive/login`} style={{ textDecoration: "none" }}><CTAButton>Connect Google Drive</CTAButton></a>) : (<div style={{ padding: 10, borderRadius: 8, background: "#e9f7ef", color: DEEP_BLUE }}>✅ Drive Connected (will save outputs to your Drive)</div>)}</div>
                )}

                <div style={styles.field}>
                  <div style={{display: "flex", justifyContent: "center", padding: "12px", marginTop: 28}}>
                    <StepTitle number="2">Select Files or Folder</StepTitle>
                  </div>
                  <div style={{ fontSize: 14, color: "#6b7280" }}>Upload individual files or a full folder.</div>
                  <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "center" }}>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple style={{ display: "none" }} />
                    <input type="file" ref={folderInputRef} onChange={handleFileChange} webkitdirectory="true" directory="true" style={{ display: "none" }} />
                    <OutlineButton onClick={() => fileInputRef.current.click()}>Select File(s)</OutlineButton>
                    <OutlineButton onClick={() => folderInputRef.current.click()}>Select Folder</OutlineButton>
                  </div>
                  <div style={{ fontSize: 14, marginTop: 10, color: "#6b7280" }}>{files.length} item(s) selected.</div>
                </div>

                <div style={{ marginTop: 14}}>
                  <a href="#" onClick={() => { setFiles([]); setLocalResults({}); setLocalMessage(""); }} style={{ color: DEEP_BLUE }}>Clear Selection</a>
                </div>

                <div style={styles.field}>
                  <div style={{display: "flex", justifyContent: "center", padding: "12px", marginTop: 28}}>
                    <StepTitle number="3">Process Upload</StepTitle>
                  </div>
                  <div style={{ fontSize: 14, color: "#6b7280" }}>Start categorisation for selected files.</div>
                  <div style={{ marginTop: 12 }}><CTAButton onClick={handleLocalUpload} disabled={isLocalLoading || files.length === 0}>{isLocalLoading ? "Processing..." : "Process Upload"}</CTAButton></div>
                  {isLocalLoading && <div style={{ marginTop: 8 }}><progress style={{ width: "100%" }} /></div>}
                </div>

                <div style={{ marginTop: 16 }}>
                  {localMessage && <div style={{ padding: 10, borderRadius: 8, background: "#fff" }}>{localMessage}</div>}
                  {Object.keys(localResults).length > 0 && (
                    <div style={styles.resultBox}><div style={{ fontWeight: 700, marginBottom: 8, color: LIGHT_BG }}>Local Upload Summary</div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {Object.entries(localResults).map(([name, tags]) => (<div key={name} style={{ display: "flex", justifyContent: "space-between" }}><div>{name}</div><div style={{ color: CORAL_RED }}>{tags[0]?.name || "Uncategorized"}</div><div style={{ color: LIGHT_BG }}>{tags[0]?.conf || "0.00"}</div></div>))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
            <div style={{padding: 17}}>
                <div style={styles.panel}>
                  <div style={{ marginBottom: 12 }}>
                    <h4 style={{ marginTop: 10, color: DEEP_BLUE }}>External Connection Status</h4>
                    <div style={{ marginTop: 12 }}>
                      <div style={{ marginBottom: 8, color: DEEP_BLUE }}><strong>Source:</strong> {isSourceConnected ? "Connected" : "Not connected"}</div>
                      <div style={{ marginBottom: 8, color: DEEP_BLUE }}><strong>Destination:</strong> {gdriveDestination === "gdrive-destination" ? (isDestinationConnected ? "Connected" : "Not connected") : "Using selected option"}</div>
                    </div>
                  </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}