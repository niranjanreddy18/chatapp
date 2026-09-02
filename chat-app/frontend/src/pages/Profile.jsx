import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Camera, Trash2, User, Mail, Sparkles, FileText, Check, LoaderCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../components/layout/MainLayout';
import { useAuth } from '../context/AuthContext';
import { getProfile, updateProfile } from '../services/profile';
import Avatar from '../components/common/Avatar';
import Button from '../components/common/Button';

function Profile() {
  const navigate = useNavigate();
  const { user, updateUser, refreshAuthState } = useAuth();

  // Form states
  const [username, setUsername] = useState(user?.username || '');
  const [statusMessage, setStatusMessage] = useState(user?.status_message || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [email, setEmail] = useState(user?.email || '');

  // Avatar state
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const fileInputRef = useRef(null);

  // Status flags
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');

  // Fetch latest profile from backend on mount
  useEffect(() => {
    let isMounted = true;
    async function loadLatestProfile() {
      try {
        setLoadingProfile(true);
        const res = await getProfile();
        if (isMounted && res?.data) {
          const profileData = res.data;
          setUsername(profileData.username || '');
          setStatusMessage(profileData.status_message || '');
          setBio(profileData.bio || '');
          setEmail(profileData.email || '');
          // Sync with AuthContext user
          updateUser(profileData);
        }
      } catch {
        // Fallback to existing auth user state if offline
        if (isMounted && user) {
          setUsername(user.username || '');
          setStatusMessage(user.status_message || '');
          setBio(user.bio || '');
          setEmail(user.email || '');
        }
      } finally {
        if (isMounted) setLoadingProfile(false);
      }
    }

    loadLatestProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  // Cleanup object URL preview on unmount or change
  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  // Handle avatar selection
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate format
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setErrors((prev) => ({
        ...prev,
        avatar: 'Unsupported file format. Please upload a JPG, PNG, or WEBP image.',
      }));
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        avatar: 'Image file size is too large. Maximum allowed size is 5MB.',
      }));
      return;
    }

    // Clear avatar error
    setErrors((prev) => {
      const next = { ...prev };
      delete next.avatar;
      return next;
    });

    setAvatarFile(file);
    setRemoveAvatar(false);
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    if (avatarPreview && avatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarPreview(null);
    setRemoveAvatar(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Determine which avatar source to display in preview
  const currentAvatarSrc = removeAvatar
    ? null
    : avatarPreview || user?.avatar || null;

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');
    const newErrors = {};

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      newErrors.username = 'Username cannot be empty.';
    } else if (cleanUsername.length > 150) {
      newErrors.username = 'Username must be 150 characters or fewer.';
    }

    if (statusMessage.length > 100) {
      newErrors.status_message = 'Status message must be 100 characters or fewer.';
    }

    if (bio.length > 300) {
      newErrors.bio = 'About/Bio must be 300 characters or fewer.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSaving(true);

    try {
      const formData = new FormData();
      formData.append('username', cleanUsername);
      formData.append('status_message', statusMessage.trim());
      formData.append('bio', bio.trim());

      if (avatarFile) {
        formData.append('avatar', avatarFile);
      } else if (removeAvatar) {
        formData.append('avatar', '');
      }

      const response = await updateProfile(formData);

      if (response?.success) {
        const updatedData = response.data;
        // Update global user context immediately
        updateUser(updatedData);
        // Refresh server auth state
        await refreshAuthState();

        // Reset file staging state
        setAvatarFile(null);
        setRemoveAvatar(false);
        setAvatarPreview(null);

        toast.success('Profile updated successfully!');
        // Navigate back to settings
        navigate('/settings');
      } else {
        setGeneralError(response?.message || 'Failed to update profile.');
      }
    } catch (err) {
      const respData = err?.response?.data;
      if (respData?.errors) {
        const backendErrors = {};
        for (const [key, val] of Object.entries(respData.errors)) {
          backendErrors[key] = Array.isArray(val) ? val.join(' ') : String(val);
        }
        setErrors(backendErrors);
        setGeneralError(respData.message || 'Please fix the errors below and try again.');
      } else if (respData?.message) {
        setGeneralError(respData.message);
      } else {
        setGeneralError('An unexpected network error occurred while saving your profile.');
      }
      toast.error('Failed to save profile changes.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="flex h-full w-full flex-col bg-[#EDECEC] dark:bg-slate-950 overflow-y-auto p-4 sm:p-8 lg:p-10 transition-colors">
        <div className="max-w-2xl mx-auto w-full space-y-6 pb-12 animate-[fadeIn_150ms_ease-out]">
          {/* Header */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/settings')}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm border border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Back to settings"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Edit Profile</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Update your identity, profile picture, and workspace presence.
              </p>
            </div>
          </div>

          {/* General Error Alert */}
          {generalError && (
            <div className="flex items-start gap-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-4 text-rose-800 dark:text-rose-200 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div className="flex-1">
                <p className="font-semibold text-xs uppercase tracking-wider text-rose-700 dark:text-rose-300">Profile Update Error</p>
                <p className="mt-0.5 text-xs">{generalError}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Avatar Section Card */}
            <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 transition-colors">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">
                Profile Picture
              </h2>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative group">
                  <Avatar
                    name={username || user?.username || 'User'}
                    src={currentAvatarSrc}
                    size="3xl"
                    className="shadow-md ring-4 ring-slate-100 dark:ring-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-slate-950/60 text-white opacity-0 group-hover:opacity-100 transition duration-200 cursor-pointer backdrop-blur-[2px]"
                    title="Upload new photo"
                    aria-label="Upload photo"
                  >
                    <Camera size={22} />
                    <span className="text-[10px] font-medium mt-1">Change</span>
                  </button>
                </div>

                <div className="flex-1 text-center sm:text-left space-y-2">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      onChange={handleAvatarChange}
                      className="hidden"
                      id="avatar-file-input"
                    />
                    <label
                      htmlFor="avatar-file-input"
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-semibold shadow-sm transition cursor-pointer"
                    >
                      <Camera size={14} />
                      Choose Photo
                    </label>

                    {(currentAvatarSrc || avatarFile) && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-600 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 px-3.5 py-2 text-xs font-semibold transition"
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Supports JPG, PNG, or WEBP (Max 5MB). Square images recommended.
                  </p>
                  {errors.avatar && (
                    <p className="text-xs font-medium text-rose-500">{errors.avatar}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Details Card */}
            <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-5 transition-colors">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Personal Information
              </h2>

              {/* Username / Display Name */}
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <User size={14} className="text-slate-400" />
                    Username
                    <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[11px] font-normal text-slate-400">
                    {username.length} / 150
                  </span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errors.username) {
                      setErrors((prev) => ({ ...prev, username: '' }));
                    }
                  }}
                  maxLength={150}
                  placeholder="Enter your username"
                  className={`w-full rounded-2xl border bg-slate-50/60 dark:bg-slate-800/80 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition ${
                    errors.username
                      ? 'border-rose-400 dark:border-rose-500'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                  required
                />
                {errors.username && (
                  <p className="text-xs font-medium text-rose-500">{errors.username}</p>
                )}
              </div>

              {/* Status Message */}
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-slate-400" />
                    Status Message
                  </span>
                  <span className="text-[11px] font-normal text-slate-400">
                    {statusMessage.length} / 100
                  </span>
                </label>
                <input
                  type="text"
                  value={statusMessage}
                  onChange={(e) => {
                    setStatusMessage(e.target.value);
                    if (errors.status_message) {
                      setErrors((prev) => ({ ...prev, status_message: '' }));
                    }
                  }}
                  maxLength={100}
                  placeholder="e.g. Available, In a meeting, Traveling..."
                  className={`w-full rounded-2xl border bg-slate-50/60 dark:bg-slate-800/80 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition ${
                    errors.status_message
                      ? 'border-rose-400 dark:border-rose-500'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
                {errors.status_message && (
                  <p className="text-xs font-medium text-rose-500">{errors.status_message}</p>
                )}
              </div>

              {/* About / Bio */}
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <FileText size={14} className="text-slate-400" />
                    About / Bio
                  </span>
                  <span className="text-[11px] font-normal text-slate-400">
                    {bio.length} / 300
                  </span>
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => {
                    setBio(e.target.value);
                    if (errors.bio) {
                      setErrors((prev) => ({ ...prev, bio: '' }));
                    }
                  }}
                  rows={3}
                  maxLength={300}
                  placeholder="Tell your workspace team about your role, skills, or interests..."
                  className={`w-full rounded-2xl border bg-slate-50/60 dark:bg-slate-800/80 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition resize-none ${
                    errors.bio
                      ? 'border-rose-400 dark:border-rose-500'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
                {errors.bio && (
                  <p className="text-xs font-medium text-rose-500">{errors.bio}</p>
                )}
              </div>

              {/* Email (Read-Only) */}
              <div className="space-y-1.5 pt-1">
                <label className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Mail size={14} className="text-slate-400" />
                    Email Address
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    Account Email (Read-only)
                  </span>
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/40 px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/settings')}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-2xl text-xs font-semibold"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="primary"
                disabled={isSaving || loadingProfile}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                {isSaving ? (
                  <>
                    <LoaderCircle size={15} className="animate-spin" />
                    <span>Saving changes...</span>
                  </>
                ) : (
                  <>
                    <Check size={15} />
                    <span>Save Changes</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </MainLayout>
  );
}

export default Profile;
