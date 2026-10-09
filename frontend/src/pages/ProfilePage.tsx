import React, { useState, useEffect } from 'react';
import {
  User,
  Heart,
  Phone,
  Save,
  CheckCircle2,
  X,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { profileAPI } from '../services/api';
import type { HealthProfile } from '../types';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

export const ProfilePage: React.FC = () => {
  const { user, updateUserContext } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('Unknown');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [medicalConditions, setMedicalConditions] = useState<string[]>([]);
  const [medications, setMedications] = useState<string[]>([]);
  const [emergencyContact, setEmergencyContact] = useState({
    name: '',
    relationship: '',
    phone: '',
  });

  // Tag inputs
  const [allergyInput, setAllergyInput] = useState('');
  const [conditionInput, setConditionInput] = useState('');
  const [medicationInput, setMedicationInput] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await profileAPI.getProfile();
        if (res.success && res.profile) {
          const p = res.profile;
          setFullName(p.fullName || user?.name || '');
          setDateOfBirth(p.dateOfBirth || '');
          setGender(p.gender || '');
          setBloodGroup(p.bloodGroup || 'Unknown');
          setAllergies(p.allergies || []);
          setMedicalConditions(p.medicalConditions || []);
          setMedications(p.medications || []);
          setEmergencyContact(
            p.emergencyContact || { name: '', relationship: '', phone: '' }
          );
        }
      } catch {
        setErrorMsg('Failed to load profile data.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleAddAllergy = () => {
    if (allergyInput.trim() && !allergies.includes(allergyInput.trim())) {
      setAllergies([...allergies, allergyInput.trim()]);
      setAllergyInput('');
    }
  };

  const handleRemoveAllergy = (index: number) => {
    setAllergies(allergies.filter((_, idx) => idx !== index));
  };

  const handleAddCondition = () => {
    if (conditionInput.trim() && !medicalConditions.includes(conditionInput.trim())) {
      setMedicalConditions([...medicalConditions, conditionInput.trim()]);
      setConditionInput('');
    }
  };

  const handleRemoveCondition = (index: number) => {
    setMedicalConditions(medicalConditions.filter((_, idx) => idx !== index));
  };

  const handleAddMedication = () => {
    if (medicationInput.trim() && !medications.includes(medicationInput.trim())) {
      setMedications([...medications, medicationInput.trim()]);
      setMedicationInput('');
    }
  };

  const handleRemoveMedication = (index: number) => {
    setMedications(medications.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const payload: Partial<HealthProfile> = {
        fullName: fullName.trim(),
        dateOfBirth,
        gender,
        bloodGroup,
        allergies,
        medicalConditions,
        medications,
        emergencyContact,
      };

      const res = await profileAPI.updateProfile(payload);
      if (res.success) {
        setSuccessMsg('Your health profile has been successfully saved!');
        if (user && fullName.trim() && fullName.trim() !== user.name) {
          updateUserContext({ ...user, name: fullName.trim() });
        }
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to update health profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
        <p className="text-sm text-slate-600 dark:text-slate-400">Loading your health profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 text-xs font-semibold mb-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Confidential Clinical Record</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Personal Health Profile
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Keep your medical attributes, blood group, allergies, and emergency contacts up to date.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-700 dark:text-teal-300 text-sm flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-teal-600 dark:text-teal-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Demographics */}
        <div className="bg-white/85 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 space-y-5 backdrop-blur-md shadow-sm transition-colors duration-200">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <User className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>General Demographics</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                id="profile-fullname-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ashish Sharma"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-1.5">
                Date of Birth
              </label>
              <input
                type="date"
                id="profile-dob-input"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-1.5">
                Gender
              </label>
              <select
                id="profile-gender-select"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              >
                <option value="">Select Gender</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-1.5">
                Blood Group
              </label>
              <select
                id="profile-bloodgroup-select"
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 font-mono"
              >
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Clinical Details (Allergies, Conditions, Medications) */}
        <div className="bg-white/85 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 space-y-6 backdrop-blur-md shadow-sm transition-colors duration-200">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <Heart className="w-4 h-4 text-rose-500 dark:text-rose-400" />
            <span>Clinical History &amp; Sensitivities</span>
          </h2>

          {/* Allergies */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400">
              Known Allergies (Food, Drug, Environmental)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="profile-allergy-input"
                value={allergyInput}
                onChange={(e) => setAllergyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAllergy();
                  }
                }}
                placeholder="e.g. Penicillin, Peanuts, Pollen"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
              <button
                type="button"
                onClick={handleAddAllergy}
                id="profile-add-allergy-btn"
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-teal-700 dark:text-teal-300 text-xs font-semibold border border-slate-300 dark:border-slate-700 transition-colors"
              >
                Add Tag
              </button>
            </div>
            {allergies.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {allergies.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 text-xs font-medium"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAllergy(idx)}
                      className="hover:text-rose-900 dark:hover:text-rose-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Medical Conditions */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400">
              Chronic or Diagnosed Medical Conditions
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="profile-condition-input"
                value={conditionInput}
                onChange={(e) => setConditionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCondition();
                  }
                }}
                placeholder="e.g. Hypertension, Type 2 Diabetes, Asthma"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
              <button
                type="button"
                onClick={handleAddCondition}
                id="profile-add-condition-btn"
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-teal-700 dark:text-teal-300 text-xs font-semibold border border-slate-300 dark:border-slate-700 transition-colors"
              >
                Add Tag
              </button>
            </div>
            {medicalConditions.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {medicalConditions.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-xs font-medium"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCondition(idx)}
                      className="hover:text-amber-900 dark:hover:text-amber-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Medications */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400">
              Ongoing Medications
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="profile-medication-input"
                value={medicationInput}
                onChange={(e) => setMedicationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddMedication();
                  }
                }}
                placeholder="e.g. Metformin 500mg, Lisinopril 10mg daily"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
              <button
                type="button"
                onClick={handleAddMedication}
                id="profile-add-medication-btn"
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-teal-700 dark:text-teal-300 text-xs font-semibold border border-slate-300 dark:border-slate-700 transition-colors"
              >
                Add Tag
              </button>
            </div>
            {medications.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {medications.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 text-xs font-medium"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMedication(idx)}
                      className="hover:text-teal-900 dark:hover:text-teal-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Emergency Contact */}
        <div className="bg-white/85 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 space-y-5 backdrop-blur-md shadow-sm transition-colors duration-200">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <Phone className="w-4 h-4 text-amber-500" />
            <span>Emergency Contact Person</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-1.5">
                Contact Name
              </label>
              <input
                type="text"
                id="profile-emergency-name"
                value={emergencyContact.name}
                onChange={(e) =>
                  setEmergencyContact({ ...emergencyContact, name: e.target.value })
                }
                placeholder="Ramesh Sharma"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-1.5">
                Relationship
              </label>
              <input
                type="text"
                id="profile-emergency-rel"
                value={emergencyContact.relationship}
                onChange={(e) =>
                  setEmergencyContact({ ...emergencyContact, relationship: e.target.value })
                }
                placeholder="Parent / Spouse / Sibling"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                id="profile-emergency-phone"
                value={emergencyContact.phone}
                onChange={(e) =>
                  setEmergencyContact({ ...emergencyContact, phone: e.target.value })
                }
                placeholder="+91 98765 43210"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Save CTA */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            id="profile-save-btn"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 hover:from-teal-400 hover:to-emerald-400 shadow-lg shadow-teal-500/25 transition-all transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Profile...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Health Profile</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
