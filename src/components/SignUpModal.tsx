import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  X, 
  ShieldCheck, 
  ArrowRight, 
  AlertCircle, 
  Camera, 
  RotateCcw, 
  SwitchCamera, 
  Upload, 
  CheckCircle2, 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  Mail, 
  Phone, 
  Building2, 
  Briefcase 
} from 'lucide-react';
import { AccessRequest, AuthUser } from '../types';
import { ALL_OFFICES } from './GoogleProfileSetupModal';

interface SignUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitRequest: (requestData: Partial<AccessRequest>) => void;
  isLight: boolean;
  existingUsers?: AuthUser[];
  existingRequests?: AccessRequest[];
}

export const SignUpModal: React.FC<SignUpModalProps> = ({
  isOpen,
  onClose,
  onSubmitRequest,
  isLight,
  existingUsers = [],
  existingRequests = []
}) => {
  // Credentials
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Profile Picture state
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  // Personnel Information
  const [firstName, setFirstName] = useState('');
  const [middleInitial, setMiddleInitial] = useState('');
  const [lastName, setLastName] = useState('');
  const [extensionName, setExtensionName] = useState('');
  const [email, setEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [designation, setDesignation] = useState('');
  const [selectedOffice, setSelectedOffice] = useState<string>('');

  // Submission error
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Camera Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera tracks cleanly
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (_) {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Start front camera (or specified facing mode) with robust tiered fallbacks
  const startCamera = useCallback(async (mode: 'user' | 'environment' = facingMode) => {
    setCameraError(null);
    stopCameraStream();

    // Check secure context
    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setCameraError('Live browser webcam requires a secure connection (HTTPS or localhost). Tap "Snap with Phone Camera / Upload" below to take your photo.');
      setIsCameraActive(false);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API is not supported on this browser. Tap "Snap with Phone Camera / Upload" below to take your portrait.');
      setIsCameraActive(false);
      return;
    }

    try {
      // Check for available video devices to see if switching is supported
      if (navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter(d => d.kind === 'videoinput');
          setHasMultipleCameras(videoInputs.length > 1);
        } catch (_) {}
      }

      let mediaStream: MediaStream | null = null;

      // Tier 1: Try requested facing mode with ideal resolution
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (err1) {
        console.warn('Tier 1 camera constraints failed, trying Tier 2 (basic facingMode)...', err1);
      }

      // Tier 2: Try basic facing mode without dimension constraints
      if (!mediaStream) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: mode },
            audio: false
          });
        } catch (err2) {
          console.warn('Tier 2 camera constraints failed, trying Tier 3 (any video)...', err2);
        }
      }

      // Tier 3: Try any available video track
      if (!mediaStream) {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.muted = true;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Camera video play error:', playErr);
        }
      }

      setIsCameraActive(true);
      setFacingMode(mode);
    } catch (err: any) {
      console.warn('Camera initialization error:', err);
      let msg = 'Could not access front camera. Tap "Snap with Phone Camera / Upload" below to take your portrait.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission denied. Please allow camera permissions in your browser or tap "Snap with Phone Camera / Upload".';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera found on this device. Tap "Snap with Phone Camera / Upload" below.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Camera is currently in use by another application. Please close other camera apps and retry.';
      }
      setCameraError(msg);
      setIsCameraActive(false);
    }
  }, [facingMode, stopCameraStream]);

  // Keep stream bound to video element whenever isCameraActive is toggled
  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(err => {
        console.warn('Video auto-play sync warning:', err);
      });
    }
  }, [isCameraActive]);

  // Toggle between front and back camera (especially on mobile)
  const handleToggleCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Capture frame from video with front camera mirroring
  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const vWidth = video.videoWidth;
    const vHeight = video.videoHeight;
    if (!vWidth || !vHeight) {
      setCameraError('Camera stream is still starting up. Please wait 1 second and click Capture again.');
      return;
    }

    setIsCapturing(true);

    try {
      const size = Math.min(vWidth, vHeight);
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        const startX = (vWidth - size) / 2;
        const startY = (vHeight - size) / 2;

        // Mirror horizontal if using front camera (facingMode === 'user')
        if (facingMode === 'user') {
          ctx.translate(480, 0);
          ctx.scale(-1, 1);
        }

        ctx.drawImage(video, startX, startY, size, size, 0, 0, 480, 480);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setPhotoData(dataUrl);
        stopCameraStream();
        setFormError(null);
      }
    } catch (err: any) {
      console.error('Failed to capture frame:', err);
      setCameraError('Failed to capture picture. Please try again or upload a photo.');
    } finally {
      setIsCapturing(false);
    }
  };

  // Fallback: Handle file upload / native mobile camera capture
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        // Resize image to max 480x480 square to keep lightweight
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 480;
          canvas.height = 480;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const size = Math.min(img.width, img.height);
            const startX = (img.width - size) / 2;
            const startY = (img.height - size) / 2;
            ctx.drawImage(img, startX, startY, size, size, 0, 0, 480, 480);
            setPhotoData(canvas.toDataURL('image/jpeg', 0.88));
            stopCameraStream();
            setFormError(null);
          }
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Retake photo
  const handleRetakePhoto = () => {
    setPhotoData(null);
    startCamera(facingMode);
  };

  // Trigger camera on open and ensure all form fields start fresh and empty
  useEffect(() => {
    if (isOpen) {
      // Clear all fields on open
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setFirstName('');
      setMiddleInitial('');
      setLastName('');
      setExtensionName('');
      setEmail('');
      setContactNumber('');
      setDesignation('');
      setSelectedOffice('');
      setPhotoData(null);
      setFormError(null);

      // Thwart delayed browser autofill (e.g. Chrome password manager populating saved credentials)
      const timer = setTimeout(() => {
        setEmail(prev => (prev === 'dev_master' ? '' : prev));
        setPassword(prev => (prev === 'DEV9824X' ? '' : prev));
      }, 80);

      if (!photoData && !isCameraActive) {
        startCamera('user');
      }

      return () => clearTimeout(timer);
    } else {
      stopCameraStream();
      setFormError(null);
    }
  }, [isOpen]);

  // Proactively prevent browser from injecting saved admin/master credentials into sign-up fields
  useEffect(() => {
    if (email === 'dev_master') {
      setEmail('');
    }
  }, [email]);

  useEffect(() => {
    if (password === 'DEV9824X' && !username) {
      setPassword('');
    }
  }, [password, username]);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // Format full name
  const formattedFullName = useMemo(() => {
    const fn = firstName.trim();
    const mi = middleInitial.trim() ? `${middleInitial.trim().replace('.', '')}.` : '';
    const ln = lastName.trim();
    const ext = extensionName.trim() ? `, ${extensionName.trim()}` : '';

    const nameParts = [fn, mi, ln].filter(Boolean).join(' ');
    if (!nameParts) return 'Authorized Personnel';
    return `${nameParts}${ext}`;
  }, [firstName, middleInitial, lastName, extensionName]);

  // Reviewing Authority
  const approvingAuthorityLabel = useMemo(() => {
    if (!selectedOffice) {
      return 'Respective Office Administrator & Developer';
    }
    if (selectedOffice === 'Regional Office IV-B' || selectedOffice === 'All IMOs') {
      return 'Developer & Regional Office Admin (RO Admin / RO Evaluator)';
    }
    const shortName = selectedOffice.replace('Mindoro Oriental-Marinduque-Romblon IMO', 'MOMARO IMO');
    return `${shortName} Admin / Evaluator, RO Admin & Developer`;
  }, [selectedOffice]);

  // Check username uniqueness
  const isUsernameTaken = useMemo(() => {
    if (!username.trim()) return false;
    const clean = username.trim().toLowerCase().replace(/^@/, '');
    const inUsers = existingUsers.some(u => u.username.toLowerCase() === clean);
    const inRequests = existingRequests.some(r => r.username?.toLowerCase() === clean && r.status !== 'rejected');
    return inUsers || inRequests;
  }, [username, existingUsers, existingRequests]);

  // Contact number handler
  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digitsOnly = raw.replace(/\D/g, '').slice(0, 11);
    setContactNumber(digitsOnly);
  };

  // Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // 1. Photo validation
    if (!photoData) {
      setFormError('Profile picture is required. Please capture your portrait with your camera or upload a photo.');
      return;
    }

    // 2. Username validation
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (!cleanUsername || cleanUsername.length < 3) {
      setFormError('Username must be at least 3 characters long.');
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUsername)) {
      setFormError('Username may only contain alphanumeric characters and underscores (e.g. juan_delacruz).');
      return;
    }
    if (isUsernameTaken) {
      setFormError(`The username '@${cleanUsername}' is already taken. Please choose another username.`);
      return;
    }

    // 3. Password validation
    if (!password || password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match. Please re-enter your password.');
      return;
    }

    // 4. Name validation
    if (!firstName.trim()) {
      setFormError('Please enter your First Name.');
      return;
    }
    if (!middleInitial.trim()) {
      setFormError('Please enter your Middle Initial (M.I.).');
      return;
    }
    if (!lastName.trim()) {
      setFormError('Please enter your Last Name.');
      return;
    }

    // 5. Email validation
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setFormError('Please enter a valid official email address.');
      return;
    }

    // 6. Mobile number validation
    if (contactNumber.length < 11 || !contactNumber.startsWith('09')) {
      setFormError('Please enter a valid 11-digit mobile number starting with 09 (e.g. 09123456789).');
      return;
    }

    // 7. Designation validation
    if (!designation.trim()) {
      setFormError('Please enter your official NIA designation.');
      return;
    }

    // 8. Office validation
    if (!selectedOffice) {
      setFormError('Please select your designated NIA office.');
      return;
    }

    setIsSubmitting(true);

    const payload: Partial<AccessRequest> = {
      username: cleanUsername,
      passcode: password,
      password: password,
      avatar: photoData,
      email: cleanEmail,
      firstName: firstName.trim(),
      middleInitial: middleInitial.trim(),
      lastName: lastName.trim(),
      extensionName: extensionName.trim(),
      fullName: formattedFullName,
      contactNumber: contactNumber.trim(),
      designation: designation.trim(),
      requestedOffice: selectedOffice,
      requestedApps: ['Maintenance and Status of Irrigation Facilities'],
      status: 'pending',
      provider: 'local'
    };

    onSubmitRequest(payload);
    setIsSubmitting(false);
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md animate-in fade-in overflow-y-auto ${
      isLight ? 'bg-slate-900/40' : 'bg-black/80'
    }`}>
      <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto transition-colors duration-200 ${
        isLight 
          ? 'bg-white border-slate-300 text-slate-900 shadow-slate-900/15' 
          : 'bg-[#18181b] border-[#3f3f46] text-[#fafafa]'
      }`}>
        
        {/* Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between gap-4 ${
          isLight 
            ? 'border-slate-200 bg-slate-50/90' 
            : 'border-[#3f3f46] bg-[#1f1f23]'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold font-mono text-sm shrink-0 ${
              isLight ? 'bg-emerald-100 text-[#009933] border border-emerald-300' : 'bg-[#009933]/20 text-[#009933] border border-[#009933]/40'
            }`}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className={`text-base sm:text-lg font-bold font-heading tracking-tight ${
                isLight ? 'text-slate-900' : 'text-[#fafafa]'
              }`}>
                Personnel Account Sign-Up &amp; Access Request
              </h2>
              <p className={`text-[11px] truncate ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Set your credentials, capture your profile portrait, and submit your access request.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl border transition cursor-pointer shrink-0 ${
              isLight 
                ? 'border-slate-300 hover:bg-slate-200 text-slate-600' 
                : 'border-[#3f3f46] bg-[#27272a] hover:bg-[#3f3f46] text-zinc-300 hover:text-white'
            }`}
            title="Close Sign-Up Window"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form 
          onSubmit={handleSubmit} 
          autoComplete="off" 
          noValidate 
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar text-xs"
        >
          {/* Browser autofill decoy sink: traps browser password manager attempting to fill saved login credentials */}
          <div 
            style={{ 
              opacity: 0, 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              height: 0, 
              width: 0, 
              zIndex: -1, 
              overflow: 'hidden', 
              pointerEvents: 'none' 
            }} 
            aria-hidden="true"
          >
            <input type="text" name="prevent_autofill_username" tabIndex={-1} autoComplete="off" defaultValue="" />
            <input type="password" name="prevent_autofill_password" tabIndex={-1} autoComplete="new-password" defaultValue="" />
          </div>
          
          {/* Error Message */}
          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* SECTION 1: MANDATORY PROFILE PICTURE WITH HUMAN HEAD SILHOUETTE GUIDE */}
          <div className={`p-4 rounded-2xl border ${
            isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-[#1f1f23] border-[#3f3f46]'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className={`block font-bold uppercase tracking-wider text-xs ${isLight ? 'text-slate-900' : 'text-zinc-100'}`}>
                  Official Profile Picture <span className="text-rose-500">*</span>
                </label>
                <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                  Position your self-portrait inside the head-and-shoulders silhouette. Front camera enabled.
                </p>
              </div>
              {photoData && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Captured
                </span>
              )}
            </div>

            {/* Viewfinder or Captured Preview */}
            <div className="relative w-full max-w-[320px] aspect-square mx-auto rounded-2xl overflow-hidden bg-black border-2 border-emerald-500/40 shadow-inner flex items-center justify-center">
              
              {/* Permanent Live Video Element - Kept in DOM so ref and stream binding never detach */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 w-full h-full object-cover ${
                  facingMode === 'user' ? 'scale-x-[-1]' : ''
                } ${isCameraActive && !photoData ? 'block z-0' : 'hidden'}`}
              />

              {/* Viewfinder State 1: Photo already captured */}
              {photoData ? (
                <div className="relative w-full h-full z-10 animate-in fade-in">
                  <img
                    src={photoData}
                    alt="Captured portrait"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 via-black/50 to-transparent flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleRetakePhoto}
                      className="px-3.5 py-1.5 rounded-xl bg-white/95 hover:bg-white text-slate-900 font-bold text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer active:scale-95"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retake Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-white font-medium text-xs flex items-center gap-1.5 border border-white/20 transition cursor-pointer active:scale-95"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Snap / Upload Other</span>
                    </button>
                  </div>
                </div>
              ) : isCameraActive ? (
                /* Viewfinder State 2: Live Video Stream with Human Head-Shaped Silhouette Overlay */
                <div className="absolute inset-0 w-full h-full z-10 pointer-events-none">
                  {/* HUMAN HEAD-SHAPED SILHOUETTE OVERLAY */}
                  <svg 
                    className="absolute inset-0 w-full h-full select-none pointer-events-none" 
                    viewBox="0 0 400 400" 
                    preserveAspectRatio="xMidYMid slice"
                  >
                    <defs>
                      <mask id="head-silhouette-mask">
                        {/* Base white fills full frame */}
                        <rect width="400" height="400" fill="white" />
                        {/* Anatomically proportional Head cutout based on reference */}
                        <path
                          d="M 200,32 C 210.76,32 223.98,37.42 232.27,40.13 C 240.56,42.84 245.04,45.54 249.74,48.25 C 254.44,50.96 257.39,53.67 260.45,56.38 C 263.51,59.09 265.86,61.79 268.1,64.5 C 270.34,67.21 272.18,69.92 273.89,72.63 C 275.6,75.34 277.04,78.04 278.36,80.75 C 279.68,83.46 280.8,86.17 281.81,88.88 C 282.82,91.59 283.67,94.29 284.4,97 C 285.13,99.71 285.7,102.42 286.19,105.13 C 286.68,107.84 287.04,110.54 287.35,113.25 C 287.67,115.96 287.92,118.67 288.08,121.38 C 288.24,124.09 288.33,126.79 288.33,129.5 C 288.33,132.21 288.25,134.92 288.07,137.63 C 287.89,140.34 287.59,143.04 287.28,145.75 C 286.97,148.46 286.63,151.17 286.19,153.88 C 285.75,156.59 284.95,159.29 284.63,162 C 284.31,164.71 283.48,167.42 284.26,170.13 C 285.04,172.84 287.99,175.54 289.3,178.25 C 290.61,180.96 291.75,183.67 292.11,186.38 C 292.47,189.09 291.88,191.79 291.43,194.5 C 290.98,197.21 290.25,199.92 289.41,202.63 C 288.57,205.34 287.72,208.04 286.41,210.75 C 285.1,213.46 283.85,216.17 281.54,218.88 C 279.23,221.59 275.07,224.29 272.53,227 C 269.99,229.71 267.88,232.42 266.31,235.13 C 264.74,237.84 264.35,240.54 263.13,243.25 C 261.91,245.96 260.6,248.67 258.98,251.38 C 257.37,254.09 255.44,256.79 253.44,259.5 C 251.44,262.21 249.54,264.92 247.01,267.63 C 244.48,270.34 241.66,273.04 238.27,275.75 C 234.89,278.46 231.5,281.43 226.7,283.88 C 221.9,286.33 213.95,289.13 209.5,290.48 C 205.05,291.83 203.17,292 200,292 C 196.83,292 194.95,291.83 190.5,290.48 C 186.05,289.13 178.1,286.33 173.3,283.88 C 168.5,281.43 165.11,278.46 161.73,275.75 C 158.34,273.04 155.52,270.34 152.99,267.63 C 150.46,264.92 148.56,262.21 146.56,259.5 C 144.56,256.79 142.64,254.09 141.02,251.38 C 139.41,248.67 138.09,245.96 136.87,243.25 C 135.65,240.54 135.26,237.84 133.69,235.13 C 132.12,232.42 130.01,229.71 127.47,227 C 124.93,224.29 120.77,221.59 118.46,218.88 C 116.15,216.17 114.9,213.46 113.59,210.75 C 112.28,208.04 111.43,205.34 110.59,202.63 C 109.75,199.92 109.02,197.21 108.57,194.5 C 108.12,191.79 107.53,189.09 107.89,186.38 C 108.25,183.67 109.39,180.96 110.7,178.25 C 112.01,175.54 114.96,172.84 115.74,170.13 C 116.52,167.42 115.69,164.71 115.37,162 C 115.05,159.29 114.25,156.59 113.81,153.88 C 113.37,151.17 113.03,148.46 112.72,145.75 C 112.41,143.04 112.11,140.34 111.93,137.63 C 111.76,134.92 111.67,132.21 111.67,129.5 C 111.67,126.79 111.76,124.09 111.92,121.38 C 112.08,118.67 112.34,115.96 112.65,113.25 C 112.97,110.54 113.32,107.84 113.81,105.13 C 114.3,102.42 114.87,99.71 115.6,97 C 116.33,94.29 117.18,91.59 118.19,88.88 C 119.2,86.17 120.32,83.46 121.64,80.75 C 122.96,78.04 124.4,75.34 126.11,72.63 C 127.82,69.92 129.66,67.21 131.9,64.5 C 134.14,61.79 136.49,59.09 139.55,56.38 C 142.61,53.67 145.56,50.96 150.26,48.25 C 154.96,45.54 159.44,42.84 167.73,40.13 C 176.02,37.42 189.24,32 200,32 Z"
                          fill="black"
                        />
                        {/* Upper Body & Torso cutout based on reference */}
                        <path
                          d="M 0,400 L 0,376.64 C 4.63,374.04 20.57,365.01 27.75,361.06 C 34.92,357.11 37.42,355.65 43.05,352.94 C 48.68,350.23 55.12,347.52 61.53,344.81 C 67.94,342.1 74.81,339.4 81.53,336.69 C 88.25,333.98 95.13,331.27 101.83,328.56 C 108.53,325.85 115.61,323.15 121.76,320.44 C 127.92,317.73 134.37,315.02 138.76,312.31 C 143.15,309.6 146.05,306.9 148.12,304.19 C 150.19,301.48 150.52,298.77 151.19,296.06 C 151.86,293.35 151.92,290.69 152.12,287.94 C 152.32,285.19 152.23,282.91 152.39,279.59 C 152.55,276.27 152.97,269.96 153.08,268.03 L 246.94,268.03 C 247.03,269.96 247.45,276.27 247.61,279.59 C 247.77,282.91 247.68,285.19 247.88,287.94 C 248.08,290.69 248.14,293.35 248.81,296.06 C 249.48,298.77 249.81,301.48 251.88,304.19 C 253.95,306.9 256.85,309.6 261.24,312.31 C 265.63,315.02 272.09,317.73 278.24,320.44 C 284.39,323.15 291.47,325.85 298.17,328.56 C 304.88,331.27 311.75,333.98 318.47,336.69 C 325.19,339.4 332.06,342.1 338.47,344.81 C 344.88,347.52 351.32,350.23 356.95,352.94 C 362.58,355.65 365.07,357.11 372.25,361.06 C 379.43,365.01 395.38,374.04 400,376.64 L 400,400 Z"
                          fill="black"
                        />
                      </mask>
                    </defs>

                    {/* Dark translucent outer mask */}
                    <rect width="400" height="400" fill="rgba(0, 0, 0, 0.42)" mask="url(#head-silhouette-mask)" />

                    {/* Complete Proportional Head Contour (Cranium, Temples, Ears, Jaw, Chin) */}
                    <path
                      d="M 200,32 C 210.76,32 223.98,37.42 232.27,40.13 C 240.56,42.84 245.04,45.54 249.74,48.25 C 254.44,50.96 257.39,53.67 260.45,56.38 C 263.51,59.09 265.86,61.79 268.1,64.5 C 270.34,67.21 272.18,69.92 273.89,72.63 C 275.6,75.34 277.04,78.04 278.36,80.75 C 279.68,83.46 280.8,86.17 281.81,88.88 C 282.82,91.59 283.67,94.29 284.4,97 C 285.13,99.71 285.7,102.42 286.19,105.13 C 286.68,107.84 287.04,110.54 287.35,113.25 C 287.67,115.96 287.92,118.67 288.08,121.38 C 288.24,124.09 288.33,126.79 288.33,129.5 C 288.33,132.21 288.25,134.92 288.07,137.63 C 287.89,140.34 287.59,143.04 287.28,145.75 C 286.97,148.46 286.63,151.17 286.19,153.88 C 285.75,156.59 284.95,159.29 284.63,162 C 284.31,164.71 283.48,167.42 284.26,170.13 C 285.04,172.84 287.99,175.54 289.3,178.25 C 290.61,180.96 291.75,183.67 292.11,186.38 C 292.47,189.09 291.88,191.79 291.43,194.5 C 290.98,197.21 290.25,199.92 289.41,202.63 C 288.57,205.34 287.72,208.04 286.41,210.75 C 285.1,213.46 283.85,216.17 281.54,218.88 C 279.23,221.59 275.07,224.29 272.53,227 C 269.99,229.71 267.88,232.42 266.31,235.13 C 264.74,237.84 264.35,240.54 263.13,243.25 C 261.91,245.96 260.6,248.67 258.98,251.38 C 257.37,254.09 255.44,256.79 253.44,259.5 C 251.44,262.21 249.54,264.92 247.01,267.63 C 244.48,270.34 241.66,273.04 238.27,275.75 C 234.89,278.46 231.5,281.43 226.7,283.88 C 221.9,286.33 213.95,289.13 209.5,290.48 C 205.05,291.83 203.17,292 200,292 C 196.83,292 194.95,291.83 190.5,290.48 C 186.05,289.13 178.1,286.33 173.3,283.88 C 168.5,281.43 165.11,278.46 161.73,275.75 C 158.34,273.04 155.52,270.34 152.99,267.63 C 150.46,264.92 148.56,262.21 146.56,259.5 C 144.56,256.79 142.64,254.09 141.02,251.38 C 139.41,248.67 138.09,245.96 136.87,243.25 C 135.65,240.54 135.26,237.84 133.69,235.13 C 132.12,232.42 130.01,229.71 127.47,227 C 124.93,224.29 120.77,221.59 118.46,218.88 C 116.15,216.17 114.9,213.46 113.59,210.75 C 112.28,208.04 111.43,205.34 110.59,202.63 C 109.75,199.92 109.02,197.21 108.57,194.5 C 108.12,191.79 107.53,189.09 107.89,186.38 C 108.25,183.67 109.39,180.96 110.7,178.25 C 112.01,175.54 114.96,172.84 115.74,170.13 C 116.52,167.42 115.69,164.71 115.37,162 C 115.05,159.29 114.25,156.59 113.81,153.88 C 113.37,151.17 113.03,148.46 112.72,145.75 C 112.41,143.04 112.11,140.34 111.93,137.63 C 111.76,134.92 111.67,132.21 111.67,129.5 C 111.67,126.79 111.76,124.09 111.92,121.38 C 112.08,118.67 112.34,115.96 112.65,113.25 C 112.97,110.54 113.32,107.84 113.81,105.13 C 114.3,102.42 114.87,99.71 115.6,97 C 116.33,94.29 117.18,91.59 118.19,88.88 C 119.2,86.17 120.32,83.46 121.64,80.75 C 122.96,78.04 124.4,75.34 126.11,72.63 C 127.82,69.92 129.66,67.21 131.9,64.5 C 134.14,61.79 136.49,59.09 139.55,56.38 C 142.61,53.67 145.56,50.96 150.26,48.25 C 154.96,45.54 159.44,42.84 167.73,40.13 C 176.02,37.42 189.24,32 200,32 Z"
                      fill="none"
                      stroke="#00C853"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="drop-shadow-md"
                    />

                    {/* Natural Neck Contours flowing into Shoulders (Right) */}
                    <path
                      d="M 246.92,268.03 C 247.03,269.96 247.45,276.27 247.61,279.59 C 247.77,282.91 247.68,285.19 247.88,287.94 C 248.08,290.69 248.14,293.35 248.81,296.06 C 249.48,298.77 249.81,301.48 251.88,304.19 C 253.95,306.9 256.85,309.6 261.24,312.31 C 265.63,315.02 272.09,317.73 278.24,320.44 C 284.39,323.15 291.47,325.85 298.17,328.56 C 304.88,331.27 311.75,333.98 318.47,336.69 C 325.19,339.4 332.06,342.1 338.47,344.81 C 344.88,347.52 351.32,350.23 356.95,352.94 C 362.58,355.65 365.07,357.11 372.25,361.06 C 379.43,365.01 395.38,374.04 400,376.64"
                      fill="none"
                      stroke="#00C853"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="drop-shadow-md"
                    />

                    {/* Natural Neck Contours flowing into Shoulders (Left) */}
                    <path
                      d="M 0,376.64 C 4.63,374.04 20.57,365.01 27.75,361.06 C 34.92,357.11 37.42,355.65 43.05,352.94 C 48.68,350.23 55.12,347.52 61.53,344.81 C 67.94,342.1 74.81,339.4 81.53,336.69 C 88.25,333.98 95.13,331.27 101.83,328.56 C 108.53,325.85 115.61,323.15 121.76,320.44 C 127.92,317.73 134.37,315.02 138.76,312.31 C 143.15,309.6 146.05,306.9 148.12,304.19 C 150.19,301.48 150.52,298.77 151.19,296.06 C 151.86,293.35 151.92,290.69 152.12,287.94 C 152.32,285.19 152.23,282.91 152.39,279.59 C 152.55,276.27 152.97,269.96 153.08,268.03"
                      fill="none"
                      stroke="#00C853"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="drop-shadow-md"
                    />

                    {/* Subtle Eye-Level Alignment Guide (Passport / Biometric Standard) */}
                    <line
                      x1="165"
                      y1="160"
                      x2="235"
                      y2="160"
                      stroke="#00C853"
                      strokeWidth="1.2"
                      strokeDasharray="3 3"
                      strokeOpacity="0.6"
                    />
                    <circle cx="200" cy="160" r="2" fill="#00C853" fillOpacity="0.7" />
                    {/* Head Center Alignment Tick */}
                    <line
                      x1="200"
                      y1="22"
                      x2="200"
                      y2="32"
                      stroke="#00C853"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeOpacity="0.8"
                    />

                    {/* Biometric Framing Reticles (Corners) */}
                    <path d="M 25,55 L 25,25 L 55,25" fill="none" stroke="#00C853" strokeWidth="3" strokeLinecap="round" />
                    <path d="M 375,55 L 375,25 L 345,25" fill="none" stroke="#00C853" strokeWidth="3" strokeLinecap="round" />
                    <path d="M 25,345 L 25,375 L 55,375" fill="none" stroke="#00C853" strokeWidth="3" strokeLinecap="round" />
                    <path d="M 375,345 L 375,375 L 345,375" fill="none" stroke="#00C853" strokeWidth="3" strokeLinecap="round" />
                  </svg>

                  {/* Positioning instruction banner */}
                  <div className="absolute top-2.5 inset-x-0 flex justify-center">
                    <span className="bg-black/75 backdrop-blur-sm text-white text-[10px] font-semibold px-2.5 py-1 rounded-full border border-white/20 shadow">
                      Align face &amp; shoulders in silhouette
                    </span>
                  </div>

                  {/* Camera Control Bar */}
                  <div className="absolute inset-x-0 bottom-2.5 px-3 flex items-center justify-between gap-2 pointer-events-auto">
                    {/* Switch Camera Button (Mobile front/back) */}
                    {hasMultipleCameras || (typeof navigator !== 'undefined' && /mobile|android|iphone|ipad/i.test(navigator.userAgent)) ? (
                      <button
                        type="button"
                        onClick={handleToggleCamera}
                        className="p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 shadow-md transition cursor-pointer active:scale-95"
                        title="Switch between front and back camera"
                      >
                        <SwitchCamera className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="w-9" />
                    )}

                    {/* Capture Shutter Button */}
                    <button
                      type="button"
                      onClick={handleCapturePhoto}
                      disabled={isCapturing}
                      className="px-4 py-2 rounded-full bg-[#009933] hover:bg-[#00802b] text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/50 border border-emerald-400/50 transition cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{isCapturing ? 'Snapping...' : 'Capture Photo'}</span>
                    </button>

                    {/* Native Camera / File upload fallback */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 shadow-md transition cursor-pointer active:scale-95"
                      title="Take photo with phone camera or upload file"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Viewfinder State 3: Camera inactive, blocked, or error state */
                <div className="p-4 text-center space-y-3.5 z-10 w-full">
                  <div className="w-12 h-12 rounded-full bg-zinc-800/80 border border-zinc-700 mx-auto flex items-center justify-center text-zinc-400">
                    <Camera className="w-6 h-6" />
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-relaxed max-w-[260px] mx-auto">
                    {cameraError || 'Allow camera access to align your face inside the silhouette guide, or snap a photo directly using your phone.'}
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => startCamera('user')}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#009933] hover:bg-[#00802b] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/30 transition cursor-pointer active:scale-95"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Start Front Camera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full sm:w-auto px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs flex items-center justify-center gap-1.5 border border-zinc-700 transition cursor-pointer active:scale-95"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Phone Camera / Upload</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Hidden File Input for native mobile camera selfie or upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* SECTION 2: LOGIN CREDENTIALS (USERNAME & PASSWORD) */}
          <div className={`p-4 rounded-2xl border space-y-3.5 ${
            isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-[#1f1f23] border-[#3f3f46]'
          }`}>
            <div>
              <label className={`block font-bold uppercase tracking-wider text-xs ${isLight ? 'text-slate-900' : 'text-zinc-100'}`}>
                Login Credentials <span className="text-rose-500">*</span>
              </label>
              <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Set your username and password for future sign-ins once your request is approved.
              </p>
            </div>

            {/* Username Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={`block text-[11px] font-semibold ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                  Username / User ID <span className="text-rose-500">*</span>
                </label>
                {username.trim() && (
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                    isUsernameTaken 
                      ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' 
                      : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {isUsernameTaken ? 'Username Taken' : 'Username Available'}
                  </span>
                )}
              </div>
              <div className="relative">
                <User className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                  isLight ? 'text-slate-400' : 'text-zinc-400'
                }`} />
                <input
                  type="text"
                  name="signup_new_username"
                  autoComplete="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="e.g. juan_delacruz"
                  className={`w-full rounded-lg pl-9 pr-3 py-2 border font-mono transition focus:outline-none ${
                    isUsernameTaken
                      ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                      : isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-[#009933] focus:ring-1 focus:ring-[#009933]'
                      : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa] focus:border-[#009933] focus:ring-1 focus:ring-[#009933]'
                  }`}
                  required
                />
              </div>
              <p className={`text-[10px] mt-1 ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                3-30 lowercase characters, numbers, and underscores only.
              </p>
            </div>

            {/* Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                  Account Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                    isLight ? 'text-slate-400' : 'text-zinc-400'
                  }`} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="signup_new_password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className={`w-full rounded-lg pl-9 pr-9 py-2 border transition focus:outline-none ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900 focus:border-[#009933] focus:ring-1 focus:ring-[#009933]'
                        : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa] focus:border-[#009933] focus:ring-1 focus:ring-[#009933]'
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                    isLight ? 'text-slate-400' : 'text-zinc-400'
                  }`} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="signup_confirm_password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className={`w-full rounded-lg pl-9 pr-9 py-2 border transition focus:outline-none ${
                      password && confirmPassword && password !== confirmPassword
                        ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                        : isLight
                        ? 'bg-white border-slate-300 text-slate-900 focus:border-[#009933] focus:ring-1 focus:ring-[#009933]'
                        : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa] focus:border-[#009933] focus:ring-1 focus:ring-[#009933]'
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: OFFICIAL PERSONNEL DETAILS (APPLICATION REQUEST FORM FIELDS) */}
          <div className="space-y-4">
            
            {/* Complete Name */}
            <div className="space-y-1.5">
              <label className={`block font-bold uppercase tracking-wider text-xs ${isLight ? 'text-slate-900' : 'text-zinc-100'}`}>
                Complete Name <span className="text-rose-500">*</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-4">
                  <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="signup_reg_first_name"
                    autoComplete="off"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Juan"
                    className={`w-full rounded-lg px-3 py-2 border transition focus:outline-none ${
                      isLight 
                        ? 'bg-white border-slate-300 text-slate-900 focus:border-[#009933] focus:ring-1 focus:ring-[#009933] placeholder-slate-400' 
                        : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa] focus:border-[#009933] focus:ring-1 focus:ring-[#009933] placeholder-zinc-500'
                    }`}
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                    M.I. <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="signup_reg_middle_initial"
                    autoComplete="off"
                    maxLength={4}
                    value={middleInitial}
                    onChange={(e) => setMiddleInitial(e.target.value)}
                    placeholder="e.g. D."
                    className={`w-full rounded-lg px-2.5 py-2 text-center border transition focus:outline-none ${
                      isLight 
                        ? 'bg-white border-slate-300 text-slate-900 focus:border-[#009933] focus:ring-1 focus:ring-[#009933] placeholder-slate-400' 
                        : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa] focus:border-[#009933] focus:ring-1 focus:ring-[#009933] placeholder-zinc-500'
                    }`}
                    required
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="signup_reg_last_name"
                    autoComplete="off"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Dela Cruz"
                    className={`w-full rounded-lg px-3 py-2 border transition focus:outline-none ${
                      isLight 
                        ? 'bg-white border-slate-300 text-slate-900 focus:border-[#009933] focus:ring-1 focus:ring-[#009933] placeholder-slate-400' 
                        : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa] focus:border-[#009933] focus:ring-1 focus:ring-[#009933] placeholder-zinc-500'
                    }`}
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                    Ext. (Opt.)
                  </label>
                  <input
                    type="text"
                    name="signup_reg_extension"
                    autoComplete="off"
                    value={extensionName}
                    onChange={(e) => setExtensionName(e.target.value)}
                    placeholder="Jr., III"
                    className={`w-full rounded-lg px-2 py-2 text-center border transition focus:outline-none ${
                      isLight 
                        ? 'bg-white border-slate-300 text-slate-900 focus:border-[#009933] focus:ring-1 focus:ring-[#009933] placeholder-slate-400' 
                        : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa] focus:border-[#009933] focus:ring-1 focus:ring-[#009933] placeholder-zinc-500'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Official Email Address */}
            <div className="space-y-1.5">
              <label className={`block font-bold uppercase tracking-wider text-xs ${isLight ? 'text-slate-900' : 'text-zinc-100'}`}>
                Official Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                  isLight ? 'text-slate-400' : 'text-zinc-400'
                }`} />
                <input
                  type="email"
                  name="signup_reg_official_email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. juan.delacruz.nia@gmail.com"
                  className={`w-full rounded-lg pl-9 pr-3 py-2 border transition focus:outline-none ${
                    isLight 
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-[#009933] focus:ring-1 focus:ring-[#009933] placeholder-slate-400' 
                      : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa] focus:border-[#009933] focus:ring-1 focus:ring-[#009933] placeholder-zinc-500'
                  }`}
                  required
                />
              </div>
            </div>

            {/* Official Mobile Number */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className={`font-bold uppercase tracking-wider text-xs ${isLight ? 'text-slate-900' : 'text-zinc-100'}`}>
                  Official Mobile Number <span className="text-rose-500">*</span>
                </label>
                <span className={`text-[10.5px] font-mono font-semibold px-2 py-0.5 rounded border ${
                  contactNumber.length === 11 && contactNumber.startsWith('09')
                    ? (isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50')
                    : (isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-[#27272a] text-zinc-400 border-[#3f3f46]')
                }`}>
                  {contactNumber.length}/11 Digits
                </span>
              </div>

              <div className="relative">
                <Phone className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                  isLight ? 'text-slate-400' : 'text-zinc-400'
                }`} />
                <input
                  type="text"
                  name="signup_reg_mobile_number"
                  autoComplete="off"
                  inputMode="numeric"
                  maxLength={11}
                  value={contactNumber}
                  onChange={handleContactChange}
                  placeholder="09123456789"
                  className={`w-full rounded-lg pl-9 pr-3 py-2 border font-mono text-sm tracking-wider transition focus:outline-none ${
                    isLight 
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-[#009933] focus:ring-1 focus:ring-[#009933] placeholder-slate-400' 
                      : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa] focus:border-[#009933] focus:ring-1 focus:ring-[#009933] placeholder-zinc-500'
                  }`}
                  required
                />
              </div>
              <p className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Format: 11 digits starting with 09 (e.g. 09123456789).
              </p>
            </div>

            {/* Official Designation */}
            <div className="space-y-1.5">
              <label className={`block font-bold uppercase tracking-wider text-xs ${isLight ? 'text-slate-900' : 'text-zinc-100'}`}>
                Official NIA Designation <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Briefcase className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                  isLight ? 'text-slate-400' : 'text-zinc-400'
                }`} />
                <input
                  type="text"
                  name="signup_reg_designation"
                  autoComplete="off"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Senior Irrigation Engineer, Principal Engineer A, Water Resource Inspector"
                  className={`w-full rounded-lg pl-9 pr-3 py-2 border transition focus:outline-none ${
                    isLight 
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-[#009933] focus:ring-1 focus:ring-[#009933] placeholder-slate-400' 
                      : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa] focus:border-[#009933] focus:ring-1 focus:ring-[#009933] placeholder-zinc-500'
                  }`}
                  required
                />
              </div>
            </div>

            {/* Designated NIA Office */}
            <div className="space-y-1.5">
              <label className={`block font-bold uppercase tracking-wider text-xs ${isLight ? 'text-slate-900' : 'text-zinc-100'}`}>
                Designated NIA Office <span className="text-rose-500">*</span>
              </label>

              <div className="relative">
                <Building2 className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                  isLight ? 'text-slate-400' : 'text-zinc-400'
                }`} />
                <select
                  value={selectedOffice}
                  onChange={(e) => setSelectedOffice(e.target.value)}
                  required
                  className={`w-full rounded-lg pl-9 pr-3 py-2 border transition focus:outline-none font-medium ${
                    isLight 
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-[#009933] focus:ring-1 focus:ring-[#009933]' 
                      : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa] focus:border-[#009933] focus:ring-1 focus:ring-[#009933]'
                  }`}
                >
                  <option value="" disabled className={isLight ? 'bg-white text-slate-500' : 'bg-[#27272a] text-zinc-500'}>
                    -- Select Your Designated NIA Office * --
                  </option>
                  {ALL_OFFICES.map((off) => (
                    <option 
                      key={off.value} 
                      value={off.value}
                      className={isLight ? 'bg-white text-slate-900' : 'bg-[#27272a] text-[#fafafa]'}
                    >
                      {off.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Institutional Jurisdiction Notice */}
            <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 mt-2 ${
              isLight 
                ? 'bg-amber-50/90 border-amber-300 text-amber-950' 
                : 'bg-amber-950/25 border-amber-500/40 text-amber-200'
            }`}>
              <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} />
              <div className="leading-relaxed">
                <span className={`font-bold ${isLight ? 'text-amber-900' : 'text-amber-300'}`}>Administrative Verification &amp; Next Login:</span>
                <p className={`text-[11px] mt-0.5 ${isLight ? 'text-amber-950/90' : 'text-zinc-300'}`}>
                  Submitting this form submits your official access request to <strong className={`underline font-semibold ${isLight ? 'text-amber-950' : 'text-amber-300'}`}>{approvingAuthorityLabel}</strong>. Once approved, you can immediately sign in using your chosen <strong>Username</strong> and <strong>Password</strong>.
                </p>
              </div>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2.5 rounded-xl border font-semibold transition cursor-pointer ${
                isLight 
                  ? 'border-slate-300 text-slate-700 hover:bg-slate-100' 
                  : 'border-[#3f3f46] bg-[#27272a] text-zinc-300 hover:bg-[#3f3f46] hover:text-white'
              }`}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-[#009933] hover:bg-[#00802b] text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-emerald-950/20 transition flex items-center justify-center gap-2 cursor-pointer border border-[#00802b]/60 disabled:opacity-50 active:scale-[0.99]"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting Registration...' : 'Submit Profile & Request Access'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
