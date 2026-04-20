// components/UploadData.jsx (add upload session tracking)
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import JSZip from 'jszip';
import CryptoJS from 'crypto-js';

// Security configuration
const SECURITY_CONFIG = {
  MAX_ZIP_SIZE_MB: 50,
  MAX_FILES_PER_ZIP: 1000,
  MAX_JSON_SIZE_MB: 5,
  MAX_DEPTH: 20,
  ALLOWED_MIME_TYPES: ['application/zip', 'application/x-zip-compressed'],
  RATE_LIMIT_WINDOW_MS: 60000,
  MAX_UPLOADS_PER_WINDOW: 10,
  SKIP_DUPLICATES: true,
};

// Rate limiting tracking
const rateLimitMap = new Map();

// Storage key for tracking upload sessions
const UPLOAD_SESSION_KEY = 'last_upload_session';

// ID Generation Functions
const generateRunHash = (runData) => {
  const uniqueProps = {
    seed: runData.seed,
    run_time: runData.run_time,
    start_time: runData.start_time,
    player_id: runData.players?.[0]?.id || 1,
    build_id: runData.build_id,
    ascension: runData.ascension,
    win: runData.win
  };
  return CryptoJS.SHA256(JSON.stringify(uniqueProps)).toString();
};

const generateUserId = (firstRunData) => {
  const userProps = {
    platform: firstRunData.platform_type || 'unknown',
    seed: firstRunData.seed,
    first_run_time: firstRunData.start_time
  };
  const hash = CryptoJS.SHA256(JSON.stringify(userProps)).toString();
  return `user_${hash.substring(0, 16)}`;
};

// Generate a unique upload session ID
const generateUploadSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

function UploadData({ onUploadComplete }) {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [filesToUpload, setFilesToUpload] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [errorDetails, setErrorDetails] = useState(null);
  const [skipDuplicates, setSkipDuplicates] = useState(SECURITY_CONFIG.SKIP_DUPLICATES);

  // Rate limiting check
  const checkRateLimit = (clientId) => {
    const now = Date.now();
    const userUploads = rateLimitMap.get(clientId) || [];
    const recentUploads = userUploads.filter(timestamp => now - timestamp < SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS);
    
    if (recentUploads.length >= SECURITY_CONFIG.MAX_UPLOADS_PER_WINDOW) {
      return false;
    }
    
    recentUploads.push(now);
    rateLimitMap.set(clientId, recentUploads);
    return true;
  };

  // Validate JSON depth
  const getJsonDepth = (obj, currentDepth = 0) => {
    if (currentDepth > SECURITY_CONFIG.MAX_DEPTH) return currentDepth;
    if (!obj || typeof obj !== 'object') return currentDepth;
    
    let maxDepth = currentDepth;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const depth = getJsonDepth(obj[key], currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    }
    return maxDepth;
  };

  // Sanitize strings
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/[\x00-\x1F\x7F-\x9F]/g, '')
              .replace(/[<>]/g, '')
              .slice(0, 1000);
  };

  // Recursively sanitize JSON data
  const sanitizeJsonData = (obj) => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj === 'string') return sanitizeString(obj);
    if (typeof obj === 'number') return isFinite(obj) ? obj : 0;
    if (typeof obj === 'boolean') return obj;
    if (Array.isArray(obj)) return obj.map(item => sanitizeJsonData(item));
    if (typeof obj === 'object') {
      const sanitized = {};
      const keys = Object.keys(obj).slice(0, 1000);
      for (const key of keys) {
        const sanitizedKey = sanitizeString(key);
        sanitized[sanitizedKey] = sanitizeJsonData(obj[key]);
      }
      return sanitized;
    }
    return null;
  };

  // Validate file size and content
  const validateZipFile = async (file) => {
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > SECURITY_CONFIG.MAX_ZIP_SIZE_MB) {
      throw new Error(`ZIP file too large: ${fileSizeMB.toFixed(2)}MB (max: ${SECURITY_CONFIG.MAX_ZIP_SIZE_MB}MB)`);
    }

    if (!SECURITY_CONFIG.ALLOWED_MIME_TYPES.includes(file.type) && !file.name.endsWith('.zip')) {
      throw new Error('Invalid file type. Only ZIP files are allowed.');
    }

    return true;
  };

  // Validate individual JSON content
  const validateJsonContent = (json, filename) => {
    const jsonString = JSON.stringify(json);
    const jsonSizeMB = jsonString.length / (1024 * 1024);
    if (jsonSizeMB > SECURITY_CONFIG.MAX_JSON_SIZE_MB) {
      throw new Error(`${filename}: JSON too large (${jsonSizeMB.toFixed(2)}MB)`);
    }

    const depth = getJsonDepth(json);
    if (depth > SECURITY_CONFIG.MAX_DEPTH) {
      throw new Error(`${filename}: JSON nesting too deep (${depth} > ${SECURITY_CONFIG.MAX_DEPTH})`);
    }

    if (json.start_time !== undefined && typeof json.start_time !== 'number') {
      throw new Error(`${filename}: start_time must be a number`);
    }
    
    if (json.ascension !== undefined && (typeof json.ascension !== 'number' || json.ascension < 0 || json.ascension > 10)) {
      throw new Error(`${filename}: ascension must be between 0 and 10`);
    }

    if (!json.seed) {
      throw new Error(`${filename}: missing required field 'seed'`);
    }

    return true;
  };

  // Parse ZIP file with security checks
  const handleZipUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const clientId = 'anonymous-user';
    if (!checkRateLimit(clientId)) {
      alert('Rate limit exceeded. Please wait before uploading more files.');
      return;
    }
    
    setFileName(file.name);
    setFilesToUpload([]);
    setErrorDetails(null);
    
    try {
      await validateZipFile(file);
      
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      
      const jsonFiles = [];
      let totalFilesChecked = 0;
      
      for (const [path, zipEntry] of Object.entries(contents.files)) {
        if (zipEntry.dir) continue;
        
        totalFilesChecked++;
        if (totalFilesChecked > SECURITY_CONFIG.MAX_FILES_PER_ZIP) {
          throw new Error(`ZIP contains more than ${SECURITY_CONFIG.MAX_FILES_PER_ZIP} files`);
        }
        
        if (!path.toLowerCase().endsWith('.run')) continue;
        
        try {
          const content = await zipEntry.async('string');
          
          let json;
          try {
            json = JSON.parse(content);
          } catch (e) {
            console.warn(`Failed to parse ${path}: invalid JSON`);
            continue;
          }
          
          await validateJsonContent(json, path);
          const sanitizedJson = sanitizeJsonData(json);
          const runHash = generateRunHash(sanitizedJson);
          const baseName = path.replace(/\.run$/, '').replace(/\\/g, '/').split('/').pop();
          
          jsonFiles.push({
            filename: path,
            baseName: sanitizeString(baseName),
            data: sanitizedJson,
            runHash: runHash,
            seed: sanitizedJson.seed,
            start_time: sanitizedJson.start_time,
            player_id: sanitizedJson.players?.[0]?.id || 1,
            character: sanitizedJson.players?.[0]?.character || null,
            win: sanitizedJson.win || false,
            ascension: sanitizedJson.ascension || 0,
            run_time: sanitizedJson.run_time || null
          });
          
        } catch (parseError) {
          console.warn(`Error processing ${path}:`, parseError.message);
        }
      }
      
      if (jsonFiles.length === 0) {
        alert('No valid .run files found in the ZIP archive');
        setFileName('');
        return;
      }
      
      setFilesToUpload(jsonFiles);
      alert(`Found ${jsonFiles.length} valid .run file(s) in the ZIP archive`);
      
    } catch (error) {
      console.error('Error reading ZIP file:', error);
      alert(`Security check failed: ${error.message}`);
      setFileName('');
    }
  };

  // Check for existing duplicates
  const checkForDuplicates = async (files) => {
    const runHashes = files.map(f => f.runHash);
    
    const { data: existingRuns, error } = await supabase
      .from('game_runs')
      .select('run_hash, title')
      .in('run_hash', runHashes);
    
    if (!error && existingRuns && existingRuns.length > 0) {
      const duplicateHashes = new Set(existingRuns.map(r => r.run_hash));
      return files.filter(f => duplicateHashes.has(f.runHash));
    }
    return [];
  };

  // Store upload session in localStorage
  const storeUploadSession = (files, userId) => {
    const sessionId = generateUploadSessionId();
    const sessionData = {
      sessionId: sessionId,
      userId: userId,
      timestamp: Date.now(),
      formattedTime: new Date().toLocaleString(),
      fileCount: files.length,
      files: files.map(f => ({
        baseName: f.baseName,
        runHash: f.runHash,
        character: f.character,
        win: f.win,
        ascension: f.ascension
      }))
    };
    
    localStorage.setItem(UPLOAD_SESSION_KEY, JSON.stringify(sessionData));
    console.log('Upload session stored:', sessionData);
    
    return sessionData;
  };

  // Upload all files to Supabase
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (filesToUpload.length === 0) {
      alert('Please select a ZIP file containing valid .run files');
      return;
    }

    setUploading(true);
    setErrorDetails(null);
    let successCount = 0;
    let duplicateCount = 0;
    let failCount = 0;
    const errors = [];
    const duplicates = [];
    
    const firstRun = filesToUpload[0]?.data;
    const userId = generateUserId(firstRun);
    
    let existingDuplicates = [];
    existingDuplicates = await checkForDuplicates(filesToUpload);
    if (existingDuplicates.length > 0) {
      console.log(`Found ${existingDuplicates.length} potential duplicate(s) in database`);
    }

    const successfullyUploaded = [];

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      setUploadProgress({ current: i + 1, total: filesToUpload.length });
      
      if (existingDuplicates.some(d => d.runHash === file.runHash)) {
        console.log(`Skipping duplicate: ${file.filename}`);
        duplicateCount++;
        duplicates.push(file.filename);
        continue;
      }
      
      try {
        const runStartTime = file.start_time 
          ? new Date(file.start_time * 1000).toISOString() 
          : null;
        
        const extractedData = {
          run_hash: file.runHash,
          raw_data: file.data,
          user_id_hash: userId,
          upload_session: sessionId, // Add session ID to each run
          created_at: new Date().toISOString()
        };
        
        const { error } = await supabase
          .from('game_runs')
          .insert([extractedData]);

        if (error) {
          if (error.code === '23505') {
            console.log(`Duplicate detected: ${file.filename}`);
            duplicateCount++;
            duplicates.push(file.filename);
          } else {
            console.error(`Supabase error for ${file.filename}:`, error);
            errors.push({ file: file.filename, error: error.message, code: error.code });
            failCount++;
          }
        } else {
          successCount++;
          successfullyUploaded.push(file);
        }
      } catch (error) {
        console.error(`Exception processing ${file.filename}:`, error);
        errors.push({ file: file.filename, error: error.message });
        failCount++;
      }
    }

    // Store upload session information if any files were successfully uploaded
    let sessionData = null;
    if (successCount > 0) {
      sessionData = storeUploadSession(successfullyUploaded, userId);
    }

    setUploading(false);
    setUploadProgress({ current: 0, total: 0 });
    
    let message = `Upload complete!\n`;
    message += `Successfully added: ${successCount}\n`;
    if (duplicateCount > 0) message += `Skipped duplicates: ${duplicateCount}\n`;
    if (failCount > 0) message += `Failed: ${failCount}`;
    
    alert(message);
    
    if (successCount > 0) {
      setFileName('');
      setFilesToUpload([]);
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
      if (onUploadComplete) {
        onUploadComplete(userId, sessionData);
      }
    }
    
    if (errors.length > 0) {
      setErrorDetails(errors);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>☁️ Server Upload (Shared)</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Data is uploaded to the server with automatic duplicate detection
      </p>
      
      {errorDetails && errorDetails.length > 0 && (
        <div style={{ marginBottom: '15px', padding: '10px', background: '#ffebee', borderRadius: '4px', color: '#c62828' }}>
          <strong>Upload Errors:</strong>
          <ul style={{ marginTop: '8px', marginBottom: 0 }}>
            {errorDetails.slice(0, 3).map((err, idx) => (
              <li key={idx} style={{ fontSize: '12px' }}>
                {err.file}: {err.error} {err.code && `(${err.code})`}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            ZIP File (containing .run files):
          </label>
          <input
            type="file"
            accept=".zip"
            onChange={handleZipUpload}
            style={{ width: '100%' }}
            required
          />
          {fileName && (
            <div style={{ marginTop: '10px', padding: '10px', background: '#e8f5e9', borderRadius: '4px' }}>
              <p><strong>Selected:</strong> {fileName}</p>
              <p><strong>Contains:</strong> {filesToUpload.length} valid .run file(s)</p>
              {filesToUpload.length > 0 && (
                <details>
                  <summary style={{ cursor: 'pointer', color: '#646cff', marginTop: '8px' }}>
                    View file details
                  </summary>
                  <div style={{ marginTop: '8px', maxHeight: '200px', overflow: 'auto' }}>
                    {filesToUpload.slice(0, 5).map((file, idx) => (
                      <div key={idx} style={{ fontSize: '11px', fontFamily: 'monospace', padding: '4px 0', borderBottom: '1px solid #ddd' }}>
                        <strong>{file.baseName}</strong>
                        <span style={{ color: '#666', marginLeft: '8px' }}>
                          ({file.character?.replace('CHARACTER.', '') || 'Unknown'} | 
                          {file.win ? '🏆 Win' : '💀 Loss'} | 
                          A{file.ascension})
                        </span>
                      </div>
                    ))}
                    {filesToUpload.length > 5 && (
                      <div style={{ padding: '4px 0', color: '#666' }}>
                        ...and {filesToUpload.length - 5} more files
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
        
        {uploading && (
          <div style={{ marginBottom: '15px' }}>
            <div style={{ background: '#e0e0e0', borderRadius: '4px', overflow: 'hidden', height: '30px' }}>
              <div style={{ 
                background: '#646cff', 
                width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '12px',
                transition: 'width 0.3s'
              }}>
                {uploadProgress.current} / {uploadProgress.total}
              </div>
            </div>
            <p style={{ textAlign: 'center', marginTop: '8px', fontSize: '12px', color: '#666' }}>
              Uploading {uploadProgress.current} of {uploadProgress.total}...
            </p>
          </div>
        )}
        
        <button 
          type="submit" 
          disabled={uploading || filesToUpload.length === 0}
          style={{
            padding: '10px 20px',
            background: '#646cff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: uploading || filesToUpload.length === 0 ? 'not-allowed' : 'pointer',
            width: '100%',
            fontSize: '16px'
          }}
        >
          {uploading ? `Uploading... (${uploadProgress.current}/${uploadProgress.total})` : `Upload ${filesToUpload.length} File(s) to Server`}
        </button>
      </form>
      
      <div style={{ marginTop: '20px', padding: '10px', background: '#f5f5f5', borderRadius: '4px', fontSize: '12px', color: '#666' }}>
        <strong>How it works:</strong>
        <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
          <li>Each run gets a unique hash based on run information</li>
          <li>Duplicate runs are automatically skipped (no duplicate entries)</li>
          <li>Your runs are grouped under a consistent user ID</li>
          <li>Each upload session is tracked for filtering later</li>
          <li>All data is sanitized and validated before upload</li>
        </ul>
      </div>
    </div>
  );
}

export default UploadData;