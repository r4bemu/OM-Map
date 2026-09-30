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

  // Trigger camera on open if no photo
  useEffect(() => {
    if (isOpen) {
      if (!photoData && !isCameraActive) {
        startCamera('user');
      }
    } else {
      stopCameraStream();
      setFormError(null);
    }
  }, [isOpen]);

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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar text-xs">
          
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
                        {/* Anatomically proportional Head, Neck & Shoulders cutout in black */}
                        <path
                          d="
                            M 200,45
                            C 248,45 272,78 272,126
                            C 272,165 254,196 236,214
                            L 236,244
                            C 262,250 302,272 338,300
                            C 366,322 384,356 394,400
                            L 6,400
                            C 16,356 34,322 62,300
                            C 98,272 138,250 164,244
                            L 164,214
                            C 146,196 128,165 128,126
                            C 128,78 152,45 200,45 Z
                          "
                          fill="black"
                        />
                      </mask>
                    </defs>

                    {/* Dark translucent outer mask */}
                    <rect width="400" height="400" fill="rgba(0, 0, 0, 0.42)" mask="url(#head-silhouette-mask)" />

                    {/* Complete Anatomical Head Contour with Defined Chin */}
                    <path
                      d="
                        M 200,45
                        C 248,45 272,78 272,126
                        C 272,168 254,198 234,214
                        C 220,224 210,227 200,227
                        C 190,227 180,224 166,214
                        C 146,198 128,168 128,126
                        C 128,78 152,45 200,45 Z
                      "
                      fill="none"
                      stroke="#009933"
                      strokeWidth="2.5"
                      strokeDasharray="6 4"
                      className="drop-shadow-md"
                    />

                    {/* Natural Neck Contours (under jaw to clavicle) */}
                    <path
                      d="M 164,218 L 164,244"
                      fill="none"
                      stroke="#009933"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                      className="drop-shadow-sm opacity-90"
                    />
                    <path
                      d="M 236,218 L 236,244"
                      fill="none"
                      stroke="#009933"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                      className="drop-shadow-sm opacity-90"
                    />

                    {/* Relaxed Trapezius and Natural Shoulder Arcs to Base */}
                    <path
                      d="
                        M 6,400
                        C 16,356 34,322 62,300
                        C 98,272 138,250 164,244
                        M 236,244
                        C 262,250 302,272 338,300
                        C 366,322 384,356 394,400
                      "
                      fill="none"
                      stroke="#009933"
                      strokeWidth="2.5"
                      strokeDasharray="6 4"
                      className="drop-shadow-md"
                    />

                    {/* Subtle Eye-Level Alignment Guide (Passport / Biometric Standard) */}
                    <line
                      x1="160"
                      y1="130"
                      x2="240"
                      y2="130"
                      stroke="#009933"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                      strokeOpacity="0.7"
                    />
                    <circle cx="200" cy="130" r="2" fill="#009933" fillOpacity="0.8" />
                    {/* Head Center Alignment Tick */}
                    <line
                      x1="200"
                      y1="36"
                      x2="200"
                      y2="50"
                      stroke="#009933"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />

                    {/* Biometric Framing Reticles (Corners) */}
                    <path d="M 25,55 L 25,25 L 55,25" fill="none" stroke="#009933" strokeWidth="3" strokeLinecap="round" />
                    <path d="M 375,55 L 375,25 L 345,25" fill="none" stroke="#009933" strokeWidth="3" strokeLinecap="round" />
                    <path d="M 25,345 L 25,375 L 55,375" fill="none" stroke="#009933" strokeWidth="3" strokeLinecap="round" />
                    <path d="M 375,345 L 375,375 L 345,375" fill="none" stroke="#009933" strokeWidth="3" strokeLinecap="round" />
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
